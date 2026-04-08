# Model V2 Engineering Report
## Real-time Students Micro-Sentimental Analysis (FYP)

## Part 1: Behind-the-Scenes Explanation

### 1. Notebook and Training Journey
Model V2 represented a major scale-up from V1. The project moved from YOLO11n (about 2.6M parameters) to YOLO11m (about 20M+ parameters) to train on a unified 8-class dataset of 17,934 labeled images.

Training was initially prepared in Colab, but long sessions can disconnect. To reduce interruption risk, training was migrated to Kaggle (`train_model_kaggle.ipynb`) with Tesla T4 GPUs. The setup used:

- Long-running background execution
- `cache='ram'` for faster dataset loading
- 60 epochs with early stopping (`patience=10`)
- Runtime planning to fit within cloud session limits

For this scale, typical runtime is around 4 to 6 hours of continuous GPU compute (with variance based on augmentations and I/O behavior).

### 2. Engineering Finding: Domain Shift
The most important V2 finding was domain shift:

- Training examples favored clearer views and fewer visible students.
- Real classroom CCTV included crowding, desk occlusion, and very small background subjects.

Result: behavior classification was strong on clear foreground students, but recall dropped in crowded wide-angle scenes.

### 3. Solution Strategy
Instead of restarting from scratch, a Two-Stage Cascade Pipeline was engineered:

1. Stage 1: a general person detector (YOLO11s) detects humans.
2. Stage 2: each detected human crop is sent to the custom V2 behavior model (`best.pt`).

Additional engineering refinements:

- Lower Stage-1 threshold for better person recall
- IoU and merge tuning for fragmented detections
- Crop padding to preserve person context
- Diagnostic overlays for stage-by-stage inspection
- Suppression of `unknown` labels in output
- Class-specific color rendering for readability

This turned a model limitation into a strong system design decision.

---

## Part 2: Formal FYP V2 Report

## 1. Executive Summary
Phase 2 scaled the baseline into a robust, deployment-oriented pipeline. The behavioral taxonomy expanded to 8 classes, model capacity was upgraded, and cloud GPU training became the default workflow. Post-training evaluation identified domain-shift limitations in crowded classroom scenes, which were mitigated through a modular Two-Stage Cascade Architecture.

## 2. Training Methodology and Environment

- **Model Upgrade:** YOLO11n -> YOLO11m
- **Dataset:** 17,934 annotated images, unified 8-class behavior set
- **Environment:** Kaggle Notebooks
- **Hardware:** NVIDIA Tesla T4 GPU
- **Hyperparameters:** 60 epochs, early stopping patience = 10
- **Optimization:** `cache='ram'` to reduce data I/O overhead

This enabled stable training and reproducible runs under cloud session constraints.

## 3. Empirical Findings: Domain Shift
Evaluation showed high confidence for foreground students but weaker detection/classification in deeper classroom rows. Root causes:

- **Scale variance:** distant students occupy too few pixels.
- **Occlusion:** desks and monitors split visible body regions.
- **Scene density:** overlaps and partial visibility increase ambiguity.

Observed behavior: increased false negatives for background students despite strong foreground predictions.

## 4. Engineered Solution: Two-Stage Cascade Architecture
To improve robustness without immediate full dataset recollection:

- **Stage 1 (Locator):** YOLO11s constrained to `classes=[0]` for person detection
- **Stage 2 (Classifier):** custom behavior model on person crops
- **Padding:** +15 px around person bounding boxes before classification
- **Tuning:** lower confidence in crowded scenes to preserve recall
- **Diagnostics:** per-person class/confidence logging and visual overlays

This decomposition separates localization from behavior recognition and improves reliability in complex classroom imagery.

## 5. Conclusion
Model V2 delivered both model and engineering progress:

- Scaled training process and infrastructure
- Expanded behavior taxonomy to 8 classes
- Cloud-optimized training workflow
- Domain-shift diagnosis in real deployment scenarios
- Practical two-stage inference pipeline for crowded classrooms

The system is now suitable for backend integration (FastAPI + streaming/WebSocket), and ready for future improvements like retraining with more wide-angle classroom footage and temporal tracking.

---

## Appendix Recommendations

1. Add a training configuration table (epochs, lr, optimizer, imgsz, augmentations).
2. Include Kaggle runtime logs and session metadata.
3. Show before/after visuals: single-stage vs two-stage outputs.
4. Add error taxonomy for false negatives by depth and occlusion.
5. Document future roadmap: wider-camera data, tracking, and temporal smoothing.
