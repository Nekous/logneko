# Công nghệ

- HTML, CSS, JavaScript thuần. Không dùng framework, không máy chủ.
- Three.js cho mô phỏng 3D; html2canvas + jsPDF cho xuất PDF/ảnh.
- Dữ liệu tra cứu nằm trong site/data/*.json (incoterms, tu-dien, container, owner-codes, hs/), không viết cứng trong code.
- HS code: scripts/ chuyển file BIEU THUE XNK 2026.01.06.xlsx (sheet BT2026) sang JSON chia theo chương.
- Lịch sử và chế độ tối lưu bằng localStorage.
- Deploy lên Netlify, tên miền miễn phí .netlify.app; chỉ đưa thư mục site/ lên mạng.
- Công thức nằm trong site/assets/js/calc/, là hàm thuần không đụng giao diện, để test chạy trực tiếp bằng node --test.
- Thư viện ngoài lưu trong site/assets/js/vendor/ và chỉ tải khi cần dùng.
- Ô nhập số theo kiểu Việt Nam: dấu chấm luôn ngăn phần nghìn, dấu phẩy luôn ngăn phần thập phân (52.5 là 52.500; 52,5 là 52 phẩy 5). Viết sai dấu thì báo lỗi, không đoán.
- Trang công cụ ghi rõ quy ước này ở phần nhập liệu, và hiện số đã đọc dưới mỗi ô số (52.5 thì hiện "Đọc là: 52.500").
- Kết quả hiện theo kiểu Việt Nam; kết quả nào cần ,00 thì bật riêng cho kết quả đó.
