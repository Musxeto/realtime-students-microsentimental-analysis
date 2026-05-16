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
        course_name: str = "Course",
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

        if engagement_score < 70:
            tone_instruction = (
                "The engagement is critically low — below 70%. Be STERN and URGENT. "
                "Express clear disappointment and demand immediate corrective action from the teacher. "
                "Be direct, firm, and borderline angry — this is unacceptable and you are not happy."
            )
        elif engagement_score < 80:
            tone_instruction = (
                "The engagement is moderate — between 70% and 80%. Be firm but constructive. "
                "Acknowledge it's not ideal and push the teacher to do better with concrete suggestions. "
                "Be professional but clearly not satisfied yet."
            )
        else:
            tone_instruction = (
                "The engagement is excellent — above 80%. Be genuinely enthusiastic and celebratory. "
                "Praise the teacher warmly and specifically. Express how impressed you are."
            )

        prompt = (
            f"You are a strict classroom performance monitor observing a live session for '{course_name}' taught by {teacher_name}.\n"
            f"Overall Engagement Score: {engagement_score:.1f}%\n"
            f"Students actively engaged: {engaged_count}\n"
            f"Students distracted/sleeping: {distracted_count}\n\n"
            f"{tone_instruction}\n\n"
            "Write ONE short, punchy message addressed directly to the teacher by name. "
            "Do NOT use quotes, bullet points, or introductory phrases. Just the message."
        )

        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": "You are a strict, direct classroom performance coach. You don't sugarcoat — you say exactly what needs to be said based on the engagement data."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.8,
            "max_tokens": 100,
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
