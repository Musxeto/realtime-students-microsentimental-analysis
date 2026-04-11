from __future__ import annotations

import re
import base64
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator

import cv2
import numpy as np
from ultralytics import YOLO


SCRIPT_DIR = Path(__file__).resolve().parent
AI_DIR = SCRIPT_DIR


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
        for candidate in (ai_dir / "fyp_runs").rglob(ext):
            return candidate

    raise FileNotFoundError(f"Behavior model not found under {ai_dir / 'fyp_runs'}")


def resolve_video_path(ai_dir: Path, user_path: str | None, script_dir: Path = SCRIPT_DIR) -> Path:
    if user_path:
        p = Path(user_path)
        if p.exists():
            return p
        candidate = ai_dir / user_path
        if candidate.exists():
            return candidate
        candidate = script_dir / user_path
        if candidate.exists():
            return candidate
        raise FileNotFoundError(f"Video path does not exist: {p}")

    default_candidates = [script_dir / "test_video.mp4", ai_dir / "test_video.mp4"]
    for candidate in default_candidates:
        if candidate.exists():
            return candidate

    for ext in ("*.mp4", "*.mov", "*.avi", "*.mkv"):
        for candidate in ai_dir.rglob(ext):
            if candidate.is_file():
                return candidate

    raise FileNotFoundError("No video found. Provide a video path argument.")


def discover_video_files(search_roots: Iterable[Path]) -> list[Path]:
    discovered: list[Path] = []
    seen: set[Path] = set()
    for root in search_roots:
        if not root.exists():
            continue
        for ext in ("*.mp4", "*.mov", "*.avi", "*.mkv"):
            for candidate in root.rglob(ext):
                if candidate.is_file() and candidate not in seen:
                    seen.add(candidate)
                    discovered.append(candidate)
    return sorted(discovered)


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


def can_read_image(path: Path) -> bool:
    if not path.exists():
        return False
    if cv2.imread(str(path)) is not None:
        return True
    try:
        from PIL import Image

        with Image.open(path) as img:
            img.verify()
        return True
    except Exception:
        return False


def try_load_image(path: Path):
    image = cv2.imread(str(path))
    if image is not None:
        return image
    try:
        from PIL import Image

        with Image.open(path) as pil_image:
            rgb_image = pil_image.convert("RGB")
            return cv2.cvtColor(np.array(rgb_image), cv2.COLOR_RGB2BGR)
    except Exception:
        return None


def resolve_image_path(ai_dir: Path, user_path: str | None, script_dir: Path = SCRIPT_DIR) -> Path:
    if user_path:
        p = Path(user_path)
        if can_read_image(p):
            return p
        raise FileNotFoundError(f"Image path does not exist or cannot be read: {p}")

    default_candidates = [script_dir / "test_image4.jpg"]
    for candidate in default_candidates:
        if can_read_image(candidate):
            return candidate

    for ext in ("*.jpg", "*.jpeg", "*.png"):
        for candidate in ai_dir.rglob(ext):
            if can_read_image(candidate):
                return candidate

    raise FileNotFoundError("No test image found. Provide an image path argument.")


def _predict_behavior(model: YOLO, source, behavior_conf: float, behavior_imgsz: int):
    runtime_imgsz = behavior_imgsz

    try:
        return model.predict(
            source,
            conf=behavior_conf,
            iou=0.5,
            imgsz=runtime_imgsz,
            max_det=20,
            verbose=False,
        )
    except Exception as exc:
        msg = str(exc)

        if "INVALID_ARGUMENT" in msg and "Expected:" in msg:
            match = re.search(r"index:\s*[23]\s*Got:\s*\d+\s*Expected:\s*(\d+)", msg)
            if match:
                runtime_imgsz = int(match.group(1))
            return model.predict(
                source,
                conf=behavior_conf,
                iou=0.5,
                imgsz=runtime_imgsz,
                max_det=20,
                verbose=False,
            )

        if "INVALID_ARGUMENT" in msg:
            return model.predict(
                source,
                conf=behavior_conf,
                iou=0.5,
                max_det=20,
                verbose=False,
            )
        raise


def _predict_person(model: YOLO, source, person_conf: float, person_imgsz: int, max_det: int):
    runtime_imgsz = person_imgsz

    try:
        return model.predict(
            source,
            classes=[0],
            conf=person_conf,
            iou=0.3,
            imgsz=runtime_imgsz,
            max_det=max_det,
            verbose=False,
        )
    except Exception as exc:
        msg = str(exc)

        if "INVALID_ARGUMENT" in msg and "Expected:" in msg:
            match = re.search(r"index:\s*[23]\s*Got:\s*\d+\s*Expected:\s*(\d+)", msg)
            if match:
                runtime_imgsz = int(match.group(1))
            return model.predict(
                source,
                classes=[0],
                conf=person_conf,
                iou=0.3,
                imgsz=runtime_imgsz,
                max_det=max_det,
                verbose=False,
            )

        if "INVALID_ARGUMENT" in msg:
            return model.predict(
                source,
                classes=[0],
                conf=person_conf,
                iou=0.3,
                max_det=max_det,
                verbose=False,
            )
        raise


def encode_frame_preview(frame: np.ndarray, max_width: int = 640, quality: int = 60) -> str | None:
    if frame is None or frame.size == 0:
        return None

    h, w = frame.shape[:2]
    if w <= 0 or h <= 0:
        return None

    out = frame
    if w > max_width:
        scale = max_width / float(w)
        out = cv2.resize(frame, (max_width, max(1, int(h * scale))), interpolation=cv2.INTER_AREA)

    ok, encoded = cv2.imencode(
        ".jpg",
        out,
        [int(cv2.IMWRITE_JPEG_QUALITY), int(max(40, min(95, quality)))],
    )
    if not ok:
        return None

    return base64.b64encode(encoded.tobytes()).decode("ascii")


@dataclass
class FrameAnalysis:
    frame_index: int
    timestamp_sec: float | None
    detections: list[dict]
    classified_count: int
    unknown_count: int
    engaged_count: int
    distracted_count: int
    engagement_score: float


class ClassroomAnalyzer:
    def __init__(
        self,
        ai_dir: Path | None = None,
        person_model_path: Path | None = None,
        behavior_model_path: Path | None = None,
        person_conf: float = 0.3,
        behavior_conf: float = 0.1,
        person_imgsz: int = 640,
        behavior_imgsz: int = 416,
        max_det: int = 500,
        crop_padding: int = 20,
    ):
        self.ai_dir = ai_dir or AI_DIR
        self.person_model_path = person_model_path or resolve_person_model(self.ai_dir)
        self.behavior_model_path = behavior_model_path or resolve_behavior_model(self.ai_dir)
        self.person_conf = person_conf
        self.behavior_conf = behavior_conf
        self.person_imgsz = person_imgsz
        self.behavior_imgsz = behavior_imgsz
        self.max_det = max_det
        self.crop_padding = crop_padding
        self.person_finder = YOLO(str(self.person_model_path))
        self.behavior_classifier = YOLO(str(self.behavior_model_path))

    def _stage1(self, frame: np.ndarray):
        results = _predict_person(self.person_finder, frame, self.person_conf, self.person_imgsz, self.max_det)

        raw_boxes: list[list[int]] = []
        if results and results[0].boxes is not None and len(results[0].boxes) > 0:
            for box in results[0].boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                raw_boxes.append([x1, y1, x2, y2])

        raw_count = len(raw_boxes)
        return merge_vertical_fragments(raw_boxes), raw_count

    def _classify_crop(self, frame: np.ndarray):
        behavior_res = _predict_behavior(self.behavior_classifier, frame, self.behavior_conf, self.behavior_imgsz)
        label = "unknown"
        confidence = 0.0

        if behavior_res and behavior_res[0].boxes is not None and len(behavior_res[0].boxes) > 0:
            boxes = behavior_res[0].boxes
            best_idx = int(np.argmax(boxes.conf.cpu().numpy()))
            cls_id = int(boxes.cls[best_idx].item())
            confidence = float(boxes.conf[best_idx].item())
            names = self.behavior_classifier.names
            label = names.get(cls_id, str(cls_id)) if isinstance(names, dict) else names[cls_id]

        return label, round(confidence, 4)

    def analyze_frame(self, frame: np.ndarray, frame_index: int, fps: float | None = None) -> dict:
        h, w = frame.shape[:2]
        detections = []
        merged_boxes, raw_count = self._stage1(frame)

        for idx, (x1, y1, x2, y2) in enumerate(merged_boxes, start=1):
            x1, y1, x2, y2 = clip_box(x1, y1, x2, y2, w, h)
            if x2 <= x1 or y2 <= y1:
                continue

            pad = self.crop_padding
            px1 = max(0, x1 - pad)
            py1 = max(0, y1 - pad)
            px2 = min(w, x2 + pad)
            py2 = min(h, y2 + pad)
            person_crop = frame[py1:py2, px1:px2]

            if person_crop.size == 0 or person_crop.shape[0] < 12 or person_crop.shape[1] < 12:
                label = "unknown"
                confidence = 0.0
            else:
                label, confidence = self._classify_crop(person_crop)

            # UX hack: treat unknown students as look_forward instead of surfacing unknown.
            if label == "unknown":
                label = "look_forward"

            detections.append(
                {
                    "person_index": idx,
                    "box": [x1, y1, x2, y2],
                    "label": label,
                    "confidence": confidence,
                    "status": "classified" if label != "unknown" else "unclassified",
                }
            )

        label_counts = Counter(det["label"] for det in detections)
        distracted_labels = {"sleep", "using_device", "turn_head"}
        engaged_count = sum(1 for det in detections if det["label"] not in distracted_labels and det["label"] != "unknown")
        distracted_count = sum(1 for det in detections if det["label"] in distracted_labels)
        classified_count = sum(1 for det in detections if det["label"] != "unknown")
        unknown_count = len(detections) - classified_count
        total = len(detections)
        engagement_score = round((engaged_count / total) * 100, 2) if total else 0.0

        timestamp_sec = (frame_index / fps) if fps and fps > 0 else None
        return {
            "frame_index": frame_index,
            "timestamp_sec": round(timestamp_sec, 3) if timestamp_sec is not None else None,
            "frame_width": w,
            "frame_height": h,
            "raw_stage1_boxes": raw_count,
            "behavior_boxes": len(detections),
            "classifications": detections,
            "classified_count": classified_count,
            "unknown_count": unknown_count,
            "engaged_count": engaged_count,
            "distracted_count": distracted_count,
            "engagement_score": engagement_score,
            "label_counts": dict(label_counts),
        }

    def analyze_video(self, video_path: str | Path, frame_step: int = 5) -> Iterator[dict]:
        path = Path(video_path)
        if not path.exists():
            raise FileNotFoundError(f"Could not find video: {path}")

        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            raise RuntimeError(f"Could not open video: {path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        frame_index = 0

        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                if frame_index % frame_step == 0:
                    yield self.analyze_frame(frame, frame_index=frame_index, fps=fps)
                frame_index += 1
        finally:
            cap.release()
