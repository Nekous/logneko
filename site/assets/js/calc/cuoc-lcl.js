// Công thức cước LCL theo W/M. Hàm thuần, chạy được cả trong test.
import { formatNumber, HAI_SO_LE } from '../core/format.js';
import { formatCbm } from './cbm.js';

const KG_PER_TON = 1000;
// Sai số nhỏ của máy tính không được làm CBM và tấn thành khác nhau.
const EPSILON = 1e-9;
// Kết quả hiện RT tối đa 3 số lẻ; cách tính giữ đủ số để phép nhân khớp kết quả.
const RT_DECIMALS = { toiDa: 3 };
const STEP_DECIMALS = { toiDa: 6 };
const PRICE_DECIMALS = { toiThieu: 2, toiDa: 10 };

// Chữ ngắn cho hàng "Tính theo" trong kết quả; câu đầy đủ cho cách tính và Copy.
export const BEN_THANG_TEXT = {
  'the-tich': 'Thể tích',
  'trong-luong': 'Trọng lượng',
  'bang-nhau': 'Bằng nhau',
};

const BEN_THANG_CAU = {
  'the-tich': 'tính theo thể tích',
  'trong-luong': 'tính theo trọng lượng',
  'bang-nhau': 'thể tích và trọng lượng bằng nhau',
};

export const CACH_TINH_TEXT = { rt: 'theo RT', lo: 'theo lô' };

// Phí đầu xuất đứng trước phí đầu nhập, ở mọi chỗ hiện ra.
export const DAU = ['xuat', 'nhap'];
export const DAU_TEXT = { xuat: 'Phí đầu xuất', nhap: 'Phí đầu nhập' };
const DAU_NGAN = { xuat: 'đầu xuất', nhap: 'đầu nhập' };

export function formatRt(value) {
  return formatNumber(value, RT_DECIMALS);
}

export function formatUsd(value) {
  return `${formatNumber(value, HAI_SO_LE)} USD`;
}

function winner(cbm, tan) {
  if (Math.abs(cbm - tan) < EPSILON) return 'bang-nhau';
  return cbm > tan ? 'the-tich' : 'trong-luong';
}

function inputError({ tongCbm, gw, donGia, mucToiThieu }) {
  if (tongCbm !== null && tongCbm <= 0) return 'Tổng CBM phải lớn hơn 0.';
  if (gw !== null && gw <= 0) return 'Tổng GW phải lớn hơn 0.';
  if (donGia !== null && donGia <= 0) return 'Đơn giá phải lớn hơn 0, không có thì để trống.';
  if (mucToiThieu !== null && mucToiThieu <= 0) return 'Mức tối thiểu phải lớn hơn 0, không áp thì để trống.';
  return '';
}

// Dòng trống bỏ qua; có tên mà chưa có số tiền thì chưa tính; số tiền sai thì báo lỗi.
function readFees(phi, dau) {
  const dong = [];
  const chuaTinh = [];
  for (const [index, item] of phi.entries()) {
    const stt = index + 1;
    const ten = (item.ten ?? '').trim();
    const soTien = item.soTien ?? null;
    if (soTien === null) {
      if (ten) chuaTinh.push({ dau, stt });
      continue;
    }
    if (soTien <= 0) return { loi: `${DAU_TEXT[dau]} dòng ${stt} phải lớn hơn 0, không có thì để trống.` };
    dong.push({ stt, ten: ten || `Phí dòng ${stt}`, soTien, cachTinh: item.cachTinh === 'lo' ? 'lo' : 'rt' });
  }
  return { dong, chuaTinh };
}

// Mỗi khoản tiền làm tròn tới 0,01 USD trước khi cộng, như khi lập hóa đơn, để phép cộng trên trang luôn khớp.
// Nhân thêm (1 + EPSILON) để 1,005 thành 1,01 chứ không thành 1,00 do sai số của máy tính.
export function roundCents(value) {
  return Math.round(value * 100 * (1 + Number.EPSILON)) / 100;
}

const sum = (values) => roundCents(values.reduce((total, value) => total + value, 0));

// Trả về null khi chưa có CBM hoặc GW, { loi } khi số liệu sai.
export function calculateLcl({ tongCbm = null, gw = null, donGia = null, mucToiThieu = null, phiXuat = [], phiNhap = [] }) {
  const error = inputError({ tongCbm, gw, donGia, mucToiThieu });
  if (error) return { loi: error };

  const fees = { xuat: readFees(phiXuat, 'xuat'), nhap: readFees(phiNhap, 'nhap') };
  const feeError = DAU.map((dau) => fees[dau].loi).find(Boolean);
  if (feeError) return { loi: feeError };
  if (tongCbm === null || gw === null) return null;

  const tan = gw / KG_PER_TON;
  const rtTruocToiThieu = Math.max(tongCbm, tan);
  const theoToiThieu = mucToiThieu !== null && rtTruocToiThieu < mucToiThieu - EPSILON;
  const rt = theoToiThieu ? mucToiThieu : rtTruocToiThieu;
  const cuocBien = donGia === null ? null : roundCents(rt * donGia);

  const priced = (dau) => fees[dau].dong.map((item) => ({
    ...item,
    thanhTien: roundCents(item.cachTinh === 'lo' ? item.soTien : item.soTien * rt),
  }));
  const dongPhiXuat = priced('xuat');
  const dongPhiNhap = priced('nhap');
  const tongPhiXuat = sum(dongPhiXuat.map((item) => item.thanhTien));
  const tongPhiNhap = sum(dongPhiNhap.map((item) => item.thanhTien));
  const coPhi = dongPhiXuat.length + dongPhiNhap.length > 0;
  const tongChiPhi = cuocBien !== null && coPhi ? sum([cuocBien, tongPhiXuat, tongPhiNhap]) : null;

  if (![rt, cuocBien ?? 0, tongPhiXuat, tongPhiNhap, tongChiPhi ?? 0].every(Number.isFinite)) {
    return { loi: 'Số quá lớn nên không tính được. Bạn xem lại các ô đã nhập.' };
  }

  return {
    tongCbm,
    gw,
    tan,
    benThang: winner(tongCbm, tan),
    rtTruocToiThieu,
    mucToiThieu,
    theoToiThieu,
    rt,
    donGia,
    cuocBien,
    dongPhiXuat,
    dongPhiNhap,
    tongPhiXuat,
    tongPhiNhap,
    chuaTinh: [...fees.xuat.chuaTinh, ...fees.nhap.chuaTinh],
    tongChiPhi,
  };
}

// Các phí của một đầu: { dong, tong }, để trang, cách tính và Copy hiện cùng một thứ tự.
export function feeGroups(result) {
  return [
    { dau: 'xuat', dong: result.dongPhiXuat, tong: result.tongPhiXuat },
    { dau: 'nhap', dong: result.dongPhiNhap, tong: result.tongPhiNhap },
  ].filter((group) => group.dong.length > 0);
}

export function chuaTinhPhiText(chuaTinh) {
  const parts = DAU
    .map((dau) => [dau, chuaTinh.filter((item) => item.dau === dau).map((item) => item.stt)])
    .filter(([, stts]) => stts.length > 0)
    .map(([dau, stts]) => `${DAU_NGAN[dau]} dòng ${stts.join(', ')}`);
  return `Phí ${parts.join(', phí ')} chưa có số tiền, chưa tính vào tổng.`;
}

function feeStep(item, rt) {
  if (item.cachTinh === 'lo') return `${item.ten}: ${formatUsd(item.thanhTien)} (theo lô).`;
  return `${item.ten}: ${formatNumber(rt, STEP_DECIMALS)} × ${formatNumber(item.soTien, PRICE_DECIMALS)} = ${formatUsd(item.thanhTien)} (theo RT).`;
}

const money = (value) => formatNumber(value, HAI_SO_LE);

export function lclSteps(result) {
  const { tongCbm, gw, tan, benThang, rtTruocToiThieu, mucToiThieu, theoToiThieu, rt, donGia, cuocBien, tongChiPhi } = result;
  const step = (value) => formatNumber(value, STEP_DECIMALS);
  const steps = [
    `Đổi GW sang tấn (quy ước 1 CBM tương đương 1 tấn): ${step(gw)} ÷ ${KG_PER_TON} = ${step(tan)} tấn.`,
    `So ${step(tongCbm)} CBM với ${step(tan)} tấn, lấy số lớn hơn: ${step(rtTruocToiThieu)} RT (${BEN_THANG_CAU[benThang]}).`,
  ];

  if (mucToiThieu !== null) {
    steps.push(theoToiThieu
      ? `${step(rtTruocToiThieu)} RT thấp hơn mức tối thiểu ${step(mucToiThieu)} RT, nên RT = ${step(rt)}.`
      : `${step(rtTruocToiThieu)} RT không thấp hơn mức tối thiểu ${step(mucToiThieu)} RT, nên giữ nguyên.`);
  }
  if (cuocBien !== null) {
    steps.push(`Cước biển: ${step(rt)} × ${formatNumber(donGia, PRICE_DECIMALS)} = ${formatUsd(cuocBien)}.`);
  }

  const groups = feeGroups(result);
  for (const { dau, dong, tong } of groups) {
    for (const item of dong) steps.push(`${DAU_TEXT[dau]}, ${feeStep(item, rt)}`);
    if (dong.length > 1) {
      steps.push(`Cộng ${DAU_TEXT[dau].toLowerCase()}: ${dong.map((item) => money(item.thanhTien)).join(' + ')} = ${formatUsd(tong)}.`);
    }
  }
  if (tongChiPhi !== null) {
    const parts = [`cước biển ${money(cuocBien)}`, ...groups.map(({ dau, tong }) => `${DAU_NGAN[dau]} ${money(tong)}`)];
    steps.push(`Tổng chi phí: ${parts.join(' + ')} = ${formatUsd(tongChiPhi)}.`);
  }
  return steps;
}

export function lclCopyText(result) {
  const lines = [
    `RT: ${formatRt(result.rt)} (${BEN_THANG_CAU[result.benThang]})`,
    `Tổng CBM: ${formatCbm(result.tongCbm)} CBM`,
    `Tổng GW: ${formatNumber(result.gw)} kg (${formatNumber(result.tan)} tấn)`,
  ];
  if (result.theoToiThieu) lines.push('Tính theo mức tối thiểu');
  if (result.cuocBien !== null) lines.push(`Cước biển: ${formatUsd(result.cuocBien)}`);
  for (const { dau, dong, tong } of feeGroups(result)) {
    lines.push(`${DAU_TEXT[dau]}: ${formatUsd(tong)}`);
    for (const item of dong) lines.push(`- ${item.ten} (${CACH_TINH_TEXT[item.cachTinh]}): ${formatUsd(item.thanhTien)}`);
  }
  if (result.tongChiPhi !== null) lines.push(`Tổng chi phí: ${formatUsd(result.tongChiPhi)}`);
  if (result.chuaTinh.length > 0) lines.push(chuaTinhPhiText(result.chuaTinh));
  return lines.join('\n');
}
