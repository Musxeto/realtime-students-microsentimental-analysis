from __future__ import annotations

import logging
from typing import Optional

import httpx

from ..config import settings


logger = logging.getLogger(__name__)


class OpenAIService:
    def __init__(self) -> None:
        self._is_configured = bool(settings.openai_api_key)
        self._backoff_until = 0.0
        self._model = "gpt-4o-mini"
        if self._is_configured:
            logger.info("OpenAI service configured with the server API key.")
        else:
            logger.warning("OpenAI service is not configured because OPENAI_API_KEY is missing.")

    async def generate_pedagogical_insight(
        self,
        engagement_score: float,
        distracted_count: int,
        student_count: int,
        alert_active: bool,
        course_code: str = "Course",
        teacher_name: str = "Teacher",
        recent_classes: Optional[list] = None,
    ) -> str | None:
        if not self._is_configured:
            logger.warning("Attempted to generate insight but OpenAI service is not configured.")
            return None

        import time

        if time.monotonic() < self._backoff_until:
            logger.info("OpenAI call skipped: cooldown active after previous rate-limit.")
            return None

        engaged_count = max(0, student_count - distracted_count)
        status = "ALERT! Low engagement detected." if alert_active else "Class is proceeding normally."

        prompt = (
            f"You are an expert teaching assistant observing a live classroom for {course_code} taught by {teacher_name}.\n"
            f"Current status: {status}\n"
            f"Overall Engagement Score: {engagement_score:.1f}%\n"
            f"Students actively engaged: {engaged_count}\n"
            f"Students distracted/sleeping: {distracted_count}\n\n"
            "Provide a VERY BRIEF personalized coaching message for the teacher. "
            "Address the teacher by name. Keep it short, direct, and supportive. "
            "Do not use quotes or introductory phrases."
        )

        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": "You write concise classroom coaching messages."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.7,
            "max_tokens": 80,
        }

        headers = {
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        }

        async def _send_request() -> str | None:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers)
                if response.status_code == 429:
                    raise httpx.HTTPStatusError("rate limited", request=response.request, response=response)
                response.raise_for_status()
                data = response.json()
                choices = data.get("choices") or []
                if not choices:
                    return None
                message = choices[0].get("message") or {}
                content = message.get("content")
                if isinstance(content, list):
                    content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
                return str(content).strip() if content else None

        try:
            insight = await _send_request()
            if not insight:
                return None
            insight = insight.replace('"', '')
            logger.debug("Generated AI insight: %s", insight)
            return insight
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code if exc.response is not None else None
            if status_code == 429:
                self._backoff_until = time.monotonic() + 60.0
                logger.error("OpenAI rate limit hit (429). Backing off for 60s.")
            else:
                logger.error("OpenAI generation error: %s", exc)
            return None
        except Exception as exc:
            logger.error("OpenAI generation error: %s", exc)
            return None


openai_service = OpenAIService()
