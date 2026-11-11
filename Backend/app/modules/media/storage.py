import hashlib
import io
import re
import warnings
from uuid import uuid4

from PIL import Image, UnidentifiedImageError
from mutagen.mp3 import MP3, HeaderNotFoundError

from app.core.config import MEDIA_ROOT
from app.core.utils import fail

IMAGE_LIMIT = 5 * 1024 * 1024
AUDIO_LIMIT = 15 * 1024 * 1024


def asset_path(url):
    prefix = "/admin/assets/"
    if not url or not url.startswith(prefix):
        fail(422, "UNMANAGED_ASSET", "Upload this resource to Admin before packaging it.")
    name = url[len(prefix):]
    if not re.fullmatch(r"[a-f0-9]{32}\.(jpg|png|webp|mp3)", name):
        fail(422, "INVALID_ASSET", "Invalid resource path.")
    path = MEDIA_ROOT / name
    if not path.is_file():
        fail(422, "MISSING_ASSET", "Resource is missing from storage.")
    return path


def store_bytes(data, extension):
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    path = MEDIA_ROOT / f"{uuid4().hex}.{extension}"
    path.write_bytes(data)
    return f"/admin/assets/{path.name}", hashlib.sha256(data).hexdigest()


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


def checked_image(data):
    if not data or len(data) > IMAGE_LIMIT:
        fail(422, "INVALID_IMAGE", "Images must be between 1 byte and 5 MB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                if image.format not in {"JPEG", "PNG", "WEBP"} or image.width * image.height > 20_000_000:
                    raise ValueError()
                image.load()
                image.thumbnail((1600, 1600))
                output = io.BytesIO()
                image.convert("RGB").save(output, format="JPEG", quality=88)
                return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        fail(422, "INVALID_IMAGE", "Use a valid JPG, PNG or WebP image under 20 megapixels.")
