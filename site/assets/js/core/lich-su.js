// Lịch sử tính của từng công cụ, lưu trên máy người dùng. Hàm thuần, chạy được cả trong test.

export const SO_LAN_TOI_DA = 20;
const KEY_PREFIX = 'logneko:lich-su:';

function khoa(id) {
  return `${KEY_PREFIX}${id}`;
}

// Chỉ nhận dòng đủ ba phần; dòng hỏng thì bỏ, không làm hỏng cả danh sách.
function hopLe(muc) {
  return muc && typeof muc.luc === 'string' && typeof muc.tomTat === 'string' && muc.duLieu && typeof muc.duLieu === 'object';
}

// Trình duyệt chặn lưu hay dữ liệu hỏng thì coi như chưa có lịch sử.
export function docLichSu(id, storage) {
  try {
    const saved = JSON.parse((storage ?? localStorage).getItem(khoa(id)));
    return Array.isArray(saved) ? saved.filter(hopLe) : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

function ghi(id, ds, storage) {
  try {
    (storage ?? localStorage).setItem(khoa(id), JSON.stringify(ds));
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

// Mới nhất đứng đầu. Cùng số liệu với một lần cũ thì bỏ lần cũ, đưa lên đầu với giờ mới.
// Trả về danh sách sau khi lưu; không lưu được thì trả danh sách cũ.
export function themLichSu(id, { tomTat, duLieu }, { storage, now = new Date() } = {}) {
  const cu = docLichSu(id, storage);
  const giong = JSON.stringify(duLieu);
  const moi = [
    { luc: now.toISOString(), tomTat, duLieu },
    ...cu.filter((muc) => JSON.stringify(muc.duLieu) !== giong),
  ].slice(0, SO_LAN_TOI_DA);
  return ghi(id, moi, storage) ? moi : cu;
}

export function xoaMotLan(id, luc, storage) {
  const moi = docLichSu(id, storage).filter((muc) => muc.luc !== luc);
  ghi(id, moi, storage);
  return moi;
}

export function xoaHet(id, storage) {
  try {
    (storage ?? localStorage).removeItem(khoa(id));
  } catch (error) {
    console.error(error);
  }
  return [];
}

const hai = (so) => String(so).padStart(2, '0');

// "14:30, 11/11/2026" theo giờ trên máy người dùng.
export function nhanThoiGian(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${hai(d.getHours())}:${hai(d.getMinutes())}, ${hai(d.getDate())}/${hai(d.getMonth() + 1)}/${d.getFullYear()}`;
}
