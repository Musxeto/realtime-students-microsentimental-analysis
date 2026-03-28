# Real-time Students Micro-Sentimental Analysis

Real-time student engagement detection using YOLOv11 object detection on classroom video feeds.

## 📋 Setup Instructions

### Phase 1: Environment Setup

1. **Install Python Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Verify Installation**
   ```bash
   python -c "import torch; print(f'GPU Available: {torch.cuda.is_available()}')"
   ```

### Phase 2: Dataset Configuration

The dataset is already structured and should be located at:
```
dataset/
├── train/
│   ├── images/     (training images)
│   └── labels/     (YOLO format annotations)
├── valid/
│   ├── images/     (validation images)
│   └── labels/     (YOLO format annotations)
├── test/
│   ├── images/     (test images)
│   └── labels/     (YOLO format annotations)
└── data.yaml       (dataset configuration - already fixed)
```

**Class Labels (6 classes):**
- `handrise` - Student raising hand
- `read` - Student reading
- `sleep` - Student sleeping/head down
- `stand` - Student standing
- `using_electronic_devices` - Student using phone/phone
- `write` - Student writing

### Phase 3: Model Training

Run the training notebook to fine-tune YOLOv11 nano on your dataset:

```bash
jupyter notebook train_model.ipynb
```

**Training Configuration:**
- Model: YOLOv11 Nano (`yolo11n.pt`)
- Epochs: 20 (adjust as needed for better accuracy)
- Batch Size: 16 (reduce to 8 if OOM error occurs)
- Image Size: 640x640
- Device: Auto-detects GPU if available
- Output: `fyp_runs/classroom_model_v1/weights/best.pt`

### Phase 4: Live Inference

Once training completes, run the live inference notebook:

```bash
jupyter notebook live_inference.ipynb
```

**Features:**
- Real-time webcam feed processing
- 0.5 confidence threshold for robust detections
- Live FPS display and detection count
- Press 'q' to quit

## 🚀 Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run training (first time only)
jupyter notebook train_model.ipynb
# → Run all cells, wait for training to complete

# 3. Run live inference
jupyter notebook live_inference.ipynb
# → Press 'q' to quit when done
```

## 📊 Monitor Training

Training outputs are saved to:
- `fyp_runs/classroom_model_v1/weights/best.pt` - Best model weights
- `fyp_runs/classroom_model_v1/results.png` - Training loss/accuracy curves
- `fyp_runs/classroom_model_v1/confusion_matrix.png` - Confusion matrix

## ⚙️ Configuration & Troubleshooting

### Out of Memory (OOM) Error
If you get OOM error during training:
1. Edit the training notebook
2. Find the training configuration cell
3. Change `batch: 16` to `batch: 8` and rerun

### Low FPS During Inference
If real-time inference is slow:
1. Ensure GPU is available: `torch.cuda.is_available()`
2. Reduce image size in inference (modify `imgsz` parameter)
3. Increase confidence threshold to filter fewer detections

### Webcam Not Opening
If webcam fails to open:
1. Try different webcam indices: `WEBCAM_INDEX = 1` or `2`
2. Verify no other application is using the webcam
3. Check USB connection

## 📈 Next Steps for Production

1. **Increase Training Epochs**: From 20 to 50-100 for better accuracy
2. **Add Training Data**: Collect more diverse classroom scenarios
3. **Class Balancing**: Ensure balanced representation of all 6 classes
4. **Optimize Inference**: Use ONNX or TensorRT for 3x-5x speedup
5. **Deployment**: Containerize with Docker for university servers

## 📚 References

- [Ultralytics YOLOv11 Documentation](https://docs.ultralytics.com/models/yolov11/)
- [PyTorch CUDA Setup](https://pytorch.org/get-started/locally/)
- [YOLOv11 Training Guide](https://docs.ultralytics.com/modes/train/)

---
**Final Year Project** | Lahore Garrison University
