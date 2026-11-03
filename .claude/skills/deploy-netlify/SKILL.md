---
name: deploy-netlify
description: Chạy toàn bộ test, rồi đưa thư mục site/ lên Netlify và báo link.
disable-model-invocation: true
---

Đưa LOGNEKO lên Netlify. Chỉ thư mục site/ được đưa lên mạng.

## Các bước
1. Chạy `node --test tests/`. Chỉ một test đỏ cũng dừng, báo kết quả thật và không deploy.
2. Kiểm tra netlify.toml có `publish = "site"`.
3. Liệt kê file trong site/. Có file .xlsx, .md, hoặc nghi có giá thật, tên hãng, tên sale từ báo giá mẫu thì dừng và báo lại.
4. Lần đầu deploy: nhờ Khải tự chạy `npx netlify-cli login` và xác nhận tên trang. Không tự nhập tài khoản hay mã đăng nhập.
5. Tóm tắt số test đạt, số file và trang đích, rồi hỏi Khải xác nhận. Chưa có xác nhận thì không deploy.
6. Chạy `npx netlify-cli deploy --prod --dir=site`.
7. Kiểm tra trên link thật: trang chủ mở được, và không truy cập được nguon/, tests/, .claude/.

## Báo cáo
Link trang, thời điểm deploy, kết quả kiểm tra. Deploy lỗi thì báo nguyên văn lỗi, không thử lại quá một lần. Không commit, không đẩy lên GitHub.
