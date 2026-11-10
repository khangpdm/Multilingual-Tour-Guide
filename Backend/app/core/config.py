from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[3]
STATIC_DIR = BASE_DIR / "static"

IMAGE_DIR = STATIC_DIR / "images"
AUDIO_DIR = STATIC_DIR / "audio"

LANG_SHARD_MAX_LANGS = 3
ZONE_CACHE_TTL = 600  # 10 phút