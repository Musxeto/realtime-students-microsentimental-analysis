# Real-Time Students Micro-Sentimental Analysis

End-to-end FYP platform for classroom behavior analytics using YOLO-based inference, a FastAPI backend, PostgreSQL storage, and a modern React dashboard.

## What This Project Does

- Runs frame-by-frame classroom analysis from video input.
- Streams live metrics through WebSocket.
- Persists sessions and logs in PostgreSQL.
- Supports role-based workflows for admin and teacher users.
- Provides a modern frontend stack for real-time dashboard UX.

## Current Technology Stack

### AI and Inference

- Ultralytics YOLO pipeline in [ai/inference_utils.py](ai/inference_utils.py)
- ONNX Runtime DirectML on Windows for AMD acceleration
- CPU fallback if GPU acceleration is unavailable

### Backend

- FastAPI
- SQLAlchemy + Alembic
- PostgreSQL 15
- JWT auth with python-jose and passlib
- WebSocket streaming endpoint for live session telemetry

### Frontend

- React 18 + Vite + TypeScript
- Redux Toolkit + RTK Query
- React Router v6
- Tailwind CSS
- Tremor charts
- react-use-websocket
- react-icons + lucide-react

## Repository Structure

```text
FYP CODE/
  ai/                    # Model files, notebooks, datasets, inference helpers
  backend/               # FastAPI service, routes, ORM models, tests
  docs/                  # Plans, reports, implementation notes
  frontend/              # React dashboard
  alembic.ini            # Alembic config
  docker-compose.yml     # Local Postgres + API stack
  Dockerfile             # Backend image
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm 9+
- PostgreSQL 15 (or Docker)

## Environment Variables

Backend reads configuration from [backend/config.py](backend/config.py).

Required or recommended variables:

- DATABASE_URL
  - Local default: postgresql+psycopg2://postgres:1234@localhost:5432/fyp
- SECRET_KEY
  - Default exists for development, change for production.
- AI_DIR
  - Default: ./ai
- VIDEO_ROOT
  - Default: ./ai
- ACCESS_TOKEN_EXPIRE_MINUTES
  - Default: 300
- SESSION_LOG_BATCH_SIZE
  - Default: 60
- SESSION_DISCONNECT_TIMEOUT_SECONDS
  - Default: 30

Frontend variables:

- VITE_API_BASE_URL
  - Default: http://localhost:8000
- VITE_WS_BASE_URL
  - Default: ws://localhost:8000

## Local Setup (Windows or Linux)

### 1. Backend setup

```powershell
cd "d:\FYP\FYP CODE"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
pip install -r requirements.txt
```

Run migrations:

```powershell
python -m alembic -c alembic.ini upgrade head
```

Start API:

```powershell
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Health check:

```powershell
curl http://localhost:8000/health
```

### 2. Frontend setup

```powershell
cd "d:\FYP\FYP CODE\frontend"
npm install
npm run dev
```

Frontend dev URL:

- http://localhost:5173

## Docker Setup (Backend + Postgres)

The file [docker-compose.yml](docker-compose.yml) starts:

- db: PostgreSQL 15
- api: FastAPI app

Run:

```powershell
cd "d:\FYP\FYP CODE"
docker compose up --build
```

## Authentication and Roles

- Login endpoint: POST /auth/login
- JWT carries role claim.
- Supported roles:
  - admin
  - teacher

Role behavior:

- admin can manage teachers and courses globally.
- teacher only accesses assigned course/session scope.

## Core Backend Endpoints

- GET /health
- POST /auth/login
- GET /auth/me
- POST /auth/refresh
- POST /auth/logout
- POST /auth/change-password
- GET /courses
- POST /courses
- DELETE /courses/{course_id}
- GET /courses/{course_id}/analytics
- GET /courses/{course_id}/alert-config
- PUT /courses/{course_id}/alert-config
- POST /sessions/start
- GET /sessions
- GET /sessions/{session_id}
- GET /sessions/{session_id}/logs
- GET /sessions/{session_id}/metrics
- POST /sessions/{session_id}/end
- WS /sessions/ws/stream/{session_id}
- POST /admin/teachers
- GET /admin/teachers
- PATCH /admin/teachers/{teacher_id}
- GET /admin/teachers/{teacher_id}/analytics
- POST /admin/users/{user_id}/reset-password

Swagger docs:

- http://localhost:8000/docs

## Seeded Default Accounts

First startup seeds sample users and courses.

Typical credentials:

- admin@fyp.com / admin123
- teacher@fyp.com / teacher123
- teacher2@fyp.com / teacher123
- teacher3@fyp.com / teacher123

If these are changed in seed scripts, trust the current seed source in [backend/bootstrap.py](backend/bootstrap.py).

## Frontend Architecture (Current)

The dashboard is feature-oriented:

```text
frontend/src/
  app/                 # store, router, providers
  components/          # shared layout/UI
  config/              # env constants
  features/
    auth/
    admin/
    teacher/
    live-session/
  hooks/
  services/
  types/
```

Key files:

- [frontend/src/app/store.ts](frontend/src/app/store.ts)
- [frontend/src/app/router.tsx](frontend/src/app/router.tsx)
- [frontend/src/services/api/apiSlice.ts](frontend/src/services/api/apiSlice.ts)
- [frontend/src/hooks/useSessionWebSocket.ts](frontend/src/hooks/useSessionWebSocket.ts)

Implemented teacher runtime flow:

- Start session from /session/start
- Live monitoring at /session/{id}
- Post-session review at /session/{id}/summary

## Running Tests

Backend tests:

```powershell
cd "d:\FYP\FYP CODE"
pytest backend/tests -v
```

AI video smoke test:

```powershell
cd "d:\FYP\FYP CODE"
python ai/tests/test_video.py
```

Frontend type and build check:

```powershell
cd "d:\FYP\FYP CODE\frontend"
npm run build
```

## AMD RX5700 and Windows Notes

- This project supports AMD GPUs on Windows via onnxruntime-directml.
- If DirectML is unavailable, inference falls back to CPU.
- Keep ONNX model artifacts available for best Windows performance.

## Colab Workflow Notes

- Use notebooks in [ai/fyp-notebook.ipynb](ai/fyp-notebook.ipynb) and [ai/train_model.ipynb](ai/train_model.ipynb).
- Train/export in Colab GPU, then copy model artifacts back to this repository.
- Keep local inference paths aligned with backend settings AI_DIR and VIDEO_ROOT.

## Common Troubleshooting

- Module not found errors in frontend:
  - Run npm install in [frontend](frontend)
  - Restart TS server in VS Code if diagnostics are stale
- Database connection issues:
  - Verify DATABASE_URL and PostgreSQL service
  - Re-run alembic upgrade command
- WebSocket does not stream:
  - Confirm session was created with /sessions/start
  - Confirm frontend uses ws:// base URL and valid session id

## Project Status

- Backend auth, RBAC, admin workflows, course analytics, alert configuration, session metrics, and websocket streaming are implemented.
- Frontend has role-based login redirects, working admin and teacher dashboards, live session runtime controls, and realtime engagement/alert views.
- Backend API tests and frontend production build pass on current branch.

Known non-blocking items:

- Backend uses `datetime.utcnow()` in multiple places and emits deprecation warnings under Python 3.12+ test runs.
- Live session chart bundle is still the largest frontend chunk due to charting/runtime dependencies.

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'teacher') DEFAULT 'teacher',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Courses Table
```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY,
  course_name VARCHAR(255) NOT NULL,
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Sessions Table
```sql
CREATE TABLE class_sessions (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id),
  video_path VARCHAR(255) NOT NULL,
  status ENUM('pending', 'running', 'paused', 'completed') DEFAULT 'pending',
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  final_avg_score FLOAT,
  session_metadata JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Session Logs Table
```sql
CREATE TABLE session_logs (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  timestamp TIMESTAMP NOT NULL,
  engagement_score FLOAT,
  engaged_count INT,
  distracted_count INT,
  classifications JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ON (session_id),
  INDEX ON (timestamp)
);
```

---

## Performance Notes

- **Frame Processing**: ~50–100 ms per frame (AMD RX5700 with ONNX DirectML)
- **Batch Logging**: Flushes every 60 frames (~5–10 seconds depending on FPS)
- **Model Warmup**: ~30–60 seconds on first startup (model loading + compilation)
- **WebSocket Latency**: ~50–200 ms frame-to-client delivery

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Models not found** | Verify `ai/yolo11n.pt`, `classroom_model_v2/weights/best.pt` exist |
| **"db_connected": false** | Ensure PostgreSQL is running on `localhost:5432` with correct credentials |
| **WebSocket closes immediately** | Confirm session was created first via POST `/sessions/start` |
| **Login returns 401** | Check seeded accounts exist; run migrations: `alembic upgrade head` |
| **Slow inference** | Verify ONNX DirectML is loaded (check logs); fall back to CPU if needed |
| **Port 8000 already in use** | Change port: `uvicorn backend.main:app --port 8001` |

---

## Known Limitations & Future Work

### Current Scope
- ✅ Local PostgreSQL only (no cloud deployment)
- ✅ Video files from disk only (no live IP camera feeds)
- ✅ Batch logging every 60 frames (no per-frame writes)
- ✅ AMD GPU via ONNX DirectML (Windows only)

### Future Enhancements (Post-MVP)
- Session resume after disconnect (currently auto-timeout at 30 seconds)
- Concurrent session limits per teacher (prevent GPU overload)
- Model fine-tuning loop integration (export training data)
- Gemini co-pilot pedagogical suggestions
- React frontend dashboard
- Cloud deployment (AWS/GCP)
- RTSP live camera feed support
- Multi-GPU distributed inference

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
