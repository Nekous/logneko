// Trang chủ: ô tìm kiếm chung, danh sách 8 công cụ có xem trước, và dải con số.
import { isLive, loadTools, statsFor, toolHref } from './core/tools.js';
import { mountSearch } from './tim-kiem.js';

const narrowScreen = matchMedia('(max-width: 859px)');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderPreview(panel, tool) {
  const details = el('dl');
  details.append(
    el('dt', '', 'Bạn nhập'), el('dd', '', tool.nhap),
    el('dt', '', 'Bạn nhận'), el('dd', '', tool.ket_qua),
  );

  const foot = el('div', 'tool-preview-foot');
  if (isLive(tool)) {
    const link = el('a', 'btn btn--primary', 'Mở công cụ');
    link.href = toolHref(tool);
    foot.append(link);
  } else {
    foot.append(el('span', 'badge', 'Sắp có'));
  }

  panel.replaceChildren(el('h3', '', tool.ten), el('p', '', tool.mo_ta), details, foot);
}

function renderTools(data) {
  const list = document.getElementById('tool-list');
  const slot = document.getElementById('tool-preview-slot');
  const panel = el('div', 'tool-preview');
  panel.setAttribute('aria-live', 'polite');

  const buttons = new Map();
  let activeId = data.cong_cu[0].id;

  // Điện thoại: xem trước nằm ngay dưới mục đang chọn. Máy tính: nằm ở cột bên cạnh.
  const placePanel = () => {
    if (narrowScreen.matches) buttons.get(activeId).after(panel);
    else slot.append(panel);
  };

  const select = (tool) => {
    activeId = tool.id;
    for (const [id, button] of buttons) {
      button.setAttribute('aria-current', String(id === tool.id));
    }
    renderPreview(panel, tool);
    placePanel();
  };

  for (const groupName of data.nhom) {
    const group = el('div', 'tool-group');
    group.append(el('h3', 'tool-group-title', groupName));
    const items = el('ul');
    for (const tool of data.cong_cu.filter((item) => item.nhom === groupName)) {
      const item = el('li');
      const button = el('button', 'tool-item');
      button.type = 'button';
      button.append(el('span', '', tool.ten));
      if (!isLive(tool)) button.append(el('span', 'badge', 'Sắp có'));
      button.addEventListener('click', () => select(tool));
      buttons.set(tool.id, button);
      item.append(button);
      items.append(item);
    }
    group.append(items);
    list.append(group);
  }

  narrowScreen.addEventListener('change', placePanel);
  select(data.cong_cu[0]);
}

function renderStats(data) {
  const box = document.getElementById('stats');
  for (const stat of statsFor(data)) {
    const item = el('div', 'stat');
    item.append(el('span', 'stat-value', stat.so), el('span', 'stat-label', stat.nhan));
    box.append(item);
  }
}

const data = await loadTools().catch((error) => {
  console.error(error);
  return null;
});
// Thiếu danh sách công cụ thì ô tìm vẫn tra được Incoterms và từ điển.
mountSearch(document.getElementById('tim-kiem'), data?.cong_cu ?? []);

try {
  if (!data) throw new Error('Không có danh sách công cụ');
  renderTools(data);
  renderStats(data);
} catch (error) {
  console.error(error);
  document.getElementById('tool-list').append(
    el('p', 'tools-error', 'Không tải được danh sách công cụ. Bạn thử tải lại trang.'),
  );
}
