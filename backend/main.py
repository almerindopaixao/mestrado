import shutil
import os
import uuid
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

from app.services import process_video

app = FastAPI(title="mestrado")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_PATH = os.path.join("data", "uploads", "videos")
UPLOAD_URL = "data/uploads/videos"

os.makedirs(UPLOAD_PATH, exist_ok=True)

app.mount(f"/data", StaticFiles(directory="data"), name="data")

@app.post("/upload")
def upload_video(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    video_id = str(uuid.uuid4())
    file_location = os.path.join(UPLOAD_PATH, f"{video_id}.mp4") 
    
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    background_tasks.add_task(process_video, file_location, video_id, UPLOAD_PATH)
    
    return {"id": video_id, "status": "processing", "message": "Video recebido. Processamento iniciado."}

@app.get("/status/{video_id}")
def get_status(video_id: str, request: Request):
    json_path = os.path.join(UPLOAD_PATH, f"{video_id}.json") 
    if os.path.exists(json_path):
        base_url = str(request.base_url)
        result_url = f"{base_url}{UPLOAD_URL}/{video_id}.json"
        video_url = f"{base_url}{UPLOAD_URL}/{video_id}.mp4"

        return {
            "status": "completed", 
            "result_url": result_url, 
            "video_url": video_url
        }
    return {"status": "processing"}