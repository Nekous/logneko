// Trang tra cứu Incoterms 2020: chọn một điều kiện để xem, hoặc hai điều kiện để so sánh.
// Trang không có ô số nên không dùng khuôn mountTool, chỉ dùng lại class và nút Copy chung.
import {
  BEN_TEXT,
  compareCopyText,
  compareRows,
  findTerm,
  findWay,
  parseSelection,
  selectionQuery,
  sideLabel,
  stepRows,
  summaryRows,
  termCopyText,
} from '../calc/incoterms.js';
import { createCopyButton } from '../core/tool-shell.js';
import { loadTools } from '../core/tools.js';

const ERROR_LOAD = 'Không tải được dữ liệu Incoterms, bạn hãy tải lại trang.';
const PROMPT_PICK = 'Chọn một điều kiện để xem ai trả tiền từng chặng và rủi ro chuyển ở đâu.';
const PROMPT_SECOND = 'Chọn điều kiện thứ hai ở hàng "So sánh với".';
const NOTE = 'Hợp đồng thực tế có thể thỏa thuận khác với cách chia trên; khi có tranh chấp, căn cứ vào hợp đồng và bản Incoterms 2020 của ICC. Kết quả chỉ để tham khảo.';
const SO_CHANG = 9;
// Khe giữa các ô của dải hành trình, phải khớp gap của .ict-strip trong tool.css.
const KHE_PX = 3;
// Từ khổ này trở lên, kết quả đã nằm trong tầm mắt nên không cần tự cuộn.
const WIDE_SCREEN = '(min-width: 860px)';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function loadData() {
  const response = await fetch('/data/incoterms.json');
  if (!response.ok) throw new Error(`Không tải được incoterms.json (${response.status})`);
  return response.json();
}

// Thiếu tên và mô tả công cụ thì trang vẫn tra được, chỉ dùng tiêu đề của thẻ title.
async function loadToolInfo() {
  try {
    const data = await loadTools();
    return data.cong_cu.find((tool) => tool.id === 'incoterms');
  } catch (error) {
    console.error(error);
    return null;
  }
}

const [DATA, TOOL] = await Promise.all([loadData().catch((error) => {
  console.error(error);
  return null;
}), loadToolInfo()]);

const root = document.getElementById('tool-root');
const head = el('header', 'tool-head');
head.append(el('h1', '', TOOL?.ten ?? document.title));
if (TOOL?.mo_ta) head.append(el('p', 'tool-lead', TOOL.mo_ta));

const state = { a: null, b: null, fca: 'kho-ban', comparing: false };

function side(ma) {
  const term = findTerm(DATA, ma);
  return { term, cachGiao: term.ma === 'FCA' ? state.fca : undefined };
}

// Hàng nút chọn mã, chia theo hai nhóm phương thức. prefix phân biệt hàng chính với hàng so sánh.
function chipGroups(prefix, selected, onPick, disabled) {
  const wrap = el('div', 'ict-groups');
  for (const group of DATA.nhom) {
    const block = el('div', 'ict-group');
    const label = el('p', 'ict-group-name', group.ten);
    label.id = `${prefix}-nhom-${group.id}`;
    const chips = el('div', 'ict-chips');
    chips.setAttribute('role', 'group');
    // Hàng so sánh đọc khác hàng chính, để trình đọc màn hình không gặp hai nhóm trùng tên.
    if (prefix === 'b') chips.setAttribute('aria-label', `So sánh với, ${group.ten.toLowerCase()}`);
    else chips.setAttribute('aria-labelledby', label.id);
    for (const term of DATA.dieu_kien.filter((item) => item.phuong_thuc === group.id)) {
      const chip = el('button', 'ict-chip', term.ma);
      chip.type = 'button';
      chip.dataset.key = `${prefix}-${term.ma}`;
      chip.title = `${term.ten_en}: ${term.ten_vi}`;
      chip.setAttribute('aria-label', `${term.ma}, ${term.ten_vi}`);
      chip.setAttribute('aria-pressed', String(term.ma === selected));
      chip.disabled = term.ma === disabled;
      chip.addEventListener('click', () => onPick(term.ma));
      chips.append(chip);
    }
    block.append(label, chips);
    wrap.append(block);
  }
  return wrap;
}

function wayButtons() {
  const fca = findTerm(DATA, 'FCA');
  const block = el('div', 'ict-ways');
  const label = el('p', 'ict-group-name', 'Cách giao của FCA');
  label.id = 'cach-giao-fca';
  const row = el('div', 'ict-chips');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-labelledby', label.id);
  for (const way of fca.cach_giao) {
    const button = el('button', 'ict-chip ict-chip--wide', way.ten);
    button.type = 'button';
    button.dataset.key = `fca-${way.id}`;
    button.setAttribute('aria-pressed', String(way.id === state.fca));
    button.addEventListener('click', () => update({ fca: way.id }));
    row.append(button);
  }
  block.append(label, row);
  return block;
}

// Dải 9 ô tô màu theo người trả, vạch đánh dấu nơi rủi ro chuyển sang người mua.
function journeyStrip(current) {
  const way = findWay(current.term, current.cachGiao);
  const strip = el('div', 'ict-strip');
  strip.setAttribute('aria-hidden', 'true');
  way.chang.forEach((value, index) => {
    const cell = el('span', `ict-cell is-${value}`);
    cell.append(el('span', 'ict-cell-num', String(index + 1)));
    strip.append(cell);
  });
  const position = way.rui_ro.vi_tri;
  const marker = el('span', 'ict-risk');
  // Rủi ro sau chặng k thì vạch nằm giữa khe sau ô k; giữa chặng thì vạch nằm giữa ô.
  const gaps = Math.min(Number.isInteger(position) ? Math.max(position - 0.5, 0) : Math.floor(position), SO_CHANG - 1);
  marker.style.left = `calc((100% - ${(SO_CHANG - 1) * KHE_PX}px) * ${position / SO_CHANG} + ${gaps * KHE_PX}px)`;
  if (position === 0) marker.classList.add('is-start');
  if (position === SO_CHANG) marker.classList.add('is-end');
  marker.append(el('span', 'ict-risk-label', 'Rủi ro chuyển'));
  strip.append(marker);
  return strip;
}

function legend() {
  const list = el('ul', 'ict-legend');
  list.setAttribute('aria-hidden', 'true');
  for (const value of ['ban', 'mua', 'chia']) {
    const item = el('li');
    item.append(el('span', `ict-swatch is-${value}`), document.createTextNode(BEN_TEXT[value]));
    list.append(item);
  }
  const risk = el('li');
  risk.append(el('span', 'ict-swatch is-risk'), document.createTextNode('Rủi ro chuyển sang người mua'));
  list.append(risk);
  return list;
}

function riskStep(way) {
  const position = way.rui_ro.vi_tri;
  const where = Number.isInteger(position) ? '' : ` (giữa chặng ${Math.ceil(position)})`;
  const item = el('li', 'ict-step-risk');
  item.append(el('strong', '', `Rủi ro chuyển sang người mua${where}: `), document.createTextNode(way.rui_ro.mo_ta));
  return item;
}

// Danh sách chặng cho cả trình đọc màn hình; dòng rủi ro chen đúng chỗ trong hành trình.
function stepList(current) {
  const way = findWay(current.term, current.cachGiao);
  const position = way.rui_ro.vi_tri;
  const list = el('ol', 'ict-steps');
  // Rủi ro chuyển sau chặng k thì dòng rủi ro đứng sau chặng k; giữa chặng thì đứng ngay trên chặng đó.
  const riskAfter = Math.floor(position);
  if (position === 0) list.append(riskStep(way));
  stepRows(DATA, current.term, current.cachGiao).forEach((row, index) => {
    if (!Number.isInteger(position) && index === riskAfter) list.append(riskStep(way));
    const item = el('li', 'ict-step');
    const line = el('div', 'ict-step-line');
    line.append(
      el('span', `ict-swatch is-${row.so_sanh}`),
      el('span', 'ict-step-name', row.nhan),
      el('span', 'ict-step-who', row.gia_tri),
    );
    item.append(line);
    if (row.ghi_chu) item.append(el('p', 'ict-step-note', row.ghi_chu));
    list.append(item);
    if (position > 0 && position === index + 1) list.append(riskStep(way));
  });
  return list;
}

function rowsList(rows) {
  const list = el('dl', 'ict-rows');
  for (const row of rows) {
    const wrap = el('div');
    const value = el('dd', '', row.gia_tri);
    if (row.ghi_chu) value.append(el('span', 'ict-row-note', row.ghi_chu));
    wrap.append(el('dt', '', row.nhan), value);
    list.append(wrap);
  }
  return list;
}

function subTitle(text) {
  return el('h3', 'ict-sub', text);
}

function actionsRow(getText) {
  const copy = createCopyButton(getText);
  const row = el('div', 'tool-actions ict-actions');
  row.append(copy.button, copy.status);
  return row;
}

function termView(current) {
  const { term } = current;
  const box = el('div', 'ict-view is-single');

  const title = el('div', 'ict-title');
  title.append(el('h2', 'ict-code', term.ma));
  const names = el('div', 'ict-names');
  names.append(el('p', 'ict-name-en', term.ten_en), el('p', 'ict-name-vi', term.ten_vi));
  title.append(names, el('span', 'badge', `Nhóm ${term.nhom_chu}`));
  box.append(title, el('p', 'ict-lead', term.tom_tat));

  if (term.cach_giao.length > 1) box.append(wayButtons());

  box.append(subTitle('Ai trả từng chặng'), journeyStrip(current), legend(), stepList(current));
  box.append(subTitle('Tóm tắt'), rowsList(summaryRows(DATA, term, current.cachGiao)));

  box.append(subTitle('Cách ghi trong hợp đồng'));
  box.append(el('p', 'ict-muted', `Mẫu: ${term.cach_ghi.mau}`), el('p', 'ict-example', term.cach_ghi.vi_du));

  box.append(subTitle('Lỗi hay gặp'));
  const mistakes = el('ul', 'ict-list');
  mistakes.append(...[...term.loi_hay_gap, ...DATA.loi_chung].map((text) => el('li', '', text)));
  box.append(mistakes);

  if (term.ghi_chu) box.append(el('p', 'tool-result-note', term.ghi_chu));
  box.append(actionsRow(() => termCopyText(DATA, term, current.cachGiao)));
  return box;
}

function compareView(left, right) {
  const box = el('div', 'ict-view');
  box.append(el('h2', 'ict-compare-title', `So sánh ${left.term.ma} và ${right.term.ma}`));
  if ([left, right].some((item) => item.term.cach_giao.length > 1)) box.append(wayButtons());

  box.append(subTitle('Ai trả từng chặng'));
  for (const current of [left, right]) {
    const block = el('div', 'ict-journey');
    block.append(el('p', 'ict-journey-name', `${sideLabel(current)}: ${current.term.ten_vi}`), journeyStrip(current));
    box.append(block);
  }
  box.append(legend());

  // Trong bảng chỉ cần mã; cách giao của FCA đã hiện ở nút đổi và tên dải hành trình.
  const [codeA, codeB] = [left.term.ma, right.term.ma];
  const rows = compareRows(DATA, left, right);
  const different = rows.filter((row) => row.khac).length;
  box.append(subTitle('Từng tiêu chí'), el('p', 'ict-muted', `${different} trên ${rows.length} tiêu chí khác nhau, được đánh dấu "Khác".`));

  const list = el('dl', 'ict-compare');
  // Hàng tên cột chỉ hiện khi hai cột đứng cạnh nhau; mỗi ô đã tự ghi mã cho trình đọc màn hình.
  const header = el('div', 'ict-cmp-row ict-cmp-head');
  header.setAttribute('aria-hidden', 'true');
  header.append(el('dt', '', 'Tiêu chí'), el('dd', '', codeA), el('dd', '', codeB));
  list.append(header);
  for (const row of rows) {
    const wrap = el('div', row.khac ? 'ict-cmp-row is-diff' : 'ict-cmp-row');
    const label = el('dt', 'ict-cmp-label', row.nhan);
    if (row.khac) label.append(el('span', 'ict-diff', 'Khác'));
    wrap.append(label);
    for (const [name, value, note] of [[codeA, row.a, row.ghiChuA], [codeB, row.b, row.ghiChuB]]) {
      const cell = el('dd', 'ict-cmp-val');
      cell.append(el('span', 'ict-cmp-code', name), el('span', '', value));
      if (note) cell.append(el('span', 'ict-row-note', note));
      wrap.append(cell);
    }
    list.append(wrap);
  }
  box.append(list, actionsRow(() => compareCopyText(DATA, left, right)));
  return box;
}

const pick = el('section', 'tool-panel ict-pick');
pick.setAttribute('aria-label', 'Chọn điều kiện');
const result = el('section', 'tool-panel ict-result');
result.setAttribute('aria-label', 'Kết quả');
// Chỉ báo ngắn mã đang xem cho trình đọc màn hình, không đọc lại cả khung kết quả.
const announce = el('p', 'ict-sr');
announce.setAttribute('role', 'status');

function renderPick() {
  const first = el('h2', 'ict-pick-title', 'Chọn điều kiện');
  const nodes = [first, chipGroups('a', state.a, (ma) => update({ a: ma, b: ma === state.b ? null : state.b }))];

  const toggle = el('button', 'btn', state.comparing ? 'Bỏ so sánh' : 'So sánh với điều kiện khác');
  toggle.type = 'button';
  toggle.dataset.key = 'so-sanh';
  toggle.disabled = !state.a;
  toggle.addEventListener('click', () => update(state.comparing ? { comparing: false, b: null } : { comparing: true }));
  const row = el('div', 'tool-actions ict-toggle');
  row.append(toggle);
  nodes.push(row);

  if (state.comparing) {
    nodes.push(el('h2', 'ict-pick-title', 'So sánh với'), chipGroups('b', state.b, (ma) => update({ b: ma }), state.a));
    if (!state.b) nodes.push(el('p', 'ict-muted ict-hint', PROMPT_SECOND));
  }
  pick.replaceChildren(...nodes);
}

function renderResult() {
  if (!state.a) {
    result.replaceChildren(el('p', 'tool-message', PROMPT_PICK));
    announce.textContent = '';
    return;
  }
  const left = side(state.a);
  if (state.comparing && state.b) {
    const right = side(state.b);
    result.replaceChildren(compareView(left, right));
    announce.textContent = `Đang so sánh ${sideLabel(left)} và ${sideLabel(right)}.`;
  } else {
    result.replaceChildren(termView(left));
    // Ghi cả cách giao của FCA, để đổi cách giao thì trình đọc màn hình có câu mới để đọc.
    announce.textContent = state.comparing
      ? `Đang xem ${sideLabel(left)}. ${PROMPT_SECOND}`
      : `Đang xem ${sideLabel(left)}, ${left.term.ten_vi}.`;
  }
}

// scroll = false khi mở trang từ link, để trang không tự nhảy xuống lúc vừa tải.
function update(changes, { scroll = true } = {}) {
  // Vẽ lại thì nút cũ mất, nên ghi nhớ nút đang được chọn bằng bàn phím để trả con trỏ về đúng chỗ.
  const focusKey = document.activeElement?.dataset?.key;
  Object.assign(state, changes);
  if (!state.a) state.comparing = false;
  if (!state.comparing) state.b = null;
  renderPick();
  renderResult();
  history.replaceState(null, '', `${location.pathname}${selectionQuery(state)}`);
  if (focusKey) root.querySelector(`[data-key="${focusKey}"]`)?.focus({ preventScroll: true });
  // Trên điện thoại, hai hàng chọn mã đẩy kết quả xuống khuất; chọn mã so sánh xong thì cuộn tới kết quả.
  if (scroll && changes.b && !window.matchMedia(WIDE_SCREEN).matches) result.scrollIntoView({ block: 'start' });
}

if (DATA) {
  const layout = el('div', 'ict-layout');
  layout.append(pick, result);
  root.replaceChildren(head, layout, announce, el('p', 'tool-note', `${DATA.nguon} ${NOTE} Cập nhật ${DATA.cap_nhat.split('-').reverse().join('/')}.`));
  const selection = parseSelection(DATA, location.search);
  update({ ...selection, comparing: Boolean(selection.b) }, { scroll: false });
} else {
  root.replaceChildren(head, el('p', 'tool-message is-error', ERROR_LOAD));
}
