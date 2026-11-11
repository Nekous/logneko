---
name: them-thuat-ngu
description: Thêm thuật ngữ vào từ điển LOGNEKO, kiểm tra trùng và gắn link sang công cụ liên quan.
argument-hint: <thuật ngữ, cách nhau bằng dấu phẩy>
disable-model-invocation: true
---

Thêm thuật ngữ: $ARGUMENTS

Từ 5 thuật ngữ trở lên thì giao cho agent soan-tu-dien, không làm các bước dưới đây trong phiên chính.

## Các bước
1. Đọc site/data/tu-dien.json. File chưa có thì dừng và báo lại.
2. Kiểm tra trùng theo id, thuật ngữ và tên đầy đủ, không phân biệt hoa thường và dấu. Trùng thì hiện mục cũ và hỏi Khải, không ghi đè.
3. Tìm nội dung trong tài liệu theo danh sách ở CLAUDE.local.md. Không có nguồn thì hỏi Khải, không tự bịa.
4. Viết mục từ theo định dạng trong .claude/agents/soan-tu-dien.md (gồm cả bi_danh nếu có và nguon), bằng lời của LOGNEKO. Không đưa giá, tên hãng, tên sale, tuyến hay kỳ hiệu lực từ báo giá mẫu.
5. Gắn liên kết và nhóm:
   - nhom: một trong biển, air, chứng từ, phí, Incoterms, kho, hải quan, các bên.
   - cong_cu: trang công cụ liên quan, ví dụ CBM → cbm.html, FOB → incoterms.html?dk=FOB.
   - lien_quan: chỉ dùng id đã có trong từ điển.
6. Chạy `node --test tests/`: test kiểm tra JSON hợp lệ, liên kết, nhóm và nguồn.

## Báo cáo
Mục đã thêm, nguồn đã dùng, link đã gắn, mục bị trùng và mục thiếu nguồn. Không commit, không deploy.
