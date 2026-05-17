# Real-Time Students Micro-Sentimental Analysis using Computer Vision

**Authors:**
- Ghulam Mustafa (Fa-2022/BSCS/188) — fa22-bscs-188@lgu.edu.pk
- Ammad Rasheed (Fa-2022/BSCS/199) — fa22-bscs-199@lgu.edu.pk

**Supervisor:**
- Sir Hassan Sultan — Department of Computer Science, Lahore Garrison University

---

End-to-end FYP platform for real-time classroom engagement analytics. A fine-tuned YOLOv11 model detects and classifies student behavior; a FastAPI backend streams live metrics over WebSocket to a React dashboard; PostgreSQL persists all session data; and an OpenAI-powered AI coach delivers live pedagogical feedback.

---

## What This Project Does

- Runs real-time classroom analysis from video files or IP camera feeds.
- Detects and classifies student behaviors in **a single model pass** using a custom fine-tuned YOLOv11 model (no separate person-detection stage).
- Computes a per-frame **Aggregate Engagement Score** (`engaged / total × 100`).
- Streams live metrics, annotated frame previews, and AI coaching messages to a React dashboard via WebSocket.
- Persists session logs, alert events, and performance metrics in PostgreSQL for historical reporting and analytics.
- Delivers real-time pedagogical coaching via the **OpenAI API** (GPT-4o-mini), replacing the former Gemini integration.
- Supports role-based workflows for **Teachers** (start/monitor sessions) and **Admins** (manage teachers, courses, AI settings).
- Provides configurable per-course engagement alert thresholds with duration-based triggers and full-screen UI alerts.
- Tracks an admin-configurable AI coach update interval (minimum 60 s, configurable per deployment).

---

## What Changed (v2 — Current Version)

### AI / Model

| Area | Before | Now |
|------|--------|-----|
| **Architecture** | Two-stage cascade (Person Detection → Behavior Classification) | **Single-stage**: One fine-tuned YOLOv11 model detects and classifies in one pass |
| **Model files** | `yolo11n.onnx` + `classroom_model_v2/best.onnx` | **`fyp_runs/lgu_classroom_finetune/weights/best.pt`** (fine-tuned) |
| **Training** | General dataset training | **Fine-tuned** on LGU classroom-specific dataset via `fyp-finetuning-notebook.ipynb` |
| **Inference code** | Two-model pipeline with separate cropping and NMS stages | Direct `model.predict()` on full frame; class mapping via `names` dict |

### Backend

| Area | Change |
|------|--------|
| **AI Coaching LLM** | Switched from Google Gemini (`gemini_service.py`) to **OpenAI GPT-4o-mini** (`openai_service.py`) |
| **AI Update Interval** | Admin-configurable via `/admin/settings/ai` endpoint, persisted in `ai_settings` DB table |
| **Rolling Engagement Window** | AI coach now uses a **10-second rolling average** before deciding to call the LLM, reducing noise |
| **Significance Filter** | LLM call is skipped unless engagement changes ≥ 5 % or alert state changes or 3 min have elapsed |
| **Rate-limit Backoff** | 60 s automatic backoff on OpenAI HTTP 429 errors |
| **Stale Session Cleanup** | Auto-close of stale `PENDING`/`RUNNING`/`PAUSED` sessions left over after server restart |
| **Audit Log** | `CLASS_COMPLETED` audit event recorded on session end |
| **Alert Events** | Persisted to `alert_events` table with engagement snapshot and reason |
| **Performance Metrics** | Per-frame processing latency tracked in `performance_metrics` table |
| **New Admin Endpoints** | `/admin/settings/ai` (GET/PUT), `/admin/teachers/{id}/project`, `/admin/teachers` (DELETE bulk) |
| **New Session Endpoints** | `GET /sessions/{id}/metrics` — returns avg/P95 latency, FPS, alert count, avg engagement |
| **IP Camera Support** | `ip_camera_stream_sources` config; InferenceService tries multiple URL variants for HTTP/RTSP feeds |
| **New DB Tables** | `ai_settings`, `alert_events`, `performance_metrics`, `audit_logs` |

### Frontend

| Area | Change |
|------|--------|
| **Live Session Dashboard** | Complete redesign: theme-aware glassmorphism UI with animated AI coach panel |
| **AI Coach Panel** | Real-time display of OpenAI coaching messages with tone-based styling (stern/warning/praise) |
| **Low-Engagement Alerts** | Toast notifications + full-screen modal overlay for critical engagement drops |
| **Session Completion Modal** | Full-screen summary modal shown when stream ends or session is manually ended |
| **10-Second Rolling Window** | Engagement chart uses rolling data window for smoother display |
| **Admin Dashboard** | Pagination, search, and filter for teacher/course management; bulk actions |
| **AI Settings Panel** | Admin UI to configure the OpenAI coach update interval |
| **Theme Feature** | Dedicated `theme` feature module for consistent dark/light theming |

---

## Technology Stack

### AI and Inference

- **YOLOv11** (Ultralytics) — single-stage fine-tuned model for classroom behavior detection and classification
- Fine-tuned on LGU classroom dataset via Google Colab GPU (`ai/fyp-finetuning-notebook.ipynb`)
- ONNX Runtime DirectML for hardware acceleration on Windows (AMD/NVIDIA)
- OpenCV for video capture and frame preprocessing
- 8-class behavior taxonomy: `handrise`, `read`, `write`, `sleep`, `using_device`, `stand`, `look_forward`, `turn_head`

### Backend

- FastAPI 0.135+
- SQLAlchemy 2.x + Alembic
- PostgreSQL 15
- JWT auth — `python-jose` + `passlib` (bcrypt)
- WebSocket streaming endpoint for live session telemetry
- **OpenAI API** (`httpx`-based async client) for AI coaching (`openai_service.py`)

### Frontend

- React 18 + Vite + TypeScript
- Redux Toolkit + RTK Query
- React Router v6
- Tailwind CSS + glassmorphism design system
- Recharts for engagement trend charts
- `react-use-websocket` for WebSocket connection management
- `react-hot-toast` for toast notifications
- `lucide-react` + `react-icons`

---

## Repository Structure

```text
FYP CODE/
  ai/                        # Model files, notebooks, datasets, inference helpers
    fyp-finetuning-notebook.ipynb   # Fine-tuning notebook (new)
    fyp-notebook.ipynb              # Original training notebook
    fyp_runs/                       # Training run outputs + fine-tuned weights
      lgu_classroom_finetune/       # Fine-tuned model weights (ACTIVE)
        weights/best.pt
    inference_utils.py              # ClassroomAnalyzer (single-stage pipeline)
    yolo11n.onnx                    # Person detector (kept as fallback reference)
    yolo11n.pt
  backend/                   # FastAPI service, routes, ORM models, tests
    routes/
      auth.py                # Login, Logout, Refresh, Change Password
      admin.py               # Teacher CRUD, AI Settings, Analytics
      courses.py             # Course CRUD, Alert Config, History
      sessions.py            # Session Start/End, Logs, Metrics, WebSocket
    services/
      inference_service.py   # Async video streaming + frame analysis
      session_manager.py     # In-memory session state + alert engine
      openai_service.py      # OpenAI GPT-4o-mini coaching (NEW)
      gemini_service.py      # Deprecated stub (no longer used)
      ai_settings.py         # DB-backed AI update interval config
      database.py            # Batch DB write repository
      opencv_preview.py      # Optional local debug window
    models.py                # ORM: 9 tables
    config.py                # Settings (env-driven)
  docs/                      # Plans, reports, implementation notes
  frontend/                  # React dashboard
  alembic.ini
  docker-compose.yml
  Dockerfile
```

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm 9+
- PostgreSQL 15 (or Docker)
- OpenAI API key (for AI coaching feature)

---

## Environment Variables

All backend configuration is read from `.env` in the project root (loaded via `python-dotenv`).

### Backend Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+psycopg2://postgres:1234@localhost:5432/fyp` | PostgreSQL connection string |
| `SECRET_KEY` | `change-me` | JWT signing secret — **change in production** |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `300` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |
| `OPENAI_API_KEY` | *(unset)* | **Required** for AI coaching feature |
| `AI_DIR` | `./ai` | Path to model files and video assets |
| `VIDEO_ROOT` | `./ai` | Root for video file resolution |
| `IP_CAMERA_STREAM_SOURCES` | `http://192.168.100.118:8080/video,...` | Comma-separated IP camera URLs |
| `SESSION_LOG_BATCH_SIZE` | `60` | Flush log buffer after N frames |
| `SESSION_LOG_FLUSH_INTERVAL_SECONDS` | `1.0` | Time-based log flush interval |
| `SESSION_DISCONNECT_TIMEOUT_SECONDS` | `30` | Auto-complete session after disconnect |
| `SESSION_OPENCV_PREVIEW_ENABLED` | `false` | Enable local OpenCV debug window |
| `SESSION_OPENCV_PREVIEW_WINDOW_NAME` | `Session Live Preview` | OpenCV window title |

### Frontend Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend REST base URL |
| `VITE_WS_BASE_URL` | `ws://localhost:8000` | Backend WebSocket base URL |

---

## Local Setup (Windows)

### 1. Backend

```powershell
cd "d:\FYP\FYP CODE"

# Create virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Set your OpenAI API key
$env:OPENAI_API_KEY = "sk-..."

# Run database migrations
python -m alembic -c alembic.ini upgrade head

# Start the API (auto-reloads on file change)
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Or run directly
cd backend
python main.py
```

Health check:
```powershell
curl http://localhost:8000/health
# {"status":"ok","db_connected":true,"models_loaded":true}
```

### 2. Frontend

```powershell
cd "d:\FYP\FYP CODE\frontend"
npm install
npm run dev
```

Frontend dev URL: **http://localhost:5173**

---

## Docker Setup (Backend + Postgres)

```powershell
cd "d:\FYP\FYP CODE"
docker compose up --build
```

This starts:
- `db` — PostgreSQL 15
- `api` — FastAPI application

---

## Authentication and Roles

| Role | Permissions |
|------|-------------|
| `ADMIN` | Manage teachers, courses, global analytics, AI settings, reset passwords |
| `TEACHER` | Start/monitor sessions for assigned courses only |

- Login: `POST /auth/login`
- JWT carries role claim; refresh token stored in Redux + local storage
- Token version field enables server-side token invalidation on password reset

### Default Seeded Accounts

| Email | Password | Role |
|-------|----------|------|
| `admin@fyp.com` | `admin123` | ADMIN |
| `teacher@fyp.com` | `teacher123` | TEACHER |
| `teacher2@fyp.com` | `teacher123` | TEACHER |
| `teacher3@fyp.com` | `teacher123` | TEACHER |

---

## Core API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Obtain access + refresh tokens |
| GET | `/auth/me` | Current user profile |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate refresh token |
| POST | `/auth/change-password` | Change own password |

### Courses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses` | List courses (scoped by role) |
| POST | `/courses` | Create course |
| PATCH | `/courses/{id}` | Update course |
| DELETE | `/courses/{id}` | Delete course |
| GET | `/courses/{id}/analytics` | Course engagement analytics |
| GET | `/courses/{id}/alert-config` | Get alert threshold config |
| PUT | `/courses/{id}/alert-config` | Update alert threshold config |
| GET | `/courses/{id}/history` | Course audit log |

### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sessions/start` | Create and initialize a session |
| GET | `/sessions` | List sessions (paginated, filterable) |
| GET | `/sessions/{id}` | Get session details |
| GET | `/sessions/{id}/logs` | Paginated frame-level logs |
| GET | `/sessions/{id}/metrics` | Latency, FPS, alert count, avg engagement |
| POST | `/sessions/{id}/end` | Finalize session + write audit log |
| WS | `/sessions/ws/stream/{id}` | Live inference stream (WebSocket) |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/summary` | Platform-wide stats |
| GET | `/admin/teachers` | List teachers (search + filter) |
| POST | `/admin/teachers` | Create teacher + courses |
| PATCH | `/admin/teachers/{id}` | Update teacher |
| DELETE | `/admin/teachers/{id}` | Delete teacher |
| DELETE | `/admin/teachers` | Bulk delete all teachers |
| GET | `/admin/teachers/{id}/analytics` | Teacher performance analytics |
| GET | `/admin/teachers/{id}/project` | Full teacher project deep-dive |
| POST | `/admin/users/{id}/reset-password` | Admin password reset |
| DELETE | `/admin/courses` | Bulk delete all courses |
| GET | `/admin/settings/ai` | Get AI coach update interval |
| PUT | `/admin/settings/ai` | Set AI coach update interval |

Swagger docs: **http://localhost:8000/docs**

---

## WebSocket Stream Payload

Connect to `ws://localhost:8000/sessions/ws/stream/{session_id}` to receive per-frame JSON:

```json
{
  "session_id": 42,
  "frame_index": 150,
  "timestamp_sec": 5.0,
  "frame_width": 1280,
  "frame_height": 720,
  "behavior_boxes": 12,
  "classifications": [
    {"person_index": 1, "box": [100, 80, 220, 340], "label": "write", "confidence": 0.87, "status": "classified"},
    {"person_index": 2, "box": [250, 90, 380, 350], "label": "sleep", "confidence": 0.74, "status": "classified"}
  ],
  "engaged_count": 10,
  "distracted_count": 2,
  "engagement_score": 83.33,
  "processing_latency_ms": 68.4,
  "live_fps": 6.2,
  "source_fps": 30.0,
  "frame_step": 5,
  "frame_jpeg_base64": "<base64-encoded-jpeg>",
  "course_name": "Machine Learning",
  "alert_state": {
    "active": false,
    "reason": "",
    "triggered_at": null,
    "ai_insight": "Great work keeping students engaged — keep this energy going!"
  },
  "message": "AI Coach: Great work keeping students engaged — keep this energy going!",
  "stream_schema_version": 2
}
```

---

## AI Coaching (OpenAI GPT-4o-mini)

The system uses **OpenAI's `gpt-4o-mini`** model to generate real-time pedagogical coaching messages during live sessions.

### How It Works

1. The backend maintains a **10-second rolling engagement window** of scores.
2. Every `N` seconds (configurable, minimum 60 s, default 60 s) the system checks whether a new LLM call is needed.
3. A call is only made if any of these are true:
   - Engagement changed by ≥ 5 % since last call
   - Alert state changed (alert triggered or resolved)
   - More than 3 minutes have elapsed regardless
4. The LLM receives engagement score, student counts, course name, teacher name, and a **tone instruction** (stern if < 70 %, firm if < 80 %, celebratory if ≥ 80 %).
5. The response (≤ 100 tokens) is injected into the WebSocket payload.
6. On HTTP 429 (rate limit), the service backs off for **60 seconds** automatically.

### Configuration

```bash
# .env
OPENAI_API_KEY=sk-...

# Admin dashboard → AI Settings → Update Interval (seconds)
# Minimum: 60 s
```

The update interval is persisted in the `ai_settings` database table and can be changed live through the admin UI without restarting the server.

---

## Database Schema

### Tables Overview

| Table | Purpose |
|-------|---------|
| `users` | Admin and Teacher accounts |
| `courses` | Academic courses (code, semester, section) |
| `sessions` | Analysis sessions (one video run) |
| `session_logs` | Per-frame engagement data |
| `alert_configs` | Per-course alert threshold settings |
| `alert_events` | Historical alert trigger records |
| `performance_metrics` | Processing latency per frame |
| `audit_logs` | Administrative action audit trail |
| `ai_settings` | OpenAI coach update interval config |

### Key DDL

```sql
-- Users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  role ENUM('ADMIN','TEACHER') DEFAULT 'TEACHER',
  is_active BOOLEAN DEFAULT TRUE,
  token_version INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Courses (unique per code+semester+section)
CREATE TABLE courses (
  id SERIAL PRIMARY KEY,
  course_name VARCHAR(255) NOT NULL,
  course_code VARCHAR(32) NOT NULL,
  semester INT NOT NULL,
  section INT NOT NULL,
  instructor_id INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (course_code, semester, section)
);

-- Sessions
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  final_avg_score FLOAT,
  status ENUM('PENDING','RUNNING','PAUSED','COMPLETED') DEFAULT 'PENDING',
  video_path TEXT,
  session_metadata JSON
);

-- Session Logs (per-frame)
CREATE TABLE session_logs (
  id SERIAL PRIMARY KEY,
  session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  timestamp TIMESTAMP NOT NULL,
  engagement_score FLOAT NOT NULL,
  engaged_count INT DEFAULT 0,
  distracted_count INT DEFAULT 0,
  payload JSON
);

-- Alert Events
CREATE TABLE alert_events (
  id SERIAL PRIMARY KEY,
  session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  engagement_at_trigger FLOAT NOT NULL,
  reason TEXT NOT NULL,
  resolved_at TIMESTAMP
);

-- Performance Metrics
CREATE TABLE performance_metrics (
  id SERIAL PRIMARY KEY,
  session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL,
  value FLOAT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id INT REFERENCES users(id),
  course_id INT REFERENCES courses(id),
  action VARCHAR(100) NOT NULL,
  details JSON
);

-- AI Settings
CREATE TABLE ai_settings (
  id SERIAL PRIMARY KEY,
  update_interval_seconds INT NOT NULL DEFAULT 60,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Frontend Architecture

```text
frontend/src/
  app/                   # Redux store, router, providers
  components/            # Shared layout and modals
  config/                # env.ts (API/WS URLs)
  features/
    auth/                # Login page, token, RBAC guard, profile
    admin/               # Admin dashboard, teacher project page
    teacher/             # Teacher dashboard, courses, sessions, analytics
    live-session/        # Session start, live monitoring, summary
    theme/               # Global theme context/provider
  hooks/                 # useSessionWebSocket
  services/api/          # RTK Query apiSlice (all endpoints)
  types/                 # Shared TypeScript types
```

Key pages:
- `/session/start` — Course + video source selection
- `/session/{id}` — **Live monitoring dashboard** with animated AI coach, engagement chart, behavior breakdown, annotated video feed, alert modals
- `/session/{id}/summary` — Post-session engagement report
- `/admin` — Admin dashboard with teacher/course management
- `/dashboard` — Teacher overview with quick stats

---

## Running Tests

### Backend

```powershell
cd "d:\FYP\FYP CODE"
pytest backend/tests -v
```

### AI Smoke Test

```powershell
python ai/tests/test_video.py
```

### Frontend Type Check + Build

```powershell
cd "d:\FYP\FYP CODE\frontend"
npm run build
```

### OpenCV Debug Window (during live session)

```powershell
$env:SESSION_OPENCV_PREVIEW_ENABLED = "true"
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Then start a session from the frontend — a local OpenCV window will open showing annotated frames with engagement overlays.

---

## Performance Notes

| Metric | Value |
|--------|-------|
| Frame processing time | ~50–100 ms/frame (AMD RX5700, ONNX DirectML) |
| Log batch flush | Every 1 s or 60 frames (whichever comes first) |
| Model warm-up time | ~10–30 s on first startup (single model now faster) |
| WebSocket latency | ~50–200 ms frame-to-client |
| AI coach call interval | 60 s minimum (configurable, admin panel) |
| OpenAI rate-limit backoff | 60 s after HTTP 429 |

---

## AMD RX5700 / Windows Notes

- `onnxruntime-directml` provides DirectML GPU acceleration.
- If DirectML is unavailable, inference falls back to CPU automatically.
- The fine-tuned `.pt` model is loaded via Ultralytics; ONNX export is recommended for best performance.

---

## IP Camera Support

The `InferenceService` will try multiple URL variants when a network source is provided:
- `{base}/video`, `{base}/mjpeg`, `{base}/stream`, `{base}/live`, `{base}`

Configure default camera URLs in `.env`:
```bash
IP_CAMERA_STREAM_SOURCES=http://192.168.100.118:8080/video,http://10.0.0.2:8080/video
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `models_loaded: false` on `/health` | Check `ai/fyp_runs/lgu_classroom_finetune/weights/best.pt` exists |
| `db_connected: false` on `/health` | Ensure PostgreSQL is running; verify `DATABASE_URL` |
| WebSocket closes immediately | Confirm session was created via `POST /sessions/start` first |
| Login returns 401 | Run `alembic upgrade head`; check seed data |
| OpenAI coach not appearing | Set `OPENAI_API_KEY` in `.env`; check backend logs for 429 |
| Slow inference | Verify ONNX DirectML loaded in startup logs; CPU fallback is slower |
| Port 8000 in use | Use `uvicorn backend.main:app --port 8001` |
| `Module not found` (frontend) | Run `npm install` in `frontend/`; restart TS server in VS Code |
| Stale `RUNNING` session after restart | Handled automatically on next `POST /sessions/start` (auto-cleanup) |

---

## Project Status

### Completed ✅

- ✅ Full JWT auth with role-based access control (ADMIN / TEACHER)
- ✅ Admin dashboard — teacher/course CRUD, pagination, search, filter, bulk actions
- ✅ Teacher dashboard — session history, engagement analytics, course management
- ✅ **Fine-tuned single-stage YOLOv11 model** (`lgu_classroom_finetune`) replacing the two-stage cascade
- ✅ **OpenAI GPT-4o-mini** AI coaching replacing Google Gemini
- ✅ 10-second rolling engagement window for AI coach decisions
- ✅ Significance-filtering and rate-limit backoff for OpenAI calls
- ✅ Admin-configurable AI update interval (via DB + admin UI)
- ✅ Glassmorphism, theme-aware live session dashboard with animated AI coach panel
- ✅ Full-screen alert modals and toast notifications for engagement events
- ✅ Session completion detection with summary modal
- ✅ Alert event persistence and performance metrics tracking
- ✅ Audit log for session completion events
- ✅ Stale session auto-recovery on server restart
- ✅ IP camera stream support (HTTP/RTSP)
- ✅ OpenCV local debug preview window

### Known Non-Blocking Issues

- Backend uses `datetime.utcnow()` in several places — emits deprecation warnings under Python 3.12+ (timezone-aware `datetime.now(timezone.utc)` is the recommended replacement).
- `google-ai-generativelanguage` and related packages remain in `requirements.txt` from the Gemini era; `gemini_service.py` is now a deprecated stub (safe to remove in a future cleanup).
- Live session chart bundle is the largest frontend chunk due to Recharts dependencies.

### Future Work

- Cloud deployment (AWS/GCP)
- RTSP live camera feed from IP cameras directly in session UI
- Session resume after WebSocket reconnect (currently auto-completes after 30 s)
- Concurrent session limiting per teacher (GPU resource management)
- Per-session PDF export of engagement reports
- Multi-GPU distributed inference for high-throughput deployments

---

## Colab Training Workflow

1. Open `ai/fyp-finetuning-notebook.ipynb` in Google Colab with GPU runtime.
2. Upload or mount the LGU classroom dataset.
3. Run fine-tuning (YOLOv11 + custom class taxonomy).
4. Export weights: `best.pt` (and optionally `best.onnx`).
5. Copy weights to `ai/fyp_runs/lgu_classroom_finetune/weights/`.
6. Restart the backend — `InferenceService` will auto-detect the new weights.

---

## Quick API Flow

### 1. Login
```http
POST /auth/login
Content-Type: application/json

{"email": "teacher@fyp.com", "password": "teacher123"}
```

### 2. List Courses
```http
GET /courses
Authorization: Bearer <jwt>
```

### 3. Start Session
```http
POST /sessions/start
Authorization: Bearer <jwt>
Content-Type: application/json

{"course_id": 1, "video_path": "tests/test_video.mp4", "frame_step": 5}
```

### 4. Connect WebSocket
```
ws://localhost:8000/sessions/ws/stream/{session_id}
```

### 5. End Session
```http
POST /sessions/{session_id}/end
Authorization: Bearer <jwt>
```
