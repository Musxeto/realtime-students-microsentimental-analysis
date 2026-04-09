from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from .bootstrap import ensure_seed_data
from .database import engine
from .migrations import upgrade_to_head
from .models import ClassSession, Course, SessionLog, User
from .routes.admin import router as admin_router
from .routes.auth import router as auth_router
from .routes.courses import router as courses_router
from .routes.sessions import router as sessions_router
from .services.inference_service import inference_service


app = FastAPI(title="Real-time Students Micro-Sentimental Analysis API", version="0.1.0")

app.state.db_connected = False
app.state.models_loaded = False

app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(courses_router)
app.include_router(sessions_router)


@app.on_event("startup")
def startup_event():
    upgrade_to_head()

    with Session(bind=engine) as db:
        db.execute(text("SELECT 1"))
        ensure_seed_data(db)
    app.state.db_connected = True

    # Warm model load so first websocket request has no cold-start delay.
    inference_service.ensure_analyzer()
    app.state.models_loaded = True


@app.get("/health")
def health():
    return {
        "status": "ok",
        "db_connected": bool(app.state.db_connected),
        "models_loaded": bool(app.state.models_loaded),
    }


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error_code": "INTERNAL_SERVER_ERROR",
            "message": str(exc),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
