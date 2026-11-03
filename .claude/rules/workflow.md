# Workflow

- Chỉ bắt đầu một giai đoạn khi tui chỉ định.
- Làm từng công cụ một theo lộ trình; dùng Plan mode trước khi code. Sửa xong file trong site/tools hoặc site/data thì chạy test trong tests/ và kiểm tra JSON hợp lệ; test xanh mới báo xong.
- Sau mỗi thay đổi lớn: mở trên Edge hoặc Chrome, chụp màn hình ở cả khổ điện thoại và máy tính, so với ảnh mẫu và yêu cầu rồi sửa.
- Agent tốn token hơn chat thường: chỉ gọi ở cuối mỗi công cụ, không gọi sau từng sửa nhỏ.
- Sau mỗi lần gọi agent: chạy git status, báo ngay nếu có file bị đổi ngoài phạm vi của agent đó.
- Chỉ commit khi tui yêu cầu. Hỏi lại trước khi đẩy lên GitHub hoặc deploy Netlify.
- Kho GitHub để công khai: trước mỗi commit, kiểm tra không có giá thật, thông tin từ báo giá mẫu, ảnh Solidroad hay đường dẫn cá nhân.
- Trả lời tui bằng tiếng Việt, giải thích đơn giản vì tui không chuyên IT.
