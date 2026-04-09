from __future__ import annotations

import asyncio
from time import perf_counter
from pathlib import Path
from typing import AsyncIterator

from ai.inference_utils import ClassroomAnalyzer


class InferenceService:
    def __init__(self, analyzer: ClassroomAnalyzer | None = None):
        self._analyzer = analyzer

    def ensure_analyzer(self) -> ClassroomAnalyzer:
        if self._analyzer is None:
            self._analyzer = ClassroomAnalyzer()
        return self._analyzer

    async def stream_video(self, video_path: Path, frame_step: int = 5) -> AsyncIterator[dict]:
        analyzer = self.ensure_analyzer()
        iterator = analyzer.analyze_video(video_path, frame_step=frame_step)

        def _next_item():
            try:
                return next(iterator)
            except StopIteration:
                return None

        while True:
            start = perf_counter()
            payload = await asyncio.to_thread(_next_item)
            elapsed_ms = round((perf_counter() - start) * 1000, 2)
            if payload is None:
                break
            payload = dict(payload)
            payload["processing_latency_ms"] = elapsed_ms
            yield payload
            await asyncio.sleep(0)


inference_service = InferenceService()
