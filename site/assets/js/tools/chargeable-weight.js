// Trang công cụ chargeable weight: danh sách kiện, GW, loại dịch vụ và cách hiện kết quả.
import { chuaTinhText } from '../calc/cbm.js';
import {
  BEN_THANG_TEXT,
  calculateChargeableWeight,
  chargeableCopyText,
  chargeableSteps,
  formatVw,
} from '../calc/chargeable-weight.js';
import { formatNumber, HAI_SO_LE } from '../core/format.js';
import { renderPackageList, showNumber } from '../core/package-list.js';
import { createField, mountTool, readNumberField } from '../core/tool-shell.js';

const SERVICES = [
  { value: 'hang-bay', label: 'Hãng bay' },
  { value: 'chuyen-phat', label: 'Chuyển phát nhanh' },
];
const ROUNDINGS = [
  { value: '0.5', label: '0,5 kg' },
  { value: '1', label: '1 kg' },
];

// Lô A trong bài thực hành. Bài học không cho đơn giá nên ví dụ để trống.
const EXAMPLE = {
  donViKichThuoc: 'cm',
  gw: 34,
  kien: [
    { soKien: 1, dai: 81, rong: 29, cao: 36 },
    { soKien: 1, dai: 81, rong: 29, cao: 26 },
    { soKien: 1, dai: 81, rong: 29, cao: 31 },
    { soKien: 1, dai: 81, rong: 29, cao: 41 },
  ],
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderInputs(slot, onChange) {
  const list = renderPackageList(slot, onChange, { weights: false });
  const gw = createField({ name: 'gw', label: 'GW', unit: 'kg' });
  const service = createField({ name: 'loai-dich-vu', label: 'Loại dịch vụ', type: 'select', options: SERVICES });
  const rounding = createField({ name: 'lam-tron', label: 'Làm tròn lên', type: 'select', options: ROUNDINGS });
  const minimum = createField({ name: 'muc-toi-thieu', label: 'Mức tối thiểu', unit: 'kg', optional: true });
  const rate = createField({ name: 'don-gia', label: 'Đơn giá', unit: 'USD/kg', optional: true });
  slot.append(gw.wrap, service.wrap, rounding.wrap, minimum.wrap, rate.wrap);

  return {
    read() {
      // Chuyển phát nhanh luôn làm tròn lên 1 kg nên không có ô chọn.
      rounding.wrap.hidden = service.control.value !== 'hang-bay';

      const { values, invalid: listInvalid } = list.read();
      const readings = [gw, minimum, rate].map(readNumberField);
      return {
        values: {
          ...values,
          gw: readings[0].number,
          loaiDichVu: service.control.value,
          lamTron: Number(rounding.control.value),
          mucToiThieu: readings[1].number,
          donGia: readings[2].number,
        },
        invalid: listInvalid || readings.some((reading) => reading.invalid),
      };
    },

    fill(data) {
      list.fill(data);
      gw.control.value = showNumber(data.gw);
      service.control.value = SERVICES[0].value;
      rounding.control.value = ROUNDINGS[0].value;
      minimum.control.value = '';
      rate.control.value = '';
    },
  };
}

function resultRow(label, value) {
  const row = el('div');
  row.append(el('dt', '', label), el('dd', '', value));
  return row;
}

function renderResult(value, box) {
  const total = el('div', 'tool-total');
  total.append(
    el('span', 'tool-total-label', 'Chargeable weight (CW)'),
    el('span', 'tool-total-value', `${formatNumber(value.cw)} kg`),
  );
  box.append(total);

  if (value.theoToiThieu) box.append(el('p', 'tool-result-note', 'Tính theo mức tối thiểu.'));
  if (value.chuaTinh.length > 0) box.append(el('p', 'tool-warning', chuaTinhText(value.chuaTinh)));

  const rows = el('dl', 'tool-rows');
  rows.append(
    resultRow('Bên thắng', BEN_THANG_TEXT[value.benThang]),
    resultRow('GW', `${formatNumber(value.gw)} kg`),
    resultRow(`VW (÷ ${value.heSo})`, `${formatVw(value.vw)} kg`),
    resultRow('Tổng thể tích', `${formatNumber(value.tongCm3)} cm³`),
  );
  if (value.cuoc !== null) {
    rows.append(resultRow('Cước ước tính', `${formatNumber(value.cuoc, HAI_SO_LE)} USD`));
  }
  box.append(rows);
}

await mountTool({
  id: 'chargeable-weight',
  renderInputs,
  example: EXAMPLE,
  calculate: calculateChargeableWeight,
  renderResult,
  steps: (values, value) => chargeableSteps(value),
  copyText: chargeableCopyText,
  stickyTotal: (value) => {
    const rest = value.chuaTinh.length > 0 ? `, chưa tính dòng ${value.chuaTinh.join(', ')}` : '';
    return `CW: ${formatNumber(value.cw)} kg${rest}`;
  },
  note: 'Công thức: VW = dài × rộng × cao (cm) ÷ 6000 với hãng bay, ÷ 5000 với chuyển phát nhanh; CW là số lớn hơn giữa GW và VW, làm tròn lên. Bậc làm tròn và mức tối thiểu tùy hãng (45 kg hoặc 100 kg là mức thường gặp), một số hãng chuyển phát nhanh dùng hệ số thấp hơn 5000, nên bạn hỏi lại hãng trước khi báo giá. Cước ước tính chưa gồm phụ phí. Nút Điền ví dụ dùng Lô A trong bài thực hành môn Air cargo. Kết quả chỉ để tham khảo.',
});
