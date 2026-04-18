from __future__ import annotations

import asyncio
import re
from time import perf_counter
from pathlib import Path
from typing import AsyncIterator
from urllib.parse import urlparse
import cv2

from ai.inference_utils import ClassroomAnalyzer, encode_frame_preview


class InferenceService:
    def __init__(self, analyzer: ClassroomAnalyzer | None = None):
        self._analyzer = analyzer

    def ensure_analyzer(self) -> ClassroomAnalyzer:
        if self._analyzer is None:
            self._analyzer = ClassroomAnalyzer()
        return self._analyzer

    def _candidate_sources(self, video_source: str | Path) -> list[str]:
        source = str(video_source).strip()
        if not source:
            return []

        parsed = urlparse(source)
        host_port_pattern = re.compile(r"^[A-Za-z0-9_.-]+:\d{2,5}(?:/.*)?$")

        if parsed.scheme in {"rtsp", "http", "https"}:
            if parsed.scheme in {"http", "https"} and not parsed.path:
                return [
                    f"{source}/video",
                    f"{source}/mjpeg",
                    f"{source}/stream",
                    f"{source}/live",
                    source,
                ]
            return [source]

        if host_port_pattern.match(source):
            base = f"http://{source}"
            return [
                f"{base}/video",
                f"{base}/mjpeg",
                f"{base}/stream",
                f"{base}/live",
                base,
            ]

        return [source]

    async def stream_video(self, video_path: str | Path, frame_step: int = 5) -> AsyncIterator[dict]:
        analyzer = self.ensure_analyzer()
        tried_sources = self._candidate_sources(video_path)
        cap = None
        active_source = None
        for candidate in tried_sources:
            candidate_cap = cv2.VideoCapture(candidate)
            if candidate_cap.isOpened():
                cap = candidate_cap
                active_source = candidate
                break
            candidate_cap.release()

        if cap is None:
            raise RuntimeError(f"Could not open video source: {video_path}. Tried: {tried_sources}")

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
                try:
                    payload["frame_jpeg_base64"] = encode_frame_preview(frame)
                except Exception:
                    payload["frame_jpeg_base64"] = None
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
                payload["source"] = active_source
                payload["frame_step"] = frame_step
                payload["stream_schema_version"] = 2
                payload["student_count"] = int(
                    payload.get("behavior_boxes")
                    or len(payload.get("classifications") or [])
                )
                payload.setdefault("frame_jpeg_base64", None)
                payload.setdefault("timestamp_sec", payload.get("runtime_sec", 0.0))
                payload.setdefault("runtime_sec", payload.get("timestamp_sec", 0.0))
                payload.setdefault("processed_frames", payload.get("frame_index", -1) + 1)
                yield payload
                await asyncio.sleep(0)
        finally:
            cap.release()


inference_service = InferenceService()
