from app.modules.media.storage import (
    AUDIO_LIMIT,
    checked_mp3,
    store_bytes,
)


def store_audio_bytes(data: bytes):
    return store_bytes(data, "mp3")