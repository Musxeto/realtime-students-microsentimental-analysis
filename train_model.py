from ultralytics import YOLO
import torch

def main():
    # Check if NVIDIA GPU is available
    device = '0' if torch.cuda.is_available() else 'cpu'
    print(f"Training on device: {device} (0 = GPU, cpu = CPU)")
    
    if device == '0':
        print(f"GPU found: {torch.cuda.get_device_name(0)}")

    # Load the YOLOv11 'nano' model
    print("Loading YOLOv11 nano model...")
    model = YOLO('yolo11n.pt')

    # Start the fine-tuning process
    print("Starting training...")
    results = model.train(
        data='dataset/data.yaml',  # Path to dataset configuration
        epochs=20,                 # 20 epochs for initial training
        imgsz=640,                 # 640x640 resolution
        batch=16,                  # Batch size (reduce to 8 if OOM)
        device=device,             # GPU or CPU
        project='fyp_runs',        # Output folder for runs
        name='classroom_model_v1'  # Run name
    )
    
    print("Training complete! Weights saved at: fyp_runs/classroom_model_v1/weights/best.pt")

if __name__ == '__main__':
    main()
