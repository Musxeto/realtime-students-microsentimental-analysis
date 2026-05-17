# Changelog

All notable changes to the FYP platform are documented here.

---

## [v2.0] — May 2026

### AI / Model

#### Changed
- **Replaced two-stage cascade pipeline with a single-stage fine-tuned YOLOv11 model.**
  - Removed: separate person detector (`yolo11n.onnx`) + behavior classifier (crop-and-classify)
  - Added: `lgu_classroom_finetune` fine-tuned YOLOv11 model that detects and classifies behaviors in one forward pass
  - Active weights: `ai/fyp_runs/lgu_classroom_finetune/weights/best.pt`
- `ClassroomAnalyzer.__init__()` now loads only one model (no `person_model` attribute)
- `ClassroomAnalyzer.analyze_frame()` now calls `model.predict()` on the full frame; no cropping stages
- Removed helper functions: `_stage1()`, `_classify_crop()`, `merge_vertical_fragments()`
- Retained utility helpers: `nms_person()`, `iou_xyxy()`, `clip_box()`, `encode_frame_preview()`

#### Added
- Fine-tuning notebook: `ai/fyp-finetuning-notebook.ipynb`
- Fine-tuned run artifacts: `ai/fyp_runs/lgu_classroom_finetune/`

---

### Backend

#### Changed (LLM / AI Coaching)
- **Replaced Google Gemini API with OpenAI API (GPT-4o-mini).**
  - Removed: `gemini_service.py` (now a deprecated empty stub)
  - Added: `openai_service.py` — uses `httpx` async client to call OpenAI Chat Completions endpoint
  - Model used: `gpt-4o-mini`; max tokens: 100; temperature: 0.8
- AI coach now uses a **10-second rolling engagement window** (list of `(monotonic_time, score)` tuples) instead of instant point values, reducing noisy calls
- Minimum AI update interval changed from **15 seconds** to **60 seconds** (configurable, DB-persisted)
- Rate-limit backoff: 60 s on HTTP 429 (unchanged behaviour, now applies to OpenAI)
- Prompt tone now has three tiers: Stern (< 70%), Firm (70–80%), Celebratory (≥ 80%)
- Response length: ≤ 100 tokens (was ≤ 12 words with Gemini)
- All LLM calls are dispatched as non-blocking `asyncio.Task`s

#### Added (Backend)
- `backend/services/ai_settings.py` — `get_ai_update_interval_seconds()`, `upsert_ai_settings()`
- `backend/models.py` — `AISettings` ORM table (`update_interval_seconds`, `created_at`, `updated_at`)
- `backend/models.py` — `AuditLog` ORM table (replaces manual audit tracking)
- `backend/models.py` — `AlertEvent` ORM table (persists alert triggers with engagement snapshot)
- `backend/models.py` — `PerformanceMetric` ORM table (per-frame processing latency)
- `GET /admin/summary` — Platform-wide aggregated stats
- `GET /admin/settings/ai` — Read AI coach update interval
- `PUT /admin/settings/ai` — Update AI coach update interval (live, no restart needed)
- `GET /admin/teachers/{id}/project` — Full teacher project deep-dive page
- `DELETE /admin/teachers` — Bulk delete all teachers
- `DELETE /admin/courses` — Bulk delete all courses
- `GET /sessions/{id}/metrics` — Returns avg/P95 latency, FPS, alert count, avg engagement score
- `_cleanup_stale_active_sessions()` — Auto-closes orphaned PENDING/RUNNING/PAUSED sessions on server restart
- `AuditLog` entry (action=`CLASS_COMPLETED`) written on every session end
- Alert events persisted to `alert_events` table on trigger
- IP camera support: `InferenceService` probes multiple URL variants for HTTP/RTSP sources
- `IP_CAMERA_STREAM_SOURCES` config env var (comma-separated stream URLs)
- `SESSION_LOG_FLUSH_INTERVAL_SECONDS` config env var (default: 1.0 s)

#### Changed (Backend)
- Log flush trigger: now flushes on **time interval** (1 s) OR batch size (60 frames), whichever comes first
- Session end: now records audit log entry and drains performance buffer before finalizing
- Session WebSocket: stale active sessions auto-cleaned before new session creation

---

### Frontend

#### Changed
- Live session dashboard completely redesigned with glassmorphism aesthetics and theme awareness
- AI coach panel now shows OpenAI-generated messages with tone-based color styling
- Replaced static intervention log table with animated, real-time AI coach feed
- Alert system overhauled: toast notifications + full-screen modal overlay for low engagement
- Session completion: full-screen summary modal shown automatically when stream ends
- Engagement chart uses 10-second rolling window for smoother display

#### Added
- `features/theme/` — Dedicated theme feature module (dark/light mode provider)
- Admin AI Settings panel: UI to configure OpenAI coach update interval
- Session completion modal with final engagement summary
- Low-engagement full-screen modal alert
- Toast notifications for alert state changes
- Admin dashboard pagination, search, and filter for teacher and course management
- Bulk action support in admin teacher management

---

## [v1.0] — April 2026

- Initial release with two-stage YOLO cascade, Google Gemini AI coaching, and basic React dashboard.
- See `docs/FYP_SYSTEM_DOCUMENTATION.md` for the original architecture.
