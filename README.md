# Real-time Students Micro-Sentimental Analysis

YOLOv11-based classroom behavior detection for training and live webcam inference.

## Project Structure

Your workspace is already in the right shape:

```text
FYP CODE/
├── dataset/
│   ├── train/images, train/labels
│   ├── valid/images, valid/labels
│   ├── test/images, test/labels
│   └── data.yaml
├── train_model.py
├── live_inference.py
├── train_model.ipynb
└── live_inference.ipynb
```

`dataset/data.yaml` must keep relative paths:

```yaml
train: train/images
val: valid/images
test: test/images
```

## Local Setup (Windows + AMD RX5700)

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Train from script:

```bash
python train_model.py
```

4. Run live inference:

```bash
python live_inference.py --show-fps
```

Notes for AMD on Windows:
- Standard PyTorch on Windows does not use AMD RX5700 for GPU training.
- The script will automatically fall back to CPU.
- For fast GPU training, use Google Colab GPU.

## Colab Setup (Dataset in Drive root /dataset)

In Colab, run:

```python
from google.colab import drive
drive.mount('/content/drive')
```

```bash
!pip install ultralytics opencv-python
```

If your code is in GitHub, clone it:

```bash
!git clone https://github.com/<your-user>/<your-repo>.git
%cd <your-repo>
```

Train using your Drive dataset:

```bash
!python train_model.py --data /content/drive/MyDrive/dataset/data.yaml --project /content/drive/MyDrive/fyp_runs
```

Run inference (Colab webcam support is limited in standard notebooks; local PC is recommended for realtime webcam):

```bash
!python live_inference.py --model-path /content/drive/MyDrive/fyp_runs/classroom_model_v1/weights/best.pt
```

## Notebook Usage

If you prefer notebooks:

```bash
jupyter notebook
```

Open and run:
- `train_model.ipynb`
- `live_inference.ipynb`

Use the same dataset path logic:
- Local: `dataset/data.yaml`
- Colab: `/content/drive/MyDrive/dataset/data.yaml`

## Outputs

Training creates:
- `fyp_runs/classroom_model_v1/weights/best.pt`
- `fyp_runs/classroom_model_v1/results.png`
- `fyp_runs/classroom_model_v1/confusion_matrix.png`

## Troubleshooting

OOM during training:
- Run `python train_model.py --batch 8`

Webcam not opening:
- Try `python live_inference.py --source 1`

Wrong model path:
- Pass explicit path:
`python live_inference.py --model-path fyp_runs/classroom_model_v1/weights/best.pt`
