---
name: cap-nhat-bieu-thue
description: Tạo lại dữ liệu HS code từ một file biểu thuế Excel mới và kiểm tra kết quả.
argument-hint: <đường dẫn file Excel>
disable-model-invocation: true
---

Cập nhật biểu thuế từ file: $ARGUMENTS

Không sửa tay từng dòng dữ liệu HS. Mọi thay đổi đi qua scripts/excel_to_json.py.

## Các bước
1. Kiểm tra file tồn tại và scripts/excel_to_json.py đã có. Thiếu thì dừng và báo lại.
2. Hỏi Khải ngày cập nhật của file nếu tên file không ghi rõ. Không tự đoán ngày.
3. Chép file vào nguon/. Không xóa, không ghi đè bản cũ.
4. Kiểm tra sheet BT2026 và tiêu đề các cột: F mã hàng, G mô tả tiếng Việt, H mô tả tiếng Anh, I–J đơn vị tính, K NK thông thường, N NK ưu đãi, Q VAT. Khác cấu trúc thì dừng và báo lại, không tự đoán cột.
5. Chạy `python scripts/excel_to_json.py "<file>"`.
6. So với bản đang dùng: số dòng mã 8 số (hiện 12.000), số mã khác nhau, số chương (hiện 97), các dòng mã bất thường. Con số đổi thì báo mức chênh và chờ Khải xác nhận; không xem là lỗi hay là đúng khi chưa được xác nhận.
7. Kiểm tra trang HS và trang chủ hiện đúng tên file, ngày cập nhật và cảnh báo "chỉ để tham khảo".
8. Chạy `node --test tests/`.

## Báo cáo
Tên file, ngày cập nhật, bảng so sánh số liệu cũ và mới, dòng bất thường, kết quả test. Không commit, không deploy.
