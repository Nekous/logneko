// Trang công cụ CBM: danh sách kiện, dán nhanh và cách hiện kết quả.
import { calculateCbm, cbmCopyText, cbmSteps, chuaTinhText, formatCbm, lineLabel, parsePackingList } from '../calc/cbm.js';
import { formatNumber } from '../core/format.js';
import { createField, mountTool, readNumberField } from '../core/tool-shell.js';

const SHORT_ERROR = 'Chưa đọc được';
const FILL_DECIMALS = { toiDa: 10 };
const LINE_FIELDS = [
  { key: 'soKien', label: 'Số kiện' },
  { key: 'trongLuong', label: 'Trọng lượng mỗi kiện' },
  { key: 'dai', label: 'Dài' },
  { key: 'rong', label: 'Rộng' },
  { key: 'cao', label: 'Cao' },
];
const SIZE_UNITS = ['cm', 'm', 'inch'];
const WEIGHT_UNITS = ['kg', 'lb'];

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

function button(text, onClick) {
  const node = el('button', 'btn', text);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

function unitField(name, label, units) {
  return createField({ name, label, type: 'select', options: units.map((unit) => ({ value: unit, label: unit })) });
}

function showNumber(value) {
  return value === null || value === undefined ? '' : formatNumber(value, FILL_DECIMALS);
}

function renderPackageInputs(slot, onChange) {
  const sizeUnit = unitField('don-vi-kich-thuoc', 'Đơn vị kích thước', SIZE_UNITS);
  const weightUnit = unitField('don-vi-trong-luong', 'Đơn vị trọng lượng', WEIGHT_UNITS);
  const units = el('div', 'pkg-units');
  units.append(sizeUnit.wrap, weightUnit.wrap);

  const list = el('div', 'pkg-list');
  const rows = [];
  let nextId = 1;

  const renumber = () => {
    rows.forEach((row, index) => {
      const name = `Dòng ${index + 1}`;
      row.title.textContent = name;
      row.node.setAttribute('aria-label', name);
      row.remove.setAttribute('aria-label', `Xóa dòng ${index + 1}`);
    });
  };

  const removeRow = (row) => {
    rows.splice(rows.indexOf(row), 1);
    row.node.remove();
    if (rows.length === 0) addRow();
    renumber();
    addButton.focus();
    onChange();
  };

  function addRow(values = {}) {
    const id = nextId;
    nextId += 1;
    const node = el('div', 'pkg-row');
    node.setAttribute('role', 'group');

    const head = el('div', 'pkg-row-head');
    const title = el('span', 'pkg-row-title');
    const row = { node, title, cells: {} };
    row.remove = button('Xóa', () => removeRow(row));
    head.append(title, row.remove);

    const cells = el('div', 'pkg-cells');
    for (const { key, label } of LINE_FIELDS) {
      const item = createField({ name: `${key}-${id}`, label, errorText: SHORT_ERROR });
      item.wrap.dataset.cell = key;
      item.control.value = showNumber(values[key]);
      row.cells[key] = item;
      cells.append(item.wrap);
    }

    node.append(head, cells);
    list.append(node);
    rows.push(row);
    return row;
  }

  const isBlank = (row) => Object.values(row.cells).every(({ control }) => control.value.trim() === '');

  const addButton = button('Thêm dòng', () => {
    const row = addRow();
    renumber();
    row.cells.soKien.control.focus();
    onChange();
  });
  const addRowBar = el('div', 'tool-actions');
  addRowBar.append(addButton);

  const pasteArea = createField({ name: 'dan-nhanh', label: 'Dán nhanh kiểu packing list', type: 'textarea', rows: 3, placeholder: '2(92*61*37)\n1(78*63*40)' });
  const pasteStatus = el('p', 'pkg-paste-status');
  pasteStatus.setAttribute('role', 'status');
  pasteStatus.hidden = true;

  const setPasteStatus = (text, isError = false) => {
    pasteStatus.textContent = text;
    pasteStatus.hidden = !text;
    pasteStatus.classList.toggle('is-error', isError);
    if (isError) pasteArea.control.setAttribute('aria-invalid', 'true');
    else pasteArea.control.removeAttribute('aria-invalid');
  };

  const pasteButton = button('Đưa vào danh sách', () => {
    const { kien, loi } = parsePackingList(pasteArea.control.value, sizeUnit.control.value);
    if (loi) {
      setPasteStatus(loi, true);
      return;
    }
    for (const row of rows.filter(isBlank)) {
      rows.splice(rows.indexOf(row), 1);
      row.node.remove();
    }
    for (const values of kien) addRow(values);
    renumber();
    pasteArea.control.value = '';
    setPasteStatus(`Đã thêm ${kien.length} dòng vào danh sách.`);
    onChange();
  });
  const pasteBar = el('div', 'tool-actions');
  pasteBar.append(pasteButton);

  const totalGw = createField({ name: 'tong-gw', label: 'Tổng GW', optional: true });
  const unitHint = el('p', 'pkg-hint', 'Trọng lượng không bắt buộc. Chỉ biết tổng của cả lô thì để trống từng dòng và nhập ô Tổng GW bên dưới.');

  slot.append(units, unitHint, list, addRowBar, pasteArea.wrap, pasteBar, pasteStatus, totalGw.wrap);

  addRow();
  renumber();

  return {
    read() {
      let invalid = false;
      const readCell = (item) => {
        const reading = readNumberField(item);
        if (reading.invalid) invalid = true;
        return reading.number;
      };

      const kien = rows.map((row) => Object.fromEntries(
        LINE_FIELDS.map(({ key }) => [key, readCell(row.cells[key])]),
      ));
      const tongGw = readCell(totalGw);

      return {
        values: {
          donViKichThuoc: sizeUnit.control.value,
          donViTrongLuong: weightUnit.control.value,
          kien,
          tongGw,
        },
        invalid,
      };
    },

    fill(example) {
      sizeUnit.control.value = example.donViKichThuoc;
      weightUnit.control.value = example.donViTrongLuong;
      for (const row of rows.splice(0)) row.node.remove();
      for (const values of example.kien) addRow(values);
      renumber();
      totalGw.control.value = showNumber(example.tongGw);
      pasteArea.control.value = '';
      setPasteStatus('');
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
  renderInputs: renderPackageInputs,
  example: EXAMPLE,
  calculate: calculateCbm,
  renderResult,
  steps: (values, value) => cbmSteps(value),
  copyText: cbmCopyText,
  stickyTotal: (value) => {
    const rest = value.chuaTinh.length > 0 ? `, chưa tính dòng ${value.chuaTinh.join(', ')}` : '';
    return `Tổng: ${formatCbm(value.tongCbm)} CBM${rest}`;
  },
  note: 'Công thức: CBM = dài × rộng × cao (m) × số kiện. Quy đổi: 1 inch = 2,54 cm; 1 lb = 0,45359237 kg; 1 m³ = 35,3147 ft³. Nút Điền ví dụ dùng Lô B trong bài thực hành môn Air cargo. Kết quả chỉ để tham khảo.',
});
