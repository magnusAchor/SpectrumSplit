from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import shutil
import os
import uuid
import subprocess
import threading
import time
import sys
import logging

import librosa
import soundfile as sf
from pydantic import BaseModel

from instrument_split import splitOtherStem

# ================= LOGGING =================
logging.basicConfig(
    level=logging.INFO,
    format='[BACKEND] %(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

logger.info("Backend starting...")
logger.info(f"Python executable: {sys.executable}")
logger.info(f"Python version: {sys.version}")
logger.info(f"Current working directory: {os.getcwd()}")


app = FastAPI()

# ================= CORS =================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= FOLDERS =================
UPLOAD_DIR = "temp"
OUTPUT_DIR = "output"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Serve output files
app.mount("/output", StaticFiles(directory=OUTPUT_DIR), name="output")


# ================= ROOT =================
@app.get("/")
def home():
    return {"status": "Demucs API running 🚀"}


# ================= CLEANUP =================
def delete_later(paths: list):
    time.sleep(120)
    for path in paths:
        try:
            if os.path.isdir(path):
                shutil.rmtree(path, ignore_errors=True)
            elif os.path.isfile(path):
                os.remove(path)
        except Exception as e:
            print("Cleanup error:", e)


# ================= STEP 1: DEMUCS =================
@app.post("/separate")
async def separate(file: UploadFile = File(...)):
    job_id = str(uuid.uuid4())

    logger.info(f"[SEPARATE] Starting job {job_id}")
    logger.info(f"[SEPARATE] Received file: {file.filename}")

    safe_name = file.filename.replace(" ", "_")
    input_path = os.path.join(UPLOAD_DIR, f"{job_id}_{safe_name}")

    try:
        # Save file
        logger.info(f"[SEPARATE] Saving file to {input_path}")
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        file_size = os.path.getsize(input_path)
        logger.info(f"[SEPARATE] File saved, size: {file_size} bytes")

        command = [
            sys.executable,
            "-m",
            "demucs",
            "-n",
            "htdemucs",
            "-o",
            OUTPUT_DIR,
            input_path
        ]

        logger.info(f"[SEPARATE] Running command: {' '.join(command)}")

        result = subprocess.run(command, capture_output=True, text=True)

        logger.info(f"[SEPARATE] Demucs return code: {result.returncode}")
        
        if result.stdout:
            logger.info(f"[SEPARATE] Demucs stdout: {result.stdout}")
        
        if result.stderr:
            logger.error(f"[SEPARATE] Demucs stderr: {result.stderr}")

        if result.returncode != 0:
            logger.error(f"[SEPARATE] Demucs failed with return code {result.returncode}")
            raise HTTPException(status_code=500, detail=f"Demucs processing failed: {result.stderr}")

        base_name = os.path.splitext(os.path.basename(input_path))[0]
        stem_folder = os.path.join(OUTPUT_DIR, "htdemucs", base_name)

        logger.info(f"[SEPARATE] Looking for output at: {stem_folder}")

        if not os.path.exists(stem_folder):
            logger.error(f"[SEPARATE] Output folder not found at {stem_folder}")
            logger.error(f"[SEPARATE] Contents of {OUTPUT_DIR}: {os.listdir(OUTPUT_DIR)}")
            raise HTTPException(status_code=500, detail=f"Output folder not found at {stem_folder}")

        stems = {}
        stem_files = [f for f in os.listdir(stem_folder) if f.endswith(".wav")]
        logger.info(f"[SEPARATE] Found {len(stem_files)} stem files: {stem_files}")

        for f in stem_files:
            stem_name = f.replace(".wav", "")
            stems[stem_name] = f"http://127.0.0.1:5000/output/htdemucs/{base_name}/{f}"

        logger.info(f"[SEPARATE] Job {job_id} completed successfully with stems: {list(stems.keys())}")

        # cleanup
        threading.Thread(
            target=delete_later,
            args=([input_path, stem_folder],),
            daemon=True
        ).start()

        return {
            "stems": stems,
            "expires_in": 120
        }

    except Exception as e:
        logger.error(f"[SEPARATE] Job {job_id} failed with error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ================= STEP 2: INSTRUMENT SPLIT =================
class SplitRequest(BaseModel):
    audio: str


@app.post("/split-instruments")
async def split_instruments(payload: SplitRequest):
    try:
        audio_url = payload.audio

        if not audio_url:
            raise HTTPException(status_code=400, detail="Missing audio")

        # Convert URL → local file path
        path = audio_url.replace("http://127.0.0.1:5000/", "")
        file_path = os.path.join(os.getcwd(), path)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Audio file not found")

        # Load stereo audio
        y, sr = librosa.load(file_path, sr=None, mono=False)

        if y.ndim == 1:
            raise HTTPException(status_code=400, detail="Audio is not stereo")

        left = y[0]
        right = y[1]

        # Run your instrument split logic
        result = splitOtherStem(left, right, sr)

        job_id = str(uuid.uuid4())
        out_dir = os.path.join(OUTPUT_DIR, "instruments", job_id)
        os.makedirs(out_dir, exist_ok=True)

        instruments = {}

        for name, data in result.items():
            path = os.path.join(out_dir, f"{name}.wav")

            stereo = [data["left"], data["right"]]

            sf.write(path, list(zip(*stereo)), sr)

            instruments[name] = f"http://127.0.0.1:5000/output/instruments/{job_id}/{name}.wav"

        return {
            "instruments": instruments
        }

    except Exception as e:
        print("INSTRUMENT SPLIT ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))