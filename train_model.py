import argparse
import platform
from pathlib import Path

import torch
from ultralytics import YOLO


def running_on_colab() -> bool:
    try:
        import google.colab  # type: ignore  # noqa: F401

        return True
    except Exception:
        return False


def resolve_data_yaml(user_path: str | None) -> Path:
    if user_path:
        return Path(user_path)

    candidates = []
    if running_on_colab():
        candidates.extend(
            [
                Path("/content/drive/MyDrive/dataset/data.yaml"),
                Path("/content/dataset/data.yaml"),
            ]
        )

    candidates.append(Path("dataset/data.yaml"))

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return Path("dataset/data.yaml")


def resolve_device(requested: str) -> str:
    if requested != "auto":
        return requested

    if torch.cuda.is_available():
        return "0"

    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"

    return "cpu"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train YOLOv11 for classroom behavior detection.")
    parser.add_argument("--data", type=str, default=None, help="Path to data.yaml")
    parser.add_argument("--model", type=str, default="yolo11n.pt", help="Base model weights")
    parser.add_argument("--epochs", type=int, default=20, help="Training epochs")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument(
        "--device",
        type=str,
        default="auto",
        help="Device: auto, cpu, mps, or CUDA index like 0",
    )
    parser.add_argument("--project", type=str, default="fyp_runs", help="Output project folder")
    parser.add_argument("--name", type=str, default="classroom_model_v1", help="Run name")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    data_yaml = resolve_data_yaml(args.data)
    device = resolve_device(args.device)

    print(f"Data config: {data_yaml}")
    print(f"Training device: {device} (0 = CUDA GPU, cpu = CPU)")

    if device == "0":
        print(f"CUDA GPU: {torch.cuda.get_device_name(0)}")
    elif platform.system() == "Windows" and not torch.cuda.is_available():
        print("Note: AMD GPU acceleration is not available through standard PyTorch on Windows.")
        print("Training will run on CPU locally. For faster training, use Colab with a T4 GPU.")

    if not data_yaml.exists():
        raise FileNotFoundError(
            f"Could not find data.yaml at '{data_yaml}'. "
            "Pass --data with the correct path (for Colab usually /content/drive/MyDrive/dataset/data.yaml)."
        )

    print(f"Loading model: {args.model}")
    model = YOLO(args.model)

    print("Starting training...")
    model.train(
        data=str(data_yaml),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=device,
        project=args.project,
        name=args.name,
    )

    best_path = Path(args.project) / args.name / "weights" / "best.pt"
    print(f"Training complete. Best weights expected at: {best_path}")


if __name__ == "__main__":
    main()
