Phân công backend Admin

> Cập nhật ngày 17/11/2026: PRD.docx v2 là chuẩn nghiệp vụ cho phần POI đang hoàn thiện. Các mô tả cũ bên dưới về POI mới chưa công khai, unpublish/republish và tạo lại QR không còn áp dụng. Dùng active/archived, khôi phục archive, tiếng Anh bắt buộc và audio mặc định, QR bất biến, content_version/snapshot. Hợp đồng API, migration, ranh giới N/H và kiểm thử cập nhật tại Backend/PRD_V2_IMPLEMENTATION.md. Phân công chủ module N/H không đổi.

Multilingual Tour Guide

Thành viên thực hiện Huy và Nhật
Ngày lập 10 tháng 11 năm 2026

Nhật phụ trách dữ liệu địa điểm và nội dung du lịch. Huy phụ trách truy cập quản trị, audio và phát hành gói offline. Mỗi chức năng có một người chịu trách nhiệm từ database, xử lý nghiệp vụ, API đến kiểm thử và tài liệu. Không chia một chức năng thành hai nửa để hai người cùng làm.

# 1 Phạm vi và cách áp dụng

- Chỉ làm backend FastAPI và MySQL phục vụ Admin. Không giao việc React, giao diện, ứng dụng mobile hoặc API công khai cho Enduser trong đợt này.
- Code đã có nhiều chức năng. Công việc là tiếp nhận, hiểu, kiểm tra và hoàn thiện phần được giao; không mặc định viết lại từ đầu hoặc coi tính năng có code là đã nghiệm thu.
- Giữ cấu trúc phân công theo module của tài liệu NET: dữ liệu phụ trách, nghiệp vụ, API, điểm liên kết và checklist. Không áp dụng công nghệ ASP.NET hoặc LINQ của dự án NET.

# 2 Bảng phân công tổng hợp

| **Người** | **Nhóm chức năng sở hữu** | **Điểm dự kiến** |
| --- | --- | --- |
| Nhật | N1 Khu vực và ngôn ngữ   N2 POI và nội dung đa ngôn ngữ   N3 Ảnh và QR   N4 Kiểm tra công khai   N5 Lưu trữ dữ liệu lõi và migration | 3 + 5 + 4 + 3 + 3   Tổng 18 |
| --- | --- | --- |
| Huy | H1 Đăng nhập và quyền truy cập   H2 Audio tải lên và tác vụ TTS   H3 Gói offline và phát hành   H4 Nhật ký và tổng quan dữ liệu | 3 + 6 + 6 + 3   Tổng 18 |

Điểm là ước lượng tương đối cho phạm vi tiếp nhận và hoàn thiện, không phải số ngày hay cam kết hai phần khó bằng nhau. Huy ít nhóm hơn nhưng audio và offline có xử lý nền, lỗi và trạng thái phức tạp. Nhật nhiều nhóm dữ liệu và chịu trách nhiệm adapter MySQL dùng chung.

Nguyên tắc chốt: người sở hữu viết code và sửa lỗi chức năng; người còn lại review hoặc chạy thử, không đồng thời sửa cùng chức năng.

# 3 Nhật phụ trách nội dung du lịch

## N1 Khu vực và ngôn ngữ

Dữ liệu: zone, languages. API: GET và POST /admin/zones; PUT /admin/zones/{zone\_id}; GET và POST /admin/languages; PUT /admin/languages/{code}.

- Thêm, sửa và bật tắt khu vực; kiểm tra bbox và mức zoom. Quản lý mã, tên, thứ tự và trạng thái ngôn ngữ.
- Bảo đảm ngôn ngữ mặc định hợp lệ, tiếng Việt không bị tắt; sắp xếp đúng khi display\_order bằng 0. Không cho POI mới dùng khu vực hoặc ngôn ngữ không hợp lệ.

## N2 POI và nội dung đa ngôn ngữ

Dữ liệu: poi, poi\_content. API: GET và POST /admin/pois; GET, PUT và DELETE /admin/pois/{poi\_id}; PUT /admin/pois/{poi\_id}/content/{locale}.

- Danh sách phân trang, chi tiết, tạo, sửa và xóa mềm POI; kiểm tra tọa độ, bán kính, khu vực và danh mục chuẩn.
- Lưu riêng description, introduction và text theo ngôn ngữ. POI mới chưa công khai. Khi sửa kịch bản, bỏ audio TTS cũ nhưng giữ MP3 tải lên để kiểm tra thủ công. Không viết quy trình upload hoặc chạy TTS.

## N3 Hình ảnh và QR

API: POST và PUT /admin/pois/{poi\_id}/images; DELETE /admin/pois/{poi\_id}/images/{filename}; POST /admin/pois/{poi\_id}/qr; GET /admin/pois/{poi\_id}/qr/image; GET /admin/assets/{filename}.

- Kiểm tra ảnh thật, kích thước và giới hạn; lưu ảnh, chọn ảnh đại diện, đổi thứ tự và gỡ liên kết. Không xóa tệp đang được snapshot sử dụng.
- Cấp hoặc tạo lại token QR và sinh PNG đúng token. Backend trả ảnh cho frontend tải hoặc in; không giao Nhật sửa chức năng in trên giao diện.

## N4 Kiểm tra và công khai

API: POST /admin/pois/{poi\_id}/unpublish và /republish. Nhật sở hữu readiness dùng chung và dữ liệu trả về cho bản xem trước.

- Kiểm tra danh mục, khu vực, ảnh đại diện và nội dung tiếng Việt có audio cùng checksum trước khi công khai.
- Trả danh sách mục thiếu theo ngôn ngữ để Huy gọi khi tạo offline; không tạo bộ kiểm tra thứ hai. Khi lưu trữ POI, bảo đảm tác vụ audio đang chạy không ghi kết quả trở lại.

## N5 Database và đầu ra bàn giao

Nhật sở hữu adapter mysql\_store.py và migration của dữ liệu lõi: vùng, ngôn ngữ, POI, nội dung, ảnh đại diện. Giữ dữ liệu cũ; bổ sung cột theo cách chạy lại an toàn. Bàn giao API mẫu, dữ liệu thử và kết quả kiểm tra N1 đến N4, gồm trường hợp bị từ chối.

# 4 Huy phụ trách xử lý và vận hành

## H1 Đăng nhập và quyền truy cập

Dữ liệu: users, roles, permissions, role\_permissions, admin\_sessions ở phạm vi tài khoản Admin local. API: POST /auth/login, /auth/refresh, /auth/logout; GET /admin/me/permissions.

- Kiểm tra mật khẩu được hash, phiên đăng nhập, hết hạn và đăng xuất; API trả 401 hoặc 403 đúng trường hợp.
- Cung cấp require(permission), cấu hình quyền audio và offline. Không mở rộng thành CRUD tài khoản hoặc trình quản lý vai trò đầy đủ trong đợt này.

## H2 Audio tải lên và tạo bằng TTS

Dữ liệu: audio\_tasks; chỉ cập nhật các trường audio của poi\_content qua hợp đồng đã chốt. API: POST /admin/pois/{poi\_id}/content/{locale}/audio và /audio/regenerate; GET /admin/audio-tasks; POST /admin/audio-tasks/{task\_id}/cancel và /retry.

- Nhận MP3 tối đa 15 MB, kiểm tra định dạng thật, lưu tệp và SHA-256; trả audio\_url để Admin nghe thử. Huy sở hữu toàn bộ nghiệp vụ upload MP3.
- Tích hợp adapter TTS nhận text và language, trả MP3; không có cấu hình thì báo rõ chưa khả dụng. Không tự dịch nội dung và không đưa API key ra frontend.
- Quản lý hàng đợi, tiến độ, hoàn thành, thất bại, hủy và thử lại. Chặn tác vụ trùng; không ghi đè MP3 nếu chưa cho phép; bỏ kết quả khi nội dung thay đổi hoặc POI bị lưu trữ.

## H3 Gói offline và phát hành

Dữ liệu: offline\_pack\_releases, offline\_pack\_languages và tệp ZIP. API: GET và POST /admin/offline-packs; POST /admin/offline-packs/{release\_id}/publish và /withdraw; GET /admin/offline-packs/{release\_id}/files/{part}.

- Chọn khu vực, ngôn ngữ; lấy snapshot POI công khai. Gọi readiness của Nhật, chỉ đóng gói tài nguyên được quản lý trên máy chủ.
- Tạo ZIP dữ liệu chung và ZIP từng ngôn ngữ; lưu manifest, phiên bản, kích thước, checksum, trạng thái và lỗi.
- Chặn phát hành nếu nguồn đã thay đổi hoặc ZIP hỏng; thay thế bản cũ bằng giao dịch và hỗ trợ thu hồi. Không đóng gói bản đồ; không làm trình tải offline trên mobile.

## H4 Nhật ký và tổng quan dữ liệu

Dữ liệu: audit\_logs và số lượng bản ghi. API: GET /admin/audit-logs, /admin/database/summary và /health.

Hoàn thiện hàm audit dùng chung, phân trang và kiểm soát quyền đọc; không ghi mật khẩu hoặc API key vào log. Kiểm tra số liệu thực từ MySQL và lỗi kết nối. Không làm analytics hành vi hoặc heatmap. Bàn giao API mẫu, cấu hình chạy và kết quả kiểm tra H1 đến H4.

# 5 Ranh giới mã nguồn và dữ liệu

Các đường dẫn dưới đây tính từ Backend/app. Đây là quy tắc sở hữu mã nguồn, không phải yêu cầu hai người viết lại chức năng đã có.

| **Người sửa chính** | **Phạm vi file** |
| --- | --- |
| Nhật | modules/pois, modules/zones, modules/languages; phần ảnh, QR và phục vụ asset trong modules/media; db/mysql\_store.py; migration dữ liệu lõi. |
| --- | --- |
| Huy | modules/audio, modules/offline, modules/auth, modules/audit, modules/system; main.py; cấu hình, phân quyền, lifecycle và tiện ích trong core. |
| Nhật quản lý | modules/media/storage.py giữ hàm lưu tệp, tên tệp và đường dẫn an toàn dùng chung. Huy gọi hàm này, không tự tạo cơ chế lưu ảnh hoặc asset khác. |

## Tách phần upload audio một lần

Hiện endpoint upload MP3 nằm trong modules/media/routes.py và kiểm tra MP3 nằm trong modules/media/storage.py. Trước khi làm song song, Nhật chuyển nguyên logic này sang modules/audio/uploads.py và modules/audio/storage.py, giữ nguyên URL và hành vi; Huy đăng ký router trong main.py. Hai file audio này là cấu trúc đề xuất, chưa được tạo bởi tài liệu.

Sau khi kiểm tra upload cũ vẫn chạy và bàn giao, Huy là người duy nhất sửa nghiệp vụ upload MP3. Nhật không tiếp tục sửa phần audio. Việc chuyển file chỉ là thao tác tách phạm vi, không giao hai người cùng phát triển một chức năng.

## Hợp đồng liên kết cần khóa sớm

| **Chủ hợp đồng** | **Quy tắc sử dụng** |
| --- | --- |
| Nhật | POI và nội dung: giữ poi\_id, zone\_id, locale; description là mô tả ngắn, introduction là bài giới thiệu, text là kịch bản. Huy không sửa tên hoặc ý nghĩa các trường này. |
| --- | --- |
| Huy | Audio: audio\_url, audio\_sha256, audio\_source với UPLOADED hoặc TTS. Nhật chỉ xóa thông tin TTS cũ khi kịch bản đổi; Huy sở hữu ghi kết quả audio. |
| Nhật | readiness trả ready và issues theo ngôn ngữ. Offline gọi lại hàm này, bổ sung kiểm tra tệp và fingerprint riêng, không sao chép quy tắc nội dung. |
| Huy | require, audit và cơ chế hủy tác vụ khi archive. Nhật sử dụng hợp đồng; không tự viết lớp xác thực hay worker audio khác. |

Migration: Nhật sửa adapter và schema lõi; Huy chuẩn bị SQL riêng cho bảng audio và offline của mình. Nếu cần thay đổi schema dùng chung, Nhật tích hợp SQL đã thống nhất trong một lượt, không để hai người cùng sửa mysql\_store.py hoặc admin\_mysql.sql. Huy quản lý requirements, .env.example và hướng dẫn khởi động theo nhu cầu hai bên.

# 6 Trình tự thực hiện và nghiệm thu

## Bước 1 Chốt nền tảng trước khi tách việc

- Huy xác nhận MySQL kết nối được bằng cấu hình local, chuẩn bị tài khoản thử, quyền và cách chạy API; không commit mật khẩu. Nhật chuẩn bị zone, vi, en và POI mẫu.
- Chốt hợp đồng ở mục 5, tách upload MP3 và xác nhận các URL không đổi. Không sửa giao diện để né API đang sai.
- Chỉ kiểm thử trên database và thư mục media riêng. Lượt kiểm thử gần nhất từng bị chặn bởi lỗi đăng nhập MySQL, nên phải xác nhận lại môi trường trước khi coi kết quả cũ là đủ.

## Bước 2 Hai người làm độc lập

Nhật làm N1, N2 rồi N3, N4, N5. Huy làm H1, H4 và khung H2, H3 bằng dữ liệu fixture theo hợp đồng đã chốt. Sau khi có API thật của Nhật, Huy thay fixture bằng dữ liệu thật và kiểm tra liên kết. Fixture chỉ giúp phát triển, không thay cho nghiệm thu database.

Mỗi người tự viết hoặc bổ sung kiểm thử cho module của mình và ghi request, response, kết quả vào tài liệu API. Người kia chỉ review hợp đồng và chạy thử; lỗi phát hiện quay về đúng chủ chức năng.

## Bước 3 Checklist bàn giao của từng người

| **Người** | **Điều kiện hoàn thành** |
| --- | --- |
| Nhật | Tạo POI mặc định chưa công khai; lưu và đọc lại ba trường nội dung; kiểm tra category; ảnh đại diện và thứ tự đúng; QR đúng token; thiếu dữ liệu bị chặn; migration không mất dữ liệu; display\_order bằng 0 không gây lỗi. |
| --- | --- |
| Huy | 401 và 403 đúng; MP3 sai hoặc quá lớn bị từ chối; TTS thiếu cấu hình báo rõ; hủy, thử lại và chống ghi đè đúng; offline kiểm tra ngôn ngữ, checksum và phiên bản; nhật ký không lộ bí mật; tác vụ dở dang sau restart có trạng thái rõ. |

## Bước 4 Demo tích hợp backend

Huy điều phối lần chạy cuối; Nhật cung cấp dữ liệu và sửa lỗi thuộc N1 đến N5. Luồng demo: đăng nhập → tạo vùng và ngôn ngữ → tạo POI → lưu nội dung và ảnh → upload audio → kiểm tra và công khai → lấy PNG QR → tạo offline → phát hành → tải ZIP và đối chiếu checksum.

Luồng từ chối bắt buộc: người không có quyền; thiếu nội dung; tệp sai định dạng; tác vụ đã hủy; nguồn POI đổi sau khi tạo gói. Không công nhận chỉ nhìn thấy nút trên Admin là backend đã hoàn thành.

## 7 Quy tắc bàn giao và giới hạn

- Bàn giao gồm code, migration, dữ liệu mẫu không chứa thông tin thật, API mẫu và bằng chứng kiểm thử. Làm trên nhánh hiện có hoặc nhánh được nhóm thống nhất; commit ghi mã N hoặc H, không commit tệp cấu hình bí mật và media thử.
- Đợt này chạy một worker local; TTS cần dịch vụ được cấu hình. Không giao thêm dịch tự động, queue phân tán, hệ thống tài khoản đầy đủ hoặc API Enduser.
- Sau lượt tích hợp đầu tiên, so lại khối lượng thực tế. Nếu lệch đáng kể thì chuyển nguyên một nhóm chức năng chưa làm, cập nhật người sở hữu trong tài liệu; không chia đôi cùng chức năng.
