# LOGNEKO

Website miễn phí gom 8 công cụ tính toán và tra cứu cho sinh viên và người đi làm trong ngành logistics. Kết quả hiện ngay khi nhập, và có nút "Xem cách tính" để xem công thức từng bước.

> Dự án đang được xây dựng. Link dùng thử sẽ được cập nhật khi có bản đầu tiên.

## Các công cụ

| Nhóm | Công cụ | Trạng thái |
|---|---|---|
| Tính toán | CBM & quy đổi đơn vị | Sắp có |
| Tính toán | Chargeable weight hàng air | Sắp có |
| Tính toán | Cước LCL theo W/M | Sắp có |
| Tính toán | Xếp hàng vào container, có mô phỏng 3D | Sắp có |
| Kiểm tra & tra cứu | Kiểm tra số container (ISO 6346) | Sắp có |
| Kiểm tra & tra cứu | Tra cứu Incoterms 2020 | Sắp có |
| Kiểm tra & tra cứu | Tra cứu mã HS code và thuế suất | Sắp có |
| Từ điển | Thuật ngữ & viết tắt logistics | Sắp có |

## Công nghệ

- Web tĩnh bằng HTML, CSS, JavaScript thuần: không có máy chủ, không cần tài khoản.
- Mọi phép tính và tra cứu chạy ngay trong trình duyệt của người dùng.
- Dữ liệu tra cứu lưu bằng JSON. Dự kiến dùng Three.js cho mô phỏng 3D, html2canvas và jsPDF cho xuất PDF/ảnh.
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
- Mã HS và thuế suất: biểu thuế xuất nhập khẩu bản cập nhật 06/01/2026.
- Nội dung Incoterms và từ điển được viết lại bằng lời của LOGNEKO từ tài liệu học.

## Lưu ý

Kết quả chỉ để tham khảo, không thay thế việc phân loại chính thức của Hải quan hay báo giá của hãng tàu.

## Tác giả

Đinh Võ Trường Khải, sinh viên UTH.
