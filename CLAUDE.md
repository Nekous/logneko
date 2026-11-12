# LOGNEKO — website công cụ logistics (tên nội bộ: Dự án ma)

## Tổng quan
Web tĩnh miễn phí gồm 8 công cụ cho sinh viên và người làm logistics.
Tên hiển thị trên web: LOGNEKO.
Đặc tả đầy đủ nằm trong [MO-TA-DU-AN.md](MO-TA-DU-AN.md): luôn đọc trước khi làm một công cụ.

## Quy tắc
Chi tiết nằm trong `.claude/rules/`:

| File | Nội dung |
|---|---|
| `tech-defaults.md` | Công nghệ: HTML/CSS/JS thuần, dữ liệu JSON, Three.js, xuất PDF/ảnh, Netlify |
| `design.md` | Màu, font, nút, bố cục, ưu tiên điện thoại |
| `nghiep-vu.md` | Không bịa số, ghi nguồn, không đưa giá thật, không chép tài liệu |
| `workflow.md` | Làm từng công cụ, Plan mode, chạy test, chụp màn hình, cách trả lời |

## Cấu trúc
- `site/` là phần duy nhất được đưa lên mạng.
- `tests/` chạy các ví dụ có đáp án trong MO-TA-DU-AN.md.
- `scripts/` chứa script chuyển file biểu thuế sang JSON.
- MO-TA-DU-AN.md, CLAUDE.local.md, `nguon/` và `design/mau-trang.png` không đưa lên GitHub.

## Lệnh thường dùng
```
node --test tests/                          # chạy toàn bộ test
python -m http.server 3000 --directory site # mở web trên máy tại localhost:3000
```
