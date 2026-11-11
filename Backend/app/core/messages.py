import re

MESSAGES = {
    "Record already exists or conflicts with related data.": "Dữ liệu đã tồn tại hoặc xung đột với dữ liệu liên quan.",
    "Choose an Admin role.": "Vui lòng chọn một vai trò quản trị hợp lệ.",
    "You cannot manage a role at or above your level.": "Bạn không được quản lý vai trò ngang cấp hoặc cao hơn.",
    "Unknown or unavailable permission.": "Quyền không tồn tại hoặc chưa được backend hỗ trợ.",
    "You cannot grant permissions you do not have.": "Bạn không thể cấp quyền mà mình không có.",
    "Role ID is reserved or already exists.": "Mã vai trò đã tồn tại hoặc được dành riêng cho hệ thống.",
    "This role cannot be modified.": "Không được sửa vai trò được bảo vệ hoặc vai trò của chính mình.",
    "Invalid permission changes.": "Danh sách cấp và thu hồi quyền không hợp lệ.",
    "The last active Super Admin must remain active.": "Không thể vô hiệu hóa hoặc hạ quyền Super Admin hoạt động cuối cùng.",
    "You cannot change your own role.": "Bạn không được đổi vai trò của chính mình.",
    "You cannot deactivate yourself.": "Bạn không được vô hiệu hóa chính mình.",
    "Invitation is invalid, expired or already used.": "Lời mời không hợp lệ, đã hết hạn hoặc đã được sử dụng.",
    "Password must contain letters and digits and at most 72 UTF-8 bytes.": "Mật khẩu phải có chữ và số, tối đa 72 byte UTF-8.",
    "Enter a full name.": "Vui lòng nhập họ tên.",
    "Invalid username or password.": "Tên đăng nhập hoặc mật khẩu không đúng.",
    "Account is not active.": "Tài khoản đã bị vô hiệu hóa hoặc chưa được kích hoạt.",
    "This account has no Admin permissions.": "Tài khoản này không có quyền truy cập trang quản trị.",
    "Please sign in.": "Vui lòng đăng nhập để tiếp tục.",
    "The session expired or was already renewed. Please sign in.": "Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.",
    "Try again in a minute.": "Bạn đã đăng nhập quá nhiều lần. Vui lòng thử lại sau một phút.",
    "You do not have permission.": "Bạn không có quyền thực hiện thao tác này.",
    "Record not found.": "Không tìm thấy dữ liệu yêu cầu.",
    "This record already exists.": "Dữ liệu này đã tồn tại.",
    "Invalid input.": "Dữ liệu nhập chưa hợp lệ.",
    "MySQL is unavailable. Check Backend/.env and the MySQL service.": "Không thể kết nối cơ sở dữ liệu. Vui lòng kiểm tra cấu hình và dịch vụ MySQL.",
    "Not Found": "Không tìm thấy chức năng yêu cầu.",
    "Method Not Allowed": "Phương thức thực hiện không được hỗ trợ.",
    "Write requests require an allowed Admin Origin.": "Nguồn gửi yêu cầu không được phép. Vui lòng mở đúng địa chỉ trang quản trị.",
    "Request body is too large.": "Dữ liệu gửi lên vượt quá dung lượng cho phép.",
    "Enter a valid username.": "Vui lòng nhập tên đăng nhập hợp lệ.",
    "Username must contain 3-50 letters, digits, dots, underscores or hyphens and start with a letter or digit.": "Tên đăng nhập gồm 3 đến 50 chữ cái không dấu, chữ số, dấu chấm, gạch dưới hoặc gạch ngang; bắt đầu bằng chữ cái hoặc chữ số.",
    "Bcrypt passwords must not exceed 72 UTF-8 bytes.": "Mật khẩu vượt quá giới hạn 72 byte UTF-8.",
    "Invalid map bounds or zoom range.": "Phạm vi bản đồ hoặc mức thu phóng không hợp lệ.",
    "Use an ISO date with timezone.": "Vui lòng nhập thời gian đúng định dạng ISO và có múi giờ.",
    "Vietnamese content and valid locale codes are required.": "Cần có nội dung tiếng Việt và mã ngôn ngữ hợp lệ.",
    "Zone name already exists.": "Tên khu vực đã tồn tại.",
    "Language already exists.": "Ngôn ngữ đã tồn tại.",
    "Vietnamese must remain enabled.": "Không thể tắt ngôn ngữ tiếng Việt.",
    "Default language must be active.": "Ngôn ngữ mặc định phải đang được bật.",
    "Choose another default language first.": "Vui lòng chọn ngôn ngữ mặc định khác trước.",
    "A default language is required.": "Cần chọn một ngôn ngữ mặc định.",
    "Choose an active language.": "Vui lòng chọn ngôn ngữ đang được bật.",
    "Choose an active zone.": "Vui lòng chọn khu vực đang hoạt động.",
    "Select an active zone.": "Vui lòng chọn khu vực đang hoạt động.",
    "Zone must be active before publishing.": "Khu vực phải đang hoạt động trước khi công khai địa điểm.",
    "Archived POIs cannot be changed.": "Không thể chỉnh sửa địa điểm đã lưu trữ.",
    "At most 10 images per POI.": "Mỗi địa điểm được tải lên tối đa 10 ảnh.",
    "Reorder existing images only.": "Chỉ được sắp xếp lại các ảnh hiện có.",
    "Choose a cover from the existing images.": "Vui lòng chọn ảnh đại diện trong các ảnh hiện có.",
    "Image does not belong to this POI.": "Ảnh không thuộc địa điểm này.",
    "Save content for an active language first.": "Vui lòng lưu nội dung cho ngôn ngữ đang bật trước.",
    "Assign a QR code first.": "Vui lòng cấp mã QR cho địa điểm trước.",
    "Upload this resource to Admin before packaging it.": "Vui lòng tải tài nguyên lên trang quản trị trước khi đóng gói.",
    "Invalid resource path.": "Đường dẫn tài nguyên không hợp lệ.",
    "Resource is missing from storage.": "Không tìm thấy tài nguyên trong bộ lưu trữ.",
    "MP3 must be between 1 byte and 15 MB.": "Tệp MP3 phải có nội dung và không vượt quá 15 MB.",
    "The uploaded file is not a readable MP3.": "Tệp tải lên không phải MP3 hợp lệ hoặc không đọc được.",
    "Images must be between 1 byte and 5 MB.": "Tệp ảnh phải có nội dung và không vượt quá 5 MB.",
    "Use a valid JPG, PNG or WebP image under 20 megapixels.": "Vui lòng chọn ảnh JPG, PNG hoặc WebP hợp lệ, dưới 20 megapixel.",
    "Audio task not found.": "Không tìm thấy tác vụ âm thanh.",
    "Configure TTS_ENDPOINT before generating audio. MP3 upload is available.": "Chưa cấu hình dịch vụ tạo giọng nói. Bạn vẫn có thể tải tệp MP3 lên.",
    "TTS requires HTTPS or a loopback development endpoint.": "Dịch vụ tạo giọng nói phải dùng HTTPS hoặc địa chỉ phát triển trên máy cục bộ.",
    "TTS endpoint redirects are not allowed.": "Dịch vụ tạo giọng nói không được phép chuyển hướng sang địa chỉ khác.",
    "Content is missing.": "Chưa có nội dung thuyết minh.",
    "Language is no longer active.": "Ngôn ngữ này đã bị tắt.",
    "Content or audio changed during generation. Generate again.": "Nội dung hoặc âm thanh đã thay đổi trong lúc xử lý. Vui lòng tạo lại.",
    "Uploaded audio is protected.": "Âm thanh tải lên đang được bảo vệ khỏi việc ghi đè.",
    "Uploaded audio is protected": "Âm thanh tải lên đang được bảo vệ khỏi việc ghi đè.",
    "Missing script or inactive language": "Chưa có kịch bản thuyết minh hoặc ngôn ngữ đã bị tắt.",
    "A task is already active": "Đã có tác vụ đang xử lý cho nội dung này.",
    "Audio generation failed. Check provider configuration and server connectivity, then retry.": "Không tạo được âm thanh. Vui lòng kiểm tra cấu hình dịch vụ và kết nối, sau đó thử lại.",
    "Save the translated script first; this provider generates speech only.": "Vui lòng lưu bản dịch kịch bản trước; dịch vụ này chỉ tạo giọng nói.",
    "Only active tasks may be cancelled.": "Chỉ có thể hủy tác vụ đang chờ hoặc đang xử lý.",
    "Only failed or cancelled tasks may be retried.": "Chỉ có thể thử lại tác vụ thất bại hoặc đã hủy.",
    "Save a script first.": "Vui lòng lưu kịch bản thuyết minh trước.",
    "Another task is already active for this content.": "Đã có tác vụ khác đang xử lý nội dung này.",
    "Server restarted. Retry this task.": "Máy chủ đã khởi động lại. Vui lòng chạy lại tác vụ.",
    "Server restarted. Create a new version.": "Máy chủ đã khởi động lại. Vui lòng tạo phiên bản mới.",
    "Offline release not found.": "Không tìm thấy phiên bản gói ngoại tuyến.",
    "Audio checksum does not match. Upload it again.": "Mã kiểm tra âm thanh không khớp. Vui lòng tải lại tệp.",
    "This zone has no published POIs.": "Khu vực này chưa có địa điểm được công khai.",
    "A pack part may not exceed 250 MB. Split the zone.": "Mỗi phần của gói không được vượt quá 250 MB. Vui lòng chia nhỏ khu vực.",
    "Invalid resources": "Tài nguyên không hợp lệ.",
    "Packaging failed. Check storage and resources, then create a new version.": "Đóng gói thất bại. Vui lòng kiểm tra bộ lưu trữ và tài nguyên, sau đó tạo phiên bản mới.",
    "Pack not found.": "Không tìm thấy gói ngoại tuyến.",
    "Pack is missing or changed. Build a new version.": "Gói bị thiếu hoặc đã thay đổi. Vui lòng tạo phiên bản mới.",
    "Only ready releases may be published.": "Chỉ có thể phát hành phiên bản đã sẵn sàng.",
    "Source content changed. Build a new version before publishing.": "Nội dung nguồn đã thay đổi. Vui lòng tạo phiên bản mới trước khi phát hành.",
    "A language pack is not ready.": "Có gói ngôn ngữ chưa sẵn sàng.",
    "Only published packs may be withdrawn.": "Chỉ có thể thu hồi gói đang được phát hành.",
    "The pack is not ready for download.": "Gói chưa sẵn sàng để tải xuống.",
    "Language pack not found.": "Không tìm thấy gói ngôn ngữ.",
}


def message_vi(message):
    if not isinstance(message, str):
        return message
    if message in MESSAGES:
        return MESSAGES[message]
    match = re.fullmatch(r"Language ([a-z]{2,3}(?:-[A-Z]{2})?) is not active\.", message)
    return f"Ngôn ngữ {match[1]} chưa được bật." if match else message


def localize_messages(value):
    if isinstance(value, list):
        return [localize_messages(item) for item in value]
    if isinstance(value, dict):
        return {key: message_vi(item) if key in {"message", "error", "reason"} and isinstance(item, str) else localize_messages(item) for key, item in value.items()}
    return value


FIELD_LABELS = {
    "username": "Tên đăng nhập", "password": "Mật khẩu", "email": "Email",
    "name": "Tên", "full_name": "Họ và tên", "description": "Mô tả ngắn", "introduction": "Bài giới thiệu",
    "text": "Kịch bản thuyết minh", "address": "Địa chỉ", "category": "Danh mục", "zone_id": "Khu vực",
    "content": "Nội dung", "locale": "Ngôn ngữ", "locales": "Ngôn ngữ", "code": "Mã ngôn ngữ",
    "native_name": "Tên bản địa", "display_order": "Thứ tự hiển thị", "is_active": "Trạng thái hoạt động",
    "is_default": "Ngôn ngữ mặc định", "location": "Tọa độ", "lat": "Vĩ độ", "lng": "Kinh độ",
    "geofence_radius_m": "Bán kính kích hoạt", "map_region": "Vùng bản đồ", "bbox": "Giới hạn bản đồ",
    "min_zoom": "Mức thu phóng nhỏ nhất", "max_zoom": "Mức thu phóng lớn nhất",
    "images": "Hình ảnh", "cover_image": "Ảnh đại diện", "file": "Tệp tải lên", "reason": "Lý do",
    "page": "Trang", "page_size": "Số dòng mỗi trang", "regenerate": "Tạo lại mã", "retranslate": "Dịch lại",
    "replace_uploaded_audio": "Thay thế âm thanh đã tải lên",
}


def validation_detail(error):
    kind = error["type"]
    context = error.get("ctx") or {}
    reasons = {
        "missing": "Vui lòng nhập thông tin này.", "extra_forbidden": "Trường này không được hỗ trợ.",
        "string_type": "Vui lòng nhập chuỗi ký tự.", "int_parsing": "Vui lòng nhập số nguyên.",
        "int_type": "Vui lòng nhập số nguyên.", "float_parsing": "Vui lòng nhập số hợp lệ.",
        "float_type": "Vui lòng nhập số hợp lệ.", "finite_number": "Số nhập phải là số hữu hạn.",
        "bool_parsing": "Vui lòng chọn giá trị đúng hoặc sai.", "bool_type": "Vui lòng chọn giá trị đúng hoặc sai.",
        "list_type": "Vui lòng cung cấp một danh sách.", "dict_type": "Dữ liệu phải là một đối tượng hợp lệ.",
        "literal_error": "Vui lòng chọn một giá trị được hỗ trợ.", "string_pattern_mismatch": "Định dạng không hợp lệ.",
        "json_invalid": "Dữ liệu JSON không hợp lệ.",
        "string_too_short": f"Cần nhập ít nhất {context.get('min_length')} ký tự.",
        "string_too_long": f"Chỉ được nhập tối đa {context.get('max_length')} ký tự.",
        "too_short": f"Cần có ít nhất {context.get('min_length')} phần tử.",
        "too_long": f"Chỉ được có tối đa {context.get('max_length')} phần tử.",
        "greater_than_equal": f"Giá trị phải lớn hơn hoặc bằng {context.get('ge')}.",
        "less_than_equal": f"Giá trị phải nhỏ hơn hoặc bằng {context.get('le')}.",
        "greater_than": f"Giá trị phải lớn hơn {context.get('gt')}.",
        "less_than": f"Giá trị phải nhỏ hơn {context.get('lt')}.",
    }
    reason = reasons.get(kind, "Giá trị không hợp lệ.")
    if kind == "value_error":
        original = str(context.get("error", ""))
        translated = message_vi(original)
        if translated != original:
            reason = translated
    location = error["loc"]
    label = next((FIELD_LABELS[part] for part in reversed(location) if part in FIELD_LABELS), "Dữ liệu")
    return {"field": ".".join(map(str, location)), "label": label, "reason": reason}
