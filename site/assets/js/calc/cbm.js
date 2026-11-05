// Công thức CBM và quy đổi đơn vị. Hàm thuần, chạy được cả trong test.
import { formatNumber, parseNumber } from '../core/format.js';

const CM_PER_UNIT = { cm: 1, m: 100, inch: 2.54 };
const CM3_PER_M3 = 1000000;
const MAX_SIZE_CM = 10000;
const KG_PER_LB = 0.45359237;
const FT3_PER_M3 = 35.3147;

const CBM_DISPLAY_FLOOR = 0.00005;
// Phần cách tính cần đủ số để sinh viên cộng lại khớp tổng.
const STEP_DECIMALS = { toiDa: 6 };
const EXACT_DECIMALS = { toiDa: 8 };

const PACKING_ITEM = /(\d[\d.]*)\s*\(\s*(\d[\d.,]*)\s*[*x×]\s*(\d[\d.,]*)\s*[*x×]\s*(\d[\d.,]*)\s*\)\s*(cm|m|inch|in)?/gi;
const UNIT_ALIAS = { cm: 'cm', m: 'm', inch: 'inch', in: 'inch' };
const FORMAT_HINT = 'Mỗi dòng viết theo dạng 2(92*61*37).';

export function formatCbm(value) {
  if (value > 0 && value < CBM_DISPLAY_FLOOR) return 'dưới 0,0001';
  return formatNumber(value);
}

function isFilled(value) {
  return value !== null && value !== undefined;
}

function isBlankLine(item) {
  return [item.soKien, item.dai, item.rong, item.cao, item.trongLuong].every((value) => !isFilled(value));
}

function lineError(item, stt, cmPerUnit) {
  if (isFilled(item.soKien) && (!Number.isInteger(item.soKien) || item.soKien < 1)) {
    return `Dòng ${stt}: số kiện phải là số nguyên từ 1 trở lên.`;
  }
  const sizes = [item.dai, item.rong, item.cao].filter(isFilled);
  if (sizes.some((value) => value <= 0)) {
    return `Dòng ${stt}: kích thước phải lớn hơn 0.`;
  }
  if (sizes.some((value) => value * cmPerUnit >= MAX_SIZE_CM)) {
    return `Dòng ${stt}: mỗi kích thước phải dưới 100 m. Bạn xem lại số ở dòng "Đọc là" dưới ô.`;
  }
  if (isFilled(item.trongLuong) && item.trongLuong <= 0) {
    return `Dòng ${stt}: trọng lượng phải lớn hơn 0, không có thì để trống.`;
  }
  return '';
}

function calculateGw(lines, tongGw) {
  const entered = lines.filter((item) => isFilled(item.trongLuong));
  if (isFilled(tongGw)) {
    if (entered.length > 0) return { ghiChu: 'Đang có cả hai cách, hãy giữ một' };
    return { nhap: tongGw, cach: 'tong' };
  }
  const counted = lines.filter((item) => isFilled(item.cbm));
  const missing = counted.filter((item) => !isFilled(item.trongLuong));
  if (missing.length === counted.length) return {};
  if (missing.length > 0) return { ghiChu: `Thiếu trọng lượng dòng ${missing.map((item) => item.stt).join(', ')}` };
  return { nhap: counted.reduce((sum, item) => sum + item.soKien * item.trongLuong, 0), cach: 'tung-kien' };
}

// Mỗi dòng có soKien, dai, rong, cao, trongLuong; ô trống là null.
// Trả về null khi chưa có dòng nào đủ số, { loi } khi số liệu sai.
export function calculateCbm({ kien, donViKichThuoc = 'cm', donViTrongLuong = 'kg', tongGw = null }) {
  const cmPerUnit = CM_PER_UNIT[donViKichThuoc];
  const dong = [];
  const chuaTinh = [];
  const lines = [];

  for (const [index, item] of kien.entries()) {
    const stt = index + 1;
    if (isBlankLine(item)) continue;
    const error = lineError(item, stt, cmPerUnit);
    if (error) return { loi: error };

    const isComplete = [item.soKien, item.dai, item.rong, item.cao].every(isFilled);
    if (!isComplete) {
      chuaTinh.push(stt);
      lines.push({ ...item, stt });
      continue;
    }
    const cm3 = item.dai * cmPerUnit * item.rong * cmPerUnit * item.cao * cmPerUnit * item.soKien;
    const line = { ...item, stt, cm3, cbm: cm3 / CM3_PER_M3 };
    dong.push(line);
    lines.push(line);
  }

  if (isFilled(tongGw) && tongGw <= 0) return { loi: 'Tổng GW phải lớn hơn 0, không có thì để trống.' };
  if (dong.length === 0) return null;

  // Cộng từ số chưa làm tròn: cộng các số đã làm tròn trên màn hình có thể lệch một chút.
  const tongCm3 = dong.reduce((sum, item) => sum + item.cm3, 0);
  const tongCbm = tongCm3 / CM3_PER_M3;
  const tongFt3 = tongCbm * FT3_PER_M3;
  const gw = calculateGw(lines, tongGw);
  const gwKg = isFilled(gw.nhap) ? gw.nhap * (donViTrongLuong === 'lb' ? KG_PER_LB : 1) : null;
  const gwLb = isFilled(gwKg) ? gwKg / KG_PER_LB : null;

  if (![tongCm3, tongFt3, gwKg ?? 0, gwLb ?? 0].every(Number.isFinite)) {
    return { loi: 'Số quá lớn nên không tính được. Bạn xem lại các ô đã nhập.' };
  }

  return {
    dong,
    chuaTinh,
    donViKichThuoc,
    donViTrongLuong,
    tongKien: dong.reduce((sum, item) => sum + item.soKien, 0),
    tongCm3,
    tongCbm,
    tongFt3,
    gwNhap: gw.nhap ?? null,
    gwCach: gw.cach ?? null,
    gwGhiChu: gw.ghiChu ?? null,
    gwKg,
    gwLb,
  };
}

export function chuaTinhText(chuaTinh) {
  return `Dòng ${chuaTinh.join(', ')} chưa đủ số, chưa tính vào tổng.`;
}

export function lineLabel(item, donVi) {
  const size = [item.dai, item.rong, item.cao].map((value) => formatNumber(value, EXACT_DECIMALS)).join(' × ');
  return `${formatNumber(item.soKien)} × ${size} ${donVi}`;
}

export function cbmSteps(result) {
  const { dong, donViKichThuoc, donViTrongLuong, gwCach, gwNhap } = result;
  const steps = [];
  const metersPerUnit = CM_PER_UNIT[donViKichThuoc] / 100;

  if (donViKichThuoc === 'cm') steps.push('Đổi kích thước sang mét: 1 cm = 0,01 m.');
  if (donViKichThuoc === 'inch') steps.push('Đổi kích thước sang mét: 1 inch = 2,54 cm = 0,0254 m.');

  for (const item of dong) {
    const size = [item.dai, item.rong, item.cao]
      .map((value) => formatNumber(value * metersPerUnit, STEP_DECIMALS))
      .join(' × ');
    steps.push(`Dòng ${item.stt}: ${size} × ${formatNumber(item.soKien)} = ${formatCbm(item.cbm)} CBM.`);
  }

  if (dong.length > 1) {
    const parts = dong.map((item) => formatNumber(item.cbm, STEP_DECIMALS)).join(' + ');
    steps.push(`Cộng số chưa làm tròn rồi mới làm tròn: ${parts} = ${formatNumber(result.tongCbm, STEP_DECIMALS)}, hiện là ${formatCbm(result.tongCbm)} CBM.`);
  }
  steps.push(`Đổi sang ft³: ${formatNumber(result.tongCbm, STEP_DECIMALS)} × 35,3147 = ${formatNumber(result.tongFt3)} ft³.`);

  if (gwCach === 'tung-kien') {
    const parts = dong.map((item) => `${formatNumber(item.soKien)} × ${formatNumber(item.trongLuong, EXACT_DECIMALS)}`).join(' + ');
    steps.push(`Tổng GW: ${parts} = ${formatNumber(gwNhap)} ${donViTrongLuong}.`);
  }
  if (gwCach === 'tong') steps.push(`Tổng GW theo số đã nhập: ${formatNumber(gwNhap)} ${donViTrongLuong}.`);
  if (gwCach && donViTrongLuong === 'kg') {
    steps.push(`Đổi sang lb: ${formatNumber(gwNhap)} ÷ 0,45359237 = ${formatNumber(result.gwLb)} lb.`);
  }
  if (gwCach && donViTrongLuong === 'lb') {
    steps.push(`Đổi sang kg: ${formatNumber(gwNhap)} × 0,45359237 = ${formatNumber(result.gwKg)} kg.`);
  }
  return steps;
}

export function cbmCopyText(result) {
  const { dong, chuaTinh, donViKichThuoc } = result;
  const lines = [`Tổng: ${formatCbm(result.tongCbm)} CBM (${formatNumber(result.tongFt3)} ft³), ${formatNumber(result.tongKien)} kiện`];
  if (result.gwCach) lines.push(`Tổng GW: ${formatNumber(result.gwKg)} kg (${formatNumber(result.gwLb)} lb)`);
  if (result.gwGhiChu) lines.push(`Tổng GW: ${result.gwGhiChu}`);
  for (const item of dong) {
    lines.push(`Dòng ${item.stt}: ${lineLabel(item, donViKichThuoc)} = ${formatCbm(item.cbm)} CBM`);
  }
  if (chuaTinh.length > 0) lines.push(chuaTinhText(chuaTinh));
  return lines.join('\n');
}

// Báo nguyên dòng chứ không báo mẩu thừa, vì mẩu thừa như "1" hay "." không giúp tìm chỗ sai.
function firstBadLine(text) {
  return text.split('\n').map((line) => line.trim()).find((line) => {
    const rest = line.replace(PACKING_ITEM, '');
    return rest.replace(/[\s,;+]/g, '') !== '';
  });
}

// Đọc danh sách kiểu packing list. Có phần nào không đọc được thì không nhận dòng nào.
export function parsePackingList(text, donViKichThuoc = 'cm') {
  const badLine = firstBadLine(text);
  if (badLine) return { kien: [], loi: `Chưa đọc được dòng "${badLine}". ${FORMAT_HINT}` };

  const kien = [];
  for (const [piece, soKien, dai, rong, cao, unit] of text.matchAll(PACKING_ITEM)) {
    const written = unit && UNIT_ALIAS[unit.toLowerCase()];
    if (written && written !== donViKichThuoc) {
      return { kien: [], loi: `Danh sách ghi ${written} nhưng ô đơn vị đang chọn ${donViKichThuoc}. Bạn đổi ô đơn vị hoặc sửa danh sách cho khớp.` };
    }
    const numbers = [soKien, dai, rong, cao].map(parseNumber);
    if (numbers.includes(null)) return { kien: [], loi: `Chưa đọc được phần "${piece.trim()}". ${FORMAT_HINT}` };
    kien.push({ soKien: numbers[0], dai: numbers[1], rong: numbers[2], cao: numbers[3] });
  }
  if (kien.length === 0) return { kien, loi: `Chưa có gì để đọc. ${FORMAT_HINT}` };
  return { kien, loi: null };
}
