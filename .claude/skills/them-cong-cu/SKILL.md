---
name: them-cong-cu
description: Tạo trang công cụ LOGNEKO mới theo khuôn chung, kèm hàm tính và file test.
argument-hint: <tên công cụ>
disable-model-invocation: true
---

Tạo công cụ: $ARGUMENTS

## Tên file theo công cụ
1 cbm, 2 chargeable-weight, 3 cuoc-lcl, 4 xep-container, 5 so-container, 6 incoterms, 7 hs-code, 8 tu-dien.
Trang đặt tại site/tools/<tên>.html.

## Các bước
1. Đọc đặc tả công cụ trong MO-TA-DU-AN.md. Không xác định được công cụ thì hỏi lại.
2. Đối chiếu Lộ trình build. Công cụ không thuộc giai đoạn đang làm thì hỏi trước khi tiếp tục.
3. Kiểm tra có sẵn khuôn trang công cụ và các file core. Chưa có thì dừng và báo lại, không tự dựng khuôn riêng.
4. Lập kế hoạch ngắn bằng Plan mode, chờ Khải duyệt rồi mới code.
5. Với công cụ tính toán, viết test trong tests/ trước, gồm mọi ví dụ có đáp án trong đặc tả và các số lạ (0, số âm, ô trống, chữ).
6. Viết hàm tính trong site/assets/js/calc/. Dữ liệu tra cứu đặt trong site/data/, không viết cứng trong code.
7. Làm trang đủ khuôn chung:
   - Tiêu đề và một dòng giải thích công cụ dùng để làm gì.
   - Ô nhập, có nút "Điền ví dụ".
   - Kết quả hiện ngay khi gõ, không cần nút Tính.
   - Nút "Xem cách tính": công thức và các bước với chính số vừa nhập.
   - Hàng nút Copy, Xuất PDF/ảnh và Lịch sử có sẵn trong `mountTool`. Trang chỉ cần khai báo `stickyTotal` (hoặc `historyText`) để có dòng tóm tắt trong lịch sử, và `fill` của `renderInputs` phải điền lại được mọi ô từ bộ số đưa vào `calculate`.
   - Chuyển sang công cụ liên quan: khai báo `transfer`.
   - Ghi chú nguồn và cảnh báo "chỉ để tham khảo" khi cần.
   Phần nào khuôn chung chưa có thì để trống và ghi rõ trong báo cáo, không làm tạm riêng cho một trang.
8. Cập nhật trạng thái công cụ trong site/data/tools.json.
9. Chạy `node --test tests/`. Test xanh mới được báo xong; test đỏ thì báo kết quả thật.

## Báo cáo
Liệt kê file đã tạo, kết quả test và phần còn thiếu. Đề nghị Khải chọn gọi agent kiem-tra-nghiep-vu (công cụ tính toán) và reviewer-giao-dien. Không tự gọi agent, không commit, không deploy.
