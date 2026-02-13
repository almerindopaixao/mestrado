import asyncio
import base64
import json
import time
from typing import AsyncGenerator

import cv2
import numpy as np

from .scene_detector import detect_scenes
from .yolo_detector import yolo_service


def _frame_to_base64(frame: np.ndarray, quality: int = 80) -> str:
    encode_params = [cv2.IMWRITE_JPEG_QUALITY, quality]
    _, buffer = cv2.imencode(".jpg", frame, encode_params)
    return base64.b64encode(buffer).decode("utf-8")


def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


async def process_video_stream(video_path: str) -> AsyncGenerator[str, None]:
    start_time = time.time()

    yield _sse_event({
        "type": "progress",
        "stage": "scenes",
        "message": "Analisando video e detectando transicoes de cena...",
    })

    loop = asyncio.get_event_loop()

    try:
        scenes = await loop.run_in_executor(None, detect_scenes, video_path)
    except Exception as e:
        yield _sse_event({
            "type": "error",
            "message": f"Erro ao detectar cenas: {str(e)}",
        })
        return

    total_scenes = len(scenes)

    yield _sse_event({
        "type": "scene_count",
        "total_scenes": total_scenes,
    })

    yield _sse_event({
        "type": "progress",
        "stage": "scenes",
        "message": f"{total_scenes} cenas detectadas no video.",
    })

    if total_scenes == 0:
        yield _sse_event({
            "type": "complete",
            "summary": {
                "total_scenes": 0,
                "total_analyzed": 0,
                "frames_with_elements": 0,
                "processing_time": round(time.time() - start_time, 1),
            },
        })
        return

    yield _sse_event({
        "type": "progress",
        "stage": "yolo",
        "current": 0,
        "total": total_scenes,
        "message": "Iniciando descoberta de elementos figurados com YOLO...",
    })

    frames_with_elements = 0

    for i, scene in enumerate(scenes):
        current = i + 1

        yield _sse_event({
            "type": "progress",
            "stage": "yolo",
            "current": current,
            "total": total_scenes,
            "message": f"Analisando frame {current}/{total_scenes}...",
        })

        try:
            detections = await loop.run_in_executor(
                None, yolo_service.detect_elements, scene["frame"]
            )
        except Exception as e:
            yield _sse_event({
                "type": "progress",
                "stage": "yolo",
                "current": current,
                "total": total_scenes,
                "message": f"Erro no frame {current}: {str(e)}. Continuando...",
            })
            continue

        if detections:
            frames_with_elements += 1

            image_base64 = await loop.run_in_executor(
                None, _frame_to_base64, scene["frame"]
            )

            yield _sse_event({
                "type": "frame_detected",
                "frame": {
                    "timestamp": round(scene["timestamp"], 2),
                    "scene_start": round(scene["scene_start"], 2),
                    "scene_end": round(scene["scene_end"], 2),
                    "scene_index": scene["scene_index"],
                    "image_base64": image_base64,
                    "detections": detections,
                },
            })

        await asyncio.sleep(0.01)

    processing_time = round(time.time() - start_time, 1)

    yield _sse_event({
        "type": "progress",
        "stage": "done",
        "message": f"Processamento concluido em {processing_time}s.",
    })

    yield _sse_event({
        "type": "complete",
        "summary": {
            "total_scenes": total_scenes,
            "total_analyzed": total_scenes,
            "frames_with_elements": frames_with_elements,
            "processing_time": processing_time,
        },
    })
