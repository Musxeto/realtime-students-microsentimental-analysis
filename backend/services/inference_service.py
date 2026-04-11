from __future__ import annotations

import asyncio
from time import perf_counter
from pathlib import Path
from typing import AsyncIterator
import cv2

from ai.inference_utils import ClassroomAnalyzer, encode_frame_preview


class InferenceService:
    def __init__(self, analyzer: ClassroomAnalyzer | None = None):
        self._analyzer = analyzer

    def ensure_analyzer(self) -> ClassroomAnalyzer:
        if self._analyzer is None:
            self._analyzer = ClassroomAnalyzer()
        return self._analyzer

    async def stream_video(self, video_path: Path, frame_step: int = 5) -> AsyncIterator[dict]:
        analyzer = self.ensure_analyzer()
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise RuntimeError(f"Could not open video: {video_path}")
        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        frame_index = 0
        emitted_frames = 0
        stream_started = perf_counter()

        def _next_item():
            nonlocal frame_index
            while True:
                ok, frame = cap.read()
                if not ok:
                    return None
                current_index = frame_index
                frame_index += 1
                if current_index % frame_step != 0:
                    continue
                payload = analyzer.analyze_frame(frame, frame_index=current_index, fps=fps)
                payload["frame_jpeg_base64"] = encode_frame_preview(frame)
                return payload

        try:
            while True:
                start = perf_counter()
                payload = await asyncio.to_thread(_next_item)
                elapsed_ms = round((perf_counter() - start) * 1000, 2)
                if payload is None:
                    break
                payload = dict(payload)
                emitted_frames += 1
                runtime_sec = perf_counter() - stream_started
                payload["processing_latency_ms"] = elapsed_ms
                payload["runtime_sec"] = round(runtime_sec, 2)
                payload["processed_frames"] = emitted_frames
                payload["live_fps"] = round(emitted_frames / max(runtime_sec, 1e-6), 2)
                payload["source_fps"] = round(float(fps), 2) if fps > 0 else None
                payload["frame_step"] = frame_step
                yield payload
                await asyncio.sleep(0)
        finally:
            cap.release()


inference_service = InferenceService()
