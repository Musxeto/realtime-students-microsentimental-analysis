from __future__ import annotations

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

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


class _LowEngagementStream:
    async def __call__(self, video_path: Path, frame_step: int = 5):
        yield {
            "frame_index": 0,
            "timestamp_sec": 0.0,
            "engagement_score": 20.0,
            "engaged_count": 1,
            "distracted_count": 4,
            "classifications": [],
            "processing_latency_ms": 12.5,
        }
        yield {
            "frame_index": 5,
            "timestamp_sec": 1.0,
            "engagement_score": 15.0,
            "engaged_count": 1,
            "distracted_count": 4,
            "classifications": [],
            "processing_latency_ms": 13.0,
        }


def _login(client, email: str, password: str) -> str:
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    assert res.json()["user"]["email"] == email
    return res.json()["access_token"]


def _login_tokens(client, email: str, password: str) -> dict:
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    body = res.json()
    assert body["access_token"]
    assert body.get("refresh_token")
    return body


def test_login_success(client):
    token = _login(client, "teacher@fyp.com", "teacher123")
    assert token

    health = client.get("/health")
    assert health.status_code == 200
    body = health.json()
    assert body["status"] == "ok"
    assert body["db_connected"] is True
    assert body["models_loaded"] is True


def test_auth_me_refresh_logout_and_change_password(client):
    tokens = _login_tokens(client, "teacher@fyp.com", "teacher123")
    access = tokens["access_token"]
    refresh = tokens["refresh_token"]

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert me.status_code == 200
    assert me.json()["email"] == "teacher@fyp.com"

    refreshed = client.post("/auth/refresh", json={"refresh_token": refresh})
    assert refreshed.status_code == 200
    new_access = refreshed.json()["access_token"]
    new_refresh = refreshed.json()["refresh_token"]
    assert new_access
    assert new_refresh

    changed = client.post(
        "/auth/change-password",
        json={"current_password": "teacher123", "new_password": "teacher1234"},
        headers={"Authorization": f"Bearer {new_access}"},
    )
    assert changed.status_code == 200

    old_login = client.post("/auth/login", json={"email": "teacher@fyp.com", "password": "teacher123"})
    assert old_login.status_code == 401

    relogin = _login_tokens(client, "teacher@fyp.com", "teacher1234")
    relogin_access = relogin["access_token"]
    relogin_refresh = relogin["refresh_token"]

    logout_res = client.post(
        "/auth/logout",
        json={"refresh_token": relogin_refresh},
        headers={"Authorization": f"Bearer {relogin_access}"},
    )
    assert logout_res.status_code == 200

    # Restore teacher password for deterministic future test runs.
    admin_token = _login(client, "admin@fyp.com", "admin123")
    teachers = client.get("/admin/teachers", headers={"Authorization": f"Bearer {admin_token}"}).json()
    teacher = next((row for row in teachers if row["email"] == "teacher@fyp.com"), None)
    assert teacher is not None
    reset_res = client.post(
        f"/admin/users/{teacher['id']}/reset-password",
        json={"new_password": "teacher123"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert reset_res.status_code == 200


def test_login_with_username_field(client):
    res = client.post(
        "/auth/login",
        json={"username": "admin@fyp.com", "password": "admin123"},
    )
    assert res.status_code == 200
    assert res.json()["user"]["email"] == "admin@fyp.com"


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


def test_sessions_list_and_detail_endpoints(client, monkeypatch):
    admin_token = _login(client, "admin@fyp.com", "admin123")
    teacher_token = _login(client, "teacher@fyp.com", "teacher123")

    monkeypatch.setattr(inference_service, "stream_video", _MockStream())

    courses = client.get("/courses", headers={"Authorization": f"Bearer {admin_token}"}).json()
    assert len(courses) > 0
    course_id = courses[0]["id"]
    video_path = courses[0]["available_videos"][0] if courses[0]["available_videos"] else "tests/test_video.mp4"

    start = client.post(
        "/sessions/start",
        json={"course_id": course_id, "video_path": video_path, "frame_step": 5},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert start.status_code == 200
    session_id = start.json()["session_id"]

    list_all = client.get("/sessions", headers={"Authorization": f"Bearer {admin_token}"})
    assert list_all.status_code == 200
    assert list_all.json()["total"] >= 1
    assert any(item["id"] == session_id for item in list_all.json()["items"])

    detail = client.get(f"/sessions/{session_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert detail.status_code == 200
    assert detail.json()["id"] == session_id

    teacher_detail = client.get(f"/sessions/{session_id}", headers={"Authorization": f"Bearer {teacher_token}"})
    assert teacher_detail.status_code in (200, 404)

    ended = client.post(f"/sessions/{session_id}/end", headers={"Authorization": f"Bearer {admin_token}"})
    assert ended.status_code == 200


def test_session_logs_and_analytics_endpoints(client, monkeypatch):
    admin_token = _login(client, "admin@fyp.com", "admin123")

    monkeypatch.setattr(inference_service, "stream_video", _MockStream())

    courses = client.get("/courses", headers={"Authorization": f"Bearer {admin_token}"}).json()
    assert len(courses) > 0
    course = courses[0]
    video_path = course["available_videos"][0] if course["available_videos"] else "tests/test_video.mp4"

    started = client.post(
        "/sessions/start",
        json={"course_id": course["id"], "video_path": video_path, "frame_step": 5},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert started.status_code == 200
    session_id = started.json()["session_id"]

    with client.websocket_connect(f"/sessions/ws/stream/{session_id}") as ws:
        _ = ws.receive_json()
        _ = ws.receive_json()

    ended = client.post(f"/sessions/{session_id}/end", headers={"Authorization": f"Bearer {admin_token}"})
    assert ended.status_code == 200

    logs = client.get(f"/sessions/{session_id}/logs", headers={"Authorization": f"Bearer {admin_token}"})
    assert logs.status_code == 200
    assert logs.json()["total"] >= 1

    course_analytics = client.get(f"/courses/{course['id']}/analytics", headers={"Authorization": f"Bearer {admin_token}"})
    assert course_analytics.status_code == 200
    assert course_analytics.json()["course_id"] == course["id"]

    teacher_analytics = client.get(
        f"/admin/teachers/{course['instructor_id']}/analytics",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert teacher_analytics.status_code == 200
    assert teacher_analytics.json()["teacher_id"] == course["instructor_id"]


def test_admin_teacher_management_and_course_crud(client):
    admin_token = _login(client, "admin@fyp.com", "admin123")

    teachers_res = client.get("/admin/teachers", headers={"Authorization": f"Bearer {admin_token}"})
    assert teachers_res.status_code == 200
    teachers = teachers_res.json()
    assert len(teachers) >= 1

    target_teacher = next((t for t in teachers if t["email"] == "teacher@fyp.com"), teachers[0])
    teacher_id = target_teacher["id"]
    disable_res = client.patch(
        f"/admin/teachers/{teacher_id}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert disable_res.status_code == 200
    disabled_email = disable_res.json()["email"]

    blocked_login = client.post("/auth/login", json={"email": disabled_email, "password": "teacher123"})
    assert blocked_login.status_code == 403

    enable_res = client.patch(
        f"/admin/teachers/{teacher_id}",
        json={"is_active": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert enable_res.status_code == 200

    create_course_res = client.post(
        "/courses",
        json={"course_name": "Classroom X", "instructor_id": teacher_id},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_course_res.status_code == 200
    course_id = create_course_res.json()["id"]

    delete_course_res = client.delete(f"/courses/{course_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert delete_course_res.status_code == 204


def test_alert_config_and_session_metrics(client, monkeypatch):
    admin_token = _login(client, "admin@fyp.com", "admin123")
    monkeypatch.setattr(inference_service, "stream_video", _LowEngagementStream())

    courses = client.get("/courses", headers={"Authorization": f"Bearer {admin_token}"}).json()
    course = courses[0]

    config_res = client.put(
        f"/courses/{course['id']}/alert-config",
        json={"engagement_threshold": 80, "duration_seconds": 0, "enabled": True},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert config_res.status_code == 200
    assert config_res.json()["enabled"] is True

    start = client.post(
        "/sessions/start",
        json={"course_id": course["id"], "video_path": course["available_videos"][0] if course["available_videos"] else "tests/test_video.mp4", "frame_step": 5},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert start.status_code == 200
    session_id = start.json()["session_id"]

    with client.websocket_connect(f"/sessions/ws/stream/{session_id}") as ws:
        first = ws.receive_json()
        assert first["alert_state"]["active"] is True
        assert first["alert_state"]["reason"]

    end = client.post(f"/sessions/{session_id}/end", headers={"Authorization": f"Bearer {admin_token}"})
    assert end.status_code == 200

    metrics = client.get(f"/sessions/{session_id}/metrics", headers={"Authorization": f"Bearer {admin_token}"})
    assert metrics.status_code == 200
    body = metrics.json()
    assert body["alert_count"] >= 1
    assert body["avg_latency_ms"] is not None
