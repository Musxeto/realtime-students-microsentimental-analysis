import cv2
from ultralytics import YOLO
import os

def main():
    # Load the custom trained model
    model_path = "fyp_runs/classroom_model_v1/weights/best.pt"
    
    if not os.path.exists(model_path):
        print(f"Error: Model not found at {model_path}")
        print("Please train the model first using: python train_model.py")
        return
    
    print(f"Loading model from {model_path}...")
    model = YOLO(model_path)

    # Open the webcam
    print("Opening webcam...")
    cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("Error: Could not open webcam.")
        print("Make sure a webcam is connected and accessible.")
        return

    print("Starting live inference. Press 'q' to stop.")

    while True:
        success, frame = cap.read()
        if not success:
            print("Error reading frame from webcam.")
            break

        # Run YOLOv11 inference with confidence threshold 0.5
        results = model(frame, conf=0.5)

        # Draw bounding boxes and labels
        annotated_frame = results[0].plot()

        # Display the frame
        cv2.imshow("Real-Time Student Behavior Detection", annotated_frame)

        # Check for 'q' key to quit
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("Exiting...")
            break

    # Clean up
    cap.release()
    cv2.destroyAllWindows()
    print("Done.")

if __name__ == '__main__':
    main()
