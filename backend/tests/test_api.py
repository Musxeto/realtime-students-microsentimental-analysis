from __future__ import annotations

from pathlib import Path

from backend.services.inference_service import inference_service


class _MockStream:
    async def __call__(self, video_path: Path, frame_step: int = 5):
        yield {
            "frame_index": 0,
            "timestamp_sec": 0.0,
            "engagement_score": 75.0,
            "engaged_count": 3,
            "distracted_count": 1,
            "classifications": [],
        }
        yield {
            "frame_index": 5,
            "timestamp_sec": 1.0,
            "engagement_score": 50.0,
            "engaged_count": 2,
            "distracted_count": 2,
            "classifications": [],
        }


def _login(client, email: str, password: str) -> str:
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    assert res.json()["user"]["email"] == email
    return res.json()["access_token"]


def test_login_success(client):
    token = _login(client, "teacher@fyp.com", "teacher123")
    assert token

    health = client.get("/health")
    assert health.status_code == 200
    body = health.json()
    assert body["status"] == "ok"
    assert body["db_connected"] is True
    assert body["models_loaded"] is True


def test_admin_teacher_provisioning_rbac(client):
    teacher_token = _login(client, "teacher@fyp.com", "teacher123")
    admin_token = _login(client, "admin@fyp.com", "admin123")

    payload = {
        "name": "Teacher New",
        "email": "teacher_new@fyp.com",
        "password": "1234",
        "course_names": ["Classroom Z"],
    }

    teacher_attempt = client.post(
        "/admin/teachers",
        json=payload,
        headers={"Authorization": f"Bearer {teacher_token}"},
    )
    assert teacher_attempt.status_code == 403

    admin_attempt = client.post(
        "/admin/teachers",
        json=payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_attempt.status_code == 200
    body = admin_attempt.json()
    assert body["teacher"]["email"] == "teacher_new@fyp.com"
    assert len(body["courses"]) == 1


def test_session_start_end_and_websocket_stream(client, monkeypatch):
    admin_token = _login(client, "admin@fyp.com", "admin123")

    monkeypatch.setattr(inference_service, "stream_video", _MockStream())

    videos = client.get("/courses", headers={"Authorization": f"Bearer {admin_token}"}).json()
    assert len(videos) > 0
    video_path = videos[0]["available_videos"][0] if videos[0]["available_videos"] else "tests/test_video.mp4"

    start = client.post(
        "/sessions/start",
        json={"course_id": videos[0]["id"], "video_path": video_path, "frame_step": 5},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert start.status_code == 200
    session_id = start.json()["session_id"]

    with client.websocket_connect(f"/sessions/ws/stream/{session_id}") as ws:
        first = ws.receive_json()
        second = ws.receive_json()

    assert first["session_id"] == session_id
    assert second["session_id"] == session_id

    end = client.post(f"/sessions/{session_id}/end", headers={"Authorization": f"Bearer {admin_token}"})
    assert end.status_code == 200
    assert end.json()["status"] == "COMPLETED"
