import argparse
import time
from pathlib import Path

import cv2
from ultralytics import YOLO


def running_on_colab() -> bool:
    try:
        import google.colab  # type: ignore  # noqa: F401

        return True
    except Exception:
        return False


def resolve_model_path(user_path: str | None) -> Path:
    if user_path:
        return Path(user_path)

    candidates = [Path("fyp_runs/classroom_model_v1/weights/best.pt")]
    if running_on_colab():
        candidates.insert(0, Path("/content/drive/MyDrive/fyp_runs/classroom_model_v1/weights/best.pt"))

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return candidates[0]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run live inference for classroom behavior detection.")
    parser.add_argument("--model-path", type=str, default=None, help="Path to trained best.pt")
    parser.add_argument("--source", type=int, default=0, help="Webcam index (0, 1, 2...)")
    parser.add_argument("--conf", type=float, default=0.5, help="Confidence threshold")
    parser.add_argument("--imgsz", type=int, default=640, help="Inference image size")
    parser.add_argument("--show-fps", action="store_true", help="Overlay FPS on video")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model_path = resolve_model_path(args.model_path)

    if not model_path.exists():
        print(f"Error: model not found at {model_path}")
        print("Train first with: python train_model.py")
        print("Or pass --model-path with your exact best.pt location.")
        return

    print(f"Loading model from {model_path}...")
    model = YOLO(str(model_path))

    print(f"Opening webcam index {args.source}...")
    cap = cv2.VideoCapture(args.source)
    if not cap.isOpened():
        print("Error: could not open webcam.")
        print("Try a different source index, e.g. --source 1")
        return

    print("Starting live inference. Press 'q' to stop.")
    prev_time = time.time()

    while True:
        success, frame = cap.read()
        if not success:
            print("Error: failed to read frame from webcam.")
            break

        results = model.predict(frame, conf=args.conf, imgsz=args.imgsz, verbose=False)
        annotated_frame = results[0].plot()

        if args.show_fps:
            curr_time = time.time()
            fps = 1.0 / max(curr_time - prev_time, 1e-6)
            prev_time = curr_time
            cv2.putText(
                annotated_frame,
                f"FPS: {fps:.1f}",
                (15, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.9,
                (0, 255, 0),
                2,
                cv2.LINE_AA,
            )

        cv2.imshow("Real-Time Student Behavior Detection", annotated_frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            print("Stopping inference...")
            break

    cap.release()
    cv2.destroyAllWindows()
    print("Done.")


if __name__ == "__main__":
    main()
