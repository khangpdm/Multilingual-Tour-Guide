# PRD — Hệ Thống Du Lịch & Thuyết Minh Tự Động
**(React Native Mobile App & ReactJS Admin — Tài liệu tham khảo cho AI Co-pilot)**

* **Loại tài liệu:** Product Requirements Document (PRD) — kỹ thuật, không bao gồm mốc thời gian/nhân sự.
* **Phạm vi:** Generic, áp dụng cho bất kỳ khu du lịch/ẩm thực nào.
* **Đối tượng đọc:** AI Co-pilot lập trình (Cursor/Copilot/Claude Code) + kỹ sư triển khai.

---

## MỤC LỤC
1. Tổng quan sản phẩm
2. Yêu cầu chức năng
3. Yêu cầu phi chức năng
4. Bảng hằng số vận hành & nguyên tắc thiết kế
5. Tech Stack và ma trận chi phí
6. Luồng chạy End-to-End cho AI Co-pilot

---

## 1. TỔNG QUAN SẢN PHẨM

### 1.1 Tầm nhìn
Xây dựng một hệ thống thuyết minh du lịch tự động, không cần hướng dẫn viên, không cần đăng nhập, hoạt động mượt mà kể cả khi mất mạng hoàn toàn — giúp du khách khám phá điểm đến (POI: món ăn, di tích, quán ăn, trạm dừng...) bằng cách đơn giản là đi bộ ngang qua hoặc quét QR trên ứng dụng di động cài sẵn.

### 1.2 Mục tiêu cốt lõi
| Mục tiêu | Mô tả | Tiêu chí đo lường |
| :--- | :--- | :--- |
| **$0 Core** | Toàn bộ tính năng lõi chạy trên hạ tầng mã nguồn mở, chi phí vận hành gần bằng 0 | Không phụ thuộc dịch vụ trả phí bắt buộc để vận hành MVP |
| **Hands-free Experience** | Du khách không thao tác gì ngoài việc di chuyển; audio tự phát ngầm khi vào vùng Geofence kể cả khi tắt màn hình | ≥ 90% lượt phát audio là tự động (không do người dùng bấm) |
| **Zero-Downtime Offline** | Ứng dụng không bao giờ hiển thị màn hình trắng hoặc lỗi cứng khi mất mạng | 100% các màn hình chính có fallback offline native qua SQLite |
| **Guest-first** | Không có rào cản đăng nhập cho du khách | Time-to-first-audio < vài giây kể từ khi mở app lần đầu |

### 1.3 Mô hình ứng dụng 2 cổng (Multi-Portal)

```text
┌────────────────────────────────────────┐       ┌────────────────────────────────────────┐
│     PUBLIC MOBILE APP (React Native)   │       │      ADMIN DASHBOARD (ReactJS Web)     │
│  - Đối tượng: Du khách                 │       │  - Đối tượng: Quản trị viên,           │
│  - Auth: KHÔNG BẮT BUỘC (Guest-first)  │       │    chủ POI (poi_owner)                 │
│  - Ưu tiên: Offline-First (SQLite)     │       │  - Auth: BẮT BUỘC (RBAC)               │
│  - Nền tảng: App Native (iOS/Android)  │       │  - Nền tảng: Web Desktop / Tablet      │
└────────────────────────────────────────┘       └────────────────────────────────────────┘
                    │                                       │
                    └───────────────────┬───────────────────┘
                                        ▼
                           ┌─────────────────────────┐
                           │   FastAPI Backend Core  │
                           │  MongoDB + Redis + SSE  │
                           └─────────────────────────┘
```

* **Public Mobile App (React Native):** Trải nghiệm khách du lịch, ứng dụng di động Native cài đặt trên iOS/Android, tối ưu hiệu năng phần cứng, chạy Background Geofence/Audio và hoạt động độc lập với kết nối mạng sau khi tải Offline Pack.
* **Admin Dashboard (ReactJS Web):** Quản lý vòng đời POI (tạo/duyệt/xuất bản), theo dõi hàng đợi xử lý âm thanh (TTS), xem hệ thống báo cáo thống kê toàn diện (Analytics), giám sát mật độ khách qua Heatmap, quản trị phân quyền và nhật ký audit.

### 1.4 Nguyên tắc thiết kế xuyên suốt
* **Offline-first, không phải offline-fallback:** thiết kế mặc định là hoạt động offline, online là "tăng cường" chứ không phải điều kiện tiên quyết.
* **Progressive Enhancement theo tầng mạng:** hệ thống tự chọn tầng audio phù hợp nhất theo chất lượng mạng hiện tại (xem mục 2.1.6 — 4-Tier Audio Hybrid).
* **Privacy-by-Design:** dữ liệu định danh cá nhân (PII) được mã hóa, tự động redact, không thu thập nếu chưa có consent.

---

## 2. YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS)

### 2.1 Phân hệ Public Mobile App (React Native End-User)

#### 2.1.1 Luồng khởi động Guest (No Auth) & Startup Probe
* **Mô tả nghiệp vụ:** Khi mở app Native, hệ thống thực hiện một chuỗi kiểm tra kết nối ("Startup Probe") để quyết định app sẽ khởi động ở Cloud Mode, Hybrid Mode hay Offline Mode mà không chặn du khách chờ đợi quá lâu.
* **Quy tắc:**
  * Mỗi lần probe có timeout `2.5s`.
  * Tối đa 2 lần thử trong cửa sổ `8 giây`.
  * Nếu cả 2 lần probe thất bại → app khởi động ngay ở Offline Mode dùng dữ liệu SQLite/Local File System cục bộ, không hiển thị màn hình lỗi.
  * Không có bước đăng nhập/đăng ký trong luồng này — `user_id` là ẩn danh (UUID tạo theo thiết bị).
* **Sơ đồ luồng:**
  ```text
  App Launch (React Native)
     │
     ▼
  [Probe #1: GET /health, timeout 2.5s]
     │
     ├── Success ──► Xác định Cloud/Hybrid Mode ──► Load POI qua Delta Sync
     │
     └── Fail ──► chờ đến khi đủ 8s kể từ probe đầu ──► [Probe #2, timeout 2.5s]
                                                            │
                                                            ├── Success ──► Cloud/Hybrid Mode
                                                            └── Fail ──► OFFLINE MODE (dùng SQLite/File local)
  ```
* **Endpoint liên quan:**
  * `GET /health`: Startup probe — kiểm tra khả dụng backend.
  ```json
  // GET /health — 200 OK
  {
    "status": "ok",
    "server_time": "2026-09-17T08:00:00Z",
    "version": "1.4.2"
  }
  ```

#### 2.1.2 Ba chế độ Bản đồ
| Chế độ | Nguồn dữ liệu bản đồ | Khi nào dùng |
| :--- | :--- | :--- |
| **Cloud Mode** | Tile server online (vector tiles qua `@maplibre/maplibre-react-native`) | Có mạng ổn định, chưa tải Offline Pack |
| **Offline Pack (PMTiles)** | File `.pmtiles` lưu trong Local Storage thiết bị | Đã tải Offline Pack, không có mạng |
| **Hybrid Q4 Mode** | Kết hợp: base map từ PMTiles cục bộ + lớp phủ động (POI, Heatmap) fetch online khi có thể | Có mạng chập chờn/yếu (2G/3G không ổn định) |

* **Ghi chú kỹ thuật:** Bản đồ Offline đọc file `.pmtiles` từ bộ nhớ máy thông qua bộ giải mã PMTiles Native. Hybrid Q4 Mode ưu tiên render base map local để đạt latency 0ms.

#### 2.1.3 Lớp phủ Heatmap mật độ du khách thời gian thực
* **Mô tả nghiệp vụ:** Hiển thị một lớp phủ nhiệt (heatmap) trên bản đồ Native, thể hiện khu vực đang có đông du khách, tổng hợp từ vị trí ẩn danh của người dùng theo khung giờ.
* **Nguồn dữ liệu:** Collection `runtime_location_hourly` — dữ liệu vị trí gộp (aggregate) theo giờ, ẩn danh hóa.
* **Endpoint:** `GET /heatmap?bbox={minLng,minLat,maxLng,maxLat}&hour={0-23}`
  ```json
  // GET /heatmap?bbox=106.68,10.75,106.72,10.79&hour=14 — 200 OK
  {
    "hour": 14,
    "generated_at": "2026-09-17T14:05:00Z",
    "points": [
      { "lat": 10.7756, "lng": 106.7019, "weight": 0.82 },
      { "lat": 10.7769, "lng": 106.7003, "weight": 0.35 }
    ]
  }
  ```
* **Quy tắc consent:** Chỉ tổng hợp vị trí của thiết bị đã bật `location_consent = true`.

#### 2.1.4 Định vị & Geofence Engine (Hỗ trợ Background/Lock-screen)
* **Mô tả nghiệp vụ:** Khi du khách di chuyển vào bán kính quy định quanh một POI, ứng dụng tự động kích hoạt phát audio thuyết minh theo ngôn ngữ đã chọn — kể cả khi ứng dụng đang chạy ngầm hoặc thiết bị đã khóa màn hình.
* **Công nghệ Native:** Turf.js + `react-native-geolocation-service` (Foreground Service trên Android / Background Location trên iOS) + `react-native-track-player`.
* **Tham số vận hành:**
  * `GEO_DEFAULT_RADIUS`: `30m`
  * `GPS_THROTTLE`: `5s`
  * `GEO_DEBOUNCE`: `3s`
  * `GEO_COOLDOWN`: `5 phút`
  * `Safety Reconcile loop`: `5s`
* **Luồng xử lý:**
  ```text
  GPS Native Update (mỗi ≤5s do throttle / Background Service)
     │
     ▼
  Turf.js: point-in-circle check với tất cả POI trong Hotset (≤10 POI / 1.5km)
     │
     ├── Không có POI nào trong bán kính ──► không làm gì
     │
     └── Có POI trong bán kính 30m
            │
            ▼
         Debounce 3s (xác nhận vị trí ổn định)
            │
            ▼
         Kiểm tra Cooldown 5' cho POI này
            │
            ├── Đang trong Cooldown ──► bỏ qua
            │
            └── Không trong Cooldown ──► Trigger phát Audio Ngầm (TrackPlayer)
                                            │
                                            ▼
                                      Safety Reconcile loop (mỗi 5s)
  ```

#### 2.1.5 Quét mã QR Code
* **Mô tả nghiệp vụ:** Dùng Camera Native (`react-native-camera` hoặc `expo-camera`) quét mã QR tại các trạm cố định để nghe thuyết minh lập tức mà không phụ thuộc GPS.
* **Endpoint:** `GET /poi/by-qr/{qr_code}`
  ```json
  // GET /poi/by-qr/QR-POI-0042 — 200 OK
  {
    "poi_id": "poi_0042",
    "name": "Chợ Bến Thành",
    "audio_tier_available": ["tier1_pregen", "tier2_cloud_tts"],
    "audio_url": "/audio/poi_0042/vi.mp3",
    "trigger_source": "qr_scan"
  }
  ```
* **Quy tắc:** Bỏ qua hoàn toàn logic Debounce/Cooldown của Geofence Engine — phát ngay khi quét thành công.

#### 2.1.6 Hệ thống Thuyết minh âm thanh 4 Tầng (4-Tier Audio Hybrid)
* **Tầng 1 (Tier 1 - Pre-generated):** `0ms` — Audio đã lưu sẵn trong File System local/CDN.
* **Tầng 1.5 (Tier 1.5 - On-demand Translate + TTS):** `2–5s` — Ngôn ngữ chưa sẵn → Dịch (`deep-translator`) + TTS (`Edge-TTS`) ngầm, lưu cache local cho lần sau.
* **Tầng 2 (Tier 2 - Cloud TTS Stream):** `3–8s` — Stream TTS trực tiếp từ Cloud khi nội dung động.
* **Tầng 3 (Tier 3 - Local Speech Synthesis):** `0ms` — Dùng Text-To-Speech Engine mặc định của iOS/Android (SpeechSynthesis Native) — fallback cuối cùng khi offline hoàn toàn và chưa có file audio cache.

#### 2.1.7 Đa ngôn ngữ 2 làn & Hotset readiness
* **2 làn ngôn ngữ:** *Content Locale* (Nội dung thuyết minh) & *UI Bundle Locale* (Giao diện App).
* **Hotset readiness:** Pre-cache (dữ liệu + audio Tier 1) cho tối đa 10 POI gần nhất trong bán kính 1.5km.

---

### 2.2 Phân hệ Quản trị (Admin Dashboard - ReactJS Web)

#### 2.2.1 Phân quyền Dynamic RBAC
* **Mô hình:** 32 permissions, 9 domains, 4 vai trò mặc định (`super_admin`, `admin`, `poi_owner`, `user`).
* **9 Domains:** `poi_management`, `content_moderation`, `audio_tasks`, `user_management`, `role_management`, `analytics`, `audit`, `system_config`, `heatmap_monitoring`.

#### 2.2.2 Giám sát Task TTS qua SSE Stream
* **Mô tả:** Admin theo dõi hàng đợi tạo Audio TTS real-time qua Server-Sent Events (`GET /admin/audio-tasks/stream`). Ràng buộc: `MAX_CONCURRENT_TTS = 3`.

#### 2.2.3 Module Thống kê & Báo cáo Toàn diện (Full Analytics & Reporting System)
Phân hệ Admin được tích hợp hệ thống báo cáo chuyên sâu giúp quản trị viên nắm toàn bộ hoạt động hệ thống:

1. **Real-time Presence Metrics:**
   * Thống kê số lượng du khách đang truy cập ứng dụng đồng thời thời gian thực (`tracked_online_users`), quản lý qua Redis Sliding Window.
2. **POI Performance Metrics:**
   * Top các POI có lượt ghé thăm (Geofence trigger) và lượt nghe audio nhiều nhất.
   * Thống kê tỷ lệ kích hoạt thuyết minh qua GPS tự động vs Quét mã QR thủ công.
   * Danh sách POI bị thiếu bản dịch hoặc thiếu file audio ở các ngôn ngữ chính.
3. **User & Language Metrics:**
   * Biểu đồ tỷ lệ ngôn ngữ được du khách thiết lập nhiều nhất (VI, EN, JA, ZH, KO...).
   * Tỷ lệ du khách chấp nhận tải gói Offline Pack về điện thoại.
4. **System & Audio Performance Metrics:**
   * Tỷ lệ Cache HIT/MISS của hệ thống Audio 4 Tầng.
   * Thống kê số lượng request gọi TTS On-demand (Tier 1.5/Tier 2).
5. **Heatmap & Location Analytics:**
   * Báo cáo phân tích biến động mật độ du khách theo khung giờ trong ngày và theo ngày trong tuần dựa trên `analytics_*` và `runtime_location_hourly`.
6. **Báo cáo & Export Data:**
   * Hỗ trợ xuất tất cả dữ liệu báo cáo ra định dạng CSV, Excel, hoặc JSON.

* **Endpoints Analytics liên quan:**
  * `GET /admin/analytics/overview`: Tổng quan chỉ số real-time.
  * `GET /admin/analytics/pois?sort_by=listens`: Báo cáo chi tiết hiệu năng POI.
  * `GET /admin/analytics/export?type={poi|users|audio}&format={csv|excel|json}`: Export báo cáo.

#### 2.2.4 Bảo mật & Audit
* **Mã hóa PII:** Mã hóa Fernet cho thông tin cá nhân với tiền tố `"v1:"`. Tự động Redact sau 180 ngày (`PII_RETENTION_DAYS = 180`).
* **Audit Log:** Ghi nhận mọi thao tác biến đổi dữ liệu trên Admin vào collection `audit_logs`.

---

## 3. YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)

### 3.1 Hiệu năng & Delta Sync
* Đồng bộ dữ liệu chênh lệch giữa Server và React Native SQLite bằng HTTP `If-None-Match` (ETag) và tham số `updated_after`.
* Endpoint: `GET /poi/load-all?updated_after={iso_timestamp}` (Header: `If-None-Match: {etag}`).
* `POI_CACHE_TTL`: `15 phút`.

### 3.2 Kiến trúc Offline Native (4 Lớp Phòng Ngự)
* **Lớp 1 — Native File Caching & HTTP Interceptor:** Sử dụng thư viện caching Native (như `react-native-blob-util`) để lưu trữ Audio, Images, Map Tiles trực tiếp vào File System của thiết bị.
* **Lớp 2 — Language Sharding & Build Sync:** Giới hạn tối đa 300 files/ngôn ngữ (`LANG_SHARD_MAX_FILES`), lưu tối đa 3 ngôn ngữ offline (`LANG_SHARD_MAX_LANGS`) theo cơ chế LRU Eviction.
* **Lớp 3 — SQLite / WatermelonDB Local Database:** Lưu trữ toàn bộ thông tin POI, bản dịch, cấu hình UI xuống SQLite cục bộ. Content Fallback 3 tầng khi hiển thị: `Target Locale` → `EN` → `VI` (Không bao giờ lỗi/trắng màn hình).
* **Lớp 4 — Offline Packs Installer:** Cài đặt gói Offline theo thứ tự tuần tự: Map Tiles → POI Text Data → Images → Audio Files. Đảm bảo xác thực SHA-256 Checksum sau khi tải từng phần.

### 3.3 Bảo mật
* **Consent-Gated Analytics:** Chỉ ghi nhận vị trí gửi về `runtime_location_hourly` khi du khách đồng ý `location_consent = true`.
* **httpOnly Cookie Auth (Admin):** `access_token` (30m), `refresh_token` (7d).
* **Path Traversal Protection:** Dùng hàm `resolve_safe_path()` kiểm tra an toàn đường dẫn file tĩnh backend.

---

## 4. BẢNG HẰNG SỐ VẬN HÀNH & NGUYÊN TẮC THIẾT KẾ

### 4.1 Bảng hằng số kỹ thuật
| Hằng số | Giá trị | Domain |
| :--- | :--- | :--- |
| `ACCESS_TOKEN_EXPIRE` | 30 phút | Auth (Admin) |
| `REFRESH_TOKEN_EXPIRE` | 7 ngày | Auth (Admin) |
| `PII_RETENTION_DAYS` | 180 ngày | Bảo mật/Audit |
| `MAX_CONCURRENT_TTS` | 3 | Audio Processing |
| `GPS_THROTTLE` | 5s | Geofence Engine |
| `GEO_DEBOUNCE` | 3s | Geofence Engine |
| `GEO_COOLDOWN` | 5 phút | Geofence Engine |
| `GEO_DEFAULT_RADIUS` | 30m | Geofence Engine |
| `POI_CACHE_TTL` | 15 phút | Delta Sync |
| `STARTUP_PROBE_TIMEOUT` | 2.5s / lần | Startup Flow |
| `STARTUP_PROBE_WINDOW` | 8s (max 2 thử) | Startup Flow |
| `HOTSET_MAX_POI` | 10 POI | Pre-cache Native |
| `HOTSET_RADIUS` | 1.5km | Pre-cache Native |
| `LANG_SHARD_MAX_FILES` | 300 file/ngôn ngữ | Offline Native |
| `LANG_SHARD_MAX_LANGS` | 3 ngôn ngữ đồng thời | Offline Native |
| `RBAC_PERMISSIONS_COUNT` | 32 | RBAC |
| `RBAC_DOMAINS_COUNT` | 9 | RBAC |
| `RBAC_DEFAULT_ROLES_COUNT` | 4 | RBAC |

### 4.2 Design Patterns áp dụng
* **Modular Monolith (10 Routers):** Backend FastAPI giữ sự đơn giản, phân chia theo các Router domain rõ ràng.
* **Defense in Depth:** Tăng cường kiến trúc Offline 4 lớp + Mã hóa PII + RBAC.
* **Privacy-by-Design:** Mã hóa PII, Auto-redact, Consent-gated analytics.

---

## 5. TECH STACK VÀ MA TRẬN CHI PHÍ ($0 CORE)

### 5.1 Bảng phân tích Tech Stack
| Lớp | Công nghệ | Vai trò | Chi phí |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | FastAPI | REST API + SSE Stream | $0 (mã nguồn mở) |
| **Database Core** | MongoDB (qua Motor async) | Lưu POI, Users, Analytics, Audit Logs | $0 (Self-host) |
| **Cache & Queue** | Redis | Cache Session, Redis Sliding Window Analytics, Task Queue | $0 (Self-host) |
| **Mobile App (Du khách)** | **React Native** | App iOS/Android Native, Offline-first | $0 |
| **Mobile Offline Storage** | **SQLite / WatermelonDB** | Cơ sở dữ liệu local trên điện thoại | $0 |
| **Admin Dashboard (Web)** | **ReactJS (React 19) + Vite** | Web App quản trị & Analytics Desktop | $0 |
| **Mobile Maps** | `@maplibre/maplibre-react-native` | Render bản đồ Vector trên App di động | $0 |
| **Offline Map Tiles** | PMTiles | Đóng gói bản đồ Offline thành 1 file | $0 |
| **Background Location & Audio** | `react-native-geolocation-service` + `react-native-track-player` | Chạy ngầm định vị GPS và phát Audio khi tắt màn hình | $0 |
| **Text-to-Speech** | Edge-TTS (Microsoft) | Sinh giọng đọc thuyết minh | $0 (API công khai) |
| **Dịch thuật** | deep-translator (Google Translate) | Dịch tự động nội dung POI đa ngôn ngữ | $0 |

### 5.2 Ma trận chi phí ($0 Core vs Mở rộng)
* **$0 Core:** Tự host Backend/Database trên VPS cá nhân; sử dụng React Native Native Modules; dùng Edge-TTS và deep-translator.
* **Mở rộng (khi scale lớn):** Cloud Managed MongoDB Atlas, Azure Cognitive Speech Services / Google Cloud Translation SLA, Cloudflare CDN cho Audio.

---

## 6. LUỒNG CHẠY END-TO-END CHO AI CO-PILOT

```text
[1] MỞ REACT NATIVE MOBILE APP
     │
     ▼
[2] STARTUP PROBE (≤2 lần, mỗi lần 2.5s, cửa sổ 8s qua GET /health)
     │
     ├── Thành công ──► Xác định Cloud/Hybrid Mode
     └── Thất bại ──► OFFLINE MODE (Dùng SQLite & FileSystem local)
     │
     ▼
[3] LOAD BẢN ĐỒ NATIVE (MapLibre Native: Cloud / PMTiles Offline / Hybrid Q4)
     │
     ▼
[4] DELTA SYNC POI (GET /poi/load-all?updated_after=... + If-None-Match)
     │  → Cập nhật dữ liệu vào SQLite Local Database
     │
     ▼
[5] TÍNH HOTSET (GET /poi/hotset) — Pre-cache tối đa 10 POI / 1.5km vào bộ nhớ máy
     │
     ▼
[6] ĐỊNH VỊ LIÊN TỤC NGẦM (GPS throttle 5s) ──┬── QUÉT QR CODE (Camera Native)
     │ (Chạy ngầm cả khi khóa màn hình)         │
     ▼                                          ▼
[7] GEOFENCE ENGINE (Turf.js, bán kính 30m, debounce 3s, cooldown 5')
     │
     ▼
[8] TRIGGER PHÁT AUDIO NGẦM (TrackPlayer Native) — Chọn tầng 4-Tier Audio Hybrid:
     │   Tier 1 (Local File, 0ms) → Tier 1.5 (Translate+TTS On-demand, 2-5s)
     │   → Tier 2 (Cloud Stream, 3-8s) → Tier 3 (Native OS Text-To-Speech, 0ms)
     │
     ▼
[9] SAFETY RECONCILE LOOP (mỗi 5s) — Đảm bảo trạng thái âm thanh nhất quán
     │
     ▼
[10] CẬP NHẬT VỊ TRÍ ẨN DANH (nếu location_consent=true) ──► runtime_location_hourly
     │
     ▼
[11] RENDER HEATMAP & ĐỒNG BỘ ANALYTICS
     │  → Render Heatmap trên Mobile App & Admin Dashboard
     │  → Ghi nhận Analytics (Presence, Audio Listens, QR Scans) lên Redis/MongoDB

┌───────────────────────────── SONG SONG (Admin Web Dashboard) ────────────────────────────┐
│ 1. Admin quản lý POI, Duyệt nội dung, Theo dõi SSE Stream (GET /admin/audio-tasks/stream)│
│ 2. Xem Báo cáo Analytics toàn diện (Real-time Presence, POI Rank, Lang Ratio, Heatmap)   │
│ 3. Export Báo cáo (CSV/Excel/JSON) & Kiểm tra Audit Logs                                 │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```