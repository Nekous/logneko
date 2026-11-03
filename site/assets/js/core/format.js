// Đọc và hiện số theo kiểu Việt Nam. Hàm thuần, chạy được cả trong test.

const WHOLE = /^\d+(?:\.\d{3})*$/;
const SHORT_GROUP = /^(\d+)\.(\d{1,2})$/;
const DEFAULT_MAX_DECIMALS = 4;

// Kết quả nào cần ,00 thì truyền vào formatNumber, ví dụ số tiền: 60,00.
export const HAI_SO_LE = { toiThieu: 2, toiDa: 2 };

// Dấu chấm luôn ngăn phần nghìn, dấu phẩy luôn ngăn phần thập phân.
// Trả về số, hoặc null nếu ô trống hay viết sai dấu, để NaN không lọt xuống phép tính.
export function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const text = String(value ?? '').replace(/\s/g, '');
  const match = /^(-?)([\d.,]+)$/.exec(text);
  if (!match) return null;
  const [, sign, body] = match;

  const [written, fraction = '', ...extra] = body.split(',');
  if (extra.length > 0 || fraction.includes('.')) return null;

  // Phần nghìn viết thiếu thì bù số 0: 52.5 là 52.500. Có phần thập phân thì phải viết đủ.
  const short = body.includes(',') ? null : SHORT_GROUP.exec(written);
  const whole = short ? `${short[1]}.${short[2].padEnd(3, '0')}` : written;
  if (whole && !WHOLE.test(whole)) return null;

  const number = Number(`${sign}${whole.replace(/\./g, '')}.${fraction}`);
  return Number.isFinite(number) ? number : null;
}

export function formatNumber(value, { toiDa = DEFAULT_MAX_DECIMALS, toiThieu = 0 } = {}) {
  if (!Number.isFinite(value)) return '—';
  const text = value.toLocaleString('vi-VN', {
    minimumFractionDigits: toiThieu,
    maximumFractionDigits: Math.max(toiDa, toiThieu),
  });
  // Số âm rất nhỏ làm tròn thành 0 thì bỏ dấu trừ.
  return /^-0(,0*)?$/.test(text) ? text.slice(1) : text;
}
