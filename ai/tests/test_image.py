import argparse
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO


def resolve_person_model(ai_dir: Path) -> Path:
    p = ai_dir / "yolo11n.pt"
    if p.exists():
        return p
    raise FileNotFoundError(f"Person model not found at {p}")


def resolve_behavior_model(ai_dir: Path) -> Path:
    preferred = ai_dir / "fyp_runs" / "classroom_model_v2" / "weights" / "best.pt"
    if preferred.exists():
        return preferred
    for p in (ai_dir / "fyp_runs").rglob("best.pt"):
        return p
    raise FileNotFoundError(f"Behavior model not found under {ai_dir / 'fyp_runs'}")


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


def resolve_image_path(ai_dir: Path, user_path: str | None, script_dir: Path) -> Path:
    if user_path:
        p = Path(user_path)
        if can_read_image(p):
            return p
        raise FileNotFoundError(f"Image path does not exist or cannot be read: {p}")

    default_candidates = [
        script_dir / "test_image4.jpg",
    ]
    for p in default_candidates:
        if can_read_image(p):
            return p

    for ext in ("*.jpg", "*.jpeg", "*.png"):
        for candidate in ai_dir.rglob(ext):
            if can_read_image(candidate):
                return candidate

    raise FileNotFoundError("No test image found. Provide an image path argument.")


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


def clip_box(x1, y1, x2, y2, w, h):
    x1 = max(0, min(int(x1), w - 1))
    y1 = max(0, min(int(y1), h - 1))
    x2 = max(0, min(int(x2), w - 1))
    y2 = max(0, min(int(y2), h - 1))
    return x1, y1, x2, y2


def class_color(label: str):
    # Stable, vivid colors per class label.
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


def main():
    parser = argparse.ArgumentParser(description="Two-stage pipeline: detect people first, then classify each person's behavior")
    parser.add_argument("image", nargs="?", help="Path to input image")
    parser.add_argument("--person-model", help="Path to YOLO person model (.pt)")
    parser.add_argument("--behavior-model", help="Path to behavior model (.pt)")
    parser.add_argument("--person-conf", type=float, default=0.3, help="Confidence threshold for person detector")
    parser.add_argument("--behavior-conf", type=float, default=0.1, help="Confidence threshold for behavior classifier")
    parser.add_argument("--imgsz", type=int, default=960, help="Inference size for person detector")
    parser.add_argument("--max-det", type=int, default=500, help="Max person detections")
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    ai_dir = Path(__file__).resolve().parents[1]

    person_model_path = Path(args.person_model) if args.person_model else resolve_person_model(ai_dir)
    behavior_model_path = Path(args.behavior_model) if args.behavior_model else resolve_behavior_model(ai_dir)
    img_path = resolve_image_path(ai_dir, args.image, script_dir)

    print("Loading Models...")
    person_finder = YOLO(str(person_model_path))
    behavior_classifier = YOLO(str(behavior_model_path))

    original_img = try_load_image(img_path)
    if original_img is None:
        raise FileNotFoundError(f"Could not load image: {img_path}")

    h, w = original_img.shape[:2]

    print("Stage 1: Finding humans...")
    person_results = person_finder.predict(original_img, classes=[0], conf=0.35, iou=0.3)

    # Extract all the raw boxes
    raw_boxes = []
    if person_results and person_results[0].boxes is not None and len(person_results[0].boxes) > 0:
        for box in person_results[0].boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            raw_boxes.append([x1, y1, x2, y2])

    print(f"Initially found {len(raw_boxes)} fragments.")

    merged_boxes = []
    # Loop through and merge boxes that are vertically stacked
    while raw_boxes:
        base_box = raw_boxes.pop(0)
        bx1, by1, bx2, by2 = base_box

        boxes_to_remove = []
        for compare_box in raw_boxes:
            cx1, cy1, cx2, cy2 = compare_box

            # Check if the boxes align horizontally (same X space)
            # We allow a 30-pixel margin of error
            if abs(bx1 - cx1) < 30 and abs(bx2 - cx2) < 30:
                # Merge them! Take the highest top and the lowest bottom
                bx1 = min(bx1, cx1)
                by1 = min(by1, cy1)
                bx2 = max(bx2, cx2)
                by2 = max(by2, cy2)
                boxes_to_remove.append(compare_box)

        # Remove the fragments we just merged into the base_box
        for box in boxes_to_remove:
            raw_boxes.remove(box)

        merged_boxes.append([bx1, by1, bx2, by2])

    print(f"After merging, we have {len(merged_boxes)} solid people!")

    final_img = original_img.copy()

    print("Stage 2: Classifying behaviors...")
    # Now loop through your CLEANED UP merged_boxes instead of the raw YOLO results
    for idx, (x1, y1, x2, y2) in enumerate(merged_boxes, start=1):
        x1, y1, x2, y2 = clip_box(x1, y1, x2, y2, w, h)
        if x2 <= x1 or y2 <= y1:
            continue

        # DIAGNOSTIC: Draw a thin RED box so we can visually see all Stage 1 detections
        cv2.rectangle(final_img, (x1, y1), (x2, y2), (0, 0, 255), 1)

        # THE CRITICAL FIX: Add padding so Stage 2 has context
        pad = 20
        px1 = max(0, x1 - pad)
        py1 = max(0, y1 - pad)
        px2 = min(w, x2 + pad)
        py2 = min(h, y2 + pad)

        # Crop using the PADDED coordinates, not the tight coordinates
        person_crop = original_img[py1:py2, px1:px2]

        if person_crop.size == 0 or person_crop.shape[0] < 12 or person_crop.shape[1] < 12:
            continue

        behavior_res = behavior_classifier.predict(
            person_crop,
            conf=args.behavior_conf,
            iou=0.5,
            max_det=20,
            verbose=False,
        )

        label = "unknown"
        bconf = 0.0

        if behavior_res and behavior_res[0].boxes is not None and len(behavior_res[0].boxes) > 0:
            b = behavior_res[0].boxes
            best_idx = int(np.argmax(b.conf.cpu().numpy()))
            cls_id = int(b.cls[best_idx].item())
            bconf = float(b.conf[best_idx].item())
            names = behavior_classifier.names
            label = names.get(cls_id, str(cls_id)) if isinstance(names, dict) else names[cls_id]

        if label == "unknown":
            print(f"Person {idx}: Stage 1 found them, but Stage 2 failed to classify.")
            continue

        print(f"Person {idx}: class={label}, class_conf={bconf:.2f}")

        # SUCCESS: Overwrite the red box with the thick, colored behavior box
        color = class_color(label)
        cv2.rectangle(final_img, (x1, y1), (x2, y2), color, 2)
        text = f"{label} {bconf:.2f}"
        (tw, th), baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        text_y = max(th + 8, y1)
        cv2.rectangle(final_img, (x1, text_y - th - baseline - 6), (x1 + tw + 10, text_y + baseline - 4), color, -1)
        cv2.putText(final_img, text, (x1 + 5, text_y - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    cv2.imshow("Two-Stage Pipeline Test", final_img)
    print("Press any key to close...")
    cv2.waitKey(0)
    cv2.destroyAllWindows()

    out_path = script_dir / "pipeline_output.jpg"
    cv2.imwrite(str(out_path), final_img)
    print(f"Saved as {out_path}")


if __name__ == "__main__":
    main()
