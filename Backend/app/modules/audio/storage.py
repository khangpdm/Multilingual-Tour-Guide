import io

from mutagen.mp3 import MP3, HeaderNotFoundError

from app.core.utils import fail
from app.modules.media.storage import store_bytes

AUDIO_LIMIT = 15 * 1024 * 1024


def checked_mp3(data):
    if not data or len(data) > AUDIO_LIMIT:
        fail(422, "INVALID_AUDIO", "MP3 must be between 1 byte and 15 MB.")
    try:
        audio = MP3(io.BytesIO(data))
        if audio.info.length <= 0:
            raise ValueError()
    except (HeaderNotFoundError, ValueError, EOFError):
        fail(422, "INVALID_AUDIO", "The uploaded file is not a readable MP3.")
    return data


def store_audio_bytes(data: bytes):
    return store_bytes(data, "mp3")
