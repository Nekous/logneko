// Trang công cụ CBM: danh sách kiện, ô Tổng GW và cách hiện kết quả.
import { calculateCbm, cbmCopyText, cbmSteps, chuaTinhText, formatCbm, lineLabel } from '../calc/cbm.js';
import { formatNumber } from '../core/format.js';
import { renderPackageList, showNumber } from '../core/package-list.js';
import { createField, mountTool, readNumberField } from '../core/tool-shell.js';

const WEIGHT_HINT = 'Trọng lượng không bắt buộc. Chỉ biết tổng của cả lô thì để trống từng dòng và nhập ô Tổng GW bên dưới.';

// Lô B trong bài thực hành: bài học chỉ ghi tổng GW, không ghi từng kiện.
const EXAMPLE = {
  donViKichThuoc: 'cm',
  donViTrongLuong: 'kg',
  tongGw: 84,
  kien: [
    { soKien: 2, dai: 92, rong: 61, cao: 37 },
    { soKien: 1, dai: 78, rong: 63, cao: 40 },
    { soKien: 1, dai: 87, rong: 58, cao: 34 },
  ],
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderInputs(slot, onChange) {
  const list = renderPackageList(slot, onChange, { hint: WEIGHT_HINT });
  const totalGw = createField({ name: 'tong-gw', label: 'Tổng GW', optional: true });
  slot.append(totalGw.wrap);

  return {
    read() {
      const { values, invalid } = list.read();
      const reading = readNumberField(totalGw);
      return { values: { ...values, tongGw: reading.number }, invalid: invalid || reading.invalid };
    },

    fill(example) {
      list.fill(example);
      totalGw.control.value = showNumber(example.tongGw);
    },
  };
}

function resultRow(label, value) {
  const row = el('div');
  row.append(el('dt', '', label), el('dd', '', value));
  return row;
}

function gwRows(value) {
  if (value.gwGhiChu) return [resultRow('Tổng GW', value.gwGhiChu)];
  if (!value.gwCach) return [resultRow('Tổng GW', 'Chưa nhập')];
  return [
    resultRow('Tổng GW (kg)', `${formatNumber(value.gwKg)} kg`),
    resultRow('Tổng GW (lb)', `${formatNumber(value.gwLb)} lb`),
  ];
}

function renderResult(value, box) {
  const total = el('div', 'tool-total');
  total.append(
    el('span', 'tool-total-label', 'Tổng thể tích'),
    el('span', 'tool-total-value', `${formatCbm(value.tongCbm)} CBM`),
  );
  box.append(total);

  if (value.chuaTinh.length > 0) box.append(el('p', 'tool-warning', chuaTinhText(value.chuaTinh)));

  const rows = el('dl', 'tool-rows');
  for (const item of value.dong) {
    rows.append(resultRow(`Dòng ${item.stt}: ${lineLabel(item, value.donViKichThuoc)}`, `${formatCbm(item.cbm)} CBM`));
  }
  rows.append(
    resultRow('Tổng số kiện', formatNumber(value.tongKien)),
    resultRow('Tổng thể tích (ft³)', `${formatNumber(value.tongFt3)} ft³`),
    ...gwRows(value),
  );
  box.append(rows);

  if (value.dong.length > 1) {
    box.append(el('p', 'tool-result-note', 'Tổng được cộng từ số chưa làm tròn, nên có thể lệch một chút so với cộng tay các dòng trên.'));
  }
}

await mountTool({
  id: 'cbm',
  renderInputs,
  example: EXAMPLE,
  calculate: calculateCbm,
  renderResult,
  steps: (values, value) => cbmSteps(value),
  copyText: cbmCopyText,
  transfer: [{
    den: 'chargeable-weight',
    nhan: 'Tính chargeable weight',
    // Chỉ chuyển dòng đủ số, GW luôn tính bằng kg vì công cụ đích dùng kg.
    data: (value) => ({
      donViKichThuoc: value.donViKichThuoc,
      kien: value.dong.map(({ soKien, dai, rong, cao }) => ({ soKien, dai, rong, cao })),
      gw: value.gwKg,
      ghiChuChuyen: value.chuaTinh.length > 0 ? `Chưa chuyển dòng ${value.chuaTinh.join(', ')} vì chưa đủ số.` : '',
    }),
  }],
  stickyTotal: (value) => {
    const rest = value.chuaTinh.length > 0 ? `, chưa tính dòng ${value.chuaTinh.join(', ')}` : '';
    return `Tổng: ${formatCbm(value.tongCbm)} CBM${rest}`;
  },
  note: 'Công thức: CBM = dài × rộng × cao (m) × số kiện. Quy đổi: 1 inch = 2,54 cm; 1 lb = 0,45359237 kg; 1 m³ = 35,3147 ft³. Nút Điền ví dụ dùng Lô B trong bài thực hành môn Air cargo. Kết quả chỉ để tham khảo.',
});
