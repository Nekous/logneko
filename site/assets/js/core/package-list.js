// Danh sách kiện dùng chung: đơn vị, các dòng kiện và ô dán nhanh kiểu packing list.
import { parsePackingList } from '../calc/cbm.js';
import { formatNumber } from './format.js';
import { createField, readNumberField } from './tool-shell.js';

const SHORT_ERROR = 'Chưa đọc được';
const FILL_DECIMALS = { toiDa: 10 };
const COUNT_FIELD = { key: 'soKien', label: 'Số kiện' };
const WEIGHT_FIELD = { key: 'trongLuong', label: 'Trọng lượng mỗi kiện' };
const SIZE_FIELDS = [
  { key: 'dai', label: 'Dài' },
  { key: 'rong', label: 'Rộng' },
  { key: 'cao', label: 'Cao' },
];
const SIZE_UNITS = ['cm', 'm', 'inch'];
const WEIGHT_UNITS = ['kg', 'lb'];

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

// Số đưa vào ô phải viết theo kiểu Việt Nam, vì ô đọc dấu chấm là phần nghìn.
export function showNumber(value) {
  return value === null || value === undefined ? '' : formatNumber(value, FILL_DECIMALS);
}

// Công cụ nào không cần trọng lượng từng kiện thì truyền weights: false.
export function renderPackageList(slot, onChange, { weights = true, hint } = {}) {
  const lineFields = [COUNT_FIELD, ...(weights ? [WEIGHT_FIELD] : []), ...SIZE_FIELDS];

  const sizeUnit = unitField('don-vi-kich-thuoc', 'Đơn vị kích thước', SIZE_UNITS);
  const weightUnit = weights ? unitField('don-vi-trong-luong', 'Đơn vị trọng lượng', WEIGHT_UNITS) : null;
  const units = el('div', 'pkg-units');
  units.append(sizeUnit.wrap);
  if (weightUnit) units.append(weightUnit.wrap);

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
    for (const { key, label } of lineFields) {
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

  slot.append(units);
  if (hint) slot.append(el('p', 'pkg-hint', hint));
  slot.append(list, addRowBar, pasteArea.wrap, pasteBar, pasteStatus);

  addRow();
  renumber();

  return {
    read() {
      let invalid = false;
      const kien = rows.map((row) => Object.fromEntries(
        lineFields.map(({ key }) => {
          const reading = readNumberField(row.cells[key]);
          if (reading.invalid) invalid = true;
          return [key, reading.number];
        }),
      ));

      const values = { donViKichThuoc: sizeUnit.control.value, kien };
      if (weightUnit) values.donViTrongLuong = weightUnit.control.value;
      return { values, invalid };
    },

    fill(data) {
      sizeUnit.control.value = data.donViKichThuoc;
      if (weightUnit) weightUnit.control.value = data.donViTrongLuong ?? WEIGHT_UNITS[0];
      for (const row of rows.splice(0)) row.node.remove();
      for (const values of data.kien) addRow(values);
      if (rows.length === 0) addRow();
      renumber();
      pasteArea.control.value = '';
      setPasteStatus('');
    },
  };
}
