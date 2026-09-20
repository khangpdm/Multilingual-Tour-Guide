# PRD — Hệ Thống Du Lịch Ẩm Thực & Thuyết Minh Tự Động
### (Native Mobile App — Offline-First — Tài liệu tham khảo cho AI Co-pilot)

> **Loại tài liệu:** Product Requirements Document (PRD) — kỹ thuật, không bao gồm mốc thời gian/nhân sự.
> **Phạm vi:** Generic, áp dụng cho bất kỳ khu du lịch/ẩm thực nào.
> **Đối tượng đọc:** AI Co-pilot lập trình (Cursor/Copilot/Claude Code) + kỹ sư triển khai.
> **Cập nhật kiến trúc:** Phân hệ Du khách chuyển từ PWA sang **React Native (Android/iOS)**; Admin Dashboard giữ nguyên **ReactJS + Vite** trên trình duyệt Desktop. Bổ sung **Module Analytics & Reporting toàn diện**.

---

## MỤC LỤC
1. [Tổng quan sản phẩm](#1-tổng-quan-sản-phẩm)
2. [Yêu cầu chức năng](#2-yêu-cầu-chức-năng-functional-requirements)
3. [Yêu cầu phi chức năng](#3-yêu-cầu-phi-chức-năng-non-functional-requirements)
4. [Bảng hằng số vận hành & nguyên tắc thiết kế](#4-bảng-hằng-số-vận-hành--nguyên-tắc-thiết-kế)
5. [Tech Stack và ma trận chi phí](#5-tech-stack-và-ma-trận-chi-phí-0-core)
6. [Luồng chạy End-to-End cho AI Co-pilot](#6-tóm-tắt-luồng-chạy-end-to-end-cho-ai-co-pilot)

---

## 1. TỔNG QUAN SẢN PHẨM

### 1.1 Tầm nhìn
Xây dựng một hệ thống thuyết minh du lịch **tự động, không cần hướng dẫn viên, không cần đăng nhập, hoạt động mượt mà kể cả khi mất mạng hoàn toàn** — giúp du khách khám phá điểm đến (POI: món ăn, di tích, quán ăn, trạm dừng...) bằng cách đơn giản là *đi bộ ngang qua* hoặc *quét QR*, kể cả khi **khóa màn hình điện thoại** (background audio + background geofence).

### 1.2 Mục tiêu cốt lõi

| Mục tiêu | Mô tả | Tiêu chí đo lường |
|---|---|---|
| **$0\* Core** | Toàn bộ tính năng lõi chạy trên hạ tầng mã nguồn mở, chi phí vận hành gần bằng 0 | Không phụ thuộc dịch vụ trả phí bắt buộc để vận hành MVP |
| **Hands-free Experience** | Du khách không thao tác gì ngoài việc di chuyển; audio tự phát khi vào vùng Geofence, kể cả khi khóa màn hình | ≥ 90% lượt phát audio là tự động (không do người dùng bấm) |
| **Zero-Downtime Offline** | Ứng dụng không bao giờ crash hoặc hiển thị màn hình trắng khi mất mạng | 100% các màn hình chính có fallback offline (dữ liệu native local) |
| **Guest-first** | Không có rào cản đăng nhập cho du khách | Time-to-first-audio < vài giây kể từ khi mở app lần đầu |
| **Background Reliability** | Geofence + Audio hoạt động ổn định khi app chạy nền/khóa màn hình | Trigger đúng POI ngay cả khi màn hình tắt trong ≥ 95% trường hợp |

### 1.3 Mô hình ứng dụng 2 cổng (Multi-Portal) — Kiến trúc cập nhật

```
┌───────────────────────────────┐       ┌──────────────────────────────┐
│   MOBILE APP (React Native)    │       │   ADMIN DASHBOARD (ReactJS)    │
│  - Đối tượng: Du khách          │       │  - Đối tượng: Quản trị viên,   │
│  - Nền tảng: Android & iOS      │       │    chủ POI (poi_owner)         │
│    (cài đặt trực tiếp qua       │       │  - Nền tảng: Web Desktop       │
│    Google Play / App Store,     │       │    (React 19 + Vite)           │
│    KHÔNG phải PWA)              │       │  - Auth: BẮT BUỘC (RBAC)       │
│  - Auth: KHÔNG BẮT BUỘC          │       │  - Bổ sung: Module Analytics   │
│  - Offline: SQLite/AsyncStorage/│       │    & Reporting toàn diện       │
│    Local File System (native)   │       │                                │
│  - Background Mode: Audio phát  │       │                                │
│    ngầm + Geofence khi khóa     │       │                                │
│    màn hình                     │       │                                │
└───────────────────────────────┘       └──────────────────────────────┘
              │                                       │
              └───────────────┬───────────────────────┘
                               ▼
                  ┌─────────────────────────┐
                  │   FastAPI Backend Core   │
                  │  MongoDB + Redis + SSE   │
                  └─────────────────────────┘
```

- **Mobile App (React Native):** trải nghiệm khách du lịch, cài đặt native trên Android/iOS, lưu trữ offline bằng công nghệ native (không dùng Service Worker/IndexedDB của trình duyệt), hỗ trợ chạy nền (background) cho cả định vị và phát audio.
- **Admin Dashboard (ReactJS + Vite):** quản lý vòng đời POI, theo dõi hàng đợi TTS, giám sát Heatmap, quản trị RBAC, audit log, và **trung tâm Analytics & Reporting toàn diện**.

### 1.4 Nguyên tắc thiết kế xuyên suốt
- **Offline-first, không phải offline-fallback:** thiết kế mặc định là hoạt động offline bằng storage native trên thiết bị, online là "tăng cường" chứ không phải điều kiện tiên quyết.
- **Progressive Enhancement theo tầng mạng:** hệ thống tự chọn tầng audio phù hợp nhất theo chất lượng mạng hiện tại (xem mục 2.1.6 — 4-Tier Audio Hybrid) — **logic không đổi so với bản PWA**, chỉ thay đổi lớp lưu trữ/thực thi bên dưới.
- **Background-first cho Core Experience:** Geofence Engine và Audio Playback phải hoạt động đúng cả khi app ở background/màn hình khóa — đây là khác biệt cốt lõi so với giới hạn của PWA (trình duyệt hạn chế chạy nền).
- **Privacy-by-Design:** dữ liệu định danh cá nhân (PII) được mã hóa, tự động redact, không thu thập nếu chưa có consent.

---

## 2. YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS)

## 2.1 Phân hệ Mobile App (React Native — End-User)

### 2.1.0 Ghi chú kiến trúc Native (thay thế lớp PWA)

| Thành phần (bản PWA cũ) | Thành phần thay thế (React Native) |
|---|---|
| Service Worker (Workbox) | Background Task (`react-native-background-fetch` / Headless JS) + logic cache tự viết |
| IndexedDB | **SQLite** (qua `react-native-sqlite-storage` hoặc `expo-sqlite`) cho dữ liệu có cấu trúc (POI, metadata) |
| LocalStorage nhỏ gọn | **AsyncStorage** cho cờ trạng thái, config, cache key-value đơn giản |
| Cache Storage API (audio/ảnh) | **Local File System** (`react-native-fs` / `expo-file-system`) lưu file audio/ảnh đã tải |
| Web QR Scanner (`getUserMedia`) | `expo-camera` / `react-native-camera` |
| Web Speech API | `react-native-track-player` (phát Tier 1/2/2.5) + TTS engine native (fallback Tier 3, xem 2.1.6) |
| Browser Geolocation API | `react-native-geolocation-service` (hỗ trợ background tracking tốt hơn API mặc định) |
| MapLibre GL JS (web) | `@maplibre/maplibre-react-native` |
| `pmtiles://` qua trình duyệt | PMTiles đọc trực tiếp từ Local File System, cùng nguyên lý offline map, khác lớp I/O |

> **Nguyên tắc kế thừa:** Toàn bộ **logic nghiệp vụ** (Geofence Engine, 4-Tier Audio Hybrid, Content Fallback 3 tầng, Hotset readiness...) và **các hằng số vận hành** (mục 4) giữ nguyên 100% — chỉ thay đổi công nghệ triển khai bên dưới từ Web API sang Native API.

---

### 2.1.1 Luồng khởi động Guest (No Auth) & Startup Probe

**Mô tả nghiệp vụ (không đổi):** Khi mở app, hệ thống thực hiện một chuỗi kiểm tra kết nối ("Startup Probe") để quyết định app sẽ khởi động ở **Cloud Mode**, **Hybrid Mode** hay **Offline Mode**.

**Quy tắc (không đổi):**
- Mỗi lần probe có timeout **2.5s**.
- Tối đa **2 lần thử** trong cửa sổ **8 giây**.
- Nếu cả 2 lần probe thất bại → app khởi động ngay ở **Offline Mode** dùng dữ liệu SQLite/File System cục bộ, **không** hiển thị màn hình lỗi.
- Không có bước đăng nhập/đăng ký — `user_id` là ẩn danh (device UUID sinh và lưu trong Keychain/Keystore hoặc AsyncStorage).

**Sơ đồ luồng:**
```
App Launch (Native)
   │
   ▼
[Probe #1: GET /health, timeout 2.5s]
   │
   ├── Success ──► Xác định Cloud/Hybrid Mode ──► Load POI qua Delta Sync
   │
   └── Fail ──► chờ đến khi đủ 8s kể từ probe đầu ──► [Probe #2, timeout 2.5s]
                                                          │
                                                          ├── Success ──► Cloud/Hybrid Mode
                                                          └── Fail ──► OFFLINE MODE (SQLite/File System)
```

**Endpoint liên quan:**

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/health` | Startup probe — kiểm tra khả dụng backend |

```json
// GET /health — 200 OK
{
  "status": "ok",
  "server_time": "2026-09-17T08:00:00Z",
  "version": "1.4.2"
}
```

---

### 2.1.2 Ba chế độ Bản đồ

| Chế độ | Nguồn dữ liệu bản đồ | Khi nào dùng |
|---|---|---|
| **Cloud Mode** | Tile server online qua `@maplibre/maplibre-react-native` | Có mạng ổn định, chưa tải Offline Pack |
| **Offline Pack (PMTiles)** | File `.pmtiles` lưu trong Local File System (`react-native-fs`), MapLibre RN đọc trực tiếp | Đã tải Offline Pack, không có mạng |
| **Hybrid Q4 Mode** | Kết hợp: base map từ PMTiles cục bộ (File System) + lớp phủ động (POI, Heatmap) fetch online khi có thể | Có mạng chập chờn/yếu (2G/3G không ổn định) |

**Ghi chú kỹ thuật:** `@maplibre/maplibre-react-native` cung cấp binding native tới MapLibre GL Native SDK (Android/iOS), hiệu năng render bản đồ tốt hơn WebView do dùng GPU rendering trực tiếp thay vì DOM/Canvas.

---

### 2.1.3 Lớp phủ Heatmap mật độ du khách thời gian thực

**Mô tả nghiệp vụ (không đổi):** Hiển thị lớp phủ nhiệt (heatmap) trên bản đồ, thể hiện khu vực đang có đông du khách, tổng hợp từ vị trí ẩn danh theo khung giờ.

**Nguồn dữ liệu:** collection `runtime_location_hourly`.

**Endpoint:**

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/heatmap?bbox={minLng,minLat,maxLng,maxLat}&hour={0-23}` | Lấy dữ liệu mật độ theo khu vực + khung giờ |

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

**Quy tắc consent:** chỉ tổng hợp vị trí của thiết bị đã bật `location_consent = true`.

---

### 2.1.4 Định vị & Geofence Engine (bao gồm chế độ Background)

**Mô tả nghiệp vụ (không đổi):** Khi du khách di chuyển vào bán kính quy định quanh một POI, hệ thống tự động kích hoạt phát audio — **kể cả khi màn hình đang khóa hoặc app chạy nền**.

**Công nghệ:**
- Tính toán hình học: **Turf.js** (giữ nguyên thư viện, chạy trong JS thread của React Native).
- Thu thập vị trí: **`react-native-geolocation-service`** — thay thế Browser Geolocation API, hỗ trợ background location tốt hơn (đặc biệt trên Android, tránh giới hạn throttle mặc định của OS khi app background).
- **Background execution:**
  - **Android:** Foreground Service với notification cố định ("Đang thuyết minh du lịch...") để tránh bị hệ điều hành kill tiến trình.
  - **iOS:** Background Mode `location` + `audio` khai báo trong `Info.plist`; dùng Significant-Change Location Service kết hợp Region Monitoring khi cần tiết kiệm pin tối đa.

> **Ràng buộc quan trọng cần lưu ý (khác nhau giữa Foreground và Background):**
> - Ở **foreground**, có thể polling GPS đều đặn theo `GPS_THROTTLE = 5s` như mô tả.
> - Ở **background/khóa màn hình**, iOS **không cho phép polling liên tục mỗi 5s** — hệ điều hành sẽ tự động giảm tần suất cập nhật vị trí để tiết kiệm pin. Do đó ở chế độ nền, Geofence phải chuyển sang cơ chế **event-based (Region Monitoring — CLCircularRegion enter/exit)** thay vì polling, và **giới hạn tối đa 20 region cùng lúc trên iOS** — đây là lý do `HOTSET_MAX_POI = 10` hiện đang an toàn; nếu sau này tăng số POI theo dõi cùng lúc, cần kiểm tra lại giới hạn này.
> - Cần cơ chế **tự động giảm tần suất khi pin yếu** (VD: dưới 20%) để tránh người dùng tắt hẳn quyền vị trí vì hao pin quá nhanh.

**Tham số vận hành (không đổi — xem Bảng hằng số mục 4):**

| Tham số | Giá trị mặc định | Ý nghĩa |
|---|---|---|
| `GEO_DEFAULT_RADIUS` | 30m | Bán kính kích hoạt Geofence quanh mỗi POI |
| `GPS_THROTTLE` | 5s | Tần suất tối đa đọc lại vị trí GPS |
| `GEO_DEBOUNCE` | 3s | Thời gian chờ xác nhận vị trí ổn định trước khi trigger |
| `GEO_COOLDOWN` | 5 phút | Thời gian không trigger lại cùng một POI sau khi đã phát |
| Safety Reconcile loop | 5s | Vòng lặp kiểm tra lại trạng thái vị trí/POI để tự sửa lỗi trạng thái (state drift) |

**Luồng xử lý (không đổi về logic, chạy được cả background):**
```
GPS update (mỗi ≤5s do throttle, kể cả background nhờ Foreground Service/Background Mode)
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
          └── Không trong Cooldown ──► Trigger phát Audio nền (react-native-track-player)
                                          │
                                          ▼
                                    Safety Reconcile loop (mỗi 5s) đảm bảo
                                    trạng thái "đang phát/đã phát" nhất quán
```

---

### 2.1.4b Thời điểm xin quyền vị trí & Fallback khi từ chối — MỚI

**Thời điểm xin quyền (contextual permission, không hỏi ngay khi mở app lần đầu):**
1. App mở lần đầu → hiển thị **màn hình giải thích (priming screen)**: "Ứng dụng tự động phát thuyết minh khi bạn đi ngang qua điểm tham quan — cần quyền vị trí để làm điều này" + nút "Bật vị trí" / "Để sau".
2. Khi người dùng bấm "Bật vị trí" → mới gọi native permission dialog, xin **When In Use** trước.
3. Quyền **Background/Always** chỉ xin **sau khi** người dùng đã dùng thử tính năng và thấy hữu ích (VD: sau lần đầu Geofence trigger thành công ở foreground, hoặc khi họ chuẩn bị tải Offline Pack cho 1 zone) — đúng khuyến nghị của Apple/Google, tăng tỷ lệ chấp nhận và giảm rủi ro bị App Store từ chối.

**Nguyên tắc thiết kế Fallback: 1 audio — 3 cách kích hoạt.** Nếu du khách từ chối quyền vị trí (một phần hoặc toàn bộ), trải nghiệm **không bị chặn**, chỉ mất phần tự động:

| Cách kích hoạt | Phụ thuộc quyền vị trí? | Trạng thái khi từ chối |
|---|---|---|
| Geofence tự động (đang đi tới gần POI) | Có | Tắt |
| Quét QR | Không | Vẫn hoạt động bình thường |
| **Chạm tay chọn POI trên bản đồ/danh sách (Manual Tap-to-Play)** — **MỚI** | Không | Vẫn hoạt động bình thường — đây là fallback chính |

**Endpoint mới cho Manual Tap-to-Play** (dùng chung pipeline audio với QR, chỉ khác nguồn kích hoạt):

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/poi/{poi_id}` | Lấy chi tiết POI + audio để phát khi người dùng chạm tay chọn (không qua Debounce/Cooldown, giống hành vi QR) |

```json
// GET /poi/poi_0042 — 200 OK
{
  "poi_id": "poi_0042",
  "name": "Chợ Bến Thành",
  "audio_tier_available": ["tier1_pregen"],
  "audio_url": "/audio/poi_0042/vi.mp3",
  "trigger_source": "manual_tap"
}
```

**UX khi từ chối:**
- Bản đồ vẫn hiển thị toàn bộ POI, chỉ không có chấm định vị của du khách và không có auto-trigger.
- Một **banner nhỏ, có thể đóng** ("Bật định vị để nghe thuyết minh tự động") hiển thị một lần/phiên — không tự động mở Settings hệ điều hành, không hỏi lại permission dialog liên tục nếu người dùng đã từ chối trước đó.
- Onboarding nên nhấn mạnh QR như phương án thay thế nhanh nếu người dùng chọn "Để sau" ở bước xin quyền.

---

### 2.1.5 Quét mã QR Code

**Mô tả nghiệp vụ (không đổi):** Tại các điểm cố định, du khách quét mã QR để nghe thuyết minh **ngay lập tức**, không phụ thuộc GPS.

**Công nghệ:** `expo-camera` (nếu dùng Expo managed workflow) hoặc `react-native-camera` (bare workflow) — truy cập camera native, giải mã QR nhanh hơn `getUserMedia` trên web, hoạt động ổn định kể cả trong nhà/hầm để xe.

**Endpoint:**

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/poi/by-qr/{qr_code}` | Lấy thông tin POI + audio tương ứng từ mã QR |

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

**Quy tắc (không đổi):** Quét QR bỏ qua hoàn toàn Debounce/Cooldown — luôn phát ngay khi quét thành công.

**Chống giả mạo QR (bổ sung):** vì `qr_code` hiện là chuỗi tĩnh gắn với POI, ai in lại/dán đè QR giả vẫn được hệ thống chấp nhận. Khuyến nghị (áp dụng khi cần, không bắt buộc cho MVP):
- Với QR dán cố định lâu dài (cổng vào, trạm xe buýt): giữ chuỗi tĩnh nhưng theo dõi bất thường qua Analytics (VD: một `qr_code` đột ngột được quét từ tọa độ cách rất xa POI thật → có thể là dấu hiệu tem giả bị di dời).
- Với QR có giá trị cao (khuyến mãi, vé): nên đổi sang **QR có chữ ký/hết hạn** — nhúng `poi_id` + `expires_at` + HMAC signature, đổi mã định kỳ.

---

### 2.1.6 Hệ thống Thuyết minh âm thanh 4 Tầng (4-Tier Audio Hybrid)

**Mô tả nghiệp vụ (logic không đổi 100%):**

| Tầng | Tên | Độ trễ | Mô tả | Cơ chế phát (Native) |
|---|---|---|---|---|
| **Tier 1** | Pre-generated | **0ms** | Audio đã tạo sẵn, cache trong Local File System | `react-native-track-player` phát trực tiếp file local |
| **Tier 1.5** | On-demand Translate + TTS | 2–5s | Dịch (deep-translator) + TTS (Edge-TTS) theo yêu cầu, cache kết quả về File System cho lần sau | Tải file về File System rồi phát qua track player |
| **Tier 2** | Cloud TTS Stream | 3–8s | Stream TTS trực tiếp từ cloud khi không có bản pre-gen | `react-native-track-player` hỗ trợ streaming URL trực tiếp, kể cả khi app background |
| **Tier 3** | Local Speech Synthesis | 0ms | Dùng TTS engine native của hệ điều hành (`react-native-tts`, binding tới AVSpeechSynthesizer trên iOS / TextToSpeech trên Android) | Fallback cuối cùng khi hoàn toàn offline và chưa có audio cache |

**Logic chọn tầng (pseudocode — không đổi):**
```
function resolveAudioTier(poi, locale, networkState):
    if localFileSystem.has(poi.id, locale):            # Tier 1
        return playFromFileSystem(poi.id, locale)
    if networkState == ONLINE and translationCache.has(poi.id, locale):
        return Tier1_5_TranslateAndTTS(poi, locale)     # Tier 1.5
    if networkState == ONLINE:
        return Tier2_CloudTTSStream(poi, locale)        # Tier 2
    return Tier3_NativeSpeechSynthesis(poi.text, locale) # Tier 3 — fallback offline
```

**Yêu cầu Background Audio (mới):**
- Cấu hình `react-native-track-player` ở chế độ **background playback**: Android (Media Session + Foreground Service Notification), iOS (Background Mode `audio` + `AVAudioSession` category `playback`).
- Audio phải tiếp tục phát/queue đúng thứ tự kể cả khi màn hình khóa, app bị chuyển sang nền, hoặc có cuộc gọi đến (auto-resume sau khi cuộc gọi kết thúc, theo hành vi mặc định của `AVAudioSession`/`AudioFocus`).

**Endpoint liên quan (không đổi):**

| Method | Path | Mục đích |
|---|---|---|
| `POST` | `/audio/synthesize` | Yêu cầu tạo audio on-demand (Tier 1.5) |
| `GET` | `/audio/stream/{poi_id}?lang={locale}` | Stream Cloud TTS (Tier 2) |

```json
// POST /audio/synthesize — Request
{
  "poi_id": "poi_0042",
  "target_locale": "ja",
  "source_text_locale": "vi"
}

// 202 Accepted
{
  "task_id": "tts_task_88213",
  "status": "queued",
  "estimated_seconds": 4
}
```

---

### 2.1.7 Đa ngôn ngữ 2 làn & Hotset readiness

**Mô tả nghiệp vụ (không đổi):**
- **2 làn ngôn ngữ độc lập:** Content Locale (nội dung POI) và UI Bundle Locale (giao diện app, nay là resource bundle native qua `react-i18next` hoặc `react-native-localize`).
- **Hotset readiness:** pre-cache **tối đa 10 POI gần nhất trong bán kính 1.5km**, tải trước audio vào Local File System để sẵn sàng ở Tier 1 (0ms).

```json
// GET /poi/hotset?lat=10.7756&lng=106.7019&radius_km=1.5&limit=10 — 200 OK
{
  "hotset_pois": [
    { "poi_id": "poi_0042", "distance_m": 120, "audio_ready": true },
    { "poi_id": "poi_0043", "distance_m": 340, "audio_ready": false }
  ]
}
```

---

## 2.2 Phân hệ Quản trị (Admin Dashboard — ReactJS + Vite, Web Desktop)

### 2.2.0 Quản lý POI (CRUD) & Luồng xuất bản nội dung — MỚI (làm rõ)

**Mô hình vai trò đã xác nhận (4 actor):**

| Actor | Phạm vi quản lý POI |
|---|---|
| `super_admin` | Toàn quyền trên mọi POI + toàn hệ thống |
| `admin` | Toàn quyền trên mọi POI + hậu kiểm nội dung |
| `poi_owner` | **Vai trò toàn cục (global role)** — có toàn quyền thêm/sửa/xóa **tất cả** POI trong hệ thống, không giới hạn theo "POI sở hữu riêng". Vì vậy schema POI **không cần field `owner_id`** ở giai đoạn này — mọi thao tác chỉ cần ghi nhận `last_modified_by` để phục vụ Audit. |
| `user` (du khách, ẩn danh) | Không có quyền quản trị |

> **Lưu ý thiết kế:** vì `poi_owner` hiện là vai trò toàn cục (không phải sở hữu theo từng POI), nếu sau này cần mô hình "mỗi người chỉ quản lý một số POI nhất định", chỉ cần bổ sung field `owner_ids: [user_id]` vào document `pois` và thêm điều kiện lọc ở tầng middleware permission — **không cần đổi kiến trúc RBAC hiện tại**, vì RBAC đã tách rời "permission theo domain" khỏi "phạm vi dữ liệu (data scope)".

**Luồng xuất bản nội dung — Self-Publish + Post-hoc Audit (đã xác nhận):**
- `poi_owner` và `admin` tạo/sửa POI thì nội dung **lên thẳng trạng thái `published`** — không cần chờ duyệt trước.
- `admin`/`super_admin` thực hiện **hậu kiểm (post-hoc audit)**: có thể `unpublish` (gỡ tạm, kèm lý do bắt buộc) hoặc `republish` (khôi phục) bất kỳ lúc nào. Mọi hành động này ghi vào `audit_logs` với `before`/`after` đầy đủ.

**POI status enum:** `published` → `unpublished` (do admin gỡ) → `published` (republish) | `archived` (xóa mềm, không hiển thị nhưng giữ lịch sử).

**Schema POI gợi ý (để AI Co-pilot không phải tự đoán):**
```json
{
  "poi_id": "poi_0042",
  "name": "Chợ Bến Thành",
  "category": "landmark",
  "zone_id": "zone_dalat",
  "location": { "lat": 10.7756, "lng": 106.7019 },
  "geofence_radius_m": 30,
  "qr_code": "QR-POI-0042",
  "status": "published",
  "content": {
    "vi": { "text": "...", "audio_url": "/audio/poi_0042/vi.mp3" },
    "en": { "text": "...", "audio_url": "/audio/poi_0042/en.mp3" }
  },
  "images": ["/images/poi_0042/1.jpg"],
  "last_modified_by": "admin_007",
  "created_at": "2026-01-10T00:00:00Z",
  "updated_at": "2026-09-16T10:00:00Z"
}
```

**Endpoint CRUD:**

| Method | Path | Permission yêu cầu | Mục đích |
|---|---|---|---|
| `POST` | `/admin/pois` | `poi.create` | Tạo POI mới, mặc định `status=published` |
| `PUT` | `/admin/pois/{poi_id}` | `poi.edit` | Sửa nội dung/tọa độ/geofence radius, publish ngay |
| `DELETE` | `/admin/pois/{poi_id}` | `poi.delete` | Xóa mềm → `status=archived` |
| `POST` | `/admin/pois/{poi_id}/unpublish` | `content.unpublish` | Hậu kiểm: gỡ tạm, **bắt buộc kèm `reason`** |
| `POST` | `/admin/pois/{poi_id}/republish` | `content.restore` | Khôi phục POI đã bị gỡ |
| `POST` | `/admin/pois/{poi_id}/qr` | `poi.assign_qr` | Sinh/gán mã QR cho POI |

```json
// POST /admin/pois/poi_0042/unpublish — Request
{ "reason": "Thông tin giờ mở cửa sai lệch, chờ poi_owner cập nhật lại" }

// 200 OK
{ "poi_id": "poi_0042", "status": "unpublished" }
```

---

### 2.2.1 Phân quyền Dynamic RBAC & Quản lý tài khoản

**Mô hình:** 32 permissions, 9 domains, 4 vai trò mặc định (`super_admin`, `admin`, `poi_owner`, `user`).

**Bảng đầy đủ 32 Permissions theo 9 Domains (bản nháp — chỉnh sửa được qua `/admin/roles`):**

| Domain | Permissions (tổng: 32) |
|---|---|
| `poi_management` (5) | `poi.create`, `poi.edit`, `poi.delete`, `poi.view`, `poi.assign_qr` |
| `content_moderation` (3) | `content.unpublish`, `content.restore`, `content.flag` |
| `audio_tasks` (4) | `audio.trigger_regenerate`, `audio.view_tasks`, `audio.cancel_task`, `audio.retry_task` |
| `user_management` (4) | `user.create`, `user.edit`, `user.deactivate`, `user.view` |
| `role_management` (3) | `role.create`, `role.assign_permission`, `role.view` |
| `analytics` (4) | `analytics.view_overview`, `analytics.view_poi_reports`, `analytics.view_user_reports`, `analytics.export` |
| `audit` (2) | `audit.view`, `audit.export` |
| `system_config` (3) | `system.manage_constants`, `system.manage_languages`, `system.manage_integrations` |
| `heatmap_monitoring` (4) | `heatmap.view_live`, `heatmap.view_trend`, `heatmap.configure_zones`, `heatmap.export` |

**Ma trận phân quyền mặc định gợi ý:**

| Vai trò | Quyền mặc định |
|---|---|
| `super_admin` | Toàn bộ 32 permissions |
| `admin` | Toàn bộ `poi_management`, `content_moderation`, `audio_tasks` (trừ `trigger_regenerate` nếu muốn giới hạn chi phí), toàn bộ `analytics`, `audit.view`, `heatmap_monitoring`, `user.view`/`user.edit`/`user.deactivate` (không có `user.create`), `role.view` |
| `poi_owner` | Toàn bộ `poi_management` (đúng như đã xác nhận: toàn quyền thêm/sửa/xóa mọi POI), `audio.view_tasks` + `audio.retry_task`, `analytics.view_poi_reports`, `heatmap.view_live` |
| `user` | Không có permission nào |

**Quản lý tài khoản (đã xác nhận: hiện tại chỉ `super_admin` được tạo tài khoản):**

| Method | Path | Permission | Mục đích |
|---|---|---|---|
| `POST` | `/admin/users/invite` | `user.create` | Tạo tài khoản mới + gửi lời mời (email/username, role gán sẵn) |
| `GET` | `/admin/users` | `user.view` | Danh sách tài khoản admin/poi_owner |
| `PUT` | `/admin/users/{id}/deactivate` | `user.deactivate` | Vô hiệu hóa tài khoản |
| `GET` | `/admin/roles` | `role.view` | Danh sách vai trò + permissions |
| `POST` | `/admin/roles/{role}/permissions` | `role.assign_permission` | Gán/thu hồi permission cho vai trò |
| `GET` | `/admin/me/permissions` | — | Lấy danh sách quyền của người dùng hiện tại |

```json
// POST /admin/users/invite — Request (chỉ super_admin gọi được ở giai đoạn hiện tại)
{ "email": "owner1@example.com", "role": "poi_owner" }

// 202 Accepted
{ "user_id": "user_00231", "status": "pending_activation", "invite_expires_at": "2026-09-24T00:00:00Z" }
```

> **Gợi ý mở rộng về sau (không cần đổi kiến trúc):** vì đây là **Dynamic RBAC** (permission được gán theo vai trò, kiểm tra qua middleware, không hard-code trong logic), việc "cho phép `admin` tự mời `poi_owner`" trong tương lai chỉ đơn giản là **gán thêm permission `user.create` cho vai trò `admin`** qua `POST /admin/roles/admin/permissions`. Để tránh leo thang đặc quyền (privilege escalation — VD: một `admin` tự mời tài khoản `super_admin` mới), nên thêm quy tắc ở tầng service: *người mời chỉ được gán vai trò có "cấp độ" thấp hơn hoặc bằng cấp độ được `role_management` của chính mình cho phép* (VD: `admin` chỉ được mời `poi_owner`, không được mời `admin`/`super_admin`).

---

### 2.2.2 Giám sát Task TTS qua SSE Stream

**Mô tả nghiệp vụ (không đổi):** Admin theo dõi trạng thái hàng đợi xử lý TTS theo thời gian thực, không cần polling.

**Endpoint:**

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/admin/audio-tasks/stream` | SSE stream — cập nhật trạng thái task TTS real-time |

```
// GET /admin/audio-tasks/stream — Server-Sent Events

event: task_update
data: {"task_id": "tts_task_88213", "status": "processing", "progress": 40}

event: task_update
data: {"task_id": "tts_task_88213", "status": "completed", "audio_url": "/audio/poi_0042/ja.mp3"}

event: task_update
data: {"task_id": "tts_task_88214", "status": "failed", "error": "TTS provider timeout"}
```

**Ràng buộc vận hành:** `MAX_CONCURRENT_TTS = 3` (không đổi).

---

### 2.2.3 Bảo mật & Audit

**Mã hóa PII:**
- Dữ liệu định danh cá nhân được mã hóa bằng **Fernet**, tiền tố `"v1:"`.
- **Tự động Redact** sau **180 ngày** (`PII_RETENTION_DAYS = 180`).

**Audit Log:** mọi hành động ghi trên Admin Dashboard được lưu vào `audit_logs`.

```json
{
  "log_id": "audit_00019281",
  "actor_user_id": "admin_007",
  "action": "poi.publish",
  "target_id": "poi_0042",
  "timestamp": "2026-09-17T09:12:00Z",
  "ip_hash": "sha256:...",
  "before": { "status": "draft" },
  "after": { "status": "published" }
}
```

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/admin/audit-logs?actor={id}&from={date}&to={date}` | Truy vấn nhật ký audit có bộ lọc |

---

### 2.2.4 Module Thống kê & Báo cáo toàn diện (Analytics & Reporting System) — MỚI

**Mô tả nghiệp vụ:** Trung tâm Analytics tập trung trong Admin Dashboard, cung cấp cái nhìn toàn diện về hành vi du khách, hiệu năng hệ thống và chất lượng nội dung, phục vụ ra quyết định vận hành (thêm bản dịch, mở rộng hotset, tối ưu hạ tầng TTS...).

#### a) Real-time Presence Metrics

**Nghiệp vụ:** Đếm số du khách đang hoạt động đồng thời (online) theo cửa sổ trượt thời gian thực, dùng **Redis Sliding Window** (ghi nhận heartbeat/ping ẩn danh từ Mobile App mỗi N giây, đếm số key còn "sống" trong window).

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/admin/analytics/presence/live` | Số du khách online hiện tại (tracked_online_users) |

```json
// GET /admin/analytics/presence/live — 200 OK
{
  "tracked_online_users": 187,
  "window_seconds": 300,
  "generated_at": "2026-09-17T14:10:00Z",
  "trend_last_hour": [120, 135, 150, 187]
}
```

#### b) POI Metrics

**Nghiệp vụ:**
- Top POI được truy cập/nghe audio nhiều nhất.
- Tỷ lệ quét QR theo từng trạm/địa điểm.
- Báo cáo POI thiếu bản dịch (content locale) hoặc thiếu audio pre-gen — phục vụ Admin ưu tiên bổ sung nội dung.

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/admin/analytics/poi/top?metric=audio_plays&limit=10&from=&to=` | Top POI theo lượt nghe/truy cập |
| `GET` | `/admin/analytics/poi/qr-rate` | Tỷ lệ quét QR theo từng POI/trạm |
| `GET` | `/admin/analytics/poi/content-gaps` | Danh sách POI thiếu bản dịch/audio |

```json
// GET /admin/analytics/poi/top?metric=audio_plays&limit=3 — 200 OK
{
  "metric": "audio_plays",
  "period": "last_30_days",
  "items": [
    { "poi_id": "poi_0042", "name": "Chợ Bến Thành", "value": 4820 },
    { "poi_id": "poi_0017", "name": "Nhà thờ Đức Bà", "value": 3990 },
    { "poi_id": "poi_0005", "name": "Phố đi bộ Nguyễn Huệ", "value": 3510 }
  ]
}

// GET /admin/analytics/poi/content-gaps — 200 OK
{
  "missing_translation": [
    { "poi_id": "poi_0091", "missing_locales": ["ja", "ko"] }
  ],
  "missing_pregen_audio": [
    { "poi_id": "poi_0091", "missing_locales": ["ja", "ko", "zh"] }
  ]
}
```

#### c) User & Language Metrics

**Nghiệp vụ:**
- Thống kê tỷ lệ ngôn ngữ du khách sử dụng (`en`, `vi`, `ja`, `zh`, `ko`, ...).
- Tỷ lệ người dùng đã tải Offline Pack (đo mức độ chuẩn bị của du khách trước chuyến đi).

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/admin/analytics/users/language-distribution` | Tỷ lệ % theo Content Locale sử dụng |
| `GET` | `/admin/analytics/users/offline-pack-adoption` | Tỷ lệ thiết bị đã tải Offline Pack |

```json
// GET /admin/analytics/users/language-distribution — 200 OK
{
  "period": "last_30_days",
  "distribution": [
    { "locale": "vi", "percentage": 42.1 },
    { "locale": "en", "percentage": 31.4 },
    { "locale": "ja", "percentage": 12.0 },
    { "locale": "ko", "percentage": 8.9 },
    { "locale": "zh", "percentage": 5.6 }
  ]
}

// GET /admin/analytics/users/offline-pack-adoption — 200 OK
{
  "total_devices_30d": 5230,
  "offline_pack_downloaded": 3140,
  "adoption_rate_percentage": 60.0
}
```

#### d) System & Audio Metrics

**Nghiệp vụ:**
- Tỷ lệ Cache HIT/MISS (đo hiệu quả của Tier 1 pre-gen so với các tầng phải xử lý on-demand).
- Số lượt gọi TTS on-demand (Tier 1.5/Tier 2) — theo dõi tải hệ thống và chi phí tiềm ẩn nếu chuyển sang TTS trả phí.
- Giám sát tiến độ Task TTS qua SSE Stream (đã có ở mục 2.2.2, liên kết chéo vào dashboard Analytics tổng).

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/admin/analytics/system/cache-hit-rate` | Tỷ lệ Cache HIT/MISS theo tầng audio |
| `GET` | `/admin/analytics/system/tts-ondemand-calls` | Số lượt gọi TTS on-demand theo thời gian |

```json
// GET /admin/analytics/system/cache-hit-rate — 200 OK
{
  "period": "last_7_days",
  "tier1_hit_rate": 78.3,
  "tier1_5_rate": 14.2,
  "tier2_rate": 6.1,
  "tier3_offline_fallback_rate": 1.4
}

// GET /admin/analytics/system/tts-ondemand-calls — 200 OK
{
  "period": "last_7_days",
  "total_calls": 2145,
  "by_locale": { "ja": 812, "ko": 640, "zh": 693 },
  "avg_processing_seconds": 3.6
}
```

#### e) Heatmap & Location Analytics

**Nghiệp vụ:** Báo cáo biến động mật độ du khách theo giờ/ngày, dựa trên `runtime_location_hourly` và các collection tổng hợp `analytics_*` (ví dụ: `analytics_daily_density`, `analytics_zone_summary`).

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/admin/analytics/heatmap/trend?zone_id=&from=&to=&granularity=hour\|day` | Biến động mật độ theo thời gian cho 1 khu vực |

```json
// GET /admin/analytics/heatmap/trend?zone_id=zone_cho_ben_thanh&granularity=hour&from=2026-09-17&to=2026-09-17 — 200 OK
{
  "zone_id": "zone_cho_ben_thanh",
  "granularity": "hour",
  "series": [
    { "hour": 8, "avg_density_score": 0.21 },
    { "hour": 12, "avg_density_score": 0.68 },
    { "hour": 18, "avg_density_score": 0.91 }
  ]
}
```

#### f) Xuất dữ liệu (Export)

**Nghiệp vụ:** Cho phép Admin xuất bất kỳ báo cáo Analytics nào ở định dạng **CSV, Excel (.xlsx), hoặc JSON**, dùng chung một endpoint tham số hóa theo loại báo cáo.

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/admin/analytics/export?report={report_key}&format=csv\|xlsx\|json&from=&to=` | Xuất báo cáo theo định dạng chỉ định |

```json
// GET /admin/analytics/export?report=poi_top_plays&format=json&from=2026-08-01&to=2026-09-01 — 200 OK
{
  "report": "poi_top_plays",
  "format": "json",
  "download_url": "/admin/analytics/downloads/poi_top_plays_20260901.json",
  "expires_at": "2026-09-18T00:00:00Z"
}
```

> **Ghi chú cho AI Co-pilot:** với `format=csv|xlsx`, response nên trả về file trực tiếp (`Content-Disposition: attachment`) hoặc một `download_url` tạm thời (pattern giống ví dụ JSON trên) — chọn 1 trong 2 cách và áp dụng nhất quán cho toàn bộ các report.

**Danh sách report_key gợi ý:** `presence_trend`, `poi_top_plays`, `poi_qr_rate`, `poi_content_gaps`, `user_language_distribution`, `offline_pack_adoption`, `cache_hit_rate`, `tts_ondemand_calls`, `heatmap_trend`.

---

## 3. YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)

### 3.1 Hiệu năng & Delta Sync (không đổi)

**Cơ chế:** kết hợp HTTP `If-None-Match` (ETag) và `updated_after`.

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/poi/load-all?updated_after={iso_timestamp}` (Header: `If-None-Match: {etag}`) | Đồng bộ chênh lệch (delta sync) dữ liệu POI |

```
// Request
GET /poi/load-all?updated_after=2026-09-10T00:00:00Z
If-None-Match: "a1b2c3d4"

// Case 1: Không có thay đổi
304 Not Modified

// Case 2: Có thay đổi
200 OK
ETag: "e5f6g7h8"
{
  "updated_pois": [ { "poi_id": "poi_0042", "updated_at": "2026-09-16T10:00:00Z", "...": "..." } ],
  "deleted_poi_ids": ["poi_0099"],
  "sync_timestamp": "2026-09-17T08:00:00Z"
}
```

**Cache POI:** `POI_CACHE_TTL = 15 phút` (không đổi, dữ liệu lưu trong SQLite thay vì IndexedDB).

---

### 3.2 Kiến trúc Offline & 4 Lớp Phòng Ngự (4 Offline Defense Layers) — cập nhật lớp lưu trữ Native

#### Lớp 1 — Native Background Sync Strategies (thay thế Service Worker Strategies)
- Thay vì Workbox `injectManifest` (chỉ dùng cho web), dùng **Background Task/Headless JS** (`react-native-background-fetch` hoặc tương đương) để đồng bộ định kỳ khi app ở nền.
- **Chiến lược cache theo loại tài nguyên — logic giữ nguyên:**

| Loại tài nguyên | Chiến lược | Timeout | Triển khai Native |
|---|---|---|---|
| Dữ liệu POI (API) | `NetworkFirst` | 8s → fallback SQLite | Custom fetch wrapper + fallback query SQLite |
| Audio, Hình ảnh | `CacheFirst` | — | Kiểm tra Local File System trước, tải về nếu thiếu |
| Metadata cấu hình app | `StaleWhileRevalidate` | — | Đọc AsyncStorage ngay, đồng bộ ngầm phía sau |

- **Quota-aware purge:** theo dõi dung lượng qua `react-native-fs.getFSInfo()` (thay cho `navigator.storage.estimate()`), tự động xóa cache theo LRU khi gần đầy, ưu tiên giữ Tier 1 audio của Hotset hiện tại.

#### Lớp 2 — Language Sharding & Build Sync (không đổi logic)
- **Max 300 files/lang**, **Max 3 langs** đồng thời (LRU eviction) — áp dụng trên Local File System thay vì Cache Storage của trình duyệt.
- **`APP_BUILD_SYNC`:** đối chiếu version build giữa local (lưu trong AsyncStorage) và server, buộc invalidate cache khi có bản build không tương thích. Kết hợp với cơ chế **OTA Update** (VD: CodePush/Expo Updates) để đẩy bản vá JS bundle mà không cần qua App Store/Google Play cho các thay đổi không native.

#### Lớp 3 — SQLite / Quan4DB v2 (thay thế IndexedDB)
- **Content Fallback 3 tầng — logic không đổi:**
  ```
  Target Locale có sẵn trong SQLite? ──► Hiển thị Target Locale
        │ Không
        ▼
  EN có sẵn? ──► Hiển thị EN (kèm nhãn "bản dịch tạm")
        │ Không
        ▼
  VI (ngôn ngữ gốc) ──► Hiển thị VI — KHÔNG BAO GIỜ hiển thị màn hình trắng/crash
  ```
- `Quan4DB v2` giữ nguyên vai trò là lớp schema/data-access nội bộ, chỉ đổi engine lưu trữ vật lý bên dưới từ IndexedDB sang SQLite.

#### Lớp 4 — Offline Packs theo Zone (đã xác nhận: tải theo khu vực, không tải toàn quốc)

**Mô tả nghiệp vụ:** Dữ liệu POI được nhóm sẵn theo **Zone** (khu vực địa lý — VD: "Đà Lạt", "Phố cổ Hội An", "Quận 1"). Du khách chủ động chọn zone cần dùng và tải trọn bộ (bản đồ + POI + ảnh + audio) về máy **khi đang có mạng**, để dùng lại khi mất mạng — tránh phải tải toàn bộ dữ liệu quốc gia gây nặng máy/tốn dung lượng lưu trữ không cần thiết.

**Vòng đời một Zone (Admin quản lý ở mục 2.2, gán mỗi POI vào 1 zone qua field `zone_id` trong schema POI ở mục 2.2.0).**

**Endpoint:**

| Method | Path | Mục đích |
|---|---|---|
| `GET` | `/offline-packs/zones` | Danh sách zone khả dụng kèm dung lượng ước tính, để hiển thị màn hình chọn zone cho du khách |
| `GET` | `/offline-packs/{zone_id}/manifest` | Danh sách file cần tải cho zone này (map tile, POI json, ảnh, audio) kèm checksum SHA-256 từng file |
| `DELETE` | `/offline-packs/{zone_id}` (client-side) | Xóa pack đã tải khỏi máy để giải phóng dung lượng (không gọi server, chỉ xóa file local) |

```json
// GET /offline-packs/zones — 200 OK
{
  "zones": [
    { "zone_id": "zone_dalat", "name": "Đà Lạt", "poi_count": 42, "estimated_size_mb": 210 },
    { "zone_id": "zone_hoian", "name": "Phố cổ Hội An", "poi_count": 28, "estimated_size_mb": 130 }
  ]
}

// GET /offline-packs/zone_dalat/manifest — 200 OK
{
  "zone_id": "zone_dalat",
  "total_size_mb": 210,
  "files": [
    { "type": "map_tile", "url": "/packs/zone_dalat/map.pmtiles", "sha256": "a1b2..." },
    { "type": "poi_data", "url": "/packs/zone_dalat/poi.json", "sha256": "c3d4..." },
    { "type": "audio", "url": "/audio/poi_1042/vi.mp3", "sha256": "e5f6..." }
  ]
}
```

- **Cài đặt tuần tự (không đổi logic):** `Map → POI → Images → Audio`, lưu vào Local File System theo thư mục riêng từng zone (VD: `.../offline-packs/zone_dalat/`) — giúp xóa/quản lý dung lượng theo từng zone độc lập.
- **SHA-256 verify:** không đổi — kiểm tra checksum sau khi tải mỗi file, tải lại nếu sai lệch.
- **Quản lý dung lượng:** màn hình "Quản lý Offline Pack" trong app cho phép xem danh sách zone đã tải + dung lượng đang chiếm + nút xóa từng zone, tách biệt hoàn toàn với Hotset (mục 2.1.7, luôn tự động, không tính vào dung lượng do người dùng quản lý).

---

### 3.3 Bảo mật

| Cơ chế | Mô tả |
|---|---|
| **Consent-Gated Analytics** | Không thu thập vị trí/hành vi cho Heatmap/Analytics nếu chưa bật `location_consent`; xin quyền qua native permission dialog (Location "Always" cần giải thích rõ mục đích theo yêu cầu của App Store/Google Play) |
| **httpOnly Cookie Auth** (Admin, web) | `access_token` (TTL **30 phút**), `refresh_token` (TTL **7 ngày**), httpOnly |
| **Mobile Token Storage** (Guest, nếu cần token nhẹ cho rate-limit) | Lưu trong **Keychain** (iOS) / **Keystore** (Android) — không dùng AsyncStorage cho bất kỳ secret nào |
| **Path Traversal Protection** | Mọi thao tác đọc file tĩnh đi qua `resolve_safe_path()` (áp dụng phía backend, không đổi) |
| **Rate-Limit cho Guest Endpoint (mới)** | Vì du khách không cần đăng nhập, các endpoint tốn tài nguyên (`POST /audio/synthesize`, `GET /audio/stream/*`) cần giới hạn theo `device_uuid` (Redis, VD: tối đa N request/phút) để tránh lạm dụng/DoS. Có thể kết hợp App Attest (iOS)/Play Integrity (Android) để xác thực request đến từ app thật, không phải script |

---

### 3.4 Yêu cầu Native Platform (mới)

| Hạng mục | Android | iOS |
|---|---|---|
| Background Location | Foreground Service + notification bắt buộc hiển thị khi đang track | Background Mode `location`, khai báo `NSLocationAlwaysAndWhenInUseUsageDescription` |
| Background Audio | `MediaSessionService` (qua `react-native-track-player`) | Background Mode `audio`, `AVAudioSession` category `playback` |
| Permissions cần khai báo | `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `CAMERA`, `FOREGROUND_SERVICE` | `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSCameraUsageDescription`, `NSMicrophoneUsageDescription` (nếu cần) |
| Phân phối | Google Play Store (APK/AAB) | Apple App Store (yêu cầu review kỹ hơn với Background Location — cần justification rõ ràng trong App Review Notes) |

---

## 4. BẢNG HẰNG SỐ VẬN HÀNH & NGUYÊN TẮC THIẾT KẾ (không đổi)

### 4.1 Bảng hằng số kỹ thuật

| Hằng số | Giá trị | Domain |
|---|---|---|
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
| `STARTUP_PROBE_WINDOW` | 8s (tối đa 2 lần thử) | Startup Flow |
| `HOTSET_MAX_POI` | 10 POI | Pre-cache |
| `HOTSET_RADIUS` | 1.5km | Pre-cache |
| `LANG_SHARD_MAX_FILES` | 300 file/ngôn ngữ | Offline Lớp 2 |
| `LANG_SHARD_MAX_LANGS` | 3 ngôn ngữ đồng thời | Offline Lớp 2 |
| `RBAC_PERMISSIONS_COUNT` | 32 | RBAC |
| `RBAC_DOMAINS_COUNT` | 9 | RBAC |
| `RBAC_DEFAULT_ROLES_COUNT` | 4 | RBAC |

### 4.2 Design Patterns áp dụng

| Pattern | Áp dụng ở đâu | Lý do |
|---|---|---|
| **Modular Monolith (10 Routers)** | Backend FastAPI | Đơn giản khi triển khai, phân chia rõ theo domain (POI, Audio, Admin, Auth, Heatmap, Audit, Analytics...) |
| **Defense in Depth** | Kiến trúc Offline (4 lớp) + Bảo mật (mã hóa + path traversal + RBAC + Keychain/Keystore) | Mỗi lớp thất bại độc lập mà hệ thống vẫn an toàn/hoạt động |
| **Privacy-by-Design** | PII encryption, consent-gated analytics, auto-redact | Bảo vệ dữ liệu cá nhân là mặc định |

---

## 5. TECH STACK VÀ MA TRẬN CHI PHÍ ($0 CORE)

### 5.1 Bảng phân tích Tech Stack (cập nhật)

| Lớp | Công nghệ | Vai trò | Chi phí |
|---|---|---|---|
| Backend Framework | FastAPI | REST API + SSE | $0 (mã nguồn mở) |
| Database | MongoDB (qua Motor) | Lưu POI, users, audit_logs, roles, analytics_* | $0 (self-host) / trả phí nếu dùng Atlas |
| Cache/Queue/Presence | Redis | Cache session, hàng đợi task TTS, **Sliding Window cho Real-time Presence Metrics** | $0 (self-host) |
| **Mobile App Framework** | **React Native** | Ứng dụng Du khách (Android/iOS), cài native | $0 |
| Mobile Bản đồ | `@maplibre/maplibre-react-native` | Render bản đồ vector native (GPU) | $0 |
| Mobile Audio Player | `react-native-track-player` | Phát audio 4-tier, hỗ trợ background playback | $0 |
| Mobile Camera/QR | `expo-camera` / `react-native-camera` | Quét mã QR | $0 |
| Mobile Geolocation | `react-native-geolocation-service` | Định vị, hỗ trợ background location | $0 |
| Mobile Local Storage | SQLite (`expo-sqlite`/`react-native-sqlite-storage`), AsyncStorage, `react-native-fs` | Offline data, config, file audio/ảnh/PMTiles | $0 |
| Mobile TTS Fallback | `react-native-tts` | Tier 3 — Local Speech Synthesis native | $0 |
| **Admin Dashboard Framework** | **React 19 + Vite** | Web Desktop cho quản trị | $0 |
| Text-to-Speech (server) | Edge-TTS (Microsoft) | Sinh giọng đọc thuyết minh | $0 (không chính thức) |
| Dịch thuật | deep-translator (Google Translate backend) | Dịch nội dung POI đa ngôn ngữ | $0 (không chính thức) |
| AI Advisor (tùy chọn) | Gemini 2.5 Flash / ProxyPal | Hỗ trợ Admin/Owner soạn nội dung | Có chi phí nếu vượt free tier |
| Xuất báo cáo | Thư viện xử lý CSV/XLSX phía backend (VD: `openpyxl`/`pandas` cho Python) | Export Analytics CSV/Excel/JSON | $0 |

### 5.2 Ma trận chi phí: $0 Core vs Mở rộng

| Nhóm | $0 Open-Source Core | Mở rộng trả phí (tùy chọn) |
|---|---|---|
| **Compute/Hosting** | VPS cá nhân/self-host, hoặc free tier (Render/Railway/Fly.io) | Cloud managed (AWS/GCP) khi scale lớn |
| **Database** | MongoDB self-host | MongoDB Atlas (managed, auto-scaling) |
| **TTS/Dịch thuật** | Edge-TTS + deep-translator (không chính thức) | Azure Cognitive Speech, Google Cloud Translation (SLA chính thức) |
| **AI Advisor** | Không bắt buộc — có thể tắt hoàn toàn | Gemini 2.5 Flash API (chi phí theo token) |
| **Phân phối Mobile App** | Google Play (~$25 phí đăng ký 1 lần) | Apple Developer Program (~$99/năm — bắt buộc để publish iOS) |
| **OTA Update** | Tự host (VD: hạ tầng CodePush self-host qua `code-push-server` mã nguồn mở) | Expo EAS Update / App Center (dịch vụ quản lý) |
| **CDN cho Audio/Ảnh** | Serve trực tiếp từ backend | Cloudflare CDN / S3 + CloudFront khi lượng truy cập lớn |

> **Lưu ý cho AI Co-pilot:** Edge-TTS và deep-translator là API không chính thức — cần retry logic mạnh và lớp abstraction (`ITTSProvider`, `ITranslationProvider`) để dễ thay thế. Với React Native, cần chọn dứt điểm **Expo Managed Workflow** hay **Bare React Native** ngay từ đầu vì ảnh hưởng trực tiếp tới khả năng dùng các thư viện native (camera, background location, track player) — khuyến nghị **Expo Bare/Dev Client** hoặc **Bare Workflow** nếu cần custom native module sâu cho background geofence.

---

## 6. TÓM TẮT LUỒNG CHẠY END-TO-END CHO AI CO-PILOT (không đổi logic, cập nhật chú thích Native)

```
[1] MỞ APP (Native — Android/iOS)
     │
     ▼
[2] STARTUP PROBE (≤2 lần, mỗi lần 2.5s, cửa sổ 8s)
     │
     ├── Thành công ──► Xác định Cloud/Hybrid Mode
     └── Thất bại ──► OFFLINE MODE (SQLite/File System)
     │
     ▼
[3] LOAD BẢN ĐỒ (MapLibre RN — Cloud / PMTiles Offline / Hybrid Q4)
     │
     ▼
[4] DELTA SYNC POI (GET /poi/load-all?updated_after=... + If-None-Match)
     │  → Cập nhật SQLite (Quan4DB v2)
     │
     ▼
[5] TÍNH HOTSET (GET /poi/hotset) — pre-cache tối đa 10 POI / 1.5km vào Local File System
     │
     ▼
[6] ĐỊNH VỊ LIÊN TỤC — hoạt động cả BACKGROUND (GPS throttle 5s) ──┬── QUÉT QR (bỏ qua debounce/cooldown)
     │                                                                │
     ▼                                                                ▼
[7] GEOFENCE ENGINE (Turf.js, bán kính 30m, debounce 3s, cooldown 5')
     │
     ▼
[8] TRIGGER PHÁT AUDIO NỀN (react-native-track-player) — chọn tầng theo 4-Tier Audio Hybrid:
     │   Tier 1 (File System, 0ms) → Tier 1.5 (translate+TTS on-demand, 2-5s)
     │   → Tier 2 (cloud stream, 3-8s) → Tier 3 (native TTS engine, 0ms, offline)
     │
     ▼
[9] SAFETY RECONCILE LOOP (mỗi 5s) — đảm bảo trạng thái phát audio nhất quán kể cả khi khóa màn hình
     │
     ▼
[10] CẬP NHẬT VỊ TRÍ ẨN DANH (nếu location_consent=true) ──► runtime_location_hourly
     │      + gửi heartbeat cho Redis Sliding Window (Real-time Presence)
     ▼
[11] RENDER HEATMAP trên Mobile App lẫn Admin Dashboard

┌───────────────────────────── SONG SONG (Admin — ReactJS/Vite) ─────────────────────────────┐
│  Admin duyệt/tạo POI mới ──► Task TTS enqueue (MAX_CONCURRENT_TTS = 3)                       │
│  ──► Theo dõi qua SSE (GET /admin/audio-tasks/stream) ──► Ghi audit_logs                     │
│                                                                                                │
│  Admin mở Analytics Dashboard ──► Gọi song song các endpoint /admin/analytics/*               │
│  (presence/live, poi/top, users/language-distribution, system/cache-hit-rate,                 │
│   heatmap/trend) ──► Xem báo cáo tổng hợp ──► Export CSV/Excel/JSON khi cần                   │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

*Hết tài liệu PRD (bản cập nhật kiến trúc Native Mobile + Analytics). Toàn bộ logic nghiệp vụ, thuật toán (Geofence Engine, 4-Tier Audio Hybrid, Content Fallback 3 tầng), bảng hằng số kỹ thuật và luồng E2E được kế thừa nguyên vẹn từ bản PRD trước; các thay đổi chỉ nằm ở lớp công nghệ triển khai (Native Mobile thay PWA) và bổ sung mới Module Analytics & Reporting.*