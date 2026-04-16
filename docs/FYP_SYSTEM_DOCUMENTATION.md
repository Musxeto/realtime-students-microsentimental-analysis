# Real-Time Students Micro-Sentimental Analysis Using Computer Vision

## Complete System Documentation — Final Year Project

---

**Authors:**
- Ghulam Mustafa (Fa-2022/BSCS/188) — fa22-bscs-188@lgu.edu.pk
- Ammad Rasheed (Fa-2022/BSCS/199) — fa22-bscs-199@lgu.edu.pk

**Supervisor:**
- Sir Hassan Sultan — Department of Computer Science, Lahore Garrison University

**Date:** April 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [AI / Model Component](#3-ai--model-component)
4. [Backend Component](#4-backend-component)
5. [Frontend Component](#5-frontend-component)
6. [Database Design](#6-database-design)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Real-Time Streaming Pipeline](#8-real-time-streaming-pipeline)
9. [Gemini AI Coaching Integration](#9-gemini-ai-coaching-integration)
10. [Scripts & Tooling](#10-scripts--tooling)
11. [DevOps & Deployment](#11-devops--deployment)
12. [API Reference](#12-api-reference)
13. [Testing Strategy](#13-testing-strategy)
14. [Environment Configuration](#14-environment-configuration)
15. [Repository Structure](#15-repository-structure)
16. [Performance Benchmarks](#16-performance-benchmarks)
17. [Known Limitations & Future Work](#17-known-limitations--future-work)

---

## 1. Project Overview

### 1.1 Problem Statement

Traditional classroom monitoring relies on manual observation by instructors, which is subjective, non-scalable, and unable to provide quantitative engagement data. There is no real-time feedback mechanism for teachers to adapt their pedagogy during a live lecture based on student attentiveness.

### 1.2 Proposed Solution

This system provides **real-time, AI-powered classroom behavior analytics** using computer vision. A video feed (from a classroom recording or IP camera) is processed frame-by-frame through a Two-Stage YOLOv11 Cascade Pipeline that:

1. **Detects** individual students in the frame (Stage 1 — Person Detection)
2. **Classifies** each student's behavior (Stage 2 — Behavior Classification)
3. **Computes** an aggregate engagement score per frame
4. **Streams** these metrics live to a React dashboard via WebSocket
5. **Persists** session data to PostgreSQL for historical reporting
6. **Generates** real-time AI coaching suggestions via Google Gemini

### 1.3 Key Features

| Feature | Description |
|---------|-------------|
| **Real-Time Inference** | Frame-by-frame YOLO analysis at ~10–20 FPS |
| **8-Class Behavior Taxonomy** | handrise, read, write, sleep, using_device, stand, look_forward, turn_head |
| **Live Dashboard** | Engagement score, distraction alerts, and annotated video preview |
| **Role-Based Access** | Admin (manages teachers/courses) and Teacher (runs sessions) |
| **Alert System** | Configurable engagement threshold alerts with duration-based triggers |
| **AI Coaching** | Gemini-powered pedagogical suggestions streamed live to teachers |
| **Session History** | Persistent logs with course analytics and engagement trends |
| **AMD GPU Support** | ONNX Runtime with DirectML acceleration for AMD GPUs on Windows |

### 1.4 Technology Stack Summary

| Layer | Technologies |
|-------|-------------|
| **AI / ML** | YOLOv11 (Ultralytics), ONNX Runtime DirectML, OpenCV, PyTorch, NumPy |
| **Backend** | FastAPI, SQLAlchemy, Alembic, PostgreSQL 15, python-jose (JWT), WebSockets |
| **Frontend** | React 18, TypeScript, Vite, Redux Toolkit (RTK Query), Tailwind CSS, Recharts, react-use-websocket |
| **AI Coaching** | Google Gemini API (gemini-3-flash-preview) |
| **DevOps** | Docker, Docker Compose, GitHub |

---

## 2. System Architecture

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM ARCHITECTURE                                │
│                                                                                 │
│            ┌──────────────────────────────────┐                                 │
│            │        REACT DASHBOARD            │                                │
│            │   (Vite + TypeScript + Redux)      │                                │
│            │                                   │                                │
│            │  ┌──────────┐  ┌──────────────┐   │                                │
│            │  │  Admin   │  │   Teacher     │   │                                │
│            │  │Dashboard │  │  Dashboard    │   │                                │
│            │  └──────────┘  └──────────────┘   │                                │
│            │  ┌──────────────────────────────┐ │                                │
│            │  │    Live Session View          │ │                                │
│            │  │  (WebSocket + Video Preview)  │ │                                │
│            │  └──────────────────────────────┘ │                                │
│            └───────────┬──────────┬────────────┘                                │
│                 HTTP/REST    WebSocket                                           │
│                   (JWT)     (Live Stream)                                        │
│            ┌───────────┴──────────┴────────────┐                                │
│            │         FastAPI BACKEND            │                                │
│            │                                   │                                │
│            │  ┌────────────────────────────┐   │                                │
│            │  │     API Route Layer        │   │                                │
│            │  │  auth | admin | courses |  │   │                                │
│            │  │       sessions (REST+WS)   │   │                                │
│            │  └─────────────┬──────────────┘   │                                │
│            │  ┌─────────────┴──────────────┐   │                                │
│            │  │     Service Layer          │   │                                │
│            │  │  InferenceService          │   │                                │
│            │  │  SessionManager            │   │                                │
│            │  │  GeminiService             │   │                                │
│            │  │  SessionRepository         │   │                                │
│            │  │  OpenCVPreview             │   │                                │
│            │  └─────────────┬──────────────┘   │                                │
│            │  ┌─────────────┴──────────────┐   │                                │
│            │  │    Data / ORM Layer        │   │                                │
│            │  │   SQLAlchemy + Alembic     │   │                                │
│            │  └─────────────┬──────────────┘   │                                │
│            └────────────────┼──────────────────┘                                │
│                             │                                                   │
│            ┌────────────────┴──────────────┐  ┌──────────────────────────────┐  │
│            │      PostgreSQL 15            │  │     AI INFERENCE ENGINE      │  │
│            │  (users, courses, sessions,   │  │                              │  │
│            │   session_logs, alerts, etc.)  │  │  ┌────────────────────────┐  │  │
│            └───────────────────────────────┘  │  │   Stage 1: YOLOv11n    │  │  │
│                                               │  │   (Person Detection)   │  │  │
│            ┌───────────────────────────────┐  │  └──────────┬─────────────┘  │  │
│            │     Google Gemini API         │  │  ┌──────────┴─────────────┐  │  │
│            │  (Pedagogical Suggestions)    │  │  │  Stage 2: Custom YOLO  │  │  │
│            └───────────────────────────────┘  │  │  (Behavior Classifier) │  │  │
│                                               │  │  8-class taxonomy      │  │  │
│                                               │  └────────────────────────┘  │  │
│                                               │                              │  │
│                                               │  ONNX Runtime + DirectML     │  │
│                                               │  (AMD/NVIDIA GPU accel.)     │  │
│                                               └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow — Live Session

```
┌───────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────────────┐
│  Teacher  │────▶│ POST     │────▶│ Session      │────▶│ ClassSession     │
│  (Browser)│     │ /start   │     │ Manager      │     │ created in DB    │
└───────────┘     └──────────┘     │ (in-memory)  │     │ status=PENDING   │
                                   └──────────────┘     └──────────────────┘
      │
      │  WebSocket Connect
      ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│  WS /ws/stream  │────▶│ InferenceService │────▶│ ClassroomAnalyzer    │
│  /{session_id}  │     │ .stream_video()  │     │                      │
└─────────────────┘     └──────────────────┘     │  Stage 1: detect     │
                                                  │  Stage 2: classify   │
      │                                           │  Compute engagement  │
      │  Per-frame JSON payload                   └──────────────────────┘
      ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│  SessionManager │────▶│ Alert Engine     │────▶│ Gemini AI Service    │
│  .consume_frame │     │ (threshold check)│     │ (async insight)      │
│  (buffer + stats)│    └──────────────────┘     └──────────────────────┘
└───────┬─────────┘
        │  Periodic flush (every 1s or 60 frames)
        ▼
┌─────────────────┐     ┌──────────────────┐
│  SessionRepo    │────▶│  PostgreSQL      │
│  .add_logs()    │     │  session_logs    │
│  .add_metrics() │     │  performance_    │
└─────────────────┘     │  metrics         │
                        └──────────────────┘
```

### 2.3 Component Communication

| From | To | Protocol | Purpose |
|------|----|----------|---------|
| React → FastAPI | HTTP/REST | JWT-authenticated CRUD operations |
| React → FastAPI | WebSocket | Real-time session frame streaming |
| FastAPI → PostgreSQL | TCP (psycopg2) | Persistent data storage |
| FastAPI → AI Engine | In-process (Python) | Frame analysis via ClassroomAnalyzer |
| FastAPI → Gemini | HTTPS | Pedagogical insight generation |
| FastAPI → OpenCV | In-process | Optional local preview window |

---

## 3. AI / Model Component

### 3.1 Two-Stage Cascade Architecture

The inference pipeline uses a **cascade architecture** where two YOLO models work in sequence:

```
Input Video Frame (720p)
         │
         ▼
┌─────────────────────────────────┐
│  STAGE 1: Person Detection       │
│  Model: yolo11n.onnx (10.7 MB)  │
│  Task: Detect all persons        │
│  Class filter: class=[0] (person)│
│  Confidence: 0.3                 │
│  Image size: 640px               │
│  Post-process:                   │
│    - Vertical fragment merging   │
│    - Custom NMS (IoU=0.3)        │
│  Output: Bounding boxes          │
└─────────────────┬───────────────┘
                  │  For each detected person:
                  ▼
┌─────────────────────────────────────────┐
│  STAGE 2: Behavior Classification        │
│  Model: classroom_model_v2/best.onnx    │
│  Task: Classify student behavior         │
│  Input: Cropped person region + padding  │
│  Confidence: 0.1                         │
│  Image size: 416px                       │
│  Output: Behavior label + confidence     │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  AGGREGATION                             │
│  - Count engaged vs distracted           │
│  - Compute engagement_score (%)          │
│  - Encode frame preview (base64 JPEG)    │
│  - Return structured JSON payload        │
└─────────────────────────────────────────┘
```

### 3.2 Behavior Class Taxonomy (8 Classes)

| Class ID | Label | Category | Description |
|----------|-------|----------|-------------|
| 0 | `handrise` | **Engaged** | Student raising hand to ask/answer |
| 1 | `read` | **Engaged** | Student reading material |
| 2 | `write` | **Engaged** | Student writing/taking notes |
| 3 | `sleep` | **Distracted** | Student sleeping at desk |
| 4 | `using_device` | **Distracted** | Student using phone/tablet |
| 5 | `stand` | **Engaged** | Student standing (presenting, etc.) |
| 6 | `look_forward` | **Engaged** | Student attentively facing front |
| 7 | `turn_head` | **Distracted** | Student looking away/distracted |

**Engagement Score Formula:**
```
engagement_score = (engaged_count / total_detected) × 100
```

Where `distracted_labels = {sleep, using_device, turn_head}` and everything else is considered engaged.

### 3.3 Model Training

#### Dataset

- **Total images:** 17,000+ annotated images
- **Sources:** 3 merged datasets with class remapping
- **Master dataset builder:** [build_master_dataset.py](file:///d:/FYP/FYP%20CODE/ai/dataset-creation/build_master_dataset.py)
- **Split:** train / valid / test with YOLO-format labels
- **Format:** YOLO annotation format (class_id center_x center_y width height)

#### Dataset Merging Strategy

The `build_master_dataset.py` script merges multiple source datasets with different class schemas into one unified 8-class taxonomy using configurable class-ID mapping:

```python
MASTER_CLASSES = [
    "handrise",     # 0
    "read",         # 1
    "write",        # 2
    "sleep",        # 3
    "using_device", # 4
    "stand",        # 5
    "look_forward", # 6
    "turn_head",    # 7
]
```

Three source datasets are merged:
1. **`dataset`** — Mapping: `{0→0, 1→1, 2→3, 3→5, 4→4, 5→2}`
2. **`Student Behaviour Detection`** — Mapping: `{0→4, 1→3, 2→1, 3→3, 4→0, 5→4, 6→6, 7→1, 8→3, 9→7, 10→6, 11→2}`
3. **`student-classroom-activity.v6i.yolov11`** — Mapping: `{0→4, 1→3, 2→1}`

#### Training Environment

- **Platform:** Google Colab GPU (T4/A100)
- **Framework:** Ultralytics YOLOv11
- **Notebooks:**
  - [fyp-notebook.ipynb](file:///d:/FYP/FYP%20CODE/ai/fyp-notebook.ipynb) — Full training pipeline
  - [train_model.ipynb](file:///d:/FYP/FYP%20CODE/ai/train_model.ipynb) — Focused training configuration
- **Export:** Models exported to ONNX format for local inference

#### Model Files

| File | Size | Purpose |
|------|------|---------|
| `ai/yolo11n.onnx` | 10.7 MB | Pre-trained person detector (ONNX) |
| `ai/yolo11n.pt` | 5.6 MB | Pre-trained person detector (PyTorch fallback) |
| `ai/yolo26n.pt` | 5.5 MB | Alternative YOLO model |
| `ai/fyp_runs/classroom_model_v2/weights/best.onnx` | varies | Custom-trained behavior classifier (ONNX) |
| `ai/fyp_runs/classroom_model_v2/weights/best.pt` | varies | Custom-trained behavior classifier (PyTorch fallback) |

### 3.4 Inference Pipeline Code Architecture

The core inference logic lives in [inference_utils.py](file:///d:/FYP/FYP%20CODE/ai/inference_utils.py):

```
ai/inference_utils.py
├── ClassroomAnalyzer          # Main analysis class
│   ├── __init__()             # Loads both YOLO models
│   ├── _stage1()              # Person detection + NMS + fragment merging
│   ├── _classify_crop()       # Behavior classification on person crop
│   ├── analyze_frame()        # Full two-stage pipeline for one frame
│   └── analyze_video()        # Iterator over video frames
│
├── resolve_person_model()     # Finds yolo11n.onnx/.pt
├── resolve_behavior_model()   # Finds classroom_model_v2/best.onnx/.pt
├── resolve_video_path()       # Resolves video file paths
├── discover_video_files()     # Scans directories for video files
├── encode_frame_preview()     # Encodes frame to base64 JPEG for WebSocket
├── merge_vertical_fragments() # Post-processing: merges split person boxes
├── nms_person()               # Custom Non-Maximum Suppression
├── iou_xyxy()                 # Intersection over Union calculation
└── clip_box()                 # Clamps bounding box to frame dimensions
```

### 3.5 ONNX Runtime & Hardware Acceleration

The system prioritizes ONNX format for cross-platform GPU inference:

```
ONNX Provider Selection Priority:
1. CUDAExecutionProvider     (NVIDIA GPUs)
2. DmlExecutionProvider      (AMD GPUs via DirectML on Windows)
3. CoreMLExecutionProvider   (Apple Silicon Macs)
4. CPUExecutionProvider      (Fallback)
```

- **AMD RX5700 support** is achieved via `onnxruntime-directml` on Windows
- ONNX models handle dynamic image size errors with automatic retry logic that parses the expected size from error messages

### 3.6 Dynamic Image Size Error Handling

A notable engineering challenge: fixed-shape ONNX models sometimes reject inputs of unexpected spatial dimensions. The `_predict_behavior()` function handles this with a three-tier retry:

1. **Try** with configured `behavior_imgsz` (default: 416)
2. **On `INVALID_ARGUMENT`** error — parse the expected size from the error message and retry
3. **Final fallback** — omit explicit `imgsz` and let the model use its default

---

## 4. Backend Component

### 4.1 Architecture Overview

The backend is a **FastAPI** application structured in layers:

```
backend/
├── main.py                    # FastAPI app, CORS, lifespan, routers
├── config.py                  # Settings dataclass (env-driven)
├── database.py                # SQLAlchemy engine, session factory, Base
├── models.py                  # ORM models (8 tables)
├── schemas.py                 # Pydantic request/response schemas (~40 schemas)
├── security.py                # JWT creation/verification, password hashing
├── deps.py                    # FastAPI dependency injection (auth guards)
├── migrations.py              # Alembic migration helpers
├── __init__.py                # Package init
│
├── routes/
│   ├── auth.py                # Login, Logout, Refresh, Change Password, /me
│   ├── admin.py               # Teacher CRUD, Analytics, Reset Password
│   ├── courses.py             # Course CRUD, Analytics, Alert Config, History
│   └── sessions.py            # Session Start/End, Logs, Metrics, WebSocket
│
├── services/
│   ├── inference_service.py   # InferenceService (wraps ClassroomAnalyzer)
│   ├── session_manager.py     # In-memory session state + alert tracking
│   ├── database.py            # SessionRepository (batch DB writes)
│   ├── gemini_service.py      # Google Gemini AI coaching
│   └── opencv_preview.py      # Optional local OpenCV mirror window
│
├── tests/
│   ├── conftest.py            # Pytest fixtures (SQLite in-memory, TestClient)
│   └── test_api.py            # Integration tests (7 test functions)
│
└── alembic/                   # Database migration scripts
```

### 4.2 Application Lifecycle

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Verify database connectivity
    with Session(bind=engine) as db:
        db.execute(text("SELECT 1"))
    app.state.db_connected = True

    # 2. Pre-load YOLO models (warm start)
    inference_service.ensure_analyzer()
    app.state.models_loaded = True

    yield  # Application runs
```

The lifespan handler ensures:
- Database is reachable before accepting requests
- YOLO models are loaded into memory during startup (30–60s warmup)
- Health endpoint reports both states

### 4.3 Middleware

- **CORS**: Allows `localhost:5173` (Vite dev), `localhost`, `127.0.0.1` origins with credentials
- **Global Exception Handler**: Returns structured JSON for all unhandled exceptions with timestamp

### 4.4 Service Layer Details

#### InferenceService ([inference_service.py](file:///d:/FYP/FYP%20CODE/backend/services/inference_service.py))

Wraps the AI `ClassroomAnalyzer` with async streaming capability:

- Lazily initializes the analyzer on first use
- `stream_video()` — async generator that:
  - Opens video with OpenCV
  - Runs frame analysis in a thread pool (`asyncio.to_thread`)
  - Encodes frame preview as base64 JPEG
  - Enriches payload with latency metrics, FPS, and frame metadata
  - Yields structured dictionaries per frame

#### SessionManager ([session_manager.py](file:///d:/FYP/FYP%20CODE/backend/services/session_manager.py))

Manages in-memory state for active sessions:

- **`LiveSessionState`** dataclass tracks per-session:
  - Video path, frame step, course info
  - Log buffer and performance buffer (batch writes)
  - Running engagement statistics (sum, count, peak distracted)
  - Alert state machine (threshold, duration, active/inactive)
  - Gemini AI insight cache
  - Disconnect timeout handling

- **Alert Engine**: Time-windowed engagement monitoring
  - Tracks consecutive low-engagement duration
  - Triggers alert when engagement drops below threshold for configured duration
  - Auto-resolves when engagement recovers

#### GeminiService ([gemini_service.py](file:///d:/FYP/FYP%20CODE/backend/services/gemini_service.py))

Integrates Google Gemini for real-time pedagogical coaching:

- Uses `google-genai` Python SDK with `gemini-3-flash-preview` model
- Generates brief (≤12 words) coaching messages personalized to teacher name
- Rate-limited: calls every 15 seconds with "significant change" detection
- Exponential backoff on 429 (rate limit) errors with 60s cooldown
- Graceful degradation: works without API key (logs warning, returns None)

#### SessionRepository ([services/database.py](file:///d:/FYP/FYP%20CODE/backend/services/database.py))

Handles batch database operations:

- `add_session_logs()` — Bulk inserts session log entries
- `add_performance_metrics()` — Bulk inserts latency/timing metrics
- `add_alert_event()` — Records alert trigger events
- `finalize_session()` — Updates final score and metadata

#### OpenCVSessionPreview ([opencv_preview.py](file:///d:/FYP/FYP%20CODE/backend/services/opencv_preview.py))

Optional debugging tool:

- Opens a local OpenCV window showing the live session with bounding box overlays
- Enabled via `SESSION_OPENCV_PREVIEW_ENABLED=true` environment variable
- Renders detections, engagement score, FPS, latency, and alert status on the preview frame

---

## 5. Frontend Component

### 5.1 Architecture Overview

The frontend is a **React 18 + TypeScript** single-page application built with **Vite**:

```
frontend/src/
├── app/
│   ├── store.ts               # Redux store (auth + apiSlice)
│   ├── router.tsx             # React Router v6 with lazy-loaded pages
│   ├── providers.tsx          # Redux Provider wrapper
│   ├── hooks.ts               # Typed Redux hooks
│   └── confirm.tsx            # Confirmation dialog utility
│
├── features/
│   ├── auth/
│   │   ├── authSlice.ts       # Redux slice (credentials, role, user)
│   │   ├── token.ts           # Local storage token persistence
│   │   ├── ProtectedRoute.tsx # RBAC route guard component
│   │   └── pages/
│   │       ├── LoginPage.tsx
│   │       └── UserProfilePage.tsx
│   │
│   ├── admin/
│   │   └── pages/
│   │       ├── AdminDashboardPage.tsx    # Teacher/Course management
│   │       └── TeacherProjectPage.tsx    # Deep-dive teacher analytics
│   │
│   ├── teacher/
│   │   └── pages/
│   │       ├── TeacherDashboardPage.tsx  # Overview with stats cards
│   │       ├── TeacherCoursesPage.tsx    # Course list + management
│   │       ├── CourseHistoryPage.tsx     # Audit log viewer
│   │       ├── TeacherSessionsPage.tsx   # Session history table
│   │       └── TeacherAnalyticsPage.tsx  # Engagement trend charts
│   │
│   └── live-session/
│       └── pages/
│           ├── SessionStartPage.tsx      # Course + video selection
│           ├── LiveSessionPage.tsx       # Real-time monitoring view
│           └── SessionSummaryPage.tsx    # Post-session report
│
├── components/
│   ├── layout/
│   │   └── AppLayout.tsx      # Sidebar + main content shell
│   └── modals/
│       ├── BaseModal.tsx
│       ├── CreateTeacherModal.tsx
│       ├── CreateCourseModal.tsx
│       ├── EditCourseModal.tsx
│       ├── ChangePasswordModal.tsx
│       ├── ResetPasswordModal.tsx
│       ├── UpdateAlertConfigModal.tsx
│       └── TeacherSelect.tsx
│
├── services/api/
│   └── apiSlice.ts            # RTK Query: ALL API endpoints (24 hooks)
│
├── hooks/
│   └── useSessionWebSocket.ts # WebSocket hook for live session
│
├── config/
│   └── env.ts                 # API_BASE_URL & WS_BASE_URL
│
├── types/
│   └── auth.ts                # Auth type definitions
│
├── index.css                  # Global styles + Tailwind imports
├── App.tsx                    # Root component
└── main.tsx                   # Vite entry point
```

### 5.2 State Management

**Redux Toolkit** with two slices:

| Slice | Purpose | Key State |
|-------|---------|-----------|
| `authSlice` | Authentication state | `accessToken`, `refreshToken`, `role`, `user` |
| `apiSlice` | RTK Query API cache | Auto-managed server state cache |

**RTK Query** provides 24 auto-generated hooks for all API operations:

```typescript
// Authentication
useLoginMutation, useGetMeQuery, useRefreshMutation,
useLogoutApiMutation, useChangePasswordMutation

// Courses
useGetCoursesQuery, useCreateCourseMutation, useDeleteCourseMutation,
useUpdateCourseMutation, useGetCourseAnalyticsQuery,
useGetAlertConfigQuery, useUpdateAlertConfigMutation,
useGetCourseHistoryQuery

// Sessions
useStartSessionMutation, useEndSessionMutation, useGetSessionsQuery,
useGetSessionByIdQuery, useGetSessionLogsQuery, useGetSessionMetricsQuery

// Admin
useGetTeachersQuery, useCreateTeacherMutation, useUpdateTeacherMutation,
useAdminResetUserPasswordMutation, useGetTeacherAnalyticsQuery,
useGetTeacherProjectPageQuery
```

### 5.3 Authentication Flow with Token Refresh

The `apiSlice` implements an automatic token refresh guard:

```
1. Request fails with 401
2. Check if refresh token exists
3. POST /auth/refresh with refresh token
4. If success: update credentials in Redux, retry original request
5. If failure: dispatch logout, redirect to /login
```

### 5.4 Routing & RBAC

| Route | Component | Allowed Roles | Description |
|-------|-----------|---------------|-------------|
| `/login` | LoginPage | Public | Authentication |
| `/profile` | UserProfilePage | admin, teacher | User settings |
| `/admin` | AdminDashboardPage | admin | Teacher/Course management |
| `/admin/teachers/:id` | TeacherProjectPage | admin | Teacher deep-dive |
| `/dashboard` | TeacherDashboardPage | teacher, admin | Teacher overview |
| `/teacher/courses` | TeacherCoursesPage | teacher, admin | Course listing |
| `/teacher/courses/:id/history` | CourseHistoryPage | teacher, admin | Audit log |
| `/teacher/sessions` | TeacherSessionsPage | teacher, admin | Session history |
| `/teacher/analytics` | TeacherAnalyticsPage | teacher, admin | Engagement charts |
| `/session/start` | SessionStartPage | teacher, admin | Start new session |
| `/session/:id` | LiveSessionPage | teacher, admin | Live monitoring |
| `/session/:id/summary` | SessionSummaryPage | teacher, admin | Post-session report |

### 5.5 WebSocket Integration

The [useSessionWebSocket](file:///d:/FYP/FYP%20CODE/frontend/src/hooks/useSessionWebSocket.ts) hook manages the live data stream:

```typescript
// SessionPayload interface (key fields)
interface SessionPayload {
  session_id: number
  frame_index: number
  timestamp_sec: number
  engagement_score: number
  engaged_count: number
  distracted_count: number
  student_count: number
  processing_latency_ms: number
  live_fps: number
  frame_jpeg_base64: string          // Base64-encoded annotated frame
  stream_completed: boolean
  classifications: Detection[]        // Per-student behavior labels
  alert_state: {
    active: boolean
    reason: string
    triggered_at?: string
  }
  message?: string                    // AI coaching messages
  course_name?: string
}
```

Features:
- Auto-reconnect on non-clean disconnects (every 3 seconds)
- Heartbeat ping every 30 seconds
- JWT token attached as query parameter for authenticated WebSocket proxies

### 5.6 Key Frontend Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3.1 | UI framework |
| `react-router-dom` | ^6.30.1 | Client-side routing |
| `@reduxjs/toolkit` | ^2.11.2 | State management + RTK Query |
| `react-redux` | ^9.2.0 | React-Redux bindings |
| `react-use-websocket` | ^4.13.0 | WebSocket hook |
| `recharts` | ^3.8.1 | Data visualization charts |
| `tailwindcss` | ^3.4.19 | Utility-first CSS |
| `lucide-react` | ^1.7.0 | Icon library |
| `react-icons` | ^5.6.0 | Additional icon set |
| `react-hot-toast` | ^2.6.0 | Toast notifications |
| `class-variance-authority` | ^0.7.1 | Component variant styling |
| `clsx` + `tailwind-merge` | latest | Conditional class merging |

---

## 6. Database Design

### 6.1 Entity-Relationship Diagram

```mermaid
erDiagram
    users ||--o{ courses : "instructs"
    users ||--o{ audit_logs : "performs"
    courses ||--o{ sessions : "has"
    courses ||--o{ alert_configs : "has"
    courses ||--o{ audit_logs : "references"
    sessions ||--o{ session_logs : "records"
    sessions ||--o{ alert_events : "triggers"
    sessions ||--o{ performance_metrics : "measures"

    users {
        int id PK
        varchar name
        varchar email UK
        varchar hashed_password
        enum role
        boolean is_active
        int token_version
        timestamp created_at
    }

    courses {
        int id PK
        varchar course_name
        varchar course_code
        int semester
        int section
        int instructor_id FK
        timestamp created_at
    }

    sessions {
        int id PK
        int course_id FK
        timestamp start_time
        timestamp end_time
        float final_avg_score
        enum status
        text video_path
        json session_metadata
    }

    session_logs {
        int id PK
        int session_id FK
        timestamp timestamp
        float engagement_score
        int engaged_count
        int distracted_count
        json payload
    }

    alert_configs {
        int id PK
        int course_id FK
        float engagement_threshold
        int duration_seconds
        boolean enabled
        timestamp created_at
    }

    alert_events {
        int id PK
        int session_id FK
        timestamp triggered_at
        float engagement_at_trigger
        text reason
        timestamp resolved_at
    }

    performance_metrics {
        int id PK
        int session_id FK
        varchar metric_type
        float value
        timestamp timestamp
    }

    audit_logs {
        int id PK
        timestamp timestamp
        int user_id FK
        int course_id FK
        varchar action
        json details
    }
```

### 6.2 Table Descriptions

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `users` | Admin and Teacher accounts | `1:N → courses` |
| `courses` | Academic courses with code/semester/section | `N:1 → users`, `1:N → sessions` |
| `sessions` | Analysis sessions (one video run) | `N:1 → courses`, `1:N → logs, alerts, metrics` |
| `session_logs` | Per-frame engagement data (batched) | `N:1 → sessions` |
| `alert_configs` | Per-course engagement alert thresholds | `1:1 → courses` |
| `alert_events` | Historical alert trigger records | `N:1 → sessions` |
| `performance_metrics` | Processing latency and timing data | `N:1 → sessions` |
| `audit_logs` | Administrative action audit trail | `N:1 → users, courses` |

### 6.3 Unique Constraints

- `users.email` — Globally unique
- `courses (course_code, semester, section)` — Composite unique constraint
- `alert_configs.course_id` — One config per course

### 6.4 Session Status Enum

| Status | Description |
|--------|-------------|
| `PENDING` | Session created, waiting for WebSocket connection |
| `RUNNING` | WebSocket connected, inference in progress |
| `PAUSED` | Client disconnected, waiting for reconnect or auto-timeout |
| `COMPLETED` | Session finalized with engagement summary |

---

## 7. Authentication & Authorization

### 7.1 Authentication Mechanism

The system uses **JWT (JSON Web Token)** authentication:

```
┌──────────────────────────────────────────────────────────┐
│                    JWT Token Structure                     │
├──────────────────┬───────────────────────────────────────┤
│  sub             │  User email (subject)                 │
│  typ             │  "access" or "refresh"                │
│  jti             │  Unique token ID (UUID)               │
│  exp             │  Expiration timestamp                 │
│  iat             │  Issued at timestamp                  │
│  role            │  "admin" or "teacher"                 │
│  tv              │  Token version (for invalidation)     │
└──────────────────┴───────────────────────────────────────┘
```

### 7.2 Password Security

- **Algorithm:** PBKDF2-SHA256 with 210,000 iterations
- **Salt:** 16-byte random hex per password
- **Format:** `pbkdf2_sha256$210000$<salt>$<base64-digest>`
- **Comparison:** Constant-time via `hmac.compare_digest()`

### 7.3 Token Lifecycle

| Token | Duration | Purpose |
|-------|----------|---------|
| Access Token | 300 minutes (5 hours) | API authentication |
| Refresh Token | 7 days | Obtain new access tokens |

### 7.4 Token Versioning & Invalidation

Each user has a `token_version` counter. When the user:
- **Logs out** → `token_version += 1` (invalidates all existing tokens)
- **Changes password** → `token_version += 1`
- **Admin resets password** → `token_version += 1`

The `get_current_user` dependency verifies the token's `tv` claim matches the user's current `token_version`.

### 7.5 Role-Based Access Control (RBAC)

| Action | Admin | Teacher |
|--------|-------|---------|
| List all courses | ✅ | Own courses only |
| Create/delete courses | ✅ | Own courses only |
| Manage teachers | ✅ | ❌ |
| Start sessions | ✅ | Own courses only |
| View all sessions | ✅ | Own courses only |
| Configure alerts | ✅ | ❌ |
| Reset passwords | ✅ | ❌ |
| View analytics | ✅ All | Own only |

---

## 8. Real-Time Streaming Pipeline

### 8.1 WebSocket Protocol

**Endpoint:** `WS /sessions/ws/stream/{session_id}`

**Lifecycle:**
1. Client connects → server accepts
2. Server validates session exists in SessionManager
3. Server marks session as `RUNNING` in database
4. Server loads alert configuration for the course
5. Server begins async video analysis loop
6. Per frame: analyze → buffer → check alerts → inject AI insights → send JSON
7. On video exhaustion: auto-complete session, send `stream_completed: true`
8. On client disconnect: pause session, start 30s auto-complete timeout
9. On manual end: flush buffers, compute final summary, mark `COMPLETED`

### 8.2 Frame Payload Schema (v2)

```json
{
  "stream_schema_version": 2,
  "session_id": 42,
  "course_name": "Data Structures",
  "frame_index": 150,
  "timestamp_sec": 5.0,
  "frame_width": 1280,
  "frame_height": 720,
  "raw_stage1_boxes": 12,
  "behavior_boxes": 10,
  "student_count": 10,
  "engaged_count": 7,
  "distracted_count": 3,
  "classified_count": 10,
  "unknown_count": 0,
  "engagement_score": 70.0,
  "label_counts": {
    "look_forward": 4,
    "write": 2,
    "read": 1,
    "sleep": 1,
    "using_device": 1,
    "turn_head": 1
  },
  "classifications": [
    {
      "person_index": 1,
      "box": [120, 80, 250, 400],
      "label": "look_forward",
      "confidence": 0.87,
      "status": "classified"
    }
  ],
  "frame_jpeg_base64": "/9j/4AAQ...",
  "processing_latency_ms": 85.42,
  "runtime_sec": 12.50,
  "processed_frames": 30,
  "live_fps": 2.40,
  "source_fps": 30.0,
  "frame_step": 5,
  "alert_state": {
    "active": false,
    "reason": "",
    "triggered_at": null,
    "ai_insight": null
  },
  "message": "AI Coach: Great energy, keep it up!"
}
```

### 8.3 Batch Logging Strategy

- **Log Buffer:** Frames accumulate in `LiveSessionState.log_buffer`
- **Flush Triggers:**
  - Every `session_log_flush_interval_seconds` (default: 1.0s)
  - When buffer reaches `session_log_batch_size` (default: 60 frames)
- **Performance Buffer:** Latency metrics flushed on the same schedule
- **Final Flush:** All remaining buffered data flushed on session end/disconnect

### 8.4 Disconnect Handling

```
Client Disconnects
       │
       ▼
Session marked PAUSED in DB
       │
       ▼
30-second auto-timeout task started
       │
       ├── Client reconnects within 30s → Cancel timeout, resume
       │
       └── 30s elapsed → Auto-complete session
           ├── Flush pending logs/metrics
           ├── Compute final summary
           ├── Mark COMPLETED with "auto_ended_on_disconnect": true
           └── Remove from SessionManager
```

### 8.5 Stale Session Cleanup

On session start, the system automatically detects and closes stale sessions:
- Sessions marked as `PENDING`, `RUNNING`, or `PAUSED` in the database that have no corresponding in-memory state are auto-completed
- Prevents duplicate active sessions per course and per teacher

---

## 9. Gemini AI Coaching Integration

### 9.1 Architecture

```
┌─────────────────────────────┐
│  WebSocket Stream Loop       │
│                             │
│  Every 15 seconds:          │
│  ├── Check engagement delta │
│  ├── Significant change?    │
│  │   ├── YES → Call Gemini  │
│  │   └── NO  → Skip        │
│  └── Inject insight into    │
│      outgoing payload       │
└─────────────────────────────┘
```

### 9.2 Trigger Conditions

An AI coaching call is made when ANY of these conditions are met:
1. **Engagement change ≥ 5%** from last AI call
2. **Alert state change** (active ↔ inactive)
3. **3+ minutes** since last AI call (forced update)
4. **First call** of the session

### 9.3 Prompt Engineering

The Gemini prompt is designed for:
- **Brevity:** Maximum 12 words
- **Personalization:** Addresses teacher by name
- **Context-awareness:** Uses engagement score, distracted count, student count
- **Tone scaling:**
  - ≥ 90% engagement → Impressed/excited
  - 80–89% → Casual/cool
  - < 70% → Urgent but supportive

### 9.4 Rate Limiting

- **Minimum interval:** 15 seconds between calls
- **Backoff on 429:** 60-second cooldown
- **Significance filter:** Skips calls when engagement is stable
- **Graceful degradation:** System works normally without Gemini API key

---

## 10. Scripts & Tooling

### 10.1 AI Scripts

| Script | Path | Purpose |
|--------|------|---------|
| Video Smoke Test | [test_video.py](file:///d:/FYP/FYP%20CODE/ai/tests/test_video.py) | Standalone video analysis with OpenCV preview |
| Image Test | [test_image.py](file:///d:/FYP/FYP%20CODE/ai/tests/test_image.py) | Single-image inference test |
| Dataset Builder | [build_master_dataset.py](file:///d:/FYP/FYP%20CODE/ai/dataset-creation/build_master_dataset.py) | Merges datasets with class remapping |
| ONNX Backend | [onnx.py](file:///d:/FYP/FYP%20CODE/ai/scripts/onnx.py) | ONNX Runtime inference backend implementation |

#### `test_video.py` — Video Smoke Test
```powershell
# Run with default test video
python ai/tests/test_video.py

# Run with specific video and options
python ai/tests/test_video.py path/to/video.mp4 --frame-step 5 --behavior-conf 0.1 --save-video --show-providers
```

Features:
- Real-time OpenCV preview with bounding boxes
- Saves annotated output video
- Exports JSON summary with per-frame detections
- Configurable frame step, confidence thresholds, and model paths

#### `build_master_dataset.py` — Dataset Merger
```powershell
# Build unified dataset from source datasets
python ai/dataset-creation/build_master_dataset.py --datasets-dir ./datasets --output-dir ./master_dataset --overwrite
```

Features:
- Remaps class IDs across multiple dataset schemas
- Handles train/valid/test splits
- Generates `data.yaml` for YOLO training
- Deduplicates filenames with auto-incrementing suffixes

### 10.2 Backend Commands

| Command | Purpose |
|---------|---------|
| `uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000` | Start API server |
| `python -m alembic -c alembic.ini upgrade head` | Run database migrations |
| `pytest backend/tests -v` | Run backend integration tests |
| `$env:SESSION_OPENCV_PREVIEW_ENABLED="true"` | Enable local OpenCV mirror |

### 10.3 Frontend Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | Production build (TypeScript check + Vite) |
| `npm run lint` | ESLint check |
| `npm run preview` | Preview production build |

---

## 11. DevOps & Deployment

### 11.1 Docker Configuration

#### Dockerfile (Backend)

```dockerfile
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libgl1 libsm6 libxext6 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt -r /app/backend/requirements.txt
COPY . /app

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Docker Compose

```yaml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: fyp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: 1234
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]

  api:
    build: .
    depends_on: [db]
    environment:
      DATABASE_URL: postgresql+psycopg2://postgres:1234@db:5432/fyp
      SECRET_KEY: change-me
      AI_DIR: /app/ai
      VIDEO_ROOT: /app/ai
    ports: ["8000:8000"]
    volumes: [".:/app"]

volumes:
  postgres_data:
```

### 11.2 Local Development Setup

#### Prerequisites
- Python 3.11+
- Node.js 18+ / npm 9+
- PostgreSQL 15 (or Docker)

#### Backend Setup
```powershell
cd "d:\FYP\FYP CODE"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
pip install -r requirements.txt

# Run migrations
python -m alembic -c alembic.ini upgrade head

# Start API
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup
```powershell
cd "d:\FYP\FYP CODE\frontend"
npm install
npm run dev
```

#### Docker Setup
```powershell
cd "d:\FYP\FYP CODE"
docker compose up --build
```

### 11.3 Default Seeded Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@fyp.com | admin123 | Admin |
| teacher@fyp.com | teacher123 | Teacher |
| teacher2@fyp.com | teacher123 | Teacher |
| teacher3@fyp.com | teacher123 | Teacher |

---

## 12. API Reference

### 12.1 Authentication Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/auth/login` | Login with email/password → JWT tokens | ❌ |
| GET | `/auth/me` | Get current user info | ✅ |
| POST | `/auth/refresh` | Refresh access token | ❌ (uses refresh token) |
| POST | `/auth/logout` | Logout (increments token version) | ✅ |
| POST | `/auth/change-password` | Change own password | ✅ |

### 12.2 Admin Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/admin/teachers` | List teachers (search, filter, paginate) | Admin |
| POST | `/admin/teachers` | Create teacher + optional courses | Admin |
| PATCH | `/admin/teachers/{id}` | Update teacher name/email/active | Admin |
| DELETE | `/admin/teachers/{id}` | Delete teacher | Admin |
| DELETE | `/admin/teachers` | Delete all teachers | Admin |
| GET | `/admin/teachers/{id}/analytics` | Teacher performance analytics | Admin |
| GET | `/admin/teachers/{id}/project` | Full teacher project page data | Admin |
| POST | `/admin/users/{id}/reset-password` | Admin reset user password | Admin |
| DELETE | `/admin/courses` | Delete all courses | Admin |

### 12.3 Course Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/courses` | List courses (search, filter, paginate) | ✅ (scoped) |
| POST | `/courses` | Create course | ✅ |
| PATCH | `/courses/{id}` | Update course details | ✅ (owner/admin) |
| DELETE | `/courses/{id}` | Delete course + cascade | Admin |
| GET | `/courses/{id}/analytics` | Course engagement analytics + trend | ✅ (owner/admin) |
| GET | `/courses/{id}/alert-config` | Get alert threshold config | ✅ (owner/admin) |
| PUT | `/courses/{id}/alert-config` | Create/update alert config | Admin |
| GET | `/courses/{id}/history` | Audit log for course actions | ✅ (owner/admin) |

### 12.4 Session Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/sessions` | List sessions (filter by course/status) | ✅ (scoped) |
| GET | `/sessions/{id}` | Get session details | ✅ (scoped) |
| POST | `/sessions/start` | Start new analysis session | ✅ (course owner) |
| POST | `/sessions/{id}/end` | End session + compute final score | ✅ (course owner) |
| GET | `/sessions/{id}/logs` | Get session log entries (paginated) | ✅ (scoped) |
| GET | `/sessions/{id}/metrics` | Get performance metrics | ✅ (scoped) |
| WS | `/sessions/ws/stream/{id}` | Live frame-by-frame WebSocket stream | Via session state |

### 12.5 Utility Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/health` | Health check (DB + models status) | ❌ |

### 12.6 API Quick Flow Example

```http
# 1) Login
POST /auth/login
{"email": "teacher@fyp.com", "password": "teacher123"}
→ {"access_token": "<jwt>", "refresh_token": "<jwt>", "token_type": "bearer"}

# 2) List Courses
GET /courses?include_videos=true
Authorization: Bearer <jwt>
→ {"items": [{"id": 1, "course_name": "...", "available_videos": [...]}], ...}

# 3) Start Session
POST /sessions/start
{"course_id": 1, "video_path": "tests/test_video.mp4", "frame_step": 5}
→ {"session_id": 7, "status": "PENDING", ...}

# 4) Stream via WebSocket
ws://localhost:8000/sessions/ws/stream/7
→ {...frame payload JSON per analyzed frame...}

# 5) End Session
POST /sessions/7/end
→ {"session_id": 7, "status": "COMPLETED", "final_avg_score": 72.5}
```

### 12.7 Swagger Documentation

Auto-generated interactive API docs available at: `http://localhost:8000/docs`

---

## 13. Testing Strategy

### 13.1 Backend Integration Tests

Located at [test_api.py](file:///d:/FYP/FYP%20CODE/backend/tests/test_api.py) with 7 test functions:

| Test | Description |
|------|-------------|
| `test_login_success` | Verify login + health check |
| `test_auth_me_refresh_logout_and_change_password` | Full auth lifecycle: /me → refresh → change password → old password fails → admin reset |
| `test_login_with_username_field` | Legacy support: `username` field alias for `email` |
| `test_admin_teacher_provisioning_rbac` | RBAC: teacher can't create teachers (403), admin can (200) |
| `test_session_start_end_and_websocket_stream` | Full session lifecycle: start → WebSocket → end |
| `test_sessions_list_and_detail_endpoints` | Session listing + detail + RBAC scoping |
| `test_session_logs_and_analytics_endpoints` | Log retrieval + course/teacher analytics |
| `test_alert_config_and_session_metrics` | Alert config + alert triggering during low engagement |

**Test Infrastructure:**
- Uses **in-memory SQLite** database via `conftest.py`
- Mock inference service (`_MockStream`, `_LowEngagementStream`) for deterministic testing
- FastAPI `TestClient` with WebSocket testing support

### 13.2 Running Tests

```powershell
# Backend tests
cd "d:\FYP\FYP CODE"
pytest backend/tests -v

# AI video smoke test (requires models + GPU)
python ai/tests/test_video.py

# Frontend type check + build
cd frontend
npm run build
```

### 13.3 AI Model Validation

- [test_video.py](file:///d:/FYP/FYP%20CODE/ai/tests/test_video.py) — Full video pipeline test with visual output
- [test_image.py](file:///d:/FYP/FYP%20CODE/ai/tests/test_image.py) — Single image inference test
- Output: `ai/tests/video_summary.json` — JSON with per-frame detection stats

---

## 14. Environment Configuration

### 14.1 Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+psycopg2://postgres:1234@localhost:5432/fyp` | PostgreSQL connection |
| `SECRET_KEY` | `change-me` | JWT signing key |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `300` | Access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token TTL |
| `GEMINI_API_KEY` | `None` | Google Gemini API key (optional) |
| `AI_DIR` | `./ai` | Path to AI models directory |
| `VIDEO_ROOT` | `./ai` | Root path for video file discovery |
| `SESSION_LOG_BATCH_SIZE` | `60` | Frames before forced DB flush |
| `SESSION_LOG_FLUSH_INTERVAL_SECONDS` | `1.0` | Time-based DB flush interval |
| `SESSION_DISCONNECT_TIMEOUT_SECONDS` | `30` | Auto-complete delay after disconnect |
| `SESSION_OPENCV_PREVIEW_ENABLED` | `false` | Enable local OpenCV mirror window |
| `SESSION_OPENCV_PREVIEW_WINDOW_NAME` | `Session Live Preview` | OpenCV window title |
| `ENVIRONMENT` | `dev` | Runtime environment |

### 14.2 Frontend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend API base URL |
| `VITE_WS_BASE_URL` | `ws://localhost:8000` | Backend WebSocket base URL |

---

## 15. Repository Structure

```
FYP CODE/
│
├── .env                           # Environment variables (gitignored)
├── .gitignore                     # Git ignore rules
├── Dockerfile                     # Backend Docker image definition
├── docker-compose.yml             # Docker Compose orchestration
├── alembic.ini                    # Alembic migration configuration
├── requirements.txt               # AI/ML Python dependencies
├── README.md                      # Project README
│
├── ai/                            # AI / Model component
│   ├── inference_utils.py         # Core: ClassroomAnalyzer + utilities
│   ├── yolo11n.onnx               # Person detection model (ONNX)
│   ├── yolo11n.pt                 # Person detection model (PyTorch)
│   ├── yolo26n.pt                 # Alternative YOLO model
│   ├── fyp-notebook.ipynb         # Colab training notebook
│   ├── train_model.ipynb          # Training configuration notebook
│   │
│   ├── fyp_runs/                  # Training outputs
│   │   └── classroom_model_v2/
│   │       └── weights/
│   │           ├── best.onnx      # Behavior classifier (ONNX)
│   │           └── best.pt        # Behavior classifier (PyTorch)
│   │
│   ├── dataset/                   # Source dataset (labeled images)
│   ├── dataset-creation/
│   │   ├── build_master_dataset.py
│   │   └── datasets/
│   │
│   ├── scripts/
│   │   └── onnx.py                # ONNX Runtime backend class
│   │
│   └── tests/
│       ├── test_video.py          # Video smoke test
│       ├── test_image.py          # Image inference test
│       ├── test_video*.mp4        # Test video files
│       ├── test_image*.jpg        # Test image files
│       └── video_summary.json     # Test output summary
│
├── backend/                       # FastAPI backend
│   ├── __init__.py
│   ├── main.py                    # App entry + middleware + routers
│   ├── config.py                  # Settings dataclass
│   ├── database.py                # SQLAlchemy engine + session
│   ├── models.py                  # 8 ORM models
│   ├── schemas.py                 # ~40 Pydantic schemas
│   ├── security.py                # JWT + password hashing
│   ├── deps.py                    # Auth dependency injection
│   ├── migrations.py
│   ├── requirements.txt
│   │
│   ├── routes/
│   │   ├── auth.py                # 5 auth endpoints
│   │   ├── admin.py               # 9 admin endpoints
│   │   ├── courses.py             # 8 course endpoints
│   │   └── sessions.py            # 7 session endpoints (incl. WebSocket)
│   │
│   ├── services/
│   │   ├── inference_service.py
│   │   ├── session_manager.py
│   │   ├── database.py
│   │   ├── gemini_service.py
│   │   └── opencv_preview.py
│   │
│   ├── tests/
│   │   ├── conftest.py
│   │   └── test_api.py            # 7 integration tests
│   │
│   └── alembic/
│
├── frontend/                      # React dashboard
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── index.html
│   │
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── app/                   # store, router, providers, hooks
│       ├── features/              # auth (2p), admin (2p), teacher (5p), live-session (3p)
│       ├── components/            # layout + 8 modals
│       ├── services/api/          # RTK Query apiSlice (24 hooks)
│       ├── hooks/                 # useSessionWebSocket
│       ├── config/                # env.ts
│       └── types/                 # auth.ts
│
└── docs/                          # Documentation
    ├── FYP_SYSTEM_DOCUMENTATION.md
    ├── backend_plan.md
    ├── model_v2_phase2_report.md
    ├── ADMIN_DASHBOARD_COMPLETION.md
    ├── progress_report_2026_04_12.md
    ├── worklog_2026-04-05.md
    └── worklog_2026-04-09.md
```

---

## 16. Performance Benchmarks

### 16.1 Inference Performance (AMD RX5700 + ONNX DirectML)

| Metric | Value |
|--------|-------|
| Frame processing latency | ~50–100 ms per frame |
| Live FPS (with frame_step=5) | ~2–4 FPS (analyzed frames) |
| Model warmup (first load) | ~30–60 seconds |
| ONNX model size (total) | ~16 MB |
| Video decode overhead | Negligible (OpenCV GPU-assisted) |

### 16.2 WebSocket Streaming

| Metric | Value |
|--------|-------|
| Frame-to-client latency | ~50–200 ms |
| Payload size (with preview) | ~20–50 KB per frame |
| Payload size (without preview) | ~2–5 KB per frame |

### 16.3 Database Performance

| Operation | Strategy | Frequency |
|-----------|----------|-----------|
| Session log writes | Batch insert | Every 1s or 60 frames |
| Performance metrics | Batch insert | Same as logs |
| Session finalization | Single update | Once per session |
| Alert events | Individual insert | On trigger only |

---

## 17. Known Limitations & Future Work

### 17.1 Current Limitations

| Limitation | Description |
|------------|-------------|
| **Video from disk only** | No live IP camera (RTSP) feeds — uses pre-recorded MP4 files |
| **Local deployment** | No cloud deployment; runs on localhost only |
| **Single GPU** | No multi-GPU distributed inference |
| **Windows-only GPU** | AMD GPU acceleration via DirectML (Windows only) |
| **No session resume** | Disconnected sessions auto-timeout after 30 seconds |
| **Model instability** | Behavior classifier shows some instability in crowded scenes |
| **Batch logging** | Per-frame data batched every 60 frames (not individual writes) |
| **Python 3.12+ deprecations** | `datetime.utcnow()` warnings in multiple backend files |

### 17.2 Future Enhancements

| Enhancement | Priority | Description |
|-------------|----------|-------------|
| RTSP Live Camera Feed | High | Real-time analysis from classroom IP cameras |
| Model Retraining | High | Improve behavior classifier with more data and fine-tuning |
| Cloud Deployment | Medium | AWS/GCP deployment with GPU instances |
| Concurrent Session Limits | Medium | Prevent GPU overload from multiple simultaneous sessions |
| Session Resume | Medium | Allow reconnecting to paused sessions |
| Multi-GPU Support | Low | Distribute inference across multiple GPUs |
| Period Report Generation | Medium | Automated engagement reports per SRS REQ-8 |
| Frontend Polish | High | Premium, modern design for teacher dashboard |
| Training Data Export | Low | Export classified data for model retraining pipeline |
| Mobile Responsive UI | Low | Responsive design for tablet/mobile access |

---

## Appendix A: Python Dependency Lists

### AI / ML Dependencies (`requirements.txt`)
```
ultralytics==8.4.30
opencv-python>=4.8.0
torch>=2.1.0
torchvision>=0.16.0
pyyaml>=6.0
numpy>=1.24.0
Pillow>=10.0.0
matplotlib>=3.8.0
notebook>=7.0.0
onnxruntime-directml>=1.18.0  (Windows only)
onnxruntime>=1.18.0           (non-Windows)
```

### Backend Dependencies (`backend/requirements.txt`)
```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
sqlalchemy>=2.0.0
alembic>=1.13.0
psycopg2-binary>=2.9.9
pydantic>=2.7.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.9
email-validator>=2.2.0
pytest>=8.2.0
google-genai>=0.1.0
```

### Frontend Dependencies (`frontend/package.json`)
```
@reduxjs/toolkit: ^2.11.2
react: ^18.3.1
react-dom: ^18.3.1
react-router-dom: ^6.30.1
react-redux: ^9.2.0
react-use-websocket: ^4.13.0
recharts: ^3.8.1
tailwindcss: ^3.4.19
lucide-react: ^1.7.0
react-icons: ^5.6.0
react-hot-toast: ^2.6.0
class-variance-authority: ^0.7.1
clsx: ^2.1.1
tailwind-merge: ^3.5.0
vite: ^8.0.4
typescript: ~6.0.2
```

---

## Appendix B: Quick Start Commands

```powershell
# ─── Clone & Setup ───────────────────────────────────────────
cd "d:\FYP\FYP CODE"

# Backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
pip install -r requirements.txt
python -m alembic -c alembic.ini upgrade head
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev

# ─── Testing ─────────────────────────────────────────────────
pytest backend/tests -v                    # Backend tests
python ai/tests/test_video.py              # AI pipeline test
cd frontend && npm run build               # Frontend type check

# ─── Docker (Alternative) ────────────────────────────────────
docker compose up --build

# ─── URLs ────────────────────────────────────────────────────
# API:       http://localhost:8000
# Swagger:   http://localhost:8000/docs
# Frontend:  http://localhost:5173
# Health:    http://localhost:8000/health
```

---

*This documentation was generated for the Final Year Project at Lahore Garrison University, Department of Computer Science, April 2026.*
