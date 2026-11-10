from pathlib import Path
from fastapi import HTTPException

def resolve_safe_path(base_dir: Path, file_path: str) -> Path:
    target_path = (base_dir / file_path).resolve()
    base_resolved = base_dir.resolve()

    if not str(target_path).startswith(str(base_resolved)):
        raise HTTPException(status_code=403, detail="Truy cập đường dẫn không hợp lệ")
    return target_path