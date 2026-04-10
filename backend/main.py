from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import os
import sys
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

try:
    from .database import engine
    from .models import ClassSession, Course, SessionLog, User
    from .routes.admin import router as admin_router
    from .routes.auth import router as auth_router
    from .routes.courses import router as courses_router
    from .routes.sessions import router as sessions_router
    from .services.inference_service import inference_service
except ImportError:
    # Allow running this file directly with: python main.py
    project_root = Path(__file__).resolve().parents[1]
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    from backend.database import engine
    from backend.models import ClassSession, Course, SessionLog, User
    from backend.routes.admin import router as admin_router
    from backend.routes.auth import router as auth_router
    from backend.routes.courses import router as courses_router
    from backend.routes.sessions import router as sessions_router
    from backend.services.inference_service import inference_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    with Session(bind=engine) as db:
        db.execute(text("SELECT 1"))
    app.state.db_connected = True

    # Warm model load so first websocket request has no cold-start delay.
    inference_service.ensure_analyzer()
    app.state.models_loaded = True
    yield


app = FastAPI(
    title="Real-time Students Micro-Sentimental Analysis API",
    version="0.1.0",
    lifespan=lifespan,
)

# Open CORS policy for development clients, including Vite defaults.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost",
        "http://127.0.0.1",
    ],
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.db_connected = False
app.state.models_loaded = False

app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(courses_router)
app.include_router(sessions_router)


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


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)
