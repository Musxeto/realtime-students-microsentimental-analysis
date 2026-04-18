import argparse
import time
from urllib.parse import urlparse

import cv2


def build_candidate_urls(address: str) -> list[str]:
    """Build likely stream URLs from a raw IP camera address."""
    address = address.strip()
    if not address:
        return []

    # If the user already passed a full URL (http/https/rtsp), use it directly.
    parsed = urlparse(address)
    if parsed.scheme in {"http", "https", "rtsp"}:
        return [address]

    base = f"http://{address}"
    return [
        f"{base}/video",
        f"{base}/mjpeg",
        f"{base}/stream",
        f"{base}/live",
        base,
    ]


def open_first_working_stream(urls: list[str], warmup_seconds: float = 2.0):
    for url in urls:
        cap = cv2.VideoCapture(url)
        if not cap.isOpened():
            cap.release()
            continue

        deadline = time.time() + warmup_seconds
        while time.time() < deadline:
            ok, frame = cap.read()
            if ok and frame is not None:
                return cap, url

        cap.release()

    return None, None


def main() -> None:
    parser = argparse.ArgumentParser(description="Connect to and preview an IP camera stream.")
    parser.add_argument(
        "--address",
        default="192.168.100.118:8080",
        help="IP camera address or full stream URL. Default: 192.168.100.118:8080",
    )
    parser.add_argument(
        "--window-title",
        default="IP Camera Preview",
        help="OpenCV window title",
    )
    args = parser.parse_args()

    urls = build_candidate_urls(args.address)
    if not urls:
        raise SystemExit("No valid address was provided.")

    print("Trying stream URLs:")
    for url in urls:
        print(f"  - {url}")

    cap, active_url = open_first_working_stream(urls)
    if cap is None:
        raise SystemExit(
            "Could not open the IP camera stream. Verify the camera app is running and reachable."
        )

    print(f"Connected to: {active_url}")
    print("Press 'q' in the preview window to quit.")

    cv2.namedWindow(args.window_title, cv2.WINDOW_NORMAL)

    try:
        while True:
            ok, frame = cap.read()
            if not ok or frame is None:
                print("Frame read failed. Retrying...")
                time.sleep(0.1)
                continue

            cv2.imshow(args.window_title, frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
