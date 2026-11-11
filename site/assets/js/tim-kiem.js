// Ô tìm kiếm chung ở đầu trang chủ. Cách tìm nằm trong calc/tim-kiem.js, ở đây chỉ vẽ.
import { demDong, timChung } from './calc/tim-kiem.js';
import { saveTransfer } from './core/transfer.js';

const SEARCH_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m15.5 15.5 5 5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
const NGUON_TAI = [
  { key: 'incoterms', url: '/data/incoterms.json', ten: 'Incoterms' },
  { key: 'tuDien', url: '/data/tu-dien.json', ten: 'từ điển' },
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Không tải được ${url} (${response.status})`);
  return response.json();
}

function renderRow(dong) {
  const item = el('li', 'search-item');
  const main = el(dong.href ? 'a' : 'div', 'search-main');
  if (dong.href) main.href = dong.href;
  const top = el('span', 'search-top');
  top.append(el('span', 'search-title', dong.tieuDe));
  if (dong.phu) top.append(el('span', 'search-sub', dong.phu));
  if (dong.nhan) top.append(el('span', 'badge', dong.nhan));
  main.append(top, el('span', 'search-desc', dong.moTa));
  // Số container đi kèm số đã gõ: lưu lại để trang số container tự điền.
  if (dong.chuyen) {
    main.addEventListener('click', () => saveTransfer(dong.chuyen.den, { tu: 'tìm kiếm', data: dong.chuyen.data }));
  }
  item.append(main);

  if (dong.linkPhu.length) {
    const extra = el('div', 'search-extra');
    for (const link of dong.linkPhu) {
      const node = el('a', 'search-chip', link.ten);
      node.href = link.href;
      extra.append(node);
    }
    item.append(extra);
  }
  return item;
}

function renderGroup(nhom) {
  const section = el('section', 'search-group');
  const title = el('h3', 'search-group-title', nhom.ten);
  title.id = `search-nhom-${nhom.id}`;
  const list = el('ul', 'search-list');
  list.setAttribute('aria-labelledby', title.id);
  list.append(...nhom.dong.map(renderRow));
  section.append(title, list);
  if (nhom.xemTatCa) {
    const all = el('a', 'search-all', nhom.xemTatCa.ten);
    all.href = nhom.xemTatCa.href;
    section.append(all);
  }
  return section;
}

export function mountSearch(slot, congCu) {
  const nguon = { congCu, incoterms: null, tuDien: null };
  let dangTai = null;
  const loi = [];

  const label = el('label', 'search-label', 'Tìm thuật ngữ, Incoterms, mã HS');
  label.htmlFor = 'search-q';
  const box = el('div', 'search-box');
  box.innerHTML = SEARCH_ICON;
  const input = el('input', 'search-input');
  Object.assign(input, { id: 'search-q', type: 'search', placeholder: 'Ví dụ: FOB, THC, 8471', autocomplete: 'off', spellcheck: false });
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('enterkeyhint', 'search');
  input.setAttribute('aria-describedby', 'search-hint');
  box.append(input);
  const hint = el('p', 'search-hint', 'Gõ được số container để kiểm tra ngay.');
  hint.id = 'search-hint';

  const panel = el('div', 'search-panel');
  panel.hidden = true;
  // Chỉ đọc dòng đếm cho trình đọc màn hình, không đọc lại cả danh sách sau mỗi phím gõ.
  const count = el('p', 'search-count');
  count.setAttribute('role', 'status');
  const groups = el('div', 'search-groups');
  const note = el('p', 'search-note');
  panel.append(count, groups, note);
  slot.replaceChildren(label, box, hint, panel);

  const render = () => {
    const chu = input.value.trim();
    panel.hidden = !chu;
    if (!chu) {
      count.textContent = '';
      groups.replaceChildren();
      return;
    }
    const ketQua = timChung(nguon, chu);
    const soDong = demDong(ketQua);
    count.textContent = soDong
      ? `Có ${soDong} kết quả khớp nhất cho "${chu}".`
      : `Không thấy kết quả cho "${chu}". Thử gõ viết tắt, tên tiếng Anh, hoặc xem danh sách công cụ bên dưới.`;
    count.classList.toggle('is-sr', soDong > 0);
    groups.replaceChildren(...ketQua.map(renderGroup));
    if (dangTai) note.textContent = 'Đang tải dữ liệu Incoterms và từ điển…';
    else note.textContent = loi.length ? `Không tải được dữ liệu ${loi.join(' và ')}, nên kết quả có thể thiếu. Bạn thử tải lại trang.` : '';
    note.hidden = !note.textContent;
  };

  // Dữ liệu Incoterms và từ điển chỉ tải khi người dùng bắt đầu tìm, để trang chủ nhẹ trên điện thoại.
  const load = () => {
    dangTai ??= Promise.allSettled(NGUON_TAI.map((item) => fetchJson(item.url))).then((results) => {
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') nguon[NGUON_TAI[index].key] = result.value;
        else {
          console.error(result.reason);
          loi.push(NGUON_TAI[index].ten);
        }
      });
      dangTai = false;
      render();
    });
  };

  const links = () => [...panel.querySelectorAll('a')];

  input.addEventListener('focus', load);
  input.addEventListener('input', () => {
    load();
    render();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      // Gõ nhanh rồi Enter ngay thì dữ liệu có thể chưa tải xong: chờ xong rồi mới mở.
      const openFirst = () => panel.querySelector('a.search-main')?.click();
      if (dangTai) dangTai.then(openFirst);
      else openFirst();
    } else if (event.key === 'ArrowDown' && !panel.hidden) {
      event.preventDefault();
      links()[0]?.focus();
    } else if (event.key === 'Escape') {
      input.value = '';
      render();
    }
  });
  // Mũi tên lên xuống đi giữa các link kết quả; Esc quay về ô tìm.
  panel.addEventListener('keydown', (event) => {
    const all = links();
    const index = all.indexOf(document.activeElement);
    if (index < 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = index + (event.key === 'ArrowDown' ? 1 : -1);
      if (next < 0) input.focus();
      else all[Math.min(next, all.length - 1)].focus();
    } else if (event.key === 'Escape') {
      input.focus();
    }
  });
}
