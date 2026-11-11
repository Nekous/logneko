// Trang tra mã HS: một ô gõ mã hoặc tên hàng. Gõ mã thì tải đúng một chương, gõ chữ thì tải chỉ mục.
// Trang không có ô số tính toán nên không dùng khuôn mountTool, chỉ dùng lại class chung và nút Copy.
import {
  boGach,
  chepMa,
  chuThichKyHieu,
  chuongCua,
  docMa,
  duongDan,
  hienThue,
  laMa,
  tenTep,
  timTheoMa,
  timTheoTen,
} from '../calc/hs.js';
import { loadTools } from '../core/tools.js';
import { createCopyButton } from '../core/tool-shell.js';

const DATA = '/data/hs';
const HINT = 'Gõ mã 2 đến 8 chữ số (có thể cách bằng dấu chấm), hoặc tên hàng tiếng Việt, tiếng Anh, không cần dấu.';
const VI_DU = ['8471', '0306.15', '87021010', 'tôm hun khói', 'laptop'];
const WARNING = 'Kết quả chỉ để tham khảo, không thay thế việc phân loại chính thức của Hải quan.';
const ERROR_LOAD = 'Không tải được dữ liệu biểu thuế, bạn hãy tải lại trang.';
const TEN_THUE = [['ud', 'NK ưu đãi'], ['tt', 'NK thông thường'], ['vat', 'VAT']];
const CHO_GO_MS = 150;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function fetchJson(file) {
  const response = await fetch(`${DATA}/${file}`);
  if (!response.ok) throw new Error(`Không tải được ${file} (${response.status})`);
  return response.json();
}

const chuongDaTai = new Map();
function taiChuong(so) {
  if (!chuongDaTai.has(so)) {
    chuongDaTai.set(so, fetchJson(tenTep(so)).catch((error) => {
      chuongDaTai.delete(so);
      throw error;
    }));
  }
  return chuongDaTai.get(so);
}

let chiMuc;
function taiChiMuc() {
  chiMuc ??= fetchJson('chi-muc.json').catch((error) => {
    chiMuc = undefined;
    throw error;
  });
  return chiMuc;
}

const [META, TOOL] = await Promise.all([
  fetchJson('meta.json').catch((error) => {
    console.error(error);
    return null;
  }),
  loadTools().then((data) => data.cong_cu.find((tool) => tool.id === 'hs-code')).catch(() => null),
]);

const root = document.getElementById('tool-root');
const head = el('header', 'tool-head');
head.append(el('h1', '', TOOL?.ten ?? document.title));
if (TOOL?.mo_ta) head.append(el('p', 'tool-lead', TOOL.mo_ta));

// Ô tìm và các ví dụ bấm nhanh.
const search = el('section', 'tool-panel hs-search');
search.setAttribute('aria-label', 'Tìm mã HS');
const field = el('div', 'tool-field');
const label = el('label', '', 'Mã HS hoặc tên hàng');
label.htmlFor = 'hs-q';
const input = el('input', 'tool-input');
Object.assign(input, { id: 'hs-q', type: 'search', placeholder: 'Ví dụ: 8471, 0306.15, tôm, laptop', autocomplete: 'off', spellcheck: false });
input.setAttribute('autocapitalize', 'off');
input.setAttribute('enterkeyhint', 'search');
input.setAttribute('aria-describedby', 'hs-q-hint');
const hint = el('p', 'tool-number-hint hs-hint', HINT);
hint.id = 'hs-q-hint';
field.append(label, input, hint);
const examples = el('div', 'td-related-list hs-examples');
for (const text of VI_DU) {
  const button = el('button', 'td-rel', text);
  button.type = 'button';
  button.addEventListener('click', () => go(text));
  examples.append(button);
}
search.append(field, el('p', 'td-label hs-examples-title', 'Thử nhanh'), examples);

const result = el('section', 'hs-result');
result.setAttribute('aria-label', 'Kết quả');
// Chỉ đọc dòng trạng thái cho trình đọc màn hình, không đọc lại cả danh sách sau mỗi phím gõ.
const status = el('p', 'td-count hs-status');
status.setAttribute('role', 'status');
const content = el('div', 'hs-content');
result.append(status, content);

function ngayViet(iso) {
  return iso.split('-').reverse().join('/');
}

function nutMa(ma, text = ma) {
  const button = el('button', 'hs-code-link', text);
  button.type = 'button';
  button.addEventListener('click', () => go(ma));
  return button;
}

function oThue(nhan, bo) {
  const box = el('div', 'hs-tax');
  box.append(el('span', 'hs-tax-label', nhan));
  if (!bo || !bo[0]) {
    box.append(el('span', 'hs-tax-value is-empty', 'Không ghi'));
    return box;
  }
  const [giaTri, vanBan, ngay] = bo;
  box.append(el('span', 'hs-tax-value', hienThue(giaTri)));
  const nguon = [vanBan, ngay && `hiệu lực ${ngay}`].filter(Boolean).join(', ');
  if (nguon) box.append(el('span', 'hs-tax-source', nguon));
  return box;
}

function bangThue(dong) {
  const grid = el('div', 'hs-taxes');
  grid.append(...TEN_THUE.map(([key, nhan]) => oThue(nhan, dong[key])));
  return grid;
}

// Ô Chương 98 dưới thẻ mã gốc; luôn kèm câu điều kiện và văn bản của chính dòng 98.
function hopChuong98(ds) {
  const box = el('div', 'hs-ch98');
  box.append(el('p', 'hs-ch98-title', 'Mã này còn có trong Chương 98'));
  for (const muc of ds) {
    const item = el('div', 'hs-ch98-item');
    const top = el('p', 'hs-ch98-top');
    top.append(nutMa(muc.ma), el('span', '', ` ${boGach(muc.vi)}`));
    item.append(top);
    const rates = [['NK ưu đãi', muc.ud], ['NK thông thường', muc.tt]]
      .filter(([, bo]) => bo?.[0])
      .map(([nhan, bo]) => `${nhan}: ${hienThue(bo[0])}`);
    if (rates.length) item.append(el('p', 'hs-ch98-rate', rates.join(' · ')));
    const vanBan = muc.ud?.[1] ?? muc.tt?.[1];
    item.append(el('p', 'hs-note', `Chỉ áp dụng khi hàng đáp ứng điều kiện của Chương 98${vanBan ? ` (${vanBan})` : ''}; bạn đối chiếu văn bản gốc.`));
    box.append(item);
  }
  return box;
}

function theMa(dong, { coCopy }) {
  const card = el('article', 'hs-card');
  const top = el('div', 'hs-card-top');
  top.append(el('span', 'hs-card-code', dong.ma));
  if (dong.dvt) top.append(el('span', 'badge', dong.dvt));
  card.append(top, el('p', 'hs-card-vi', boGach(dong.vi)));
  if (dong.en) card.append(el('p', 'hs-card-en', boGach(dong.en)));
  card.append(bangThue(dong));

  if ('goc' in dong) {
    const goc = el('p', 'hs-goc');
    if (dong.goc) goc.append('Mã tương ứng ở chương gốc: ', nutMa(dong.goc));
    else goc.textContent = 'File không ghi mã gốc cho dòng này.';
    card.append(goc);
  }
  if (dong.ch98) card.append(hopChuong98(dong.ch98));
  const chuThich = chuThichKyHieu(dong);
  if (chuThich.length) {
    const notes = el('ul', 'hs-legend');
    notes.append(...chuThich.map((text) => el('li', '', text)));
    card.append(notes);
  }
  if (coCopy) {
    const copy = createCopyButton(() => chepMa(dong, META));
    const row = el('div', 'tool-actions');
    row.append(copy.button, copy.status);
    card.append(row);
  }
  return card;
}

// Dòng nhóm (4, 6 số) hay dòng chỉ có chữ. Vài mã Chương 98 ứng với cả một nhóm 4 số (như 7224).
function dongNhom(dong) {
  const row = el('div', `hs-heading hs-cap-${Math.min(dong.cap ?? 0, 4)}`);
  if (dong.ma) row.append(nutMa(dong.ma));
  row.append(el('span', 'hs-heading-text', boGach(dong.vi)));
  if (!dong.ch98) return row;
  const wrap = el('div');
  wrap.append(row, hopChuong98(dong.ch98));
  return wrap;
}

function tieuDeChuong(chuong) {
  const box = el('div', 'hs-chapter');
  if (chuong.phan) box.append(el('p', 'td-label', `Phần ${chuong.phan.so}: ${chuong.phan.vi}`));
  box.append(el('h2', 'hs-chapter-title', `Chương ${chuong.so}: ${chuong.vi}`));
  if (chuong.en) box.append(el('p', 'hs-card-en', chuong.en));
  return box;
}

function chuGiai(chuong) {
  const doan = [...(chuong.phan?.chu_giai ?? []), ...chuong.chu_giai];
  if (!doan.length) return null;
  const details = el('details', 'tool-how hs-notes');
  details.append(el('summary', '', `Chú giải Chương ${chuong.so}${chuong.phan?.chu_giai.length ? ` và Phần ${chuong.phan.so}` : ''}`));
  const body = el('div', 'hs-notes-body');
  body.append(...doan.map((item) => el('p', '', item.vi || item.en)));
  details.append(body);
  return details;
}

function hienChuong(chuong, kq) {
  const list = el('div', 'hs-list');
  for (const i of kq.dong) {
    const item = chuong.dong[i];
    list.append(dongNhom(item));
  }
  const noi = [tieuDeChuong(chuong)];
  if (kq.dong.length) noi.push(list);
  else noi.push(el('p', 'tool-message', 'Chương này để dành cho việc phân loại sau này, chưa có mã nào.'));
  status.textContent = kq.dong.length ? `Chương ${chuong.so} có ${kq.dong.length} nhóm 4 số. Bấm một nhóm để xem các mã.` : `Chương ${chuong.so}.`;
  return noi;
}

function hienMa(chuong, ma, kq) {
  // Đường dẫn dọc: chỉ mã là link, mô tả viết thường và gói trong 2 dòng để không lấn kết quả.
  const crumbs = el('nav', 'hs-crumbs');
  crumbs.setAttribute('aria-label', 'Đường dẫn trong biểu thuế');
  const crumbList = el('ol');
  const chapterItem = el('li');
  chapterItem.append(nutMa(String(chuong.so).padStart(2, '0'), `Chương ${chuong.so}`));
  crumbList.append(chapterItem);
  for (const i of kq.duongDan) {
    const item = chuong.dong[i];
    const li = el('li');
    if (item.ma) li.append(nutMa(item.ma));
    li.append(el('span', 'hs-crumb-text', boGach(item.vi)));
    crumbList.append(li);
  }
  crumbs.append(crumbList);

  const dongCoThue = kq.dong.filter((i) => chuong.dong[i].ma && chuong.dong[i].ma.length !== 4 && chuong.dong[i].ma.length !== 6);
  const list = el('div', 'hs-list');
  for (const i of kq.dong) {
    const item = chuong.dong[i];
    const laMaDu = item.ma && item.ma.length !== 4 && item.ma.length !== 6;
    list.append(laMaDu ? theMa(item, { coCopy: ma.length === 8 }) : dongNhom(item));
  }
  status.textContent = ma.length === 8
    ? (dongCoThue.length > 1 ? `Mã ${ma} có ${dongCoThue.length} dòng trong biểu thuế.` : `Mã ${ma}.`)
    : `Có ${dongCoThue.length} mã bắt đầu bằng ${ma}.`;
  return [tieuDeChuong(chuong), crumbs, list];
}

async function hienTheoMa(chu, token) {
  const doc = docMa(chu);
  if (doc.loi) {
    status.textContent = doc.loi;
    content.replaceChildren();
    return;
  }
  const { ma } = doc;
  const so = chuongCua(ma);
  if (!META.chuong.some((ch) => ch.so === so)) {
    status.textContent = `Biểu thuế không có Chương ${String(so).padStart(2, '0')}. Các chương đi từ 01 đến 98.`;
    content.replaceChildren();
    return;
  }
  status.textContent = 'Đang tải dữ liệu chương…';
  const chuong = await taiChuong(so);
  if (token !== lanGo) return;

  const kq = timTheoMa(chuong, ma);
  if (kq.loai === 'khong-co') {
    status.textContent = `Không có mã nào bắt đầu bằng ${ma} trong Chương ${so}.`;
    const row = el('div', 'tool-actions');
    row.append(kq.ganNhat ? nutMa(kq.ganNhat, `Xem ${kq.ganNhat}`) : nutMa(String(so).padStart(2, '0'), `Xem Chương ${so}`));
    content.replaceChildren(row);
    return;
  }
  const noi = kq.loai === 'chuong' ? hienChuong(chuong, kq) : hienMa(chuong, ma, kq);
  const notes = chuGiai(chuong);
  content.replaceChildren(...noi, ...(notes ? [notes] : []));
}

// Dòng phụ của một kết quả: chương, mã nhóm 4 số, và mô tả dòng cha gần nhất ("Hun khói" của loại tôm nào).
function duongDanNgan(index, item) {
  const phan = [`Chương ${item.chuong}`];
  let nhom = null;
  for (let cha = index[item.i][4]; cha >= 0; cha = index[cha][4]) if (index[cha][0].length === 4) nhom = index[cha][0];
  if (nhom && nhom !== item.ma) phan.push(nhom);
  const cha = index[item.i][4];
  if (cha >= 0 && index[cha][0] !== nhom) phan.push(boGach(index[cha][2]));
  return phan.join(' · ');
}

async function hienTheoTen(chu, token) {
  status.textContent = 'Đang tải chỉ mục tìm theo tên…';
  const index = await taiChiMuc();
  if (token !== lanGo) return;
  const { ketQua, tong } = timTheoTen(index, chu);
  if (!tong) {
    status.textContent = `Không thấy mã nào khớp "${chu}". Thử từ khác, tên tiếng Anh, hoặc gõ mã.`;
    content.replaceChildren();
    return;
  }
  status.textContent = tong > ketQua.length
    ? `Có ${tong} kết quả cho "${chu}", đang hiện ${ketQua.length} kết quả khớp nhất. Gõ cụ thể hơn để thu hẹp.`
    : `Có ${tong} kết quả cho "${chu}".`;
  const list = el('ul', 'td-list hs-found');
  for (const item of ketQua) {
    const li = el('li');
    const button = el('button', 'hs-found-item');
    button.type = 'button';
    const top = el('span', 'hs-found-top');
    top.append(el('span', 'hs-card-code', item.ma), el('span', '', boGach(item.vi)));
    button.append(top);
    button.append(el('span', 'hs-found-path', duongDanNgan(index, item)));
    button.addEventListener('click', () => go(item.ma));
    li.append(button);
    list.append(li);
  }
  content.replaceChildren(list);
}

let lanGo = 0;
let timer;

function setUrl(chu) {
  const params = new URLSearchParams();
  if (chu) params.set(laMa(chu) ? 'ma' : 'q', laMa(chu) ? chu.replace(/[\s-]/g, '') : chu);
  const text = params.toString();
  history.replaceState(null, '', `${location.pathname}${text ? `?${text}` : ''}`);
}

async function update() {
  const chu = input.value.trim();
  const token = ++lanGo;
  setUrl(chu);
  if (!chu) {
    status.textContent = 'Gõ mã HS hoặc tên hàng để tra.';
    content.replaceChildren();
    return;
  }
  try {
    if (laMa(chu)) await hienTheoMa(chu, token);
    else await hienTheoTen(chu, token);
  } catch (error) {
    console.error(error);
    if (token === lanGo) {
      status.textContent = ERROR_LOAD;
      content.replaceChildren();
    }
  }
}

// Bấm mã hay ví dụ: điền vào ô, tra ngay và cuộn lên đầu kết quả.
function go(chu) {
  input.value = chu;
  update().then(() => result.scrollIntoView({ block: 'start', behavior: 'smooth' }));
}

input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(update, CHO_GO_MS);
});
input.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  clearTimeout(timer);
  update().then(() => content.querySelector('.hs-found-item')?.click());
});

if (META) {
  const layout = el('div', 'td-layout hs-layout');
  layout.append(search, result);
  const nguon = `Dữ liệu theo file biểu thuế ${META.nguon}, cập nhật ngày ${ngayViet(META.cap_nhat)}. ${WARNING}`;
  // Lỗi gõ của file gốc mà script đã sửa thì nói rõ, để người dùng biết chỗ nào khác file.
  const daSua = (META.da_sua ?? []).map((item) => `ngày "${item.tu}" thành "${item.thanh}" (${item.so_o.toLocaleString('vi-VN')} ô)`);
  const ghiChuSua = daSua.length ? ` Riêng lỗi gõ của file gốc đã được sửa: ${daSua.join('; ')}.` : '';
  root.replaceChildren(head, el('p', 'hs-source', nguon), layout,
    el('p', 'tool-note', `Mô tả, thuế suất, văn bản và ngày hiệu lực giữ nguyên văn như trong biểu thuế, kể cả ô ghi chữ như "Theo hướng dẫn…".${ghiChuSua} Thuế suất ghi kèm ngày hiệu lực; văn bản mới ban hành sau ngày cập nhật chưa có ở đây.`));
  const params = new URLSearchParams(location.search);
  input.value = params.get('ma') ?? params.get('q') ?? '';
  update();
} else {
  root.replaceChildren(head, el('p', 'tool-message is-error', ERROR_LOAD));
}
