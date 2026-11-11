// Trang từ điển: ô tìm, nút lọc theo nhóm, danh sách gọn bấm để mở từng mục.
// Trang không có ô số nên không dùng khuôn mountTool, chỉ dùng lại class chung.
import { docDiaChi, idCongCu, taoDiaChi, timMuc, timTheoId } from '../calc/tu-dien.js';
import { loadTools } from '../core/tools.js';

const ERROR_LOAD = 'Không tải được dữ liệu từ điển, bạn hãy tải lại trang.';
const HINT = 'Gõ viết tắt, tên tiếng Anh hoặc nghĩa tiếng Việt, không cần dấu. Gõ sai nhẹ vẫn tìm được; viết tắt từ 3 ký tự trở xuống chỉ tìm đúng hoặc phần đầu.';
const NOTE = 'Nội dung chỉ để tham khảo khi học và làm việc.';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function loadData() {
  const response = await fetch('/data/tu-dien.json');
  if (!response.ok) throw new Error(`Không tải được tu-dien.json (${response.status})`);
  return response.json();
}

// Thiếu danh sách công cụ thì trang vẫn tra được, nút mở công cụ dùng tên file.
async function loadToolList() {
  try {
    return (await loadTools()).cong_cu;
  } catch (error) {
    console.error(error);
    return [];
  }
}

const [DATA, TOOLS] = await Promise.all([loadData().catch((error) => {
  console.error(error);
  return null;
}), loadToolList()]);

const TOOL = TOOLS.find((tool) => tool.id === 'tu-dien');
const root = document.getElementById('tool-root');
const head = el('header', 'tool-head');
head.append(el('h1', '', TOOL?.ten ?? document.title));
if (TOOL?.mo_ta) head.append(el('p', 'tool-lead', TOOL.mo_ta));

const state = { q: '', nhom: null, muc: null };

// Chữ hoa đầu cho tên nhóm, trừ "Incoterms" đã viết hoa sẵn.
function tenNhom(nhom) {
  return `${nhom[0].toUpperCase()}${nhom.slice(1)}`;
}

const search = el('section', 'tool-panel td-search');
search.setAttribute('aria-label', 'Tìm và lọc');
const field = el('div', 'tool-field');
const label = el('label', '', 'Tìm thuật ngữ');
label.htmlFor = 'td-q';
const input = el('input', 'tool-input');
Object.assign(input, { id: 'td-q', type: 'search', placeholder: 'Ví dụ: THC, D/O, lệnh giao hàng', autocomplete: 'off', spellcheck: false });
input.setAttribute('autocapitalize', 'off');
input.setAttribute('enterkeyhint', 'search');
input.setAttribute('aria-describedby', 'td-q-hint');
const hint = el('p', 'tool-number-hint td-hint', HINT);
hint.id = 'td-q-hint';
field.append(label, input, hint);

const filterTitle = el('p', 'ict-group-name td-filter-title', 'Lọc theo nhóm');
filterTitle.id = 'td-loc';
const chips = el('div', 'ict-chips');
chips.setAttribute('role', 'group');
chips.setAttribute('aria-labelledby', filterTitle.id);
search.append(field, filterTitle, chips);

const result = el('section', 'td-result');
result.setAttribute('aria-label', 'Kết quả');
// Chỉ đọc dòng đếm cho trình đọc màn hình, không đọc lại cả danh sách sau mỗi phím gõ.
const count = el('p', 'td-count');
count.setAttribute('role', 'status');
const list = el('ul', 'td-list');
result.append(count, list);

function renderChips() {
  const options = [null, ...DATA.nhom];
  chips.replaceChildren(...options.map((nhom) => {
    const soMuc = timMuc(DATA, state.q, { nhom }).length;
    const chip = el('button', 'ict-chip ict-chip--wide', `${nhom ? tenNhom(nhom) : 'Tất cả'} (${soMuc})`);
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(state.nhom === nhom));
    chip.addEventListener('click', () => update({ nhom, muc: null }));
    return chip;
  }));
}

function toolButton(congCu) {
  const tool = TOOLS.find((item) => item.id === idCongCu(congCu));
  const link = el('a', 'btn btn--primary td-tool', `Mở công cụ: ${tool?.ten ?? congCu}`);
  link.href = `/tools/${congCu}`;
  return link;
}

function relatedButtons(muc) {
  const wrap = el('div', 'td-related');
  wrap.append(el('span', 'td-label', 'Liên quan'));
  const row = el('div', 'td-related-list');
  for (const id of muc.lien_quan) {
    const other = timTheoId(DATA, id);
    if (!other) continue;
    const button = el('button', 'td-rel', other.thuat_ngu);
    button.type = 'button';
    button.setAttribute('aria-label', `${other.thuat_ngu}, ${other.ten_day_du}`);
    button.addEventListener('click', () => goTo(id));
    row.append(button);
  }
  wrap.append(row);
  return wrap;
}

function entry(muc) {
  const item = el('li');
  const details = el('details', 'td-item');
  details.id = `muc-${muc.id}`;
  details.open = state.muc === muc.id;

  const summary = el('summary', 'td-sum');
  const top = el('span', 'td-top');
  top.append(el('span', 'td-term', muc.thuat_ngu));
  // Tên đầy đủ trùng thuật ngữ (như Demurrage) thì không lặp lại.
  if (muc.ten_day_du !== muc.thuat_ngu) top.append(el('span', 'td-full', muc.ten_day_du));
  summary.append(top, el('span', 'td-mean', muc.nghia));

  const body = el('div', 'td-body');
  const rows = el('dl', 'td-rows');
  for (const [nhan, text] of [['Giải thích', muc.giai_thich], ['Ví dụ', muc.vi_du]]) {
    const row = el('div');
    row.append(el('dt', 'td-label', nhan), el('dd', '', text));
    rows.append(row);
  }
  body.append(rows);
  const meta = el('p', 'td-meta');
  meta.append(el('span', 'badge', `Nhóm ${tenNhom(muc.nhom)}`));
  body.append(meta);
  if (muc.lien_quan.length) body.append(relatedButtons(muc));
  if (muc.cong_cu) body.append(toolButton(muc.cong_cu));

  details.append(summary, body);
  details.addEventListener('toggle', () => {
    if (details.open && state.muc !== muc.id) setUrl({ muc: muc.id });
    else if (!details.open && state.muc === muc.id) setUrl({ muc: null });
  });
  item.append(details);
  return item;
}

function renderList() {
  const found = timMuc(DATA, state.q, { nhom: state.nhom });
  list.replaceChildren(...found.map(entry));
  const where = state.nhom ? ` trong nhóm ${tenNhom(state.nhom)}` : '';
  if (found.length) {
    count.textContent = state.q ? `Có ${found.length} mục khớp "${state.q}"${where}.` : `Có ${found.length} mục${where}, xếp theo A–Z.`;
    return;
  }
  count.textContent = state.q ? `Không có mục nào khớp "${state.q}"${where}.` : `Chưa có mục nào${where}.`;
  if (state.q || state.nhom) {
    const all = el('button', 'btn', 'Xem tất cả');
    all.type = 'button';
    all.addEventListener('click', () => {
      input.value = '';
      update({ q: '', nhom: null, muc: null });
      input.focus();
    });
    const item = el('li', 'td-empty');
    item.append(all);
    list.append(item);
  }
}

function setUrl(changes) {
  Object.assign(state, changes);
  history.replaceState(null, '', `${location.pathname}${taoDiaChi(state)}${location.hash}`);
}

function update(changes) {
  setUrl(changes);
  renderChips();
  renderList();
}

// Mở một mục và cuộn tới. Mục đang bị ô tìm hay nút lọc che thì bỏ lọc trước.
function goTo(id) {
  const shown = timMuc(DATA, state.q, { nhom: state.nhom }).some((muc) => muc.id === id);
  if (shown) update({ muc: id });
  else {
    input.value = '';
    update({ q: '', nhom: null, muc: id });
  }
  const target = document.getElementById(`muc-${id}`);
  target?.scrollIntoView({ block: 'start' });
  target?.querySelector('summary').focus({ preventScroll: true });
}

input.addEventListener('input', () => update({ q: input.value.trim(), muc: null }));

if (DATA) {
  const layout = el('div', 'td-layout');
  layout.append(search, result);
  root.replaceChildren(head, layout, el('p', 'tool-note', `${DATA.nguon} ${NOTE} Cập nhật ${DATA.cap_nhat.split('-').reverse().join('/')}.`));
  const start = docDiaChi(DATA, location.search);
  input.value = start.q;
  update(start);
  if (start.muc) document.getElementById(`muc-${start.muc}`)?.scrollIntoView({ block: 'start' });
} else {
  root.replaceChildren(head, el('p', 'tool-message is-error', ERROR_LOAD));
}
