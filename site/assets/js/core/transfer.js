// Chuyển số liệu giữa hai trang công cụ trong cùng một tab. Hàm thuần, chạy được cả trong test.

const STORAGE_KEY = 'logneko-chuyen';

// Trả về false khi trình duyệt chặn lưu tạm, để trang báo cho người dùng.
export function saveTransfer(den, payload, storage) {
  try {
    (storage ?? sessionStorage).setItem(STORAGE_KEY, JSON.stringify({ den, payload }));
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

// Nhận xong thì xóa, để tải lại trang không điền lại số cũ.
export function takeTransfer(id, storage) {
  try {
    const store = storage ?? sessionStorage;
    const saved = JSON.parse(store.getItem(STORAGE_KEY));
    if (saved?.den !== id) return null;
    store.removeItem(STORAGE_KEY);
    return saved.payload;
  } catch (error) {
    console.error(error);
    return null;
  }
}
