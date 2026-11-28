import asyncio
import base64
import hmac
import io
import json
import logging
import os
import subprocess
import threading
import wave
from contextlib import aclosing, asynccontextmanager
from pathlib import Path

import edge_tts
import lameenc
from aiohttp import ClientError
from edge_tts.exceptions import EdgeTTSException
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.config import settings
from app.services.tts_voices import EDGE_VOICES

SCRIPT = Path(__file__).with_name("windows_speech.ps1")
POWERSHELL = Path(os.environ.get("SystemRoot", "C:/Windows")) / "System32/WindowsPowerShell/v1.0/powershell.exe"
PROVIDER = settings.get("TTS_PROVIDER", "edge-tts").strip().lower()
GOOGLE_LANGUAGES = {"vi": "vi-VN", "en": "en-US", "ja": "ja-JP"}
MP3_LIMIT = 15 * 1024 * 1024
speech_lock = threading.Lock()
voices = []
logger = logging.getLogger(__name__)


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
            raise ValueError("Speech synthesis must return 16-bit PCM audio.")
        encoder = lameenc.Encoder()
        encoder.set_bit_rate(128)
        encoder.set_in_sample_rate(audio.getframerate())
        encoder.set_channels(audio.getnchannels())
        encoder.set_quality(2)
        result = encoder.encode(audio.readframes(audio.getnframes())) + encoder.flush()
    if not result or len(result) > MP3_LIMIT:
        raise ValueError("Generated MP3 is empty or larger than 15 MB.")
    return bytes(result)


@asynccontextmanager
async def lifespan(app):
    global voices
    if not settings.get("TTS_API_KEY"):
        raise RuntimeError("Set TTS_API_KEY in Backend/.env before starting local TTS.")
    if PROVIDER == "windows-local":
        voices = windows_speech({"action": "voices"})
        if not voices:
            raise RuntimeError("No Windows speech voices are installed.")
        yield
        return
    if PROVIDER == "edge-tts":
        voices = [{"language": language, "name": name} for language, name in EDGE_VOICES.items()]
        yield
        return
    if PROVIDER != "google":
        raise RuntimeError("Set TTS_PROVIDER to edge-tts, windows-local, or google.")
    from google.api_core.exceptions import GoogleAPICallError
    from google.auth.exceptions import GoogleAuthError
    from google.cloud import texttospeech

    try:
        client = texttospeech.TextToSpeechClient(transport="rest")
    except GoogleAuthError as error:
        raise RuntimeError("Google TTS requires Application Default Credentials. Run gcloud auth application-default login.") from error
    try:
        try:
            available = client.list_voices(timeout=15, retry=None).voices
        except (GoogleAPICallError, GoogleAuthError) as error:
            raise RuntimeError("Google TTS could not list voices. Check ADC, billing, and the Text-to-Speech API.") from error
        languages = sorted({code for voice in available for code in voice.language_codes})
        if not languages:
            raise RuntimeError("Google TTS returned no supported languages.")
        app.state.google_tts = client
        voices = [{"language": code} for code in languages]
        yield
    finally:
        client.transport.close()


app = FastAPI(title="Local Text-to-Speech", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


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
    return {"status": "ok", "provider": PROVIDER, "voices": voices}


def google_speech(client, body):
    from google.api_core.exceptions import DeadlineExceeded, GoogleAPICallError
    from google.auth.exceptions import GoogleAuthError
    from google.cloud import texttospeech

    if len(body.text.encode("utf-8")) > 5000:
        raise HTTPException(422, "Google TTS supports up to 5,000 UTF-8 bytes per script.")
    requested = body.language.lower()
    base = requested.split("-")[0]
    supported = {voice["language"].lower(): voice["language"] for voice in voices}
    language = supported.get(requested)
    if language is None and requested == base:
        language = supported.get(GOOGLE_LANGUAGES.get(base, "").lower())
        if language is None:
            language = next((code for key, code in supported.items() if key.split("-")[0] == base), None)
    if not language:
        raise HTTPException(422, "No Google TTS voice supports this language.")
    try:
        result = client.synthesize_speech(
            input=texttospeech.SynthesisInput(text=body.text),
            voice=texttospeech.VoiceSelectionParams(language_code=language),
            audio_config=texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3),
            timeout=15,
            retry=None,
        )
    except DeadlineExceeded:
        raise HTTPException(504, "Google speech generation timed out.") from None
    except (GoogleAPICallError, GoogleAuthError):
        raise HTTPException(503, "Google speech generation failed. Check Google Cloud credentials and quota.") from None
    if not result.audio_content or len(result.audio_content) > MP3_LIMIT:
        raise HTTPException(502, "Google TTS returned an invalid audio size.")
    return Response(result.audio_content, media_type="audio/mpeg", headers={"X-TTS-Language": language})


async def edge_speech(body: SpeechInput, language: str):
    voice = EDGE_VOICES.get(language)
    if not voice:
        raise HTTPException(422, "No Edge TTS voice supports this language.")
    audio = bytearray()
    try:
        async with asyncio.timeout(50), aclosing(edge_tts.Communicate(body.text, voice).stream()) as stream:
            async for chunk in stream:
                if chunk["type"] != "audio":
                    continue
                audio.extend(chunk["data"])
                if len(audio) > MP3_LIMIT:
                    raise HTTPException(502, "Edge TTS audio exceeds 15 MB.")
    except TimeoutError:
        raise HTTPException(504, "Edge speech generation timed out.") from None
    except (ClientError, EdgeTTSException, OSError) as error:
        logger.warning("Edge TTS failed for %s (%s, status=%s).", voice, type(error).__name__, getattr(error, "status", None))
        raise HTTPException(503, "Edge speech generation failed. Check the Internet connection.") from None
    if not audio:
        raise HTTPException(502, "Edge TTS returned no audio.")
    return Response(bytes(audio), media_type="audio/mpeg", headers={"X-TTS-Language": language})


@app.post("/speech")
def speech(body: SpeechInput, request: Request, user=Depends(authorize)):
    if PROVIDER == "google":
        return google_speech(request.app.state.google_tts, body)
    language = body.language.lower().split("-")[0]
    if PROVIDER == "edge-tts":
        return asyncio.run(edge_speech(body, language))
    if not any(voice["language"].lower().split("-")[0] == language for voice in voices):
        raise HTTPException(422, "No installed TTS voice supports this language.")
    if not speech_lock.acquire(timeout=5):
        raise HTTPException(429, "Local TTS is busy. Retry later.")
    try:
        result = windows_speech({"action": "speak", "text": body.text, "language": body.language})
        audio = encode_mp3(base64.b64decode(result["audio"], validate=True))
        language = result["language"]
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Windows speech generation timed out.") from None
    except (RuntimeError, ValueError, KeyError, wave.Error):
        raise HTTPException(503, "Speech generation failed. Check installed voices and restart local TTS.") from None
    finally:
        speech_lock.release()
    return Response(audio, media_type="audio/mpeg", headers={"X-TTS-Language": language})
