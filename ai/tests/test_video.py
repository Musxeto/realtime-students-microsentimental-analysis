import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO


SCRIPT_DIR = Path(__file__).resolve().parent
AI_DIR = Path(__file__).resolve().parents[1]
DEFAULT_PERSON_MODEL = AI_DIR / "yolo11n.onnx"
DEFAULT_BEHAVIOR_MODEL = AI_DIR / "fyp_runs" / "classroom_model_v2" / "weights" / "best.onnx"
DEFAULT_BEHAVIOR_IMGSZ = 416
DEFAULT_DETECT_INTERVAL = 8
DEFAULT_CLASSIFY_INTERVAL = 10


def resolve_person_model(ai_dir: Path) -> Path:
    preferred = ai_dir / "yolo11n.onnx"
    if preferred.exists():
        return preferred

    fallback = ai_dir / "yolo11n.pt"
    if fallback.exists():
        return fallback

    raise FileNotFoundError(f"Person model not found at {preferred} or {fallback}")


def resolve_behavior_model(ai_dir: Path) -> Path:
    preferred = ai_dir / "fyp_runs" / "classroom_model_v2" / "weights" / "best.onnx"
    if preferred.exists():
        return preferred

    preferred_pt = ai_dir / "fyp_runs" / "classroom_model_v2" / "weights" / "best.pt"
    if preferred_pt.exists():
        return preferred_pt

    for ext in ("best.onnx", "best.pt"):
        for p in (ai_dir / "fyp_runs").rglob(ext):
            return p

    raise FileNotFoundError(f"Behavior model not found under {ai_dir / 'fyp_runs'}")


def resolve_video_path(ai_dir: Path, user_path: str | None, script_dir: Path) -> Path:
    if user_path:
        p = Path(user_path)
        if p.exists():
            return p
        raise FileNotFoundError(f"Video path does not exist: {p}")

    default_candidates = [
        script_dir / "test_video.mp4",
        ai_dir / "test_video.mp4",
    ]
    for p in default_candidates:
        if p.exists():
            return p

    for ext in ("*.mp4", "*.mov", "*.avi", "*.mkv"):
        for candidate in ai_dir.rglob(ext):
            if candidate.is_file():
                return candidate

    raise FileNotFoundError("No video found. Provide a video path argument.")


def clip_box(x1, y1, x2, y2, w, h):
    x1 = max(0, min(int(x1), w - 1))
    y1 = max(0, min(int(y1), h - 1))
    x2 = max(0, min(int(x2), w - 1))
    y2 = max(0, min(int(y2), h - 1))
    return x1, y1, x2, y2


def class_color(label: str):
    palette = [
        (255, 99, 71),
        (60, 179, 113),
        (30, 144, 255),
        (255, 215, 0),
        (186, 85, 211),
        (255, 140, 0),
        (0, 206, 209),
        (220, 20, 60),
        (50, 205, 50),
        (255, 105, 180),
    ]
    idx = sum(ord(ch) for ch in label) % len(palette)
    return palette[idx]


def iou_xyxy(a, b) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    iw = max(0.0, ix2 - ix1)
    ih = max(0.0, iy2 - iy1)
    inter = iw * ih
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return 0.0 if union <= 0 else inter / union


def find_best_previous_match(box: list[int], previous: list[dict], iou_thr: float = 0.55):
    best = None
    best_iou = 0.0
    for det in previous:
        iou = iou_xyxy(box, det["box"])
        if iou > best_iou:
            best_iou = iou
            best = det
    if best is not None and best_iou >= iou_thr:
        return best
    return None


def nms_person(dets: list[tuple[float, float, float, float, float]], thr: float = 0.45):
    if not dets:
        return []
    dets = sorted(dets, key=lambda x: x[4], reverse=True)
    kept = []
    while dets:
        cur = dets.pop(0)
        kept.append(cur)
        nxt = []
        for d in dets:
            if iou_xyxy(cur[:4], d[:4]) > thr:
                continue
            nxt.append(d)
        dets = nxt
    return kept


def merge_vertical_fragments(raw_boxes: list[list[int]], x_margin: int = 30):
    merged_boxes = []
    while raw_boxes:
        base_box = raw_boxes.pop(0)
        bx1, by1, bx2, by2 = base_box

        boxes_to_remove = []
        for compare_box in raw_boxes:
            cx1, cy1, cx2, cy2 = compare_box
            if abs(bx1 - cx1) < x_margin and abs(bx2 - cx2) < x_margin:
                bx1 = min(bx1, cx1)
                by1 = min(by1, cy1)
                bx2 = max(bx2, cx2)
                by2 = max(by2, cy2)
                boxes_to_remove.append(compare_box)

        for box in boxes_to_remove:
            raw_boxes.remove(box)

        merged_boxes.append([bx1, by1, bx2, by2])

    return merged_boxes


def run_stage1(person_finder: YOLO, frame: np.ndarray, person_conf: float, imgsz: int, max_det: int):
    results = person_finder.predict(
        frame,
        classes=[0],
        conf=person_conf,
        iou=0.3,
        imgsz=imgsz,
        max_det=max_det,
        verbose=False,
    )

    raw_boxes: list[list[int]] = []
    if results and results[0].boxes is not None and len(results[0].boxes) > 0:
        for box in results[0].boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            raw_boxes.append([x1, y1, x2, y2])

    raw_count = len(raw_boxes)
    return merge_vertical_fragments(raw_boxes), raw_count


def run_stage2(
    behavior_classifier: YOLO,
    frame: np.ndarray,
    merged_boxes: list[list[int]],
    behavior_conf: float,
    behavior_imgsz: int,
    frame_index: int,
    classify_interval: int,
    previous_detections: list[dict] | None = None,
):
    h, w = frame.shape[:2]
    detections = []
    batched_crops = []
    batched_meta = []
    runtime_behavior_imgsz = behavior_imgsz
    previous_detections = previous_detections or []

    for idx, (x1, y1, x2, y2) in enumerate(merged_boxes, start=1):
        x1, y1, x2, y2 = clip_box(x1, y1, x2, y2, w, h)
        if x2 <= x1 or y2 <= y1:
            continue

        pad = 20
        px1 = max(0, x1 - pad)
        py1 = max(0, y1 - pad)
        px2 = min(w, x2 + pad)
        py2 = min(h, y2 + pad)

        person_crop = frame[py1:py2, px1:px2]
        if person_crop.size == 0 or person_crop.shape[0] < 12 or person_crop.shape[1] < 12:
            detections.append(
                {
                    "person_index": idx,
                    "box": [x1, y1, x2, y2],
                    "label": "unknown",
                    "confidence": 0.0,
                    "status": "crop_too_small",
                }
            )
            continue

        can_reuse = classify_interval > 1 and (frame_index % classify_interval != 0)
        if can_reuse:
            prev = find_best_previous_match([x1, y1, x2, y2], previous_detections, iou_thr=0.55)
            if prev is not None and prev.get("label") != "unknown":
                detections.append(
                    {
                        "person_index": idx,
                        "box": [x1, y1, x2, y2],
                        "label": prev.get("label", "unknown"),
                        "confidence": float(prev.get("confidence", 0.0)),
                        "status": "cached",
                    }
                )
                continue

        batched_crops.append(person_crop)
        batched_meta.append((idx, x1, y1, x2, y2))

    if not batched_crops:
        return detections

    behavior_pairs: list[tuple[tuple[int, int, int, int, int], object]] = []

    def _predict_behavior(source):
        nonlocal runtime_behavior_imgsz
        try:
            return behavior_classifier.predict(
                source,
                conf=behavior_conf,
                iou=0.5,
                imgsz=runtime_behavior_imgsz,
                max_det=20,
                verbose=False,
            )
        except Exception as exc:
            msg = str(exc)

            # Fixed-batch ONNX models fail on list input (batch > 1). Let caller fallback to per-crop inference.
            if isinstance(source, list) and "index: 0" in msg and "Expected: 1" in msg:
                raise

            # Fixed-shape ONNX models can require a specific spatial size. Auto-adjust imgsz from error text.
            if "INVALID_ARGUMENT" in msg and "Expected:" in msg:
                match = re.search(r"index:\s*[23]\s*Got:\s*\d+\s*Expected:\s*(\d+)", msg)
                if match:
                    runtime_behavior_imgsz = int(match.group(1))
                return behavior_classifier.predict(
                    source,
                    conf=behavior_conf,
                    iou=0.5,
                    imgsz=runtime_behavior_imgsz,
                    max_det=20,
                    verbose=False,
                )

            # Last fallback: try model defaults without explicit imgsz.
            if "INVALID_ARGUMENT" in msg:
                return behavior_classifier.predict(
                    source,
                    conf=behavior_conf,
                    iou=0.5,
                    max_det=20,
                    verbose=False,
                )
            raise

    try:
        # Fast path: one batched inference call per frame.
        behavior_results = _predict_behavior(batched_crops)

        if not isinstance(behavior_results, list):
            behavior_results = [behavior_results]

        behavior_pairs = list(zip(batched_meta, behavior_results))
    except Exception:
        # Some ONNX exports are fixed at batch=1; fallback keeps compatibility.
        for meta, crop in zip(batched_meta, batched_crops):
            single_res = _predict_behavior(crop)
            behavior_pairs.append((meta, single_res[0]))

    for (idx, x1, y1, x2, y2), behavior_res in behavior_pairs:
        label = "unknown"
        bconf = 0.0

        if behavior_res and behavior_res.boxes is not None and len(behavior_res.boxes) > 0:
            b = behavior_res.boxes
            best_idx = int(np.argmax(b.conf.cpu().numpy()))
            cls_id = int(b.cls[best_idx].item())
            bconf = float(b.conf[best_idx].item())
            names = behavior_classifier.names
            label = names.get(cls_id, str(cls_id)) if isinstance(names, dict) else names[cls_id]

        record = {
            "person_index": idx,
            "box": [x1, y1, x2, y2],
            "label": label,
            "confidence": round(bconf, 4),
            "status": "classified" if label != "unknown" else "unclassified",
        }
        detections.append(record)

    return detections


def draw_detections(frame: np.ndarray, detections: list[dict], draw_diagnostic_red: bool = True) -> np.ndarray:
    for det in detections:
        x1, y1, x2, y2 = det["box"]

        if draw_diagnostic_red:
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 1)

        label = det.get("label", "unknown")
        conf = float(det.get("confidence", 0.0))

        if label == "unknown":
            continue

        color = class_color(label)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        text = f"{label} {conf:.2f}"
        (tw, th), baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        text_y = max(th + 8, y1)
        cv2.rectangle(frame, (x1, text_y - th - baseline - 6), (x1 + tw + 10, text_y + baseline - 4), color, -1)
        cv2.putText(frame, text, (x1 + 5, text_y - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    return frame


def main():
    parser = argparse.ArgumentParser(description="Two-stage classroom behavior pipeline on video")
    parser.add_argument(
        "video",
        nargs="?",
        default=str(SCRIPT_DIR / "test_video2.mp4"),
        help="Path to input .mp4/.mov/.avi/.mkv video",
    )
    parser.add_argument("--person-model", default=str(DEFAULT_PERSON_MODEL), help="Path to person detector model (.onnx or .pt)")
    parser.add_argument("--behavior-model", default=str(DEFAULT_BEHAVIOR_MODEL), help="Path to behavior classifier model (.onnx or .pt)")
    parser.add_argument("--frame-step", type=int, default=1, help="Process every Nth frame (1 = all frames)")
    parser.add_argument("--person-conf", type=float, default=0.3, help="Confidence threshold for person detector")
    parser.add_argument("--behavior-conf", type=float, default=0.1, help="Confidence threshold for behavior classifier")
    parser.add_argument("--behavior-imgsz", type=int, default=DEFAULT_BEHAVIOR_IMGSZ, help="Inference size for behavior classifier (lower = faster when model supports dynamic shapes)")
    parser.add_argument("--detect-interval", type=int, default=DEFAULT_DETECT_INTERVAL, help="Run Stage 1 detector every N frames (still renders every frame)")
    parser.add_argument("--classify-interval", type=int, default=DEFAULT_CLASSIFY_INTERVAL, help="Re-run Stage 2 every N frames (still processes all frames)")
    parser.add_argument("--imgsz", type=int, default=640, help="Inference size for person detector")
    parser.add_argument("--max-det", type=int, default=500, help="Max person detections")
    parser.add_argument("--output-json", help="Path to save the JSON summary")
    parser.add_argument("--show", action="store_true", default=True, help="Show real-time OpenCV preview with boxes")
    parser.add_argument("--window-name", default="Two-Stage Pipeline (Video)", help="OpenCV window title")
    parser.add_argument("--playback-fps", type=float, default=0.0, help="Preview FPS cap (0 = use source FPS)")
    parser.add_argument("--save-video", action="store_true", help="Save annotated output video")
    parser.add_argument("--output-video", help="Path for annotated output video (.mp4)")
    parser.add_argument("--print-json", action="store_true", help="Print full JSON at the end (can be very large)")
    parser.add_argument("--show-providers", action="store_true", help="Print ONNX Runtime providers when ONNX models are used")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    ai_dir = Path(__file__).resolve().parents[1]

    video_path = resolve_video_path(ai_dir, args.video, script_dir)
    person_model_path = Path(args.person_model) if args.person_model else resolve_person_model(ai_dir)
    behavior_model_path = Path(args.behavior_model) if args.behavior_model else resolve_behavior_model(ai_dir)

    print(f"Video: {video_path}")
    print(f"Person model: {person_model_path}")
    print(f"Behavior model: {behavior_model_path}")

    if person_model_path.suffix.lower() != ".onnx":
        print("WARNING Person model is not ONNX. This usually runs on CPU and can be much slower on AMD GPUs.")
        print("Tip: export person model to ONNX and rerun with --person-model <path_to_onnx>.")

    if args.show_providers and (person_model_path.suffix.lower() == ".onnx" or behavior_model_path.suffix.lower() == ".onnx"):
        try:
            import onnxruntime as ort

            print(f"ONNX Runtime version: {ort.__version__}")
            print(f"Available providers: {ort.get_available_providers()}")
        except Exception as exc:
            print(f"Could not inspect ONNX Runtime providers: {exc}")

    if args.frame_step < 1:
        raise ValueError("--frame-step must be at least 1")

    if args.classify_interval < 1:
        raise ValueError("--classify-interval must be at least 1")

    if args.detect_interval < 1:
        raise ValueError("--detect-interval must be at least 1")

    if not video_path.exists():
        raise FileNotFoundError(f"Could not find video: {video_path}")

    print("Loading models...")
    person_finder = YOLO(str(person_model_path))
    behavior_classifier = YOLO(str(behavior_model_path))

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    frame_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

    preview_fps = args.playback_fps if args.playback_fps > 0 else (fps if fps > 0 else 30.0)
    wait_ms = max(1, int(1000.0 / preview_fps))

    writer = None
    if args.save_video:
        output_video = Path(args.output_video) if args.output_video else script_dir / "annotated_output.mp4"
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(str(output_video), fourcc, preview_fps, (frame_w, frame_h))
        if not writer.isOpened():
            raise RuntimeError(f"Could not open video writer: {output_video}")
        print(f"Saving annotated video to {output_video}")

    if args.show:
        cv2.namedWindow(args.window_name, cv2.WINDOW_NORMAL)
        print("Preview active: press 'q' or ESC to stop early.")

    frame_index = 0
    sampled_frames = 0
    processed_frames = 0
    total_people = 0
    label_counts: Counter[str] = Counter()
    frame_results = []
    frame_level_counts: defaultdict[str, int] = defaultdict(int)
    last_detections: list[dict] = []
    previous_processed_detections: list[dict] = []
    previous_merged_boxes: list[list[int]] = []

    print("Processing video frames...")
    while True:
        ok, frame = cap.read()
        if not ok:
            break

        render_frame = frame.copy()
        processed_this_frame = frame_index % args.frame_step == 0

        if processed_this_frame:
            sampled_frames += 1
            processed_frames += 1

            rerun_stage1 = (frame_index % args.detect_interval == 0) or not previous_merged_boxes
            if rerun_stage1:
                merged_boxes, raw_count = run_stage1(person_finder, frame, args.person_conf, args.imgsz, args.max_det)
                previous_merged_boxes = merged_boxes
            else:
                merged_boxes = previous_merged_boxes
                raw_count = len(merged_boxes)

            detections = run_stage2(
                behavior_classifier,
                frame,
                merged_boxes,
                args.behavior_conf,
                args.behavior_imgsz,
                frame_index,
                args.classify_interval,
                previous_processed_detections,
            )
            last_detections = detections
            previous_processed_detections = detections
            render_frame = draw_detections(render_frame, detections, draw_diagnostic_red=True)

            timestamp_sec = (frame_index / fps) if fps > 0 else None
            labeled_detections = [d for d in detections if d["label"] != "unknown"]

            for det in detections:
                label_counts[det["label"]] += 1
                frame_level_counts[det["label"]] += 1

            total_people += len(detections)
            frame_results.append(
                {
                    "frame_index": frame_index,
                    "timestamp_sec": round(timestamp_sec, 3) if timestamp_sec is not None else None,
                    "raw_stage1_boxes": raw_count,
                    "merged_stage1_boxes": len(merged_boxes),
                    "stage1_rerun": rerun_stage1,
                    "classifications": detections,
                    "classified_count": len(labeled_detections),
                    "unknown_count": len(detections) - len(labeled_detections),
                }
            )

            print(
                f"Frame {frame_index}: Stage1={len(merged_boxes)} people, "
                f"classified={len(labeled_detections)}, unknown={len(detections) - len(labeled_detections)}"
            )
        elif last_detections:
            render_frame = draw_detections(render_frame, last_detections, draw_diagnostic_red=False)

        cv2.putText(
            render_frame,
            f"frame={frame_index} step={args.frame_step} sampled={sampled_frames}",
            (12, 24),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (255, 255, 255),
            2,
        )

        if writer is not None:
            writer.write(render_frame)

        if args.show:
            cv2.imshow(args.window_name, render_frame)
            key = cv2.waitKey(wait_ms) & 0xFF
            if key in (27, ord("q")):
                print("Stopped by user.")
                break

        frame_index += 1

    cap.release()
    if writer is not None:
        writer.release()
    if args.show:
        cv2.destroyAllWindows()

    dominant_label = label_counts.most_common(1)[0][0] if label_counts else "unknown"
    summary = {
        "video_path": str(video_path),
        "frame_step": args.frame_step,
        "fps": round(fps, 3) if fps else None,
        "total_frames_reported": total_frames,
        "sampled_frame_count": sampled_frames,
        "processed_frame_count": processed_frames,
        "total_person_observations": total_people,
        "dominant_label": dominant_label,
        "label_counts": dict(label_counts),
        "frame_level_counts": dict(frame_level_counts),
        "frames": frame_results,
    }

    output_json = Path(args.output_json) if args.output_json else script_dir / "video_summary.json"
    output_json.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    if args.print_json:
        print("\nJSON summary:")
        print(json.dumps(summary, indent=2))
    else:
        print("\nSummary:")
        print(f"sampled_frame_count={sampled_frames}, total_person_observations={total_people}, dominant_label={dominant_label}")
    print(f"\nSaved summary to {output_json}")


if __name__ == "__main__":
    main()