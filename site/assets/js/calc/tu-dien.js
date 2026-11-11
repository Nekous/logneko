// Tìm và kiểm tra mục từ điển. Hàm thuần, chạy được cả trong test.
import { boDau } from '../core/goi-y.js';

const TRUONG_CHU = ['id', 'thuat_ngu', 'ten_day_du', 'nghia', 'giai_thich', 'vi_du', 'nhom'];
const TRUONG_HOP_LE = new Set([...TRUONG_CHU, 'bi_danh', 'lien_quan', 'cong_cu', 'nguon']);
const ID_HOP_LE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KET_CAU = /[.!?…"”)]$/;
// Chữ gõ ngắn hơn mức này chỉ khớp chính xác hoặc khớp phần đầu, để THC không nhảy sang THL.
const DAI_TOI_THIEU_GO_SAI = 4;
// Từ mức này trở lên cho sai 2 ký tự, ngắn hơn chỉ cho sai 1.
const DAI_CHO_SAI_HAI = 8;

// Bỏ dấu và mọi ký tự không phải chữ, số: "D/O", "DO", "d o" như nhau; "20'DC" thành "20dc".
// NFKC đổi số mũ về số thường trước, để "m³" thành "m3".
export function chuanHoa(text) {
  return boDau(text.normalize('NFKC')).replace(/[^a-z0-9]/g, '');
}

export function tachChu(text) {
  return boDau(text.normalize('NFKC')).split(/[^a-z0-9]+/).filter(Boolean);
}

// Mỗi chữ gõ phải là phần đầu của một chữ trong câu: "phi luu" khớp "Phí lưu container".
function khopDauChu(chuCau, chuGo) {
  return chuGo.length > 0 && chuGo.every((go) => chuCau.some((chu) => chu.startsWith(go)));
}

// Khoảng cách Damerau–Levenshtein (bản đổi chỗ hai ký tự liền nhau). Vượt gioiHan thì dừng sớm.
export function khoangCach(a, b, gioiHan = Infinity) {
  if (Math.abs(a.length - b.length) > gioiHan) return gioiHan + 1;
  let truoc2 = [];
  let truoc = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const hang = [i];
    let nhoNhat = i;
    for (let j = 1; j <= b.length; j += 1) {
      const doi = a[i - 1] === b[j - 1] ? 0 : 1;
      hang[j] = Math.min(truoc[j] + 1, hang[j - 1] + 1, truoc[j - 1] + doi);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        hang[j] = Math.min(hang[j], truoc2[j - 2] + 1);
      }
      nhoNhat = Math.min(nhoNhat, hang[j]);
    }
    if (nhoNhat > gioiHan) return gioiHan + 1;
    [truoc2, truoc] = [truoc, hang];
  }
  return truoc[b.length];
}

function tenGoi(muc) {
  return [muc.thuat_ngu, muc.id, ...(muc.bi_danh ?? [])].map(chuanHoa).filter(Boolean);
}

// Tách tên gọi theo khoảng trắng, giữ nguyên "B/L" thành một chữ "bl".
function chuTrongTen(muc) {
  return [muc.thuat_ngu, ...(muc.bi_danh ?? [])].flatMap((ten) => ten.split(/\s+/)).map(chuanHoa).filter(Boolean);
}

// Hạng càng nhỏ càng khớp: 0 đúng tên, 1 đầu tên, 2 chữ trong tên tiếng Anh, 3 chữ trong nghĩa, 4 gõ sai nhẹ.
function xepHang(muc, go) {
  const ten = tenGoi(muc);
  if (ten.includes(go.gon) || chuanHoa(muc.ten_day_du) === go.gon) return { hang: 0, lech: 0 };
  if (ten.some((item) => item.startsWith(go.gon))) return { hang: 1, lech: 0 };
  const chuTen = tachChu(muc.ten_day_du);
  if (khopDauChu(chuTen, go.chu)) return { hang: 2, lech: 0 };
  // Viết tắt kiểu "B/L" thì tìm cả tên có nó là một chữ riêng: "Surrendered B/L".
  if (go.vietTat && chuTrongTen(muc).includes(go.gon)) return { hang: 2, lech: 0 };
  if (khopDauChu(tachChu(muc.nghia), go.chu)) return { hang: 3, lech: 0 };

  if (go.gon.length < DAI_TOI_THIEU_GO_SAI) return null;
  const gioiHan = go.gon.length >= DAI_CHO_SAI_HAI ? 2 : 1;
  const soVoi = [...ten, chuanHoa(muc.ten_day_du), ...chuTen.filter((chu) => chu.length >= DAI_TOI_THIEU_GO_SAI)];
  const lech = Math.min(...soVoi.map((item) => khoangCach(go.gon, item, gioiHan)));
  return lech <= gioiHan ? { hang: 4, lech } : null;
}

export function soSanhTen(a, b) {
  return a.thuat_ngu.localeCompare(b.thuat_ngu, 'vi', { sensitivity: 'base', numeric: true });
}

// Như timMuc nhưng giữ hạng khớp của từng mục, để tìm kiếm chung xếp các nhóm với nhau.
export function timMucCoHang(data, chu, { nhom } = {}) {
  const ds = nhom ? data.muc.filter((muc) => muc.nhom === nhom) : data.muc;
  const go = { gon: chuanHoa(chu), chu: tachChu(chu) };
  if (!go.gon) return [...ds].sort(soSanhTen).map((muc) => ({ muc, hang: 0 }));
  // "B/L", "c o" tách ra chữ cái lẻ thì khớp gần như mọi câu, nên chỉ so với tên gọi, không so từng chữ.
  go.vietTat = go.chu.length > 1 && go.chu.some((item) => item.length === 1);
  if (go.vietTat) go.chu = [];

  return ds
    .map((muc) => ({ muc, diem: xepHang(muc, go) }))
    .filter((item) => item.diem)
    .sort((a, b) => a.diem.hang - b.diem.hang || a.diem.lech - b.diem.lech || soSanhTen(a.muc, b.muc))
    .map((item) => ({ muc: item.muc, hang: item.diem.hang }));
}

// Ô trống thì trả cả danh sách theo A–Z. nhom lọc theo nhóm, để trống là tất cả.
export function timMuc(data, chu, options) {
  return timMucCoHang(data, chu, options).map((item) => item.muc);
}

export function timTheoId(data, id) {
  return data.muc.find((muc) => muc.id === id) ?? null;
}

// "incoterms.html?dk=FOB" thuộc công cụ incoterms.
export function idCongCu(congCu) {
  return congCu.split(/[.?]/)[0];
}

// Đọc ?q=thc&nhom=phí&muc=thc. Nhóm hay mục không có thật thì bỏ.
export function docDiaChi(data, search) {
  const params = new URLSearchParams(search);
  const nhom = params.get('nhom');
  const muc = params.get('muc');
  return {
    q: (params.get('q') ?? '').trim(),
    nhom: data.nhom.includes(nhom) ? nhom : null,
    muc: muc && timTheoId(data, muc) ? muc : null,
  };
}

export function taoDiaChi({ q, nhom, muc }) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (nhom) params.set('nhom', nhom);
  if (muc) params.set('muc', muc);
  const text = params.toString();
  return text ? `?${text}` : '';
}

// trang: tên file trong site/tools; maIncoterms: 11 mã có trong incoterms.json.
export function kiemTraDuLieu(data, { trang = [], maIncoterms = [] } = {}) {
  const loi = [];
  if (!Array.isArray(data.nhom) || !Array.isArray(data.muc) || typeof data.tai_lieu !== 'object') {
    return ['Thiếu nhom, tai_lieu hoặc muc'];
  }
  const ids = new Set();
  const tenDaCo = new Map();
  for (const muc of data.muc) {
    const ten = muc.id ?? muc.thuat_ngu ?? '(không id)';
    for (const key of Object.keys(muc)) if (!TRUONG_HOP_LE.has(key)) loi.push(`${ten}: trường lạ "${key}"`);
    for (const key of TRUONG_CHU) {
      if (typeof muc[key] !== 'string' || !muc[key].trim()) loi.push(`${ten}: thiếu ${key}`);
    }
    for (const key of ['nghia', 'giai_thich', 'vi_du']) {
      if (typeof muc[key] === 'string' && !KET_CAU.test(muc[key].trim())) loi.push(`${ten}: ${key} chưa có dấu kết câu`);
    }
    if (!ID_HOP_LE.test(muc.id ?? '')) loi.push(`${ten}: id chỉ dùng a-z, 0-9 và gạch nối`);
    if (ids.has(muc.id)) loi.push(`${ten}: trùng id`);
    ids.add(muc.id);
    if (!data.nhom.includes(muc.nhom)) loi.push(`${ten}: nhóm "${muc.nhom}" không có trong danh sách`);

    if (muc.bi_danh !== undefined && (!Array.isArray(muc.bi_danh) || muc.bi_danh.some((item) => typeof item !== 'string' || !item.trim()))) {
      loi.push(`${ten}: bi_danh phải là danh sách chữ`);
    }
    for (const goi of new Set(tenGoi(muc))) {
      if (tenDaCo.has(goi)) loi.push(`${ten}: tên gọi "${goi}" trùng với ${tenDaCo.get(goi)}`);
      else tenDaCo.set(goi, ten);
    }

    if (!Array.isArray(muc.nguon) || !muc.nguon.length) loi.push(`${ten}: thiếu nguồn`);
    else for (const id of muc.nguon) if (!(id in data.tai_lieu)) loi.push(`${ten}: nguồn "${id}" không có trong tai_lieu`);

    if (muc.cong_cu !== null) {
      const [file, query] = String(muc.cong_cu ?? '').split('?');
      if (!trang.includes(file)) loi.push(`${ten}: không có trang công cụ "${muc.cong_cu}"`);
      if (query !== undefined) {
        const params = new URLSearchParams(query);
        const hopLe = file === 'incoterms.html' && [...params.keys()].join() === 'dk' && maIncoterms.includes(params.get('dk'));
        if (!hopLe) loi.push(`${ten}: tham số công cụ không hợp lệ "${muc.cong_cu}"`);
      }
    }
  }

  for (const muc of data.muc) {
    if (!Array.isArray(muc.lien_quan)) {
      loi.push(`${muc.id}: lien_quan phải là danh sách`);
      continue;
    }
    if (new Set(muc.lien_quan).size !== muc.lien_quan.length) loi.push(`${muc.id}: lien_quan bị lặp`);
    for (const id of muc.lien_quan) {
      if (id === muc.id) loi.push(`${muc.id}: tự liên quan tới chính nó`);
      else if (!ids.has(id)) loi.push(`${muc.id}: liên quan tới "${id}" chưa có`);
    }
  }
  return loi;
}
