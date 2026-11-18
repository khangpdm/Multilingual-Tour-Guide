import base64
import hmac
import io
import json
import os
import subprocess
import threading
import wave
from contextlib import asynccontextmanager
from pathlib import Path

import lameenc
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.config import settings

SCRIPT = Path(__file__).with_name("windows_speech.ps1")
POWERSHELL = Path(os.environ.get("SystemRoot", "C:/Windows")) / "System32/WindowsPowerShell/v1.0/powershell.exe"
speech_lock = threading.Lock()
voices = []


def windows_speech(payload):
    if os.name != "nt" or not POWERSHELL.is_file():
        raise RuntimeError("Local TTS requires Windows and Windows PowerShell.")
    result = subprocess.run(
        [str(POWERSHELL), "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", str(SCRIPT)],
        input=json.dumps(payload, ensure_ascii=True).encode("ascii"),
        capture_output=True,
        timeout=45,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    if result.returncode:
        raise RuntimeError("Windows speech synthesis failed. Check installed speech voices and Windows permissions.")
    return json.loads(result.stdout.decode("utf-8-sig"))


def encode_mp3(wav_bytes):
    with wave.open(io.BytesIO(wav_bytes), "rb") as audio:
        if audio.getsampwidth() != 2 or audio.getnchannels() not in {1, 2} or audio.getcomptype() != "NONE":
            raise ValueError("Windows speech must return 16-bit PCM audio.")
        encoder = lameenc.Encoder()
        encoder.set_bit_rate(128)
        encoder.set_in_sample_rate(audio.getframerate())
        encoder.set_channels(audio.getnchannels())
        encoder.set_quality(2)
        result = encoder.encode(audio.readframes(audio.getnframes())) + encoder.flush()
    if not result or len(result) > 15 * 1024 * 1024:
        raise ValueError("Generated MP3 is empty or larger than 15 MB.")
    return bytes(result)


@asynccontextmanager
async def lifespan(app):
    global voices
    if not settings.get("TTS_API_KEY"):
        raise RuntimeError("Set TTS_API_KEY in Backend/.env before starting local TTS.")
    voices = windows_speech({"action": "voices"})
    if not voices:
        raise RuntimeError("No Windows speech voices are installed.")
    yield


app = FastAPI(title="Local Windows TTS", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def local_only(request: Request, call_next):
    if request.client is None or request.client.host not in {"127.0.0.1", "::1"} or request.url.hostname not in {"localhost", "127.0.0.1", "::1"}:
        return Response(status_code=403)
    if request.method != "GET":
        length = request.headers.get("content-length", "")
        if not length.isdigit() or int(length) > 65536:
            return Response(status_code=413)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response


def authorize(request: Request):
    expected = settings.get("TTS_API_KEY", "")
    supplied = request.headers.get("authorization", "")
    if not expected or not hmac.compare_digest(supplied.encode(), ("Bearer " + expected).encode()):
        raise HTTPException(401, "Invalid local TTS credentials.")


class SpeechInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=5000)
    language: str = Field(min_length=2, max_length=20, pattern=r"^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$")

    @field_validator("text")
    @classmethod
    def nonempty(cls, value):
        if not value.strip():
            raise ValueError("Speech text must not be blank.")
        return value


@app.get("/health")
def health(user=Depends(authorize)):
    return {"status": "ok", "provider": "windows-local", "voices": voices}


@app.post("/speech")
def speech(body: SpeechInput, user=Depends(authorize)):
    language = body.language.lower().split("-")[0]
    if not any(voice["language"].lower().split("-")[0] == language for voice in voices):
        raise HTTPException(422, "No installed Windows voice supports this language.")
    if not speech_lock.acquire(timeout=5):
        raise HTTPException(429, "Local TTS is busy. Retry later.")
    try:
        result = windows_speech({"action": "speak", "text": body.text, "language": body.language})
        audio = encode_mp3(base64.b64decode(result["audio"], validate=True))
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Windows speech generation timed out.") from None
    except (RuntimeError, ValueError, KeyError, wave.Error):
        raise HTTPException(503, "Windows speech generation failed. Check installed voices and restart local TTS.") from None
    finally:
        speech_lock.release()
    return Response(audio, media_type="audio/mpeg", headers={"X-TTS-Language": result["language"]})
