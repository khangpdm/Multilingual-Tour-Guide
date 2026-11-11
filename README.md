# Multilingual Tour Guide - Mobile App

Ứng dụng hỗ trợ hướng dẫn viên du lịch đa ngôn ngữ tích hợp AI, được xây dựng trên nền tảng React Native và Expo.

---

## 1. Giới thiệu dự án

Multilingual Tour Guide là giải pháp di động giúp khách du lịch trải nghiệm các tour tham quan với sự hỗ trợ của hướng dẫn viên AI giọng nói và văn bản đa ngôn ngữ, đề xuất lịch trình và tra cứu thông tin địa điểm theo thời gian thực.

### Tính năng chính
- Hướng dẫn viên giọng nói AI: Tự động thuyết minh điểm đến theo ngôn ngữ lựa chọn.
- Bản đồ và lộ trình tương tác: Gợi ý tuyến tham quan tối ưu.
- Trợ lý du lịch đa ngôn ngữ: Dịch thuật và giải đáp thắc mắc của khách du lịch.

---

## 2. Công nghệ sử dụng

- Framework: React Native và Expo
- Ngôn ngữ: TypeScript
- Routing: Expo Router
- Styling: Tailwind CSS / NativeWind
- CI/CD: GitHub Actions

---

## 3. Cấu trúc thư mục

Multilingual-Tour-Guide/
├── .github/              # GitHub Actions CI/CD workflows
├── Frontend/
│   └── MobileApp/        # Source code ứng dụng Expo / React Native
│       ├── app/          # Expo Router pages và screens
│       ├── src/          # Components, hooks, services, utils
│       └── package.json  # Dependencies và scripts
└── README.md             # Tài liệu dự án

---

## 4. Hướng dẫn khởi chạy local

### Yêu cầu hệ thống
- Node.js: Từ version 20 trở lên (khuyến nghị Node 22 LTS)
- Package Manager: npm hoặc yarn
- Thiết bị: Cài sẵn ứng dụng Expo Go trên iOS hoặc Android

### Các bước cài đặt

1. Clone repository:
git clone https://github.com/khangpdm/Multilingual-Tour-Guide.git
cd Multilingual-Tour-Guide/Frontend/MobileApp

2. Cài đặt dependencies:
npm install

3. Khởi chạy ứng dụng:
npx expo start

Quét mã QR bằng ứng dụng Expo Go trên điện thoại để trải nghiệm.

---

## 5. Quy trình phát triển và CI/CD

Dự án áp dụng quy trình kiểm thử tự động và bảo vệ nhánh:
- main: Nhánh Production (chỉ nhận code từ Release và Develop qua Pull Request).
- develop: Nhánh tích hợp tính năng hằng ngày.
- CI Pipeline: Tự động kiểm tra ESLint và TypeScript Type-check trên mỗi Pull Request.

---

## 6. Giấy phép

Dự án được phát triển phục vụ mục đích học tập và nghiên cứu.
