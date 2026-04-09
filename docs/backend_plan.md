# Backend API & Real-Time Inference Engine

> **TL;DR:** Refactor the existing two-stage YOLO pipeline into a FastAPI service with PostgreSQL persistence, WebSocket frame-by-frame streaming, and Docker support for AMD RX5700. The backend exposes endpoints to list available video sources (classrooms), start analysis sessions (selecting which course/video to analyze), and stream per-frame behavior classifications via WebSocket in real-time.

---

## Phases Overview

| Phase | Name | Type |
|-------|------|------|
| 1 | Project Foundation & Refactoring | Parallelizable |
| 2 | Authentication & Core Routes | Sequential |
| 3 | Inference Engine & Session Management | Sequential |
| 4 | Database Persistence & Error Handling | Sequential |
| 5 | Docker & AMD GPU Support | Parallel |
| 6 | Testing & Validation | Concurrent |

---

## Phase 1: Project Foundation & Refactoring *(Parallelizable)*

### 1.1 Create Backend Directory Structure and Requirements Files

- Create `backend/` directory with `__init__.py`, `main.py`, `config.py`, `requirements.txt`
- Add FastAPI dependencies:
  - `fastapi`
  - `uvicorn[standard]`
  - `sqlalchemy`
  - `alembic`
  - `psycopg2-binary`
  - `pydantic`
  - `pydantic-settings`
  - `python-dotenv`
- Separate from `requirements.txt` (keep ML deps there) to enable faster Docker rebuilds

---

### 1.2 Refactor `ai/test_video.py` into Reusable `ai/inference_utils.py` Module

*(Depends on understanding current codebase — can run in parallel with 1.1)*

- Extract `resolve_person_model()` → `ModelManager.resolve_model(model_type)`
- Extract `run_stage1()` → `ModelManager.run_stage1(frame, model, conf_threshold)`
- Extract `run_single_stage()` → shared function (keep ONNX shape-handling logic)
- Extract NMS functions (`iou_xyxy()`, `nms_person()`, `merge_vertical_fragments()`) → `postprocessing.py`
- Create `FrameAnalyzer` class that wraps the entire pipeline: loads models, processes frames, yields JSON results
- Export all functions for backend import; keep `test_video.py` as a standalone test client

---

### 1.3 Write `docker-compose.yml` with PostgreSQL Service + FastAPI Service

- **PostgreSQL 15 service:** volume-mounted to `./data/postgres`
- **FastAPI service:** mounts `FYP CODE/` as `/app`, sets `PYTHONUNBUFFERED=1`
- **Environment file:** `.env` for DB credentials, model paths, API settings
- **AMD GPU Support:** Add `--gpus all` to FastAPI service (if Docker Desktop supports GPU, else fallback to CPU+ONNX DirectML on Windows, CPU on Linux)
- Store models in `ai` mounted volume so they're cached across container restarts

---

### 1.4 Initialize SQLAlchemy Models in `backend/models.py`

*(Can start in parallel with 1.1–1.3)*

| Model | Fields |
|-------|--------|
| `User` | `id`, `name`, `email`, `hashed_password`, `role: Enum[ADMIN, TEACHER]` |
| `Course` | `id`, `course_name`, `instructor_id: FK → User.id`, `created_at` |
| `Session` | `id`, `course_id: FK → Course.id`, `start_time`, `end_time`, `final_avg_score`, `status: Enum[PENDING, RUNNING, COMPLETED]` |
| `SessionLog` | `id`, `session_id: FK → Session.id`, `timestamp`, `engagement_score`, `engaged_count`, `distracted_count`, `classifications: JSON` |

- Use `from sqlalchemy.ext.declarative import declarative_base`
- Use `datetime.datetime` with UTC defaults
- Use `JSON` column for flexible data

---

### 1.5 Create Alembic Migrations Setup

- `alembic init alembic` inside `backend/`
- Update `alembic/env.py` to auto-discover SQLAlchemy models
- Create initial migration: `alembic revision --autogenerate -m "initial_schema"`
- Ensure migration runs automatically on Docker startup (or manual: `docker-compose exec backend alembic upgrade head`)

---

## Phase 2: Authentication & Core Routes *(Sequential)*

### 2.1 Implement JWT Authentication in `backend/routes/auth.py`

*(Depends on 1.4 — models must exist)*

- Use `python-jose` + `passlib` for JWT + password hashing
- `POST /auth/login` → takes `{email, password}`, returns `{access_token, token_type, user: {id, name, role}}`
- Create `get_current_user()` dependency for protecting routes
- All routes except `/auth/login` require JWT in `Authorization: Bearer <token>` header
- Return `401` if missing/invalid token

---

### 2.2 Implement Admin/Teacher Data Seeding in `backend/scripts/seed_db.py`

On first run, create:

- 1 Admin user (hardcoded: `admin@fyp.local` / `admin123`)
- 3 Teachers (`teacher1@fyp.local`, …) ← configurable
- 2–3 Courses assigned to teachers

Run via:
```bash
docker-compose exec backend python scripts/seed_db.py
```
Or auto-trigger on app startup if DB is empty. Teachers table pre-loads with data ready for session-start filtering.

---

### 2.3 Implement Course/Video Listing Endpoint `GET /courses`

- Teacher sees only their assigned courses (filter by `instructor_id`)
- Admin sees all courses
- **Returns:**
  ```json
  [{"id": 1, "course_name": "...", "instructor_id": 2, "available_videos": ["video1.mp4", "video2.mp4"]}]
  ```
- Available videos read from disk: scan `tests/` or a designated `data/videos/` folder
- Use Pydantic model for response validation

---

## Phase 3: Inference Engine & Session Management *(Sequential, builds on Phase 2)*

### 3.1 Create `backend/services/inference_service.py`

Wraps `ai/inference_utils.py`.

**Class: `InferenceEngine`**

- `__init__(model_config)` → loads both models (person detector + behavior classifier) once at startup
- `async process_video_stream(video_path: str)` → `AsyncGenerator[dict, None]` → yields per-frame JSON
- Each frame yields:
  ```json
  {
    "timestamp_sec": 12.4,
    "frame_index": 62,
    "detections": [{"person_id": 1, "box": [...], "label": "engaged", "confidence": 0.91}],
    "aggregate_stats": {"total_persons": 8, "engaged_count": 6}
  }
  ```
- Uses `inference_utils.FrameAnalyzer` internally
- Handles video file I/O, FPS calculation, and frame skipping (every 5th frame) seamlessly

---

### 3.2 Create WebSocket Endpoint in `backend/routes/inference.py`

#### `POST /sessions` — Session Start

*(Depends on 2.1, 3.1)*

- **Takes:** `{course_id, video_filename, session_config: {frame_skip: 5, ...}}`
- **Validates:** user owns course (RBAC), video exists, no duplicate sessions for same course
- **Returns:** `{session_id, start_time, status: "PENDING"}`
- Does **NOT** start processing yet — waits for WebSocket connect

#### `WebSocket /ws/stream/{session_id}` — Real-time Streaming

- Client connects, backend validates `session_id` + JWT
- Backend calls `InferenceEngine.process_video_stream()`, yields JSON every frame
- Each frame sends: `{timestamp_sec, frame_index, detections, stats, session_id}`
- If client disconnects → backend stops processing and marks session as `"PAUSED"` (not `"COMPLETED"` — for resume capability)
- On frame error → send error message and gracefully close connection

#### `POST /sessions/{session_id}/end` — Session End

*(Depends on 2.1)*

- Stops processing, marks `status: "COMPLETED"`
- Computes final aggregates: avg engagement score, peak times per label
- Stores final report to PostgreSQL `sessions` table (`final_avg_score`)
- **Returns:** `{session_id, final_stats, saved_to_db: true}`

---

### 3.3 Create Background Task for Batch Logging *(Asynchronous, non-blocking)*

- After each frame is processed, add to in-memory buffer
- Every 60 frames (or ~60 seconds), flush to PostgreSQL as a single `SessionLog` row
- Buffer stored in `InferenceEngine._batch_buffer` dict
- Use `asyncio.create_task()` in FastAPI to avoid blocking frame streaming
- Handles: session end (flush remaining) + error recovery (retry on DB failure)

---

## Phase 4: Database Persistence & Error Handling *(Sequential, can overlap Phase 3)*

### 4.1 Create `backend/services/database.py` — ORM Wrapper

**`SessionRepository` class with methods:**

| Method | Signature |
|--------|-----------|
| `create_session` | `(course_id, video_filename) → Session` |
| `get_session` | `(session_id) → Session` |
| `update_session` | `(session_id, status, final_avg_score) → None` |
| `add_session_logs` | `(session_id, log_batch: List[SessionLog]) → None` (bulk insert) |

- Use SQLAlchemy context manager for transactions
- Handle DB connection failures gracefully (retry 3× on transient errors, then log + continue)

---

### 4.2 Create Error Handling Middleware in `backend/main.py`

| Exception | HTTP Response |
|-----------|---------------|
| `ValueError` (bad video path) | `400 Bad Request` |
| `ResourceNotFound` (session not found) | `404 Not Found` |
| `PermissionDenied` (teacher accessing other teacher's course) | `403 Forbidden` |
| `DatabaseError` | `500` + retry logic; log to stdout |

All errors return structured JSON:
```json
{"error_code": "RESOURCE_NOT_FOUND", "message": "Session not found", "timestamp": "2025-01-01T00:00:00Z"}
```

---

### 4.3 Add Startup/Shutdown Handlers in FastAPI

- **`@app.on_event("startup")`:** Load YOLO models once, test DB connection
- **`@app.on_event("shutdown")`:** Kill active inference processes, close DB pool
- **Health check:** `GET /health` → `{status: "ok", db_connected: true, models_loaded: true}`

---

## Phase 5: Docker & AMD GPU Support *(Parallel with Phase 4)*

### 5.1 Write Dockerfile for Backend

- **Base image:** `python:3.11-slim`
- **System deps:** `ffmpeg`, `libsm6`, `libxext6` (for OpenCV), `libgl1` (ONNX)
- Copy `requirements.txt` + `ai/requirements.txt`, run `pip install`
- Copy entire codebase: `COPY . /app`
- Set `PYTHONUNBUFFERED=1` to stream logs in real-time

**AMD GPU Handling:**

- For Windows local dev: Use `onnxruntime-directml` (already in `ai/requirements.txt`)
- Dockerfile conditional:
  ```dockerfile
  RUN if [ "$WINDOWS_GPU" = "true" ]; then pip install onnxruntime-directml; else pip install onnxruntime; fi
  ```
- Set env: `ONNX_ENABLE_DIRECTML=1` (Windows) or unset (Linux)
- Models load as ONNX by default via `inference_utils.resolve_model(format='onnx')`

---

### 5.2 Write `.dockerignore`

**Exclude:**
```
.git
__pycache__
.pytest_cache
*.pyc
venv/
node_modules/
```

**Keep:** `ai/`, `data/`, `backend/`, `.env`

---

### 5.3 Test Docker Compose Locally

```bash
docker-compose up --build
```

**Verify:**
- PostgreSQL starts and accepts connections
- FastAPI starts on `http://localhost:8000`
- `GET /health` returns `{status: "ok"}`
- Models load without error (watch startup logs)
- ONNX inference works inside container (DirectML on Windows, CPU fallback elsewhere)

---

## Phase 6: Testing & Validation *(Concurrent with Phase 5)*

### 6.1 Create `backend/tests/test_api.py` — API Contract Tests

- `POST /auth/login` with valid/invalid credentials
- `GET /courses` with RBAC (teacher sees only own, admin sees all)
- `POST /sessions` with invalid `course_id` (403), missing video (400), duplicates (409)
- WebSocket `/ws/stream/{session_id}` connects, receives 1+ frames, closes gracefully
- Use `pytest` + `httpx` async client (not `TestClient` — needed for WebSocket)
- All tests use in-memory SQLite (`:memory:`) for speed, no Docker required

---

### 6.2 Manual Testing with Postman

1. `POST /auth/login` → save `access_token` to Postman env
2. `GET /courses` with token in header → verify course list
3. `POST /sessions` → get `session_id`
4. Connect WebSocket: `ws://localhost:8000/ws/stream/{session_id}` with token
5. Verify JSON frames arrive (inspect WebSocket messages in Postman)
6. `POST /sessions/{session_id}/end` → verify final report
7. Query PostgreSQL: `SELECT * FROM sessions WHERE id = '...'` to confirm persistence

---

### 6.3 Verify AMD GPU Inference

- During Docker startup, log model resolution: `"Loading person_detector.onnx (DirectML backend)"` or `"Loading person_detector.pt (CPU fallback)"`
- Run single-frame inference test inside container:
  ```bash
  docker-compose exec backend python -c "from ai.inference_utils import InferenceEngine; e = InferenceEngine(); print(e.models_loaded)"
  ```
- Compare wall-clock time for frame processing (local ONNX vs. CPU-only) to confirm GPU usage

---

## Relevant Files

| Path | Purpose | Status |
|------|---------|--------|
| `test_video.py` | Existing pipeline to refactor | Exists → Extract |
| `ai/requirements.txt` | ML dependencies | Exists → Update with `python-multipart` |
| `backend/main.py` | FastAPI app entry | New → Create |
| `backend/config.py` | Settings (DB URL, model paths, API keys) | New → Create |
| `backend/models.py` | SQLAlchemy ORM models | New → Create |
| `backend/routes/auth.py` | Authentication endpoints | New → Create |
| `backend/routes/inference.py` | Session + WebSocket endpoints | New → Create |
| `backend/services/inference_service.py` | `InferenceEngine` wrapper class | New → Create |
| `backend/services/database.py` | ORM repository pattern | New → Create |
| `backend/scripts/seed_db.py` | Initial data loading | New → Create |
| `ai/inference_utils.py` | Refactored pipeline utilities | New → Extract from `test_video.py` |
| `ai/postprocessing.py` | NMS + fragment merging | New → Extract from `test_video.py` |
| `Dockerfile` | Container image definition | New → Create |
| `docker-compose.yml` | Local dev orchestration | New → Create |
| `.env` | Environment secrets | New → Create (add to `.gitignore`) |
| `backend/requirements.txt` | Backend-specific Python dependencies | New → Create |
| `backend/tests/test_api.py` | Pytest API tests | New → Create |

---

## Verification Checklist

### Unit Tests
```bash
pytest backend/tests/
```
All tests pass (auth, RBAC, session endpoints).

### Docker Build
```bash
docker-compose build
```
No errors; image size ~1.5 GB.

### Local Run
```bash
docker-compose up
# Services start within 30 seconds
curl http://localhost:8000/health  # → {status: "ok"}
```
PostgreSQL has full schema (Alembic migrations applied).

### Inference Chain (Postman)
1. Login → receive JWT
2. List courses → see seeded courses
3. Start session with `test_video.mp4` → get `session_id`
4. WebSocket connect → receive ≥1 frame JSON within 5 seconds
5. Frame JSON contains: `timestamp_sec`, `detections`, `stats`
6. Close session → verify `final_avg_score` saved in DB

### GPU Verification
Docker logs show `"DirectML"` or `"CPU"` backend on first model load.

### RBAC Check
- Teacher1 logs in → sees only Course1 + Course2, **cannot** access Course3 (Teacher2's)
- Admin logs in → sees all courses
- Teacher1 cannot modify other teacher's sessions → `403`

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Frame-by-frame streaming (not 1Hz summary)** | User clarified backend should send every analyzed frame via WebSocket; preserves granularity. Bandwidth increase (~5–10×) mitigated by not sending raw video frames — only stats. |
| **Video from disk (not live IP cameras)** | MVP uses local MP4 files; IP camera support deferred to Phase 2 (requires ffmpeg/RTSP pipeline). |
| **Batch writes to PostgreSQL (not per-frame)** | Performance trade-off; flushes every 60 frames (~6–12 seconds at 5–10 FPS processing). |
| **ONNX as primary model format** | Ensures AMD GPU support; smaller model size (~50 MB vs ~200 MB). |
| **Postman testing only (no React frontend)** | API contract is primary MVP deliverable; frontend can be built independently. |
| **Defer LLM co-pilot** | Gemini pedagogical suggestions are Phase 4; MVP focuses on reliable real-time inference. |
| **Local Docker only (no cloud deploy yet)** | Simpler iteration cycle; Kubernetes/cloud deployment post-MVP if needed. |

---

## Further Considerations

### Session Resume After Disconnect *(~0.5 day PR)*

Should WebSocket disconnects pause or terminate sessions? Currently: pause (allows resume). If a teacher's internet drops mid-session, should the backend wait for reconnect or commit the partial session to DB?

> **Recommendation:** Auto-timeout after 30 seconds of disconnect → save partial session + alert teacher. Safer than keeping resources allocated indefinitely.

---

### Concurrent Sessions Per Teacher *(~1 day PR)*

Can one teacher start multiple sessions (analyzing different videos in parallel)? Currently: no constraint. Should we enforce 1 active session per teacher to prevent GPU memory issues?

> **Recommendation:** Enforce 1 active session per `instructor_id` at a time — return `409` if teacher tries to start a 2nd session before ending the first. Prevents resource exhaustion.

---

### Model Fine-Tuning Loop Integration *(Future, post-MVP)*

Once data accumulates in PostgreSQL, retraining the behavior classifier on real classroom footage becomes valuable. Should the backend include endpoints to export training data or trigger retraining jobs?

> **Recommendation:** Out of scope for MVP; defer to Phase 2. For now, use pre-trained `classroom_model_v2` only.
