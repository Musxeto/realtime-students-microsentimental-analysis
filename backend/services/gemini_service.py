from __future__ import annotations

import asyncio
import logging
from typing import Optional

try:
    from google import genai
except ImportError:
    genai = None

from ..config import settings


logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        self._is_configured = False
        self._client = None
        if genai is not None and settings.gemini_api_key:
            try:
                self._client = genai.Client(api_key=settings.gemini_api_key)
                self._is_configured = True
                logger.info("Gemini service successfully configured with provided API key.")
            except Exception as e:
                logger.error(f"Failed to configure Gemini API: {e}")

    async def generate_pedagogical_insight(
        self,
        engagement_score: float,
        distracted_count: int,
        student_count: int,
        alert_active: bool,
        course_code: str = "Course",
        teacher_name: str = "Teacher",
        recent_classes: Optional[list] = None
    ) -> str | None:
        if not self._is_configured:
            logger.warning("Attempted to generate insight but Gemini service is not configured.")
            return None

        engaged_count = max(0, student_count - distracted_count)
        status = "ALERT! Low engagement detected." if alert_active else "Class is proceeding normally."
        
        prompt = (
            f"You are an expert teaching assistant observing a live classroom for {course_code} taught by {teacher_name}.\n"
            f"Current status: {status}\n"
            f"Overall Engagement Score: {engagement_score:.1f}%\n"
            f"Students actively engaged: {engaged_count}\n"
            f"Students distracted/sleeping: {distracted_count}\n\n"
            "Provide a VERY BRIEF (maximum 12 words) personalized, stylish coaching message. "
            "You MUST address the teacher by name (e.g. 'Mr. Smith' or just their first name based on input). "
            "Follow these rules based on the engagement score:\n"
            "- If >= 90%: Sound extremely impressed (e.g. 'Stellar job {teacher_name}! {course_code} is locked in!').\n"
            "- If 80% to 89%: Keep it casual and cool (e.g. 'Cool bruh, {teacher_name}, looking solid at {engagement_score}%').\n"
            "- If < 70%: Sound urgent but supportive (e.g. '{teacher_name}, take control! Engagement dropping to {engagement_score}%!').\n"
            "Do not use quotes or introductory phrases. Just give the short message."
        )

        try:
            def sync_generate():
                return self._client.models.generate_content(
                    model='gemini-3-flash-preview',
                    contents=prompt
                )
            # We use to_thread to prevent blocking the async event loop with sync requests
            response = await asyncio.to_thread(sync_generate)
            insight = response.text.strip().replace('"', '')
            logger.debug(f"Generated AI insight: {insight}")
            return insight
        except Exception as e:
            logger.error(f"Gemini generation error: {e}")
            return None


gemini_service = GeminiService()
