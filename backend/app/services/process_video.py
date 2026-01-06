import cv2
import json
import os
from scenedetect import detect, ContentDetector
from ultralytics import YOLO
from .describe_image import describe_image

def process_video(video_path: str, video_id: str, output_dir: str):
    """
    Função executada em Background.
    Gera um arquivo JSON com as descrições acessíveis.
    """
    print(f"Iniciando processamento para: {video_path}")
    
    # 1. Setup
    model = YOLO('../../assets/yolo/model.pt') # Caminho para seu modelo treinado
    accessibility_tracks = []
    
    # 2. Detecção de Cenas (PySceneDetect)
    print("Detectando cenas...")
    scene_list = detect(video_path, ContentDetector(threshold=27.0))
    
    # Se não detectar cenas (vídeo curto/estático), considera o vídeo todo como uma cena
    if not scene_list:
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        duration = frame_count / fps
        from scenedetect import FrameTimecode
        scene_list = [(FrameTimecode(time=0, fps=fps), FrameTimecode(time=duration, fps=fps))]

    cap = cv2.VideoCapture(video_path)

    # 3. Loop nas Cenas
    for i, scene in enumerate(scene_list):
        start_time, end_time = scene
        
        # Pega o frame do meio da cena
        middle_frame_idx = int((start_time.get_frames() + end_time.get_frames()) / 2)
        cap.set(cv2.CAP_PROP_POS_FRAMES, middle_frame_idx)
        ret, frame = cap.read()
        
        if not ret: continue
        
        # 4. Inferência YOLO
        results = model.predict(frame, verbose=False, conf=0.5)
        
        for result in results:
            for box in result.boxes:
                # Se detectou algo relevante
                # Recorta a imagem (Crop)
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                crop_img = frame[y1:y2, x1:x2]
                
                # 5. Chama o VLM (Gemini)
                description = describe_image(crop_img)
                
                # Salva o resultado
                accessibility_tracks.append({
                    "start": start_time.get_seconds(),
                    "end": end_time.get_seconds(),
                    "label": model.names[int(box.cls)], # ex: 'diagram'
                    "description": description
                })
                print(f"Cena {i}: {description[:30]}...")

    cap.release()
    
    # 6. Salvar Output (JSON para o Frontend consumir)
    output_path = os.path.join(output_dir, f"{video_id}.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(accessibility_tracks, f, ensure_ascii=False, indent=2)
        
    print("Processamento concluído.")