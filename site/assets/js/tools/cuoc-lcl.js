// Trang công cụ cước LCL: tổng CBM, GW, đơn giá, mức tối thiểu, phí đầu xuất, phí đầu nhập và cách hiện kết quả.
import {
  BEN_THANG_TEXT,
  CACH_TINH_TEXT,
  calculateLcl,
  chuaTinhPhiText,
  DAU_TEXT,
  feeGroups,
  formatRt,
  formatUsd,
  lclCopyText,
  lclSteps,
} from '../calc/cuoc-lcl.js';
import { formatCbm } from '../calc/cbm.js';
import { formatNumber } from '../core/format.js';
import { renderFeeList } from '../core/fee-list.js';
import { showNumber } from '../core/package-list.js';
import { createField, mountTool, readNumberField } from '../core/tool-shell.js';

const DEFAULT_MINIMUM = 1;
const FEE_HINT = 'Bấm mũi tên trong ô Tên phí để chọn phí thường gặp, hoặc gõ tên khác. Theo RT: số tiền nhân với RT tính cước. Theo lô: cộng một lần cho cả lô.';

// Ví dụ trong đặc tả, số tự đặt. Không điền phí để khỏi tự đặt thêm số.
const EXAMPLE = { tongCbm: 3, gw: 500, donGia: 20 };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Không tải được danh sách gợi ý thì ô tên phí vẫn gõ tự do được.
async function loadFeeNames() {
  try {
    const response = await fetch('/data/phi-lcl.json');
    if (!response.ok) throw new Error(`Không tải được phi-lcl.json (${response.status})`);
    return await response.json();
  } catch (error) {
    console.error(error);
    return { dau_xuat: [], dau_nhap: [] };
  }
}

const FEE_NAMES = await loadFeeNames();

function renderInputs(slot, onChange) {
  const cbm = createField({ name: 'tong-cbm', label: 'Tổng CBM' });
  const gw = createField({ name: 'tong-gw', label: 'Tổng GW', unit: 'kg' });
  const rate = createField({ name: 'don-gia', label: 'Đơn giá', unit: 'USD/RT', optional: true });
  const minimum = createField({ name: 'muc-toi-thieu', label: 'Mức tối thiểu', unit: 'RT', optional: true });
  minimum.control.value = showNumber(DEFAULT_MINIMUM);

  const exportSlot = el('div');
  const importSlot = el('div');
  const exportFees = renderFeeList(exportSlot, onChange, {
    title: DAU_TEXT.xuat,
    idPrefix: 'xuat',
    items: FEE_NAMES.dau_xuat,
    hint: FEE_HINT,
  });
  const importFees = renderFeeList(importSlot, onChange, {
    title: DAU_TEXT.nhap,
    idPrefix: 'nhap',
    items: FEE_NAMES.dau_nhap,
  });
  slot.append(cbm.wrap, gw.wrap, rate.wrap, minimum.wrap, exportSlot, importSlot);

  return {
    read() {
      const readings = [cbm, gw, rate, minimum].map(readNumberField);
      const exported = exportFees.read();
      const imported = importFees.read();
      return {
        values: {
          tongCbm: readings[0].number,
          gw: readings[1].number,
          donGia: readings[2].number,
          mucToiThieu: readings[3].number,
          phiXuat: exported.phi,
          phiNhap: imported.phi,
        },
        invalid: exported.invalid || imported.invalid || readings.some((reading) => reading.invalid),
      };
    },

    fill(data) {
      cbm.control.value = showNumber(data.tongCbm);
      gw.control.value = showNumber(data.gw);
      rate.control.value = showNumber(data.donGia);
      minimum.control.value = showNumber(data.mucToiThieu ?? DEFAULT_MINIMUM);
      exportFees.fill(data.phiXuat);
      importFees.fill(data.phiNhap);
    },
  };
}

function resultRow(label, value, className) {
  const row = el('div', className);
  row.append(el('dt', '', label), el('dd', '', value));
  return row;
}

// Số nổi bật là số tiền cuối cùng đã tính được: tổng chi phí, rồi cước biển, rồi RT.
function headline(value) {
  if (value.tongChiPhi !== null) return { key: 'tong', label: 'Tổng chi phí', text: formatUsd(value.tongChiPhi) };
  if (value.cuocBien !== null) return { key: 'cuoc', label: 'Cước biển', text: formatUsd(value.cuocBien) };
  return { key: 'rt', label: 'RT tính cước', text: `${formatRt(value.rt)} RT` };
}

function renderResult(value, box) {
  const main = headline(value);
  const groups = feeGroups(value);
  const total = el('div', 'tool-total');
  total.append(el('span', 'tool-total-label', main.label), el('span', 'tool-total-value', main.text));
  box.append(total);

  if (value.theoToiThieu) box.append(el('p', 'tool-result-note', 'Tính theo mức tối thiểu.'));
  if (value.chuaTinh.length > 0) box.append(el('p', 'tool-warning', chuaTinhPhiText(value.chuaTinh)));
  if (value.cuocBien === null && groups.length > 0) {
    box.append(el('p', 'tool-result-note', 'Nhập đơn giá để tính cước biển và tổng chi phí.'));
  }

  const rows = el('dl', 'tool-rows');
  rows.append(
    resultRow('Tính theo', BEN_THANG_TEXT[value.benThang]),
    resultRow('Tổng CBM', `${formatCbm(value.tongCbm)} CBM`),
    resultRow('Tổng GW', `${formatNumber(value.gw)} kg (${formatNumber(value.tan)} tấn)`),
  );
  if (main.key !== 'rt') rows.append(resultRow('RT tính cước', `${formatRt(value.rt)} RT`));
  if (main.key === 'tong') rows.append(resultRow('Cước biển', formatUsd(value.cuocBien)));
  for (const { dau, dong, tong } of groups) {
    rows.append(resultRow(DAU_TEXT[dau], formatUsd(tong)));
    for (const item of dong) {
      rows.append(resultRow(`${item.ten} (${CACH_TINH_TEXT[item.cachTinh]})`, formatUsd(item.thanhTien), 'tool-row-sub'));
    }
  }
  box.append(rows);
}

await mountTool({
  id: 'cuoc-lcl',
  renderInputs,
  example: EXAMPLE,
  calculate: calculateLcl,
  renderResult,
  steps: (values, value) => lclSteps(value),
  copyText: lclCopyText,
  stickyTotal: (value) => {
    // Thanh dính đáy phải gọn một dòng trên 360 px nên dùng chữ ngắn;
    // phí chưa có số tiền đã được báo trong khung kết quả nên không nhắc lại ở đây.
    const { key, text } = headline(value);
    const short = { tong: 'Tổng', cuoc: 'Cước' }[key];
    return short ? `${short}: ${text}, RT ${formatRt(value.rt)}` : `RT: ${formatRt(value.rt)}`;
  },
  note: 'Công thức: quy ước 1 CBM tương đương 1 tấn (1.000 kg). RT là số lớn hơn giữa tổng CBM và GW đổi ra tấn, rồi so với mức tối thiểu; cước biển = RT × đơn giá. Phí theo RT nhân với RT tính cước, phí theo lô cộng một lần. Mỗi khoản tiền làm tròn tới 0,01 USD rồi mới cộng. Mức tối thiểu và cách tính từng phí tùy hãng tàu hay đại lý, nên bạn đối chiếu với báo giá mình nhận được. Ai trả phí đầu xuất, phí đầu nhập tùy điều kiện Incoterms của hợp đồng. Nút Điền ví dụ dùng số tự đặt. Kết quả chỉ để tham khảo.',
});
