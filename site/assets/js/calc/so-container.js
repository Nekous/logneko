// Kiểm tra số container theo ISO 6346. Hàm thuần, chạy được cả trong test.
import { formatNumber } from '../core/format.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FIRST_LETTER_VALUE = 10;
const MODULUS = 11;
const PREFIX_LENGTH = 4;
const BODY_LENGTH = 10;
const FULL_LENGTH = 11;
// Dán nhiều số liền nhau thành một chuỗi thì chuỗi dài ít nhất hai số.
const JOINED_LENGTH = FULL_LENGTH * 2;
const FULL_PATTERN = /^[A-Z]{4}\d{7}$/;
// Khoảng trắng, các loại gạch nối và dấu trừ chỉ để dễ đọc, không thuộc số cont.
// Thêm ký tự vô hình hay dính theo khi dán từ web: gạch mềm, khoảng trắng rộng 0, dấu nối từ.
// Viết bằng mã số vì ký tự vô hình không nhìn thấy được trong code.
const REMOVABLE = String.fromCharCode(
  0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2212,
  0xad, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff,
);
// Gạch nối thường đặt cuối nhóm để không bị hiểu là khoảng ký tự.
const SEPARATORS_INSIDE = new RegExp(`[\\s${REMOVABLE}-]`, 'g');
const SEPARATORS_BETWEEN = /[\n\r,;\t]+/;
const VALID_CHAR = /[A-Z0-9]/;

export const LOAI_THIET_BI_TEXT = {
  U: 'container chở hàng',
  J: 'thiết bị gắn rời theo container, như máy phát điện của cont lạnh',
  Z: 'rơ-moóc và khung xe (chassis)',
};

export const TRANG_THAI_TEXT = {
  'hop-le': 'Hợp lệ',
  'sai-chu-so': 'Sai chữ số kiểm tra',
  'sai-dinh-dang': 'Sai định dạng',
  'thieu-chu-so': 'Thiếu chữ số kiểm tra',
  'chua-du': 'Chưa đủ ký tự',
};

export const CHU_SO_HUU_NHAC = 'Mã chủ sở hữu chỉ cho biết ai sở hữu vỏ cont, không chứng minh hãng nào đang chở lô hàng: cont thuê hoặc cont của hãng khác vẫn đi chung tàu.';

// A = 10, rồi tăng dần và bỏ qua bội của 11 (11, 22, 33) để hai chữ cái không cùng số dư.
const LETTER_VALUES = (() => {
  const values = {};
  let value = FIRST_LETTER_VALUE;
  for (const letter of LETTERS) {
    if (value % MODULUS === 0) value += 1;
    values[letter] = value;
    value += 1;
  }
  return values;
})();

export function letterValue(char) {
  return /\d/.test(char) ? Number(char) : LETTER_VALUES[char];
}

// Nhân 10 ký tự đầu với 2^0 đến 2^9, cộng lại, chia dư cho 11; dư 10 thì chữ số là 0.
export function checkDigit(body) {
  const chiTiet = [...body.slice(0, BODY_LENGTH)].map((kyTu, index) => {
    const giaTri = letterValue(kyTu);
    const heSo = 2 ** index;
    return { kyTu, giaTri, heSo, tich: giaTri * heSo };
  });
  const tong = chiTiet.reduce((sum, item) => sum + item.tich, 0);
  const du = tong % MODULUS;
  return { chiTiet, tong, du, chuSo: du % 10 };
}

// Chỉ đổi a-z sang chữ hoa: toUpperCase() biến ſ, ß thành S, SS, tức là tự sửa số người dùng nhập.
function clean(text) {
  return text.replace(SEPARATORS_INSIDE, '').replace(/[a-z]/g, (letter) => letter.toUpperCase());
}

// Mỗi dòng là một số. Riêng dòng mà mọi cụm cách nhau bằng dấu cách đều đủ 11 ký tự đúng mẫu
// thì tách thành nhiều số; còn lại ghép cả dòng, để "CSQU 305438 3" vẫn là một số.
export function splitContainerList(text) {
  const items = [];
  for (const line of String(text ?? '').split(SEPARATORS_BETWEEN)) {
    const words = line.trim().split(/\s+/).filter(Boolean);
    const parts = words.length > 1 && words.every((word) => FULL_PATTERN.test(clean(word))) ? words : [line];
    for (const part of parts) {
      const so = clean(part);
      if (so) items.push({ goc: part.trim(), so });
    }
  }
  return items;
}

function formatError(so) {
  const strange = [...new Set([...so].filter((kyTu) => !VALID_CHAR.test(kyTu)))];
  if (strange.length > 0) {
    return `Có ký tự không hợp lệ: ${strange.join(', ')}. Số container chỉ gồm chữ cái A–Z và chữ số.`;
  }
  if (so.length > FULL_LENGTH) {
    const rest = so.length >= JOINED_LENGTH ? ' Nhiều số thì đặt mỗi số một dòng.' : '';
    return `Số container có 11 ký tự (4 chữ cái và 7 chữ số), ở đây có ${so.length}.${rest}`;
  }
  const prefix = so.slice(0, PREFIX_LENGTH);
  const digits = so.slice(PREFIX_LENGTH);
  if (!/^[A-Z]*$/.test(prefix)) return '4 ký tự đầu phải là chữ cái.';
  if (!/^\d*$/.test(digits)) {
    const hint = /[OI]/.test(digits) ? ' Chữ O, I hay bị gõ nhầm với số 0, 1.' : '';
    return `7 ký tự cuối phải là chữ số.${hint}`;
  }
  if (prefix.length === PREFIX_LENGTH && !LOAI_THIET_BI_TEXT[prefix[3]]) {
    return `Ký tự thứ 4 là loại thiết bị, phải là U, J hoặc Z (ở đây là ${prefix[3]}).`;
  }
  return '';
}

function statusMessage(trangThai, so, chuSoDung, chuSoNhap) {
  if (trangThai === 'sai-chu-so') {
    return `Với 10 ký tự đầu này, chữ số kiểm tra phải là ${chuSoDung} (đang là ${chuSoNhap}). Chỗ sai có thể nằm ở ký tự khác, bạn soát lại cả số với chứng từ.`;
  }
  if (trangThai === 'thieu-chu-so') return `Thiếu chữ số kiểm tra. Với 10 ký tự này, số đủ là ${so}${chuSoDung}.`;
  if (trangThai === 'chua-du') return `Mới có ${so.length} trên 11 ký tự.`;
  return '';
}

// Bảng mã hãng: Map từ 4 chữ đầu ra tên hãng, dựng từ owner-codes.json.
export function ownerIndex(data) {
  const index = new Map();
  for (const { ten, ma } of data?.hang ?? []) {
    for (const code of ma) index.set(code, ten);
  }
  return index;
}

// Ghi chú nguồn của danh sách hãng. Nguồn chính không có "cho"; nguồn phụ ghi hãng mà nó dùng cho.
export function sourceText(data) {
  const main = data.nguon.find((source) => !source.cho);
  const extra = new Map();
  for (const { ten, cho } of data.nguon.filter((source) => source.cho)) {
    extra.set(ten, [...(extra.get(ten) ?? []), cho]);
  }
  const parts = [...extra].map(([ten, hang]) => `riêng ${hang.join(', ')} theo ${ten}`);
  return [`Danh sách mã hãng theo ${main.ten}`, ...parts, `tra ngày ${data.ngay_cap_nhat}, mới có ${data.hang.length} hãng.`].join(', ');
}

// Kiểm tra một số. Chỉ tính chữ số kiểm tra khi đã đủ 10 ký tự đúng mẫu.
export function checkContainer(text, owners = new Map()) {
  const so = clean(String(text ?? ''));
  const result = {
    so,
    trangThai: 'chua-du',
    thongBao: '',
    maChuSoHuu: null,
    loaiThietBi: null,
    soSeri: null,
    chuSoNhap: null,
    chuSoDung: null,
    hang: null,
    tinhToan: null,
  };

  const error = formatError(so);
  if (error) return { ...result, trangThai: 'sai-dinh-dang', thongBao: error };
  if (so.length < BODY_LENGTH) return { ...result, thongBao: statusMessage('chua-du', so) };

  const tinhToan = checkDigit(so);
  const chuSoNhap = so.length === FULL_LENGTH ? Number(so[BODY_LENGTH]) : null;
  let trangThai = 'thieu-chu-so';
  if (chuSoNhap !== null) trangThai = chuSoNhap === tinhToan.chuSo ? 'hop-le' : 'sai-chu-so';

  return {
    ...result,
    trangThai,
    thongBao: statusMessage(trangThai, so, tinhToan.chuSo, chuSoNhap),
    maChuSoHuu: so.slice(0, 3),
    loaiThietBi: so[3],
    soSeri: so.slice(PREFIX_LENGTH, BODY_LENGTH),
    chuSoNhap,
    chuSoDung: tinhToan.chuSo,
    hang: owners.get(so.slice(0, PREFIX_LENGTH)) ?? null,
    tinhToan,
  };
}

// Trả về null khi ô chưa có số nào. Số gõ lại lần nữa thì ghi trùng với lần đầu.
export function checkContainerList(text, owners) {
  const items = splitContainerList(text);
  if (items.length === 0) return null;

  // Ghi vị trí lần đầu của mỗi số, để danh sách dài không phải dò lại từ đầu cho từng dòng.
  const firstIndex = new Map();
  const ketQua = items.map((item, index) => {
    const result = checkContainer(item.so, owners);
    if (!firstIndex.has(item.so)) firstIndex.set(item.so, index);
    const first = firstIndex.get(item.so);
    const trungVoi = first < index && result.trangThai !== 'chua-du' ? first + 1 : null;
    return { ...result, goc: item.goc, thuTu: index + 1, trungVoi };
  });
  return { ketQua, tong: ketQua.length, hopLe: ketQua.filter((item) => item.trangThai === 'hop-le').length };
}

// Số viết tách nhóm như in trên vỏ cont: CSQU 305438 3. Chưa tính được thì giữ nguyên.
export function formatContainer(item) {
  if (!item.tinhToan) return item.so;
  return `${item.so.slice(0, PREFIX_LENGTH)} ${item.soSeri} ${item.chuSoNhap ?? '_'}`;
}

export function headlineText(result) {
  if (result.tong === 1) return TRANG_THAI_TEXT[result.ketQua[0].trangThai];
  return `${result.hopLe}/${result.tong} số hợp lệ`;
}

export function containerSteps(result) {
  const item = result.ketQua.find((entry) => entry.tinhToan);
  if (!item) return ['Chưa có số nào đủ 10 ký tự đúng mẫu để tính chữ số kiểm tra.'];

  const { chiTiet, tong, du, chuSo } = item.tinhToan;
  const which = result.tong > 1 ? `số thứ ${item.thuTu} (${item.so})` : `số ${item.so}`;
  const steps = [
    `Tính cho ${which}.`,
    'Đổi chữ cái ra số: A = 10, B = 12, C = 13… bỏ qua 11, 22, 33; chữ số giữ nguyên. Nhân ký tự thứ 1 đến thứ 10 với 1, 2, 4… 512.',
    ...chiTiet.map(({ kyTu, giaTri, heSo, tich }) => `${kyTu} → ${giaTri} × ${formatNumber(heSo)} = ${formatNumber(tich)}`),
    `Cộng lại: ${formatNumber(tong)}.`,
    du === 10
      ? `${formatNumber(tong)} chia 11 dư 10, nên chữ số kiểm tra là 0.`
      : `${formatNumber(tong)} chia 11 dư ${du}, nên chữ số kiểm tra là ${chuSo}.`,
  ];
  if (item.trangThai === 'hop-le') steps.push(`Chữ số cuối đang là ${item.chuSoNhap}, khớp, nên số hợp lệ.`);
  if (item.trangThai === 'sai-chu-so') steps.push(`Chữ số cuối đang là ${item.chuSoNhap}, không khớp, nên số sai.`);
  if (item.trangThai === 'thieu-chu-so') steps.push(`Số đủ: ${item.so}${chuSo}.`);
  return steps;
}

function copyLine(item) {
  const head = `${item.so}: ${TRANG_THAI_TEXT[item.trangThai]}`;
  const parts = [];
  if (item.tinhToan) {
    parts.push(`chủ sở hữu ${item.maChuSoHuu}, loại ${item.loaiThietBi}, sê-ri ${item.soSeri}, chữ số kiểm tra đúng là ${item.chuSoDung}`);
    parts.push(`hãng: ${item.hang ?? 'chưa có trong danh sách'}`);
  } else if (item.thongBao) {
    parts.push(item.thongBao.replace(/\.$/, ''));
  }
  if (item.trungVoi) parts.push(`trùng với số thứ ${item.trungVoi}`);
  return parts.length > 0 ? `${head}. ${parts.join('; ')}.` : `${head}.`;
}

export function containerCopyText(result) {
  return [
    `Kiểm tra số container (ISO 6346): ${result.hopLe}/${result.tong} số hợp lệ`,
    ...result.ketQua.map(copyLine),
  ].join('\n');
}
