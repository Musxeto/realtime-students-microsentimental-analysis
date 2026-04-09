# Real-time Students Micro-Sentimental Analysis (FYP)

YOLOv11-based classroom behavior analytics with a FastAPI backend for authenticated session control, real-time WebSocket streaming, PostgreSQL persistence, and AMD GPU support.

## ✅ Fully Implemented Features

### Backend API (FastAPI 0.135+)
- ✅ **JWT Authentication**: Secure token-based access via `python-jose + passlib`
- ✅ **Role-Based Access Control** (RBAC): Admin sees all courses; Teachers see only assigned courses
- ✅ **Session Management**: Start/End/Pause session endpoints with persistence
- ✅ **WebSocket Real-Time Streaming**: Frame-by-frame inference results with engagement metrics
- ✅ **Admin Teacher Provisioning**: Create new teachers + assign courses via dedicated admin endpoint
- ✅ **Health & Readiness Checks**: `/health` endpoint with db_connected + models_loaded flags
- ✅ **Batch Session Logging**: Logs flushed every 60 frames to reduce DB writes
- ✅ **Error Handling Middleware**: Structured JSON error responses with timestamps

### Database (PostgreSQL 15 + Alembic 1.13+)
- ✅ **Alembic Migrations**: Auto-discovered SQLAlchemy models, versioned schema applied on startup
- ✅ **ORM Models**: User, Course, ClassSession, SessionLog with proper relationships
- ✅ **Test Bootstrap**: `fyp_test` database auto-created; schema reset per test session
- ✅ **Seed Data**: 3 pre-configured teachers + 4 courses auto-populated on first run
- ✅ **Batch Writes**: SessionRepository pattern for bulk log inserts

### Inference Engine
- ✅ **Async Frame Processing**: `InferenceEngine` wraps YOLO pipeline with `asyncio` streaming
- ✅ **Lazy Model Loading**: Models warm-loaded on startup, not on import
- ✅ **Frame-by-Frame Output**: Per-frame detections, engagement count, distraction metrics
- ✅ **Multi-Source Support**: Reads from local MP4 files with FPS/frame-skip handling

### Testing & Validation
- ✅ **Pytest Suite**: 3 passing tests covering auth, RBAC, session lifecycle, WebSocket
- ✅ **FastAPI TestClient**: Async WebSocket mock validation
- ✅ **Local PostgreSQL Integration**: Tests use real database (not in-memory)

---

## Repository Layout

```
FYP CODE/
├── backend/
│   ├── main.py                    # FastAPI app + startup/shutdown handlers
│   ├── config.py                  # Settings (DB URL, model paths)
│   ├── models.py                  # SQLAlchemy ORM (User, Course, Session, Log)
│   ├── bootstrap.py               # Auto-seed data on startup
│   ├── schemas.py                 # Pydantic request/response models
│   ├── deps.py                    # JWT dependency injection
│   ├── security.py                # Password hashing + token creation
│   ├── database.py                # SQLAlchemy engine + session factory
│   ├── migrations.py              # Alembic upgrade helper
│   ├── routes/
│   │   ├── auth.py               # POST /auth/login
│   │   ├── courses.py            # GET /courses
│   │   ├── sessions.py           # POST/GET /sessions, WebSocket /ws/stream
│   │   └── admin.py              # POST /admin/teachers
│   ├── services/
│   │   ├── inference_service.py  # InferenceEngine wrapper (async streaming)
│   │   ├── session_manager.py    # In-memory session state + log buffering
│   │   └── database.py           # SessionRepository (ORM operations)
│   ├── alembic/
│   │   ├── env.py                # Alembic environment auto-discovery
│   │   └── versions/
│   │       └── 0001_initial_schema.py
│   ├── scripts/
│   │   └── seed_db.py            # Standalone seeding utility
│   ├── tests/
│   │   ├── conftest.py           # Pytest fixtures (DB setup)
│   │   └── test_api.py           # API contract tests
│   └── requirements.txt           # FastAPI, SQLAlchemy, Alembic, pytest, etc.
│
├── ai/
│   ├── inference_utils.py        # Refactored YOLO pipeline
│   ├── fyp-notebook.ipynb        # Model training notebook
│   ├── train_model.ipynb
│   ├── yolo11n.pt / yolo11n.onnx # Person detector models
│   ├── fyp_runs/classroom_model_v2/weights/ # Behavior classifier
│   └── dataset/                  # Training + validation data
│
├── docs/
│   └── backend_plan.md           # Full implementation roadmap
├── README.md                      # This file
├── requirements.txt              # ML deps (ultralytics, torch, opencv, onnxruntime-directml)
└── alembic.ini                   # Alembic config (points to backend/alembic)
```

---

## Prerequisites

- **Python 3.11+** (tested with 3.12 in `.venv`)
- **PostgreSQL 15** (local instance on `localhost:5432`)
  - Create database: `createdb fyp`
  - Credentials: username `postgres`, password `1234`
- **Model files** (pre-downloaded in repo):
  - `ai/yolo11n.pt` or `yolo11n.onnx` (person detector)
  - `ai/fyp_runs/classroom_model_v2/weights/best.pt` or `best.onnx` (behavior classifier)

---

## Quick Start (Local, No Docker)

### 1. Activate Virtual Environment

```powershell
.\.venv\Scripts\Activate.ps1
```

### 2. Install Backend Dependencies

```powershell
pip install -r backend/requirements.txt
```

### 3. Run Database Migrations

```powershell
python -m alembic -c alembic.ini upgrade head
```

### 4. Start FastAPI Server

```powershell
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**Server startup logs:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Waiting for application startup.
INFO:     Running Alembic migrations...
INFO:     Seeding default teachers and courses...
INFO:     Loading YOLO models (this may take 1–2 minutes)...
INFO:     Application startup complete.
```

### 5. Verify Health Endpoint

```powershell
curl http://localhost:8000/health
# Output: {"status":"ok","db_connected":true,"models_loaded":true}
```

### 6. Access Interactive Docs

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## Seeded Accounts & Test Data

On first startup, the backend auto-seeds:

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Admin | `admin@fyp.com` | `password123` | All permissions |
| Teacher 1 | `teacher@fyp.com` | `password123` | Classroom A, B |
| Teacher 2 | `teacher2@fyp.com` | `password123` | Classroom C |
| Teacher 3 | `teacher3@fyp.com` | `password123` | Classroom D |

**Courses**:
- `Classroom A`, `Classroom B` → Teacher 1
- `Classroom C` → Teacher 2
- `Classroom D` → Teacher 3

---

## API Usage Examples

### 1. Login & Get JWT Token

```http
POST /auth/login
Content-Type: application/json

{
  "email": "teacher@fyp.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Teacher One",
    "email": "teacher@fyp.com",
    "role": "teacher"
  }
}
```

### 2. List Your Courses

```http
GET /courses
Authorization: Bearer eyJhbGc...
```

**Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "course_name": "Classroom A",
    "instructor_id": "550e8400-e29b-41d4-a716-446655440002",
    "available_videos": ["test_video.mp4", "classroom_video_001.mp4"]
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440011",
    "course_name": "Classroom B",
    "instructor_id": "550e8400-e29b-41d4-a716-446655440002",
    "available_videos": []
  }
]
```

### 3. Start Analysis Session

```http
POST /sessions/start
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "course_id": "550e8400-e29b-41d4-a716-446655440010",
  "video_path": "tests/test_video.mp4",
  "frame_step": 5
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440020",
  "course_id": "550e8400-e29b-41d4-a716-446655440010",
  "start_time": "2026-04-09T10:30:00Z",
  "status": "RUNNING",
  "video_path": "tests/test_video.mp4"
}
```

### 4. Stream Real-Time Analytics via WebSocket

```
ws://localhost:8000/sessions/ws/stream/550e8400-e29b-41d4-a716-446655440020
```

Connect with JWT in headers (or query param):
```
ws://localhost:8000/sessions/ws/stream/550e8400-e29b-41d4-a716-446655440020?token=eyJhbGc...
```

**Frame payload (per-message):**
```json
{
  "timestamp_sec": 12.4,
  "frame_index": 62,
  "detections": [
    {
      "person_id": 1,
      "box": [100, 150, 200, 300],
      "label": "engaged",
      "confidence": 0.91
    }
  ],
  "aggregate_stats": {
    "total_persons": 8,
    "engaged_count": 6,
    "distracted_count": 2,
    "avg_engagement": 0.75
  }
}
```

### 5. End Session

```http
POST /sessions/{session_id}/end
Authorization: Bearer eyJhbGc...
```

**Response:**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440020",
  "status": "COMPLETED",
  "end_time": "2026-04-09T10:35:30Z",
  "final_stats": {
    "total_frames": 156,
    "avg_engagement_score": 0.73,
    "peak_engaged_time": "2026-04-09T10:33:15Z"
  }
}
```

### 6. Admin: Create New Teacher

```http
POST /admin/teachers
Authorization: Bearer eyJhbGc... (admin token)
Content-Type: application/json

{
  "name": "New Teacher",
  "email": "newteacher@fyp.com",
  "password": "temppass123",
  "course_names": ["Advanced Classroom", "Lab A"]
}
```

**Response:**
```json
{
  "teacher": {
    "id": "550e8400-e29b-41d4-a716-446655440030",
    "name": "New Teacher",
    "email": "newteacher@fyp.com",
    "role": "teacher"
  },
  "courses": [
    {"id": "...", "course_name": "Advanced Classroom", "instructor_id": "..."},
    {"id": "...", "course_name": "Lab A", "instructor_id": "..."}
  ]
}
```

---

## Windows + AMD RX5700 GPU Support

### Local Setup (Recommended for Development)

The backend uses **ONNX Runtime with DirectML** on Windows, which works well with AMD GPUs:

1. **Ensure models are in ONNX format**:
   - `ai/yolo11n.onnx` (person detector)
   - `ai/fyp_runs/classroom_model_v2/weights/best.onnx` (behavior classifier)

2. **Install ONNX DirectML** (already in `requirements.txt`):
   ```powershell
   pip install onnxruntime-directml
   ```

3. **Verify GPU acceleration**:
   Check startup logs for:
   ```
   Loading person_detector.onnx (DirectML backend enabled)
   ```

4. **Fallback behavior**: If DirectML is unavailable, ONNX Runtime automatically falls back to CPU inference.

### Windows PowerShell Notes

To run standalone video test:
```powershell
python ai/tests/test_video.py
```

To run API tests:
```powershell
pytest backend/tests -v
```

---

## Testing

### Run All Tests

```powershell
pytest backend/tests -v
```

**Expected output:**
```
backend/tests/test_api.py::test_login_success PASSED
backend/tests/test_api.py::test_admin_teacher_provisioning_rbac PASSED
backend/tests/test_api.py::test_session_start_end_and_websocket_stream PASSED
```

### Test Database

Tests use a provisioned `fyp_test` database:
- Auto-created if missing
- Schema reset before each test session
- Uses real PostgreSQL (not in-memory)

### Manual API Testing with Postman

1. Import endpoints from http://localhost:8000/openapi.json
2. Authenticate: POST `/auth/login` → save token to environment
3. Test courses: GET `/courses` with auth header
4. Create session: POST `/sessions/start`
5. Connect WebSocket: `ws://localhost:8000/sessions/ws/stream/{session_id}`
6. End session: POST `/sessions/{session_id}/end`

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
