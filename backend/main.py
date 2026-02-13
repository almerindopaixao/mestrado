import os
import tempfile
import uuid

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.services import process_video_stream

app = FastAPI(
    title="Mestrado API",
    description="Backend de processamento de video para tecnologia assistiva",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tamanho maximo: ~500MB (videos de ate 15 min)
MAX_FILE_SIZE = 500 * 1024 * 1024

# Extensoes de video aceitas
ALLOWED_EXTENSIONS = {".mp4", ".webm", ".avi", ".mov", ".mkv", ".m4v"}


@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/api/process-video")
async def process_video(file: UploadFile = File(...)):
    if not file.size:
        raise HTTPException(
            status_code=400,
            detail="Nenhum arquivo enviado. Por favor, envie um arquivo de video.",
        )

    if file.filename:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Formato de video nao suportado: {ext}. "
                       f"Formatos aceitos: {', '.join(ALLOWED_EXTENSIONS)}",
            )

    if file.content_type and not file.content_type.startswith("video/"):
        raise HTTPException(
            status_code=400,
            detail="O arquivo enviado nao e um video.",
        )

    suffix = os.path.splitext(file.filename or "video.mp4")[1]
    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, f"{uuid.uuid4()}{suffix}")

    try:
        content = await file.read()

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"Arquivo muito grande. Tamanho maximo: {MAX_FILE_SIZE // (1024*1024)}MB.",
            )

        with open(temp_path, "wb") as f:
            f.write(content)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao salvar o video: {str(e)}",
        )

    async def event_generator():
        try:
            async for event in process_video_stream(temp_path):
                yield event
        finally:
            try:
                os.unlink(temp_path)
                os.rmdir(temp_dir)
            except OSError:
                pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
