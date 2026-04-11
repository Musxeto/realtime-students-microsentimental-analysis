from __future__ import annotations

import base64

import cv2
import numpy as np


class OpenCVSessionPreview:
    def __init__(self, *, session_id: int, enabled: bool, window_name_prefix: str):
        self.enabled = enabled
        self.window_name = f"{window_name_prefix} #{session_id}"
        self._window_ready = False

    def _ensure_window(self):
        if not self.enabled or self._window_ready:
            return
        cv2.namedWindow(self.window_name, cv2.WINDOW_NORMAL)
        self._window_ready = True

    def show_payload(self, payload: dict):
        if not self.enabled:
            return

        frame_b64 = payload.get("frame_jpeg_base64")
        if not frame_b64:
            return

        try:
            frame_bytes = base64.b64decode(frame_b64)
            np_buf = np.frombuffer(frame_bytes, dtype=np.uint8)
            frame = cv2.imdecode(np_buf, cv2.IMREAD_COLOR)
        except Exception:
            return

        if frame is None:
            return

        self._ensure_window()

        frame_h, frame_w = frame.shape[:2]
        src_w = int(payload.get("frame_width") or frame_w)
        src_h = int(payload.get("frame_height") or frame_h)

        detections = payload.get("classifications") or []
        for det in detections:
            box = det.get("box")
            if not isinstance(box, list) or len(box) != 4:
                continue

            x1, y1, x2, y2 = box
            px1 = max(0, min(frame_w - 1, int((x1 / max(src_w, 1)) * frame_w)))
            py1 = max(0, min(frame_h - 1, int((y1 / max(src_h, 1)) * frame_h)))
            px2 = max(0, min(frame_w - 1, int((x2 / max(src_w, 1)) * frame_w)))
            py2 = max(0, min(frame_h - 1, int((y2 / max(src_h, 1)) * frame_h)))

            label = str(det.get("label") or "unknown")
            conf = det.get("confidence")
            color = (60, 200, 70)
            if label in {"sleep", "using_device", "turn_head"}:
                color = (40, 40, 220)

            cv2.rectangle(frame, (px1, py1), (px2, py2), color, 2)
            conf_text = f" {int(round(float(conf) * 100))}%" if isinstance(conf, (float, int)) else ""
            text = f"{label}{conf_text}"
            cv2.putText(frame, text, (px1, max(20, py1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        engagement = payload.get("engagement_score")
        runtime = payload.get("runtime_sec")
        live_fps = payload.get("live_fps")
        latency = payload.get("processing_latency_ms")
        frame_index = payload.get("frame_index")

        cv2.putText(
            frame,
            f"Frame {frame_index}  Eng {engagement}%",
            (12, 24),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 255),
            2,
        )
        cv2.putText(
            frame,
            f"Runtime {runtime}s  FPS {live_fps}  Latency {latency}ms",
            (12, 50),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (220, 220, 220),
            2,
        )

        alert = payload.get("alert_state") or {}
        if alert.get("active"):
            msg = str(alert.get("reason") or "Low engagement")
            cv2.putText(frame, f"ALERT: {msg}", (12, frame_h - 18), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (40, 40, 220), 2)

        cv2.imshow(self.window_name, frame)
        cv2.waitKey(1)

    def close(self):
        if not self.enabled or not self._window_ready:
            return
        cv2.destroyWindow(self.window_name)
        self._window_ready = False
