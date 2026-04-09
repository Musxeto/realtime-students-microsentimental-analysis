from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from .bootstrap import ensure_seed_data
from .database import engine
from .migrations import upgrade_to_head
from .models import ClassSession, Course, SessionLog, User
from .routes.auth import router as auth_router
from .routes.courses import router as courses_router
from .routes.sessions import router as sessions_router


app = FastAPI(title="Real-time Students Micro-Sentimental Analysis API", version="0.1.0")

app.include_router(auth_router)
app.include_router(courses_router)
app.include_router(sessions_router)


@app.on_event("startup")
def startup_event():
    upgrade_to_head()

    with Session(bind=engine) as db:
        ensure_seed_data(db)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error_code": "INTERNAL_SERVER_ERROR", "message": str(exc)})
