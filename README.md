# Real-time Students Micro-Sentimental Analysis

YOLOv11-based classroom behavior analytics with a FastAPI backend for authenticated session control and real-time WebSocket streaming.

## Current MVP Scope

- Two-stage computer vision pipeline (person detection + behavior classification).
- FastAPI backend with JWT authentication.
- Role-filtered course listing (Admin sees all, Teacher sees assigned courses).
- Session lifecycle APIs (`start`, `end`) and WebSocket stream endpoint.
- PostgreSQL via Docker Compose for persistence.
- Automatic seed data for quick local testing.

## Repository Layout

```text
FYP CODE/
├── ai/
│   ├── inference_utils.py
│   ├── tests/
│   │   ├── test_image.py
│   │   └── test_video.py
│   ├── dataset/
│   └── fyp_runs/
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── models.py
│   ├── routes/
│   │   ├── auth.py
│   │   ├── courses.py
│   │   └── sessions.py
│   └── services/
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

## Prerequisites

- Python 3.11+ (tested with 3.12 virtual environment).
- Docker Desktop (for PostgreSQL + API containerized run).
- Model files present under `ai/`:
	- `ai/yolo11n.onnx` or `ai/yolo11n.pt`
	- `ai/fyp_runs/classroom_model_v2/weights/best.onnx` or `best.pt`

## Local Python Setup (No Docker)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -r backend/requirements.txt
```

Run the API:

```powershell
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

```text
GET http://localhost:8000/health
```

## Docker Setup (Recommended)

```powershell
docker compose up --build
```

This starts:
- `db` (PostgreSQL 15)
- `api` (FastAPI on port 8000)

Default DB connection in compose:

```text
postgresql+psycopg2://fyp:fyp@db:5432/fyp
```

## Seeded Accounts (Startup)

On backend startup, demo users and courses are auto-created if missing:

- Admin: `admin@fyp.local` / `admin123`
- Teacher: `teacher@fyp.local` / `teacher123`
- Courses: `Classroom A`, `Classroom B` (assigned to Teacher)

## API Quick Flow

### 1) Login

```http
POST /auth/login
Content-Type: application/json

{
	"email": "teacher@fyp.local",
	"password": "teacher123"
}
```

Response includes bearer token:

```json
{
	"access_token": "<jwt>",
	"token_type": "bearer"
}
```

### 2) List Courses + Available Videos

```http
GET /courses
Authorization: Bearer <jwt>
```

### 3) Start Session

```http
POST /sessions/start
Authorization: Bearer <jwt>
Content-Type: application/json

{
	"course_id": 1,
	"video_path": "tests/test_video.mp4",
	"frame_step": 5
}
```

### 4) Stream Analytics

Connect WebSocket:

```text
ws://localhost:8000/sessions/ws/stream/{session_id}
```

Stream payload contains per-frame detections and engagement metrics.

### 5) End Session

```http
POST /sessions/{session_id}/end
Authorization: Bearer <jwt>
```

## Inference Notes (Windows + AMD RX5700)

- ONNX is preferred for local inference with AMD.
- `onnxruntime-directml` is included in `requirements.txt` for Windows.
- If ONNX provider is unavailable in a specific environment, inference falls back to available runtimes.

You can still run the standalone video tester:

```powershell
python ai/tests/test_video.py
```

## Known Gaps (Next Iterations)

- Alembic migrations are not yet wired (tables are created on startup).
- Admin-only teacher provisioning endpoint is not added yet.
- Minute-level batch session logging and Gemini co-pilot logic are pending.
- Frontend dashboard integration is pending.

## Troubleshooting

- If models are not found, verify files exist under `ai/` paths listed above.
- If login fails, confirm API startup completed and seed data ran.
- If WebSocket closes immediately, ensure the session was started first.
