CATEGORIES = {
    "heritage": "Di tích", "museum": "Bảo tàng", "religion": "Tôn giáo",
    "architecture": "Kiến trúc", "park": "Công viên", "food": "Ẩm thực",
}


def readiness(poi, locales=None):
    issues = []
    if poi.get("category") not in CATEGORIES:
        issues.append({"field": "category", "message": "Chọn danh mục chuẩn."})
    images = poi.get("images", [])
    if not images:
        issues.append({"field": "images", "message": "Thêm ít nhất một hình ảnh."})
    if not poi.get("cover_image") or poi.get("cover_image") not in images:
        issues.append({"field": "cover_image", "message": "Chọn ảnh đại diện trong bộ ảnh."})
    for locale in locales or ["vi"]:
        content = poi.get("content", {}).get(locale, {})
        for field, label in [("name", "tên"), ("description", "mô tả ngắn"), ("introduction", "bài giới thiệu"), ("text", "kịch bản thuyết minh"), ("audio_url", "audio"), ("audio_sha256", "mã kiểm tra audio")]:
            if not str(content.get(field) or "").strip():
                issues.append({"field": f"content.{locale}.{field}", "message": f"{locale}: thiếu {label}."})
    return {"ready": not issues, "issues": issues}
