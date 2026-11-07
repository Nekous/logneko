// Ô chữ có danh sách gợi ý: mũi tên để sổ danh sách, gõ thì lọc và điền tiếp phần còn thiếu.
// Enter hoặc Tab nhận gợi ý; phím cách vẫn gõ bình thường. Tên ngoài danh sách vẫn gõ được.
import { phanHoanThanh, timGoiY } from './goi-y.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// item là ô tạo bởi createField({ type: 'text' }); onPick nhận mục vừa chọn; onChange báo trang tính lại.
export function attachCombobox(item, { items, describe, toggleLabel, onPick, onChange }) {
  const { control } = item;
  const box = el('div', 'combo');
  const toggle = el('button', 'combo-toggle');
  const list = el('ul', 'combo-list');
  list.id = `${control.id}-ds`;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', toggleLabel);
  list.hidden = true;

  toggle.type = 'button';
  toggle.tabIndex = -1;
  toggle.setAttribute('aria-label', toggleLabel);
  toggle.setAttribute('aria-controls', list.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.append(el('span', 'combo-arrow'));
  toggle.firstChild.setAttribute('aria-hidden', 'true');

  control.setAttribute('role', 'combobox');
  control.setAttribute('aria-autocomplete', 'both');
  control.setAttribute('aria-controls', list.id);
  control.setAttribute('aria-expanded', 'false');

  control.replaceWith(box);
  box.append(control, toggle, list);

  let matches = [];
  let active = -1;
  // Số chữ người dùng tự gõ khi máy đang điền tiếp; null là không có phần điền tiếp chờ nhận.
  let typedLength = null;

  const sameName = (text, muc) => text.trim().toLowerCase() === muc.ten.toLowerCase();

  const setActive = (index) => {
    active = index;
    [...list.children].forEach((option, i) => option.setAttribute('aria-selected', String(i === active)));
    if (active >= 0) {
      control.setAttribute('aria-activedescendant', list.children[active].id);
      list.children[active].scrollIntoView({ block: 'nearest' });
    } else {
      control.removeAttribute('aria-activedescendant');
    }
  };

  const close = () => {
    list.hidden = true;
    matches = [];
    control.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-expanded', 'false');
    setActive(-1);
  };

  const open = (found, index = -1) => {
    matches = found;
    if (matches.length === 0) return close();
    list.replaceChildren(...matches.map((muc, i) => {
      const option = el('li', 'combo-option');
      option.id = `${list.id}-${i}`;
      option.setAttribute('role', 'option');
      option.append(el('span', 'combo-name', muc.ten));
      if (describe) option.append(el('span', 'combo-hint', describe(muc)));
      return option;
    }));
    list.hidden = false;
    control.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-expanded', 'true');
    return setActive(index);
  };

  // Bỏ phần chữ máy điền tiếp mà người dùng chưa nhận (phần bôi đen ở cuối ô).
  const dropCompletion = () => {
    if (typedLength !== null) control.value = control.value.slice(0, typedLength);
    typedLength = null;
  };

  const pick = (muc) => {
    typedLength = null;
    control.value = muc.ten;
    control.setSelectionRange(muc.ten.length, muc.ten.length);
    close();
    onPick?.(muc);
    onChange?.();
  };

  control.addEventListener('input', (event) => {
    typedLength = null;
    const typed = control.value;
    if (!typed.trim()) return close();
    const found = timGoiY(typed, items);

    // Gõ đủ tên thì chọn sẵn tên đó để Enter/Tab nhận được.
    const exact = found.findIndex((muc) => sameName(typed, muc));
    if (exact >= 0) return open(found, exact);

    // Đang xóa chữ hay đang gõ dấu bằng bộ gõ thì không điền tiếp, để không chặn tay người gõ.
    const deleting = event.inputType?.startsWith('delete');
    const index = deleting || event.isComposing ? -1 : found.findIndex((muc) => phanHoanThanh(typed, muc.ten));
    if (index >= 0) {
      // Viết theo đúng tên trong danh sách ("c" thành "CFS fee"), phần điền thêm được bôi đen.
      control.value = found[index].ten;
      control.setSelectionRange(typed.length, control.value.length);
      typedLength = typed.length;
    }
    return open(found, index);
  });

  control.addEventListener('keydown', (event) => {
    const isOpen = !list.hidden;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) return open(timGoiY(control.value, items), 0);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      return setActive((active + step + matches.length) % matches.length);
    }
    if ((event.key === 'Enter' || event.key === 'Tab') && isOpen && active >= 0) {
      if (event.key === 'Enter') event.preventDefault();
      return pick(matches[active]);
    }
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      dropCompletion();
      close();
      return onChange?.();
    }
    return undefined;
  });

  toggle.addEventListener('click', () => {
    if (list.hidden) open([...items]);
    else close();
    control.focus();
  });

  // Bấm vào danh sách không làm ô mất con trỏ, để danh sách không đóng trước khi chọn xong.
  list.addEventListener('mousedown', (event) => event.preventDefault());
  list.addEventListener('click', (event) => {
    const option = event.target.closest('.combo-option');
    if (option) pick(matches[[...list.children].indexOf(option)]);
  });

  // Tên lúc vào ô, để biết người dùng có đổi tên hay không.
  let valueOnFocus = '';
  control.addEventListener('focus', () => { valueOnFocus = control.value; });

  // Rời ô mà chưa bấm Enter/Tab: bỏ phần máy điền tiếp. Tên đã đổi và trùng một mục trong danh sách
  // thì viết lại cho đúng hoa thường và đổi cách tính theo mục đó; tên không đổi thì giữ cách tính người dùng đã chọn.
  box.addEventListener('focusout', (event) => {
    if (box.contains(event.relatedTarget)) return;
    close();
    const hadCompletion = typedLength !== null;
    dropCompletion();
    const match = items.find((muc) => sameName(control.value, muc));
    const renamed = match && match.ten !== valueOnFocus;
    if (renamed) {
      control.value = match.ten;
      onPick?.(match);
    }
    if (renamed || hadCompletion) onChange?.();
  });

  // Trang đánh số lại dòng thì đổi nhãn theo, để trình đọc màn hình biết danh sách của dòng nào.
  const setLabel = (text) => {
    toggle.setAttribute('aria-label', text);
    list.setAttribute('aria-label', text);
  };

  return { setLabel, close };
}
