// Tra mã HS trong dữ liệu biểu thuế do scripts/excel_to_json.py tạo. Hàm thuần, chạy được cả trong test.
import { formatNumber } from '../core/format.js';
import { tachChu } from './tu-dien.js';

export const SO_KET_QUA_TEN = 30;
const MA_NGAN_NHAT = 2;
const MA_DAI_NHAT = 8;
const SO_THUAN = /^\d+(\.\d+)?$/;

export const CHU_THICH = {
  sao: '*: hàng không chịu thuế GTGT, hoặc không chịu thuế GTGT ở khâu nhập khẩu.',
  vat: 'Các số 5, 8, 10 ở cột VAT là thuế suất GTGT 5%, 8%, 10%; mức áp dụng tùy điều kiện của hàng.',
  nhn: 'NHN (ngoài hạn ngạch): số đứng trước áp cho lượng hàng trong hạn ngạch thuế quan, số sau NHN áp cho phần vượt hạn ngạch.',
  chuong98: 'Ô này dẫn tới phần hướng dẫn của Chương 98. LOGNEKO chưa có nội dung hướng dẫn đó, bạn xem văn bản ghi kèm.',
};

// Chỉ gồm số, dấu chấm, dấu cách, gạch nối thì coi là gõ mã; còn lại là tìm theo tên.
export function laMa(chu) {
  const text = String(chu ?? '').trim();
  return /\d/.test(text) && /^[\d.\s-]+$/.test(text);
}

// "8471", "8471.30", "84 71 30 20" đều ra chuỗi số. Trả về { ma } hoặc { loi }.
export function docMa(chu) {
  const ma = String(chu ?? '').replace(/[.\s-]/g, '');
  if (!/^\d+$/.test(ma)) return { loi: 'Mã HS chỉ gồm chữ số; có thể cách nhóm bằng dấu chấm hoặc dấu cách.' };
  if (ma.length < MA_NGAN_NHAT) return { loi: 'Gõ ít nhất 2 chữ số (số chương).' };
  if (ma.length > MA_DAI_NHAT) return { loi: `Mã HS trong biểu thuế dài nhất 8 chữ số, ở đây có ${ma.length}.` };
  return { ma };
}

export function chuongCua(ma) {
  return Number(ma.slice(0, 2));
}

export function tenTep(so) {
  return `chuong-${String(so).padStart(2, '0')}.json`;
}

// Bỏ các dấu gạch đầu mô tả ("- - Loại khác" thành "Loại khác"); gạch chỉ để biểu thị cấp.
export function boGach(vi) {
  return vi.replace(/^[-–\s]+/, '');
}

// Các dòng cha từ trên xuống, không gồm chính dòng đó.
export function duongDan(dong, i) {
  const ds = [];
  for (let cha = dong[i]?.cha ?? -1; cha >= 0; cha = dong[cha].cha) ds.unshift(cha);
  return ds;
}

// Gõ 2 số: danh sách nhóm 4 số của chương. Gõ dài hơn: các dòng có mã bắt đầu bằng mã gõ, cùng các dòng con
// không có mã nằm giữa (như "- Ngựa:"). Không có thì gợi ý mã ngắn hơn gần nhất còn có trong biểu.
export function timTheoMa(chuong, ma) {
  const dong = chuong.dong;
  if (ma.length === MA_NGAN_NHAT) {
    return { loai: 'chuong', dong: dong.flatMap((item, i) => (item.ma?.length === 4 ? [i] : [])) };
  }
  const trong = new Set();
  const ketQua = [];
  dong.forEach((item, i) => {
    if (item.loai) return;
    if ((item.ma && item.ma.startsWith(ma)) || (!item.ma && trong.has(item.cha))) {
      trong.add(i);
      ketQua.push(i);
    }
  });
  if (!ketQua.length) {
    let ganNhat = null;
    for (let dai = ma.length - 1; dai > MA_NGAN_NHAT && !ganNhat; dai -= 1) {
      const ngan = ma.slice(0, dai);
      if (dong.some((item) => item.ma?.startsWith(ngan))) ganNhat = ngan;
    }
    return { loai: 'khong-co', ganNhat };
  }
  return { loai: 'ma', dong: ketQua, duongDan: duongDan(dong, ketQua[0]) };
}

// Chuẩn bị chỉ mục một lần: tách chữ không dấu của mô tả Việt và Anh, và câu đã nối lại để tìm cả cụm.
const daChuanBi = new WeakMap();
function chuanBi(chiMuc) {
  if (!daChuanBi.has(chiMuc)) {
    daChuanBi.set(chiMuc, chiMuc.map(([, , vi, en]) => {
      const chu = tachChu(`${vi} ${en}`);
      return { chu, cau: ` ${tachChu(vi).join(' ')} | ${tachChu(en).join(' ')} ` };
    }));
  }
  return daChuanBi.get(chiMuc);
}

const khop = (chuDong, go) => chuDong.some((chu) => chu.startsWith(go));
// Khớp nguyên chữ được 2 điểm, khớp phần đầu được 1: gõ "ca phe" thì "Cà phê" đứng trên "các".
const diemChu = (chuDong, go) => (chuDong.includes(go) ? 2 : khop(chuDong, go) ? 1 : 0);
const DIEM_CA_CUM = 3;

// Mỗi chữ gõ phải khớp phần đầu một chữ trong mô tả của dòng hoặc của các dòng cha: "tom hun khoi" tìm ra
// các dòng 9804 dù dòng 8 số chỉ ghi "Tôm hùm Na Uy". Dòng tự chứa chữ gõ (nguyên chữ, đủ cụm) đứng trước,
// rồi mã ngắn (nhóm) trước mã dài. Chỉ trả về dòng có mã.
export function timTheoTen(chiMuc, chu, { gioiHan = SO_KET_QUA_TEN } = {}) {
  const go = tachChu(String(chu ?? ''));
  if (!go.length) return { ketQua: [], tong: 0 };
  const cum = ` ${go.join(' ')} `;
  const da = chuanBi(chiMuc);
  const tim = [];
  chiMuc.forEach(([ma, chuong, vi], i) => {
    if (!ma) return;
    const rieng = go.reduce((tong, item) => tong + diemChu(da[i].chu, item), 0);
    if (rieng === 0) return;
    const conLai = go.filter((item) => !khop(da[i].chu, item));
    for (let cha = chiMuc[i][4]; conLai.length && cha >= 0; cha = chiMuc[cha][4]) {
      for (let k = conLai.length - 1; k >= 0; k -= 1) if (khop(da[cha].chu, conLai[k])) conLai.splice(k, 1);
    }
    if (conLai.length) return;
    const diem = rieng + (go.length > 1 && da[i].cau.includes(cum) ? DIEM_CA_CUM : 0);
    tim.push({ i, ma, chuong, vi, diem });
  });
  tim.sort((a, b) => b.diem - a.diem || a.ma.length - b.ma.length || a.i - b.i);
  return { ketQua: tim.slice(0, gioiHan), tong: tim.length };
}

// Ô chỉ có số ("40.5") thì viết kiểu Việt Nam kèm %, mọi dạng khác giữ nguyên văn như trong biểu thuế.
export function hienThue(o) {
  const text = String(o ?? '').trim();
  return SO_THUAN.test(text) ? `${formatNumber(Number(text), { toiDa: 10 })}%` : text;
}

// Chỉ hiện chú thích cho ký hiệu có mặt trong dòng đó.
export function chuThichKyHieu(dong) {
  const ds = [];
  const vat = dong.vat?.[0] ?? '';
  const tatCa = ['tt', 'ud', 'vat'].map((key) => dong[key]?.[0] ?? '').join(' ');
  if (vat.includes('*')) ds.push(CHU_THICH.sao);
  if (/\b(5|8|10)\b/.test(vat) && vat.includes('/')) ds.push(CHU_THICH.vat);
  if (tatCa.includes('NHN')) ds.push(CHU_THICH.nhn);
  if (/Chương 98/.test(tatCa)) ds.push(CHU_THICH.chuong98);
  return ds;
}

function dongThue(nhan, bo) {
  if (!bo) return `${nhan}: không ghi`;
  const [giaTri, vanBan, ngay] = bo;
  const ghiChu = [vanBan, ngay && `hiệu lực ${ngay}`].filter(Boolean).join(', ');
  return `${nhan}: ${hienThue(giaTri)}${ghiChu ? ` (${ghiChu})` : ''}`;
}

// Nội dung nút Copy cho một mã 8 số.
export function chepMa(dong, meta) {
  const ngay = meta.cap_nhat.split('-').reverse().join('/');
  return [
    `Mã HS ${dong.ma}: ${boGach(dong.vi)}`,
    dong.en ? boGach(dong.en) : null,
    dong.dvt ? `Đơn vị tính: ${dong.dvt}` : null,
    dongThue('NK ưu đãi', dong.ud),
    dongThue('NK thông thường', dong.tt),
    dongThue('VAT', dong.vat),
    `Nguồn: biểu thuế ${meta.nguon}, cập nhật ${ngay}. Chỉ để tham khảo.`,
  ].filter(Boolean).join('\n');
}
