// Danh sách phí cộng thêm của một đầu (xuất hoặc nhập): tên phí, số tiền và cách tính theo RT hay theo lô.
import { attachCombobox } from './combobox.js';
import { showNumber } from './package-list.js';
import { createField, readNumberField } from './tool-shell.js';

const SHORT_ERROR = 'Chưa đọc được';
const BASES = [
  { value: 'rt', label: 'Theo RT' },
  { value: 'lo', label: 'Theo lô' },
];
// Chữ ngắn để danh sách gợi ý vẫn gọn trên màn hình 360 px.
const BASIS_HINT = Object.fromEntries(BASES.map(({ value, label }) => [value, label]));

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

// idPrefix giữ id các ô không trùng khi một trang có hai danh sách; items là tên phí để gợi ý.
export function renderFeeList(slot, onChange, { title, idPrefix, items = [], hint } = {}) {
  const list = el('div', 'pkg-list');
  const rows = [];
  let nextId = 1;

  const renumber = () => {
    rows.forEach((row, index) => {
      const name = `${title}: phí ${index + 1}`;
      row.title.textContent = `Phí ${index + 1}`;
      row.node.setAttribute('aria-label', name);
      row.remove.setAttribute('aria-label', `Xóa ${name.toLowerCase()}`);
      row.combo.setLabel(`Danh sách tên phí thường gặp cho ${name.toLowerCase()}`);
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
    const id = `${idPrefix}-${nextId}`;
    nextId += 1;
    const node = el('div', 'pkg-row');
    node.setAttribute('role', 'group');

    const head = el('div', 'pkg-row-head');
    const rowTitle = el('span', 'pkg-row-title');
    const row = { node, title: rowTitle };
    row.remove = button('Xóa', () => removeRow(row));
    head.append(rowTitle, row.remove);

    row.name = createField({ name: `ten-phi-${id}`, label: 'Tên phí', type: 'text' });
    row.amount = createField({ name: `so-tien-${id}`, label: 'Số tiền (USD)', errorText: SHORT_ERROR });
    row.basis = createField({ name: `cach-tinh-${id}`, label: 'Cách tính', type: 'select', options: BASES });
    row.name.control.value = values.ten ?? '';
    row.amount.control.value = showNumber(values.soTien);
    row.basis.control.value = values.cachTinh ?? BASES[0].value;

    // Chọn phí trong danh sách thì cách tính đổi theo phí đó; người dùng vẫn sửa lại được.
    row.combo = attachCombobox(row.name, {
      items,
      describe: (muc) => BASIS_HINT[muc.cach_tinh],
      toggleLabel: 'Danh sách phí thường gặp',
      onPick: (muc) => { row.basis.control.value = muc.cach_tinh; },
      onChange,
    });

    const cells = el('div', 'fee-cells');
    cells.append(row.name.wrap, row.amount.wrap, row.basis.wrap);
    node.append(head, cells);
    list.append(node);
    rows.push(row);
    return row;
  }

  const addButton = button('Thêm phí', () => {
    const row = addRow();
    renumber();
    row.name.control.focus();
    onChange();
  });
  addButton.setAttribute('aria-label', `Thêm ${title.toLowerCase()}`);
  const addRowBar = el('div', 'tool-actions');
  addRowBar.append(addButton);

  slot.append(el('h2', 'fee-title', `${title}, tùy chọn`));
  if (hint) slot.append(el('p', 'pkg-hint', hint));
  slot.append(list, addRowBar);

  addRow();
  renumber();

  return {
    read() {
      let invalid = false;
      const phi = rows.map((row) => {
        const reading = readNumberField(row.amount);
        if (reading.invalid) invalid = true;
        return { ten: row.name.control.value, soTien: reading.number, cachTinh: row.basis.control.value };
      });
      return { phi, invalid };
    },

    fill(phi = []) {
      for (const row of rows.splice(0)) row.node.remove();
      for (const values of phi) addRow(values);
      if (rows.length === 0) addRow();
      renumber();
    },
  };
}
