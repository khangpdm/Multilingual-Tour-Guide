from pathlib import Path
from fastapi import HTTPException


def resolve_safe_path(base_dir: Path, file_path: str) -> Path:
    base_resolved = base_dir.resolve()
    target_path = (base_resolved / file_path).resolve()

    if not target_path.is_relative_to(base_resolved):
        raise HTTPException(
            status_code=403,
            detail="Truy cập đường dẫn không hợp lệ"
        )

    return target_path