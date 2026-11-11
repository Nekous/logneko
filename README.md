# LOGNEKO

Website miễn phí gom 8 công cụ tính toán và tra cứu cho sinh viên và người đi làm trong ngành logistics. Kết quả hiện ngay khi nhập, và có nút "Xem cách tính" để xem công thức từng bước.

Trang chủ có ô tìm kiếm chung: gõ FOB, THC, mã HS hay số container là ra đúng công cụ và kết quả.

Các công cụ tính có Lịch sử (20 lần gần nhất, lưu ngay trên máy, bấm để điền lại) và nút Xuất PDF/ảnh cho khối kết quả.

> Dùng thử: https://logneko.netlify.app. Hiện có 7/8 công cụ, các công cụ còn lại đang được xây dựng.

## Các công cụ

| Nhóm | Công cụ | Trạng thái |
|---|---|---|
| Tính toán | CBM & quy đổi đơn vị | Dùng được |
| Tính toán | Chargeable weight hàng air | Dùng được |
| Tính toán | Cước LCL theo W/M | Dùng được |
| Tính toán | Xếp hàng vào container, có mô phỏng 3D | Sắp có |
| Kiểm tra & tra cứu | Kiểm tra số container (ISO 6346) | Dùng được |
| Kiểm tra & tra cứu | Tra cứu Incoterms 2020 | Dùng được |
| Kiểm tra & tra cứu | Tra cứu mã HS code và thuế suất | Dùng được |
| Từ điển | Thuật ngữ & viết tắt logistics | Dùng được |

## Công nghệ

- Web tĩnh bằng HTML, CSS, JavaScript thuần: không có máy chủ, không cần tài khoản.
- Mọi phép tính và tra cứu chạy ngay trong trình duyệt của người dùng.
- Dữ liệu tra cứu lưu bằng JSON. Dự kiến dùng Three.js cho mô phỏng 3D.
- Xuất PDF/ảnh dùng [html2canvas](https://html2canvas.hertzen.com) 1.4.1 và [jsPDF](https://github.com/parallax/jsPDF) 4.2.1 (cùng giấy phép MIT, bản sao giấy phép nằm cạnh thư viện trong `site/assets/js/vendor/`), chỉ tải khi bấm Xuất.
- Lịch sử tính lưu bằng localStorage của trình duyệt, không gửi đi đâu.
- Công thức được kiểm thử bằng `node --test` với các ví dụ có đáp án.
- Đưa lên mạng bằng Netlify.
- Dự án được xây dựng với sự hỗ trợ của Claude Code.

## Chạy trên máy

```
python -m http.server 3000 --directory site   # mở web tại localhost:3000
node --test tests/                            # chạy test
```

## Nguồn dữ liệu

- Danh sách mã chủ sở hữu container: [Terminal49 SCAC code lookup](https://terminal49.com/tools/scac-code-lookup); SITC và KMTC theo [ShipsGo](https://shipsgo.com/ocean/container-prefixes/kmtu/container-tracking).
- Mã HS và thuế suất: biểu thuế xuất nhập khẩu bản cập nhật 05/04/2026, chuyển sang JSON bằng `scripts/excel_to_json.py` (cần Python và openpyxl).
- Nội dung Incoterms và từ điển được viết lại bằng lời của LOGNEKO từ tài liệu học.

## Lưu ý

Kết quả chỉ để tham khảo, không thay thế việc phân loại chính thức của Hải quan hay báo giá của hãng tàu.

## Tác giả

Đinh Võ Trường Khải, sinh viên UTH.
