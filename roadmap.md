1. Organize Your Files
Create a new main folder for your FYP (e.g., FYP_MicroSentimental). Inside this folder, place the unzipped Roboflow dataset folder. Your file structure should look like this:

Plaintext
FYP_MicroSentimental/
│
├── dataset/                  <-- Your extracted Roboflow folder
│   ├── train/                <-- Contains images and labels
│   ├── valid/                <-- Contains images and labels
│   ├── test/                 <-- Contains images and labels
│   └── data.yaml             <-- The map of your dataset
│
├── train_model.py            <-- We will create this next
└── live_inference.py         <-- We will create this next
2. The data.yaml Fix (Crucial Step)
Open dataset/data.yaml in a text editor like Notepad or VS Code. Roboflow sometimes exports paths incorrectly for local machines. Make sure the paths at the top point strictly to your folders like this:

YAML
train: train/images
val: valid/images
test: test/images

nc: 5 # Number of classes
names: ['Head_Down', 'Looking_Forward', 'Raising_Hand', 'Using_Phone', 'Writing'] # Example
3. Install Dependencies
Open your terminal or command prompt inside your FYP_MicroSentimental folder and install the required libraries:

Bash
pip install ultralytics opencv-python torch torchvision
Phase 2: The Training Script (train_model.py)
This script will download the base YOLOv11 model and fine-tune it on your 13,000+ classroom images.

Create a file named train_model.py and paste this code:

Python
from ultralytics import YOLO
import torch

def main():
    # 1. Check if your NVIDIA GPU is available (Highly recommended for training) [cite: 129]
    device = '0' if torch.cuda.is_available() else 'cpu'
    print(f"Training on device: {device} (0 = GPU, cpu = CPU)")

    # 2. Load the YOLOv11 'nano' model. 
    # The 'nano' version is extremely fast, perfect for your 15+ FPS real-time requirement[cite: 236].
    model = YOLO('yolo11n.pt') 

    # 3. Start the fine-tuning process
    print("Starting training...")
    results = model.train(
        data='dataset/data.yaml', # Path to your dataset configuration
        epochs=20,                # 20 epochs is a good start to see if it's learning today. You can increase this later for better accuracy[cite: 279].
        imgsz=640,                # Matches the 640x640 resize from your Roboflow dataset
        batch=16,                 # How many images it processes at once. Lower this to 8 if you get an "Out of Memory" error.
        device=device,            # Uses your GPU or CPU
        project='fyp_runs',       # Folder where your trained weights will be saved
        name='classroom_model_v1' # Subfolder name for this specific training run
    )
    
    print("Training complete! Your custom weights are saved in 'fyp_runs/classroom_model_v1/weights/best.pt'")

if __name__ == '__main__':
    main()
Run this script by typing python train_model.py in your terminal. This will take some time depending on your hardware!

Phase 3: The Live Inference Script (live_inference.py)
Once your model finishes training, it will generate a file called best.pt. This file acts as the "brain" that has learned to recognize the students. Now we connect it to your webcam.

Create a file named live_inference.py and paste this code:

Python
import cv2
from ultralytics import YOLO

def main():
    # 1. Load YOUR custom trained model
    # Make sure this path matches exactly where the training script saved it!
    model_path = "fyp_runs/classroom_model_v1/weights/best.pt"
    model = YOLO(model_path)

    # 2. Open the standard USB Webcam [cite: 184]
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return

    print("Starting live inference. Press 'q' to stop.")

    while True:
        success, frame = cap.read()
        if not success:
            break

        # 3. Run YOLOv11 inference on the current frame [cite: 195]
        # conf=0.5 strictly enforces REQ-3: Ignore detections with < 50% confidence [cite: 244]
        results = model(frame, conf=0.5) 

        # 4. Draw the bounding boxes and labels onto the frame [cite: 234]
        annotated_frame = results[0].plot()

        # 5. Display the live feed
        cv2.imshow("Real-Time Student Behavior Detection", annotated_frame)

        # 6. Check for 'q' key to quit the program
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # Clean up
    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()
Your Mission for Today:
Set up the folders and fix the paths in data.yaml.

Run python train_model.py and let it train (grab a coffee, it'll take a bit!).

Once it's done, run python live_inference.py, stand in front of your camera, and pretend to write or use your phone to see if it catches you!