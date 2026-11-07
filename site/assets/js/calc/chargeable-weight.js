// Công thức chargeable weight hàng air. Hàm thuần, chạy được cả trong test.
import { formatNumber, HAI_SO_LE } from '../core/format.js';
import { calculateCbm, chuaTinhText, CM_PER_UNIT } from './cbm.js';

const DIVISOR = { 'hang-bay': 6000, 'chuyen-phat': 5000 };
const COURIER_STEP = 1;
// Sai số nhỏ của máy tính không được đẩy 52,5 lên 53, hay làm GW và VW thành khác nhau.
const EPSILON = 1e-9;
const STEP_DECIMALS = { toiDa: 4 };
const SIZE_DECIMALS = { toiDa: 6 };
// Đơn giá hiện ít nhất 2 số lẻ nhưng giữ đủ số đã nhập, để phép nhân trong cách tính khớp kết quả.
const UNIT_PRICE_DECIMALS = { toiThieu: 2, toiDa: 10 };

export const BEN_THANG_TEXT = {
  nang: 'Hàng nặng',
  'cong-kenh': 'Hàng cồng kềnh',
  'bang-nhau': 'Bằng nhau',
};

export function formatVw(value) {
  return formatNumber(value, { toiDa: 2 });
}

function roundUp(value, step) {
  return Math.ceil(value / step - EPSILON) * step;
}

function winner(gw, vw) {
  if (Math.abs(gw - vw) < EPSILON) return 'bang-nhau';
  return gw > vw ? 'nang' : 'cong-kenh';
}

function inputError({ gw, mucToiThieu, donGia }) {
  if (gw !== null && gw <= 0) return 'GW phải lớn hơn 0.';
  if (mucToiThieu !== null && mucToiThieu <= 0) return 'Mức tối thiểu phải lớn hơn 0, không có thì để trống.';
  if (donGia !== null && donGia <= 0) return 'Đơn giá phải lớn hơn 0, không có thì để trống.';
  return '';
}

// Trả về null khi chưa có GW hoặc chưa có dòng nào đủ số, { loi } khi số liệu sai.
export function calculateChargeableWeight({
  kien,
  donViKichThuoc = 'cm',
  gw = null,
  loaiDichVu = 'hang-bay',
  lamTron = 0.5,
  mucToiThieu = null,
  donGia = null,
}) {
  const volume = calculateCbm({ kien, donViKichThuoc });
  if (volume?.loi) return volume;

  const error = inputError({ gw, mucToiThieu, donGia });
  if (error) return { loi: error };
  if (!volume || gw === null) return null;

  const heSo = DIVISOR[loaiDichVu];
  const buoc = loaiDichVu === 'chuyen-phat' ? COURIER_STEP : lamTron;
  const vw = volume.tongCm3 / heSo;
  const cwLamTron = roundUp(Math.max(gw, vw), buoc);
  const theoToiThieu = mucToiThieu !== null && cwLamTron < mucToiThieu;
  const cw = theoToiThieu ? mucToiThieu : cwLamTron;
  const cuoc = donGia === null ? null : cw * donGia;

  if (![cw, cuoc ?? 0].every(Number.isFinite)) {
    return { loi: 'Số quá lớn nên không tính được. Bạn xem lại các ô đã nhập.' };
  }

  return {
    dong: volume.dong,
    chuaTinh: volume.chuaTinh,
    donViKichThuoc,
    tongCm3: volume.tongCm3,
    loaiDichVu,
    heSo,
    buoc,
    gw,
    vw,
    benThang: winner(gw, vw),
    cwLamTron,
    mucToiThieu,
    theoToiThieu,
    cw,
    donGia,
    cuoc,
  };
}

export function chargeableSteps(result) {
  const { dong, donViKichThuoc, gw, vw, buoc, heSo, cw, cwLamTron, mucToiThieu, donGia, cuoc } = result;
  const steps = [];
  const cmPerUnit = CM_PER_UNIT[donViKichThuoc];

  if (donViKichThuoc === 'm') steps.push('Đổi kích thước sang cm: 1 m = 100 cm.');
  if (donViKichThuoc === 'inch') steps.push('Đổi kích thước sang cm: 1 inch = 2,54 cm.');

  for (const item of dong) {
    const size = [item.dai, item.rong, item.cao]
      .map((value) => formatNumber(value * cmPerUnit, SIZE_DECIMALS))
      .join(' × ');
    steps.push(`Dòng ${item.stt}: ${size} × ${formatNumber(item.soKien)} = ${formatNumber(item.cm3, SIZE_DECIMALS)} cm³.`);
  }
  if (dong.length > 1) steps.push(`Tổng thể tích: ${formatNumber(result.tongCm3, SIZE_DECIMALS)} cm³.`);

  steps.push(`VW = ${formatNumber(result.tongCm3, SIZE_DECIMALS)} ÷ ${heSo} = ${formatNumber(vw, STEP_DECIMALS)} kg.`);
  steps.push(`So GW ${formatNumber(gw, STEP_DECIMALS)} kg với VW ${formatNumber(vw, STEP_DECIMALS)} kg, lấy số lớn hơn: ${formatNumber(Math.max(gw, vw), STEP_DECIMALS)} kg.`);
  steps.push(`Làm tròn lên theo bậc ${formatNumber(buoc)} kg: ${formatNumber(cwLamTron)} kg.`);

  if (mucToiThieu !== null) {
    const compare = result.theoToiThieu
      ? `${formatNumber(cwLamTron)} kg thấp hơn mức tối thiểu ${formatNumber(mucToiThieu)} kg, nên CW = ${formatNumber(cw)} kg.`
      : `${formatNumber(cwLamTron)} kg không thấp hơn mức tối thiểu ${formatNumber(mucToiThieu)} kg, nên giữ nguyên.`;
    steps.push(compare);
  }
  if (cuoc !== null) {
    steps.push(`Cước ước tính: ${formatNumber(cw)} × ${formatNumber(donGia, UNIT_PRICE_DECIMALS)} = ${formatNumber(cuoc, HAI_SO_LE)} USD.`);
  }
  return steps;
}

export function chargeableCopyText(result) {
  const lines = [
    `CW: ${formatNumber(result.cw)} kg (${BEN_THANG_TEXT[result.benThang]})`,
    `GW: ${formatNumber(result.gw)} kg`,
    `VW: ${formatVw(result.vw)} kg (÷ ${result.heSo})`,
  ];
  if (result.theoToiThieu) lines.push('Tính theo mức tối thiểu');
  if (result.cuoc !== null) lines.push(`Cước ước tính: ${formatNumber(result.cuoc, HAI_SO_LE)} USD`);
  if (result.chuaTinh.length > 0) lines.push(chuaTinhText(result.chuaTinh));
  return lines.join('\n');
}
