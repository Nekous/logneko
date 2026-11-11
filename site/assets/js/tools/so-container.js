// Trang kiểm tra số container: ô dán danh sách, thẻ kết quả từng số và danh sách mã hãng.
import {
  CHU_SO_HUU_NHAC,
  checkContainerList,
  containerCopyText,
  containerSteps,
  formatContainer,
  headlineText,
  LOAI_THIET_BI_TEXT,
  ownerIndex,
  sourceText,
} from '../calc/so-container.js';
import { mountTool } from '../core/tool-shell.js';

const BADGE = {
  'hop-le': { text: 'Hợp lệ', className: 'is-ok' },
  'sai-chu-so': { text: 'Sai', className: 'is-bad' },
  'sai-dinh-dang': { text: 'Sai', className: 'is-bad' },
  'thieu-chu-so': { text: 'Thiếu số cuối', className: 'is-pending' },
  'chua-du': { text: 'Chưa đủ', className: 'is-pending' },
};

// Danh sách dài hơn số này thì gập phần chi tiết, chỉ mở sẵn số sai chữ số kiểm tra.
const OPEN_DETAILS_MAX = 3;

// Số đầu là ví dụ của ISO 6346, số thứ hai gõ sai chữ số cuối;
// số thứ ba tự đặt, viết lẫn chữ thường, dấu cách, gạch nối.
const EXAMPLE = { danhSach: 'CSQU3054383\nCSQU3054384\nmscu 123456-6' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Không tải được danh sách hãng thì vẫn kiểm tra được số, chỉ không hiện tên hãng.
async function loadOwnerCodes() {
  try {
    const response = await fetch('/data/owner-codes.json');
    if (!response.ok) throw new Error(`Không tải được owner-codes.json (${response.status})`);
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}

const OWNER_DATA = await loadOwnerCodes();
const OWNERS = ownerIndex(OWNER_DATA);

function resultRow(label, value, valueClass) {
  const row = el('div');
  row.append(el('dt', '', label), el('dd', valueClass, value));
  return row;
}

function checkDigitText(item) {
  if (item.trangThai === 'sai-chu-so') return `đúng phải là ${item.chuSoDung}, đang là ${item.chuSoNhap}`;
  if (item.trangThai === 'thieu-chu-so') return `${item.chuSoDung}, chưa nhập`;
  return String(item.chuSoDung);
}

// Không có tên hãng thì chữ nhạt, để không bị đọc nhầm thành lỗi.
function ownerRow(item) {
  if (!OWNER_DATA) return resultRow('Hãng', 'Không tải được danh sách hãng', 'is-muted');
  if (!item.hang) return resultRow('Hãng', 'Chưa có trong danh sách', 'is-muted');
  return resultRow('Hãng', item.hang);
}

function renderItem(item, { showIndex, collapse }) {
  const card = el('li', 'cont-item');
  const head = el('div', 'cont-item-head');
  if (showIndex) head.append(el('span', 'cont-index', `${item.thuTu}.`));
  const badge = BADGE[item.trangThai];
  head.append(el('span', 'cont-number', formatContainer(item)), el('span', `cont-badge ${badge.className}`, badge.text));
  card.append(head);

  if (item.thongBao) {
    const isError = badge.className === 'is-bad';
    card.append(el('p', isError ? 'cont-message is-error' : 'cont-message', item.thongBao));
  }
  if (item.trungVoi) card.append(el('p', 'cont-message', `Trùng với số thứ ${item.trungVoi}.`));

  if (item.tinhToan) {
    const rows = el('dl', 'tool-rows');
    rows.append(
      resultRow('Chủ sở hữu', item.maChuSoHuu),
      resultRow('Loại thiết bị', `${item.loaiThietBi}: ${LOAI_THIET_BI_TEXT[item.loaiThietBi]}`),
      resultRow('Số sê-ri', item.soSeri),
      resultRow('Chữ số kiểm tra', checkDigitText(item)),
      ownerRow(item),
    );
    if (collapse) {
      const details = el('details', 'cont-details');
      details.open = item.trangThai === 'sai-chu-so';
      details.append(el('summary', '', 'Chi tiết'), rows);
      card.append(details);
    } else {
      card.append(rows);
    }
  }
  return card;
}

function renderResult(value, box) {
  const total = el('div', 'tool-total');
  total.append(
    el('span', 'tool-total-label', value.tong === 1 ? 'Kết quả' : `Đã kiểm tra ${value.tong} số`),
    el('span', 'tool-total-value', headlineText(value)),
  );
  const list = el('ol', 'cont-list');
  const options = { showIndex: value.tong > 1, collapse: value.tong > OPEN_DETAILS_MAX };
  list.append(...value.ketQua.map((item) => renderItem(item, options)));
  box.append(total, list, el('p', 'tool-result-note', CHU_SO_HUU_NHAC));
}

await mountTool({
  id: 'so-container',
  fields: [{
    name: 'danhSach',
    label: 'Số container',
    type: 'textarea',
    rows: 5,
    placeholder: 'Ví dụ: CSQU3054383',
    hint: 'Mỗi số một dòng hoặc cách nhau bằng dấu phẩy. Gõ chữ thường, dấu cách hay gạch nối đều được.',
    attrs: { autocapitalize: 'characters', autocorrect: 'off', spellcheck: 'false' },
  }],
  example: EXAMPLE,
  emptyText: 'Dán số container để xem kết quả.',
  calculate: (values) => checkContainerList(values.danhSach, OWNERS),
  renderResult,
  steps: (values, value) => containerSteps(value),
  copyText: containerCopyText,
  stickyTotal: (value) => (value.tong === 1 ? `${value.ketQua[0].so}: ${headlineText(value)}` : headlineText(value)),
  // Dòng lịch sử nêu số đầu tiên, để biết lần kiểm tra đó là danh sách nào.
  historyText: (value) => (value.tong === 1
    ? `${value.ketQua[0].so}: ${headlineText(value)}`
    : `${value.ketQua[0].so} và ${value.tong - 1} số khác: ${headlineText(value)}`),
  note: `Công thức theo ISO 6346: số container gồm 3 chữ mã chủ sở hữu, 1 chữ loại thiết bị (U, J hoặc Z), 6 số sê-ri và 1 chữ số kiểm tra tính từ 10 ký tự đầu. Số hợp lệ chỉ có nghĩa là viết đúng mẫu, không cho biết cont có thật hay đang ở đâu. ${OWNER_DATA ? sourceText(OWNER_DATA) : 'Không tải được danh sách mã hãng.'} Nút Điền ví dụ dùng số ví dụ của ISO 6346, chính số đó gõ sai chữ số cuối, và một số tự đặt. Kết quả chỉ để tham khảo.`,
});
