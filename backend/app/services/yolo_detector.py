import os
import numpy as np
from ultralytics import YOLO


class YOLODetectorService:
    def __init__(self, confidence_threshold: float = 0.5):
        self.confidence_threshold = confidence_threshold
        self.model = None

    def _load_model(self):
        if self.model is None:
            MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'models', 'yolo.pt')
            self.model = YOLO(MODEL_PATH)

    def detect_elements(self, frame: np.ndarray) -> list[dict] | None:
        self._load_model()

        results = self.model.predict(
            frame,
            conf=self.confidence_threshold,
            verbose=False,
        )

        detections = []
        for result in results:
            for box in result.boxes:
                confidence = float(box.conf[0])
                bbox = box.xyxy[0].tolist()
                class_name = self.model.names[int(box.cls)]

                if class_name == 'visual-illustration':  # Foco apenas em elementos visuais
                    detections.append({
                        "class_name": class_name,
                        "confidence": round(confidence, 3),
                        "bbox": [round(v, 1) for v in bbox],
                    })

        return detections if detections else None


yolo_service = YOLODetectorService()
