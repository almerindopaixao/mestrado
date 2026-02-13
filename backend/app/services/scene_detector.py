import cv2
import numpy as np
from scenedetect import detect, AdaptiveDetector

MAX_FRAME_WIDTH = 1024

def _resize_frame(frame: np.ndarray, max_width: int = MAX_FRAME_WIDTH) -> np.ndarray:
    h, w = frame.shape[:2]
    if w <= max_width:
        return frame
    scale = max_width / w
    new_w = max_width
    new_h = int(h * scale)
    return cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)


def detect_scenes(
    video_path: str,
    min_scene_len: int = 15,
) -> list[dict]:
    scene_list = detect(video_path, AdaptiveDetector(min_scene_len=min_scene_len))

    if not scene_list:
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps

        results = []
        interval = 3.0
        t = interval
        while t < duration:
            frame_num = int(t * fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
            ret, frame = cap.read()
            if ret:
                results.append({
                    "timestamp": t,
                    "frame": _resize_frame(frame),
                    "scene_index": len(results),
                    "scene_start": max(0, t - interval / 2),
                    "scene_end": min(duration, t + interval / 2),
                })
            t += interval

        cap.release()
        return results

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    results = []

    for idx, (start, end) in enumerate(scene_list):
        start_sec = start.get_seconds()
        end_sec = end.get_seconds()
        mid_sec = (start_sec + end_sec) / 2.0
        mid_frame = int(mid_sec * fps)

        cap.set(cv2.CAP_PROP_POS_FRAMES, mid_frame)
        ret, frame = cap.read()

        if ret:
            results.append({
                "timestamp": mid_sec,
                "frame": _resize_frame(frame),
                "scene_index": idx,
                "scene_start": start_sec,
                "scene_end": end_sec,
            })

    cap.release()
    return results
