// Trang công cụ xếp container: kích thước và trọng lượng thùng, loại cont, cách xoay, số tầng, ngưỡng OWS.
import {
  calculateXep,
  formatPercent,
  GIOI_HAN_TEXT,
  huongText,
  luoiText,
  owsText,
  soContText,
  vuotTaiText,
  XOAY_TEXT,
  xepCopyText,
  xepSteps,
} from '../calc/xep-container.js';
import { formatNumber } from '../core/format.js';
import { showNumber } from '../core/package-list.js';
import { createField, mountTool, readNumberField } from '../core/tool-shell.js';
import { createViewer } from './xep-container-3d.js';

const SHORT_ERROR = 'Chưa đọc được';
const ERROR_DATA = 'Không tải được bảng thông số container, nên chưa tính được. Bạn thử tải lại trang.';

// Ví dụ trong đặc tả, số tự đặt.
const EXAMPLE = { dai: 50, rong: 40, cao: 30, loaiCont: '20gp', xoay: 'moi-huong' };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function loadContainers() {
  const response = await fetch('/data/container.json');
  if (!response.ok) throw new Error(`Không tải được container.json (${response.status})`);
  return response.json();
}

let DATA;
try {
  DATA = await loadContainers();
} catch (error) {
  console.error(error);
}

const viewer = createViewer();

function renderInputs(slot, onChange) {
  const size = el('div', 'xc-cells xc-cells--3');
  const dai = createField({ name: 'dai', label: 'Dài', unit: 'cm', errorText: SHORT_ERROR });
  const rong = createField({ name: 'rong', label: 'Rộng', unit: 'cm', errorText: SHORT_ERROR });
  const cao = createField({ name: 'cao', label: 'Cao', unit: 'cm', errorText: SHORT_ERROR });
  size.append(dai.wrap, rong.wrap, cao.wrap);

  const more = el('div', 'xc-cells');
  const weight = createField({ name: 'trong-luong', label: 'Trọng lượng mỗi thùng', unit: 'kg', optional: true, errorText: SHORT_ERROR });
  const count = createField({ name: 'so-thung', label: 'Số thùng', optional: true, errorText: SHORT_ERROR });
  more.append(weight.wrap, count.wrap);

  const type = createField({
    name: 'loai-cont',
    label: 'Loại cont',
    type: 'select',
    options: DATA.loai.map((loai) => ({ value: loai.id, label: loai.ten })),
  });
  const rotate = createField({
    name: 'xoay',
    label: 'Cho xoay thùng',
    type: 'select',
    options: Object.entries(XOAY_TEXT).map(([value, label]) => ({ value, label })),
    hint: 'Hàng ghi "This side up" (mặt này hướng lên) thì chọn chỉ xoay ngang, giữ mặt trên.',
  });
  const tiers = createField({ name: 'so-tang', label: 'Số tầng chồng tối đa', optional: true, hint: 'Để trống thì chồng tới khi chạm nóc cont.' });
  const ows = createField({ name: 'nguong-ows', label: "Ngưỡng nhắc phụ phí quá tải (OWS) cho cont 20'", unit: 'tấn', optional: true });
  slot.append(size, more, type.wrap, rotate.wrap, tiers.wrap, ows.wrap);

  const owsDefault = DATA.ows?.nguong_tan ?? null;
  ows.control.value = showNumber(owsDefault);
  // Ngưỡng OWS chỉ dùng cho cont 20', chọn cont khác thì ẩn ô.
  const syncOws = () => { ows.wrap.hidden = !DATA.ows?.ap_dung.includes(type.control.value); };
  type.control.addEventListener('change', syncOws);
  syncOws();

  const numbers = { dai, rong, cao, trongLuong: weight, soThung: count, soTangToiDa: tiers, nguongOws: ows };

  return {
    read() {
      const values = { loaiCont: type.control.value, xoay: rotate.control.value };
      let invalid = false;
      for (const [key, item] of Object.entries(numbers)) {
        const reading = readNumberField(item);
        values[key] = reading.number;
        invalid ||= reading.invalid;
      }
      return { values, invalid };
    },

    fill(data) {
      for (const [key, item] of Object.entries(numbers)) {
        // Lịch sử cũ hay số chuyển sang không nhắc ngưỡng OWS thì giữ mặc định; để trống có chủ ý thì giữ trống.
        const value = key === 'nguongOws' && data[key] === undefined ? owsDefault : data[key];
        item.control.value = showNumber(value);
      }
      type.control.value = DATA.loai.some((loai) => loai.id === data.loaiCont) ? data.loaiCont : DATA.loai[0].id;
      rotate.control.value = data.xoay in XOAY_TEXT ? data.xoay : 'moi-huong';
      syncOws();
    },
  };
}

function resultRow(label, value, className) {
  const row = el('div', className);
  row.append(el('dt', '', label), el('dd', '', value));
  return row;
}

function useRows(info, scope) {
  const rows = [resultRow(`Thể tích đã dùng${scope}`, formatPercent(info.phanTramTheTich))];
  rows.push(info.kg === null
    ? resultRow(`Tải trọng đã dùng${scope}`, 'Chưa nhập trọng lượng')
    : resultRow(`Tải trọng đã dùng${scope}`, `${formatPercent(info.phanTramTai)} (${formatNumber(info.kg)} kg)`));
  return rows;
}

function renderResult(value, box) {
  const total = el('div', 'tool-total');
  total.append(
    el('span', 'tool-total-label', `Mỗi cont ${value.loai.ten} xếp được`),
    el('span', 'tool-total-value', `${formatNumber(value.moiCont)} thùng`),
  );
  box.append(total);

  if (value.vuotTai) box.append(el('p', 'tool-warning', vuotTaiText(value)));

  const rows = el('dl', 'tool-rows');
  rows.append(
    resultRow('Đặt thùng (theo dài × rộng × cao cont)', huongText(value.huong)),
    resultRow('Lưới (dài × rộng × tầng)', luoiText(value.huong)),
    resultRow('Bị giới hạn bởi', GIOI_HAN_TEXT[value.gioiHan]),
  );
  if (value.soCont !== null) rows.append(resultRow(`Số cont cho ${formatNumber(value.soThung)} thùng`, soContText(value)));
  if (value.soCont === 1 && value.contCuoi) {
    rows.append(...useRows(value.contCuoi, ''));
  } else {
    rows.append(...useRows(value.contDay, value.soCont === null ? '' : ', cont đầy'));
    if (value.contCuoi) rows.append(...useRows(value.contCuoi, ', cont cuối').map((row) => { row.className = 'tool-row-sub'; return row; }));
  }
  box.append(rows);

  const ows = owsText(value);
  if (ows) box.append(el('p', 'xc-nhac', ows));

  box.append(viewer.element);
  viewer.show(value);

  box.append(el('p', 'tool-result-note', 'Số liệu cont chỉ để tham khảo, đối chiếu với hãng tàu. Bản này xếp một loại thùng theo lưới, chưa tính pallet, vật chèn hay khe hở khi đóng hàng thật.'));
}

if (!DATA) {
  const root = document.getElementById('tool-root');
  root.replaceChildren(el('h1', '', 'Xếp hàng vào container'), el('p', 'tool-message is-error', ERROR_DATA));
} else {
  await mountTool({
    id: 'xep-container',
    renderInputs,
    example: EXAMPLE,
    calculate: (values) => calculateXep(values, DATA),
    renderResult,
    steps: (values, value) => xepSteps(value),
    copyText: xepCopyText,
    stickyTotal: (value) => {
      const cont = value.soCont === null ? '' : ` · cần ${formatNumber(value.soCont)} cont`;
      return `${formatNumber(value.moiCont)} thùng/cont ${value.loai.ten}${cont}`;
    },
    emptyText: 'Nhập dài, rộng, cao của thùng để xem kết quả.',
    note: `Cách tính: thử các hướng đặt thùng được phép; mỗi hướng xếp theo lưới, số thùng = phần nguyên (dài lòng ÷ cạnh) × phần nguyên (rộng lòng ÷ cạnh) × số tầng. Chọn hướng nhiều thùng nhất, bằng nhau thì chọn hướng ít tầng hơn. Thùng phải lọt cửa cont. Có trọng lượng thì số thùng mỗi cont không vượt tải trọng hàng tối đa. Nguồn thông số cont: ${DATA.nguon}, cập nhật ${DATA.ngay_cap_nhat}; mỗi hãng và đời vỏ khác nhau một chút, hãy đối chiếu với hãng tàu. Nút Điền ví dụ dùng số tự đặt. Kết quả chỉ để tham khảo.`,
  });
}
