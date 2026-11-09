// Đọc dữ liệu Incoterms 2020 cho trang tra cứu. Hàm thuần, chạy được cả trong test.

export const BEN_TEXT = { ban: 'Người bán', mua: 'Người mua', chia: 'Chia hai bên' };

// FCA mặc định vẽ cách giao tại kho người bán; địa chỉ chỉ ghi fca khi đổi sang cách khác.
export const FCA_MAC_DINH = 'kho-ban';

const THAM_KHAO = 'Tóm tắt Incoterms 2020 của LOGNEKO, chỉ để tham khảo; hợp đồng thực tế có thể thỏa thuận khác.';

export function findTerm(data, ma) {
  const code = String(ma ?? '').trim().toUpperCase();
  if (!code) return null;
  return data.dieu_kien.find((term) => term.ma === code) ?? null;
}

export function findWay(term, id) {
  return term.cach_giao.find((way) => way.id === id) ?? term.cach_giao[0];
}

// Đọc ?dk=FOB&ss=CIF&fca=cang. Mã sai bị bỏ; chỉ có mã so sánh thì coi nó là mã chính.
export function parseSelection(data, search) {
  const params = new URLSearchParams(search);
  let a = findTerm(data, params.get('dk'))?.ma ?? null;
  let b = findTerm(data, params.get('ss'))?.ma ?? null;
  if (!a) [a, b] = [b, null];
  if (b === a) b = null;

  const fcaWays = findTerm(data, 'FCA')?.cach_giao.map((way) => way.id) ?? [];
  const fca = fcaWays.includes(params.get('fca')) ? params.get('fca') : FCA_MAC_DINH;
  return { a, b, fca };
}

export function selectionQuery({ a, b, fca }) {
  if (!a) return '';
  const params = new URLSearchParams({ dk: a });
  if (b) params.set('ss', b);
  if (fca !== FCA_MAC_DINH && [a, b].includes('FCA')) params.set('fca', fca);
  return `?${params}`;
}

function bothSides(data, way, id) {
  const index = data.chang.findIndex((step) => step.id === id);
  const value = way.chang[index];
  return { gia_tri: BEN_TEXT[value], ghi_chu: way.ghi_chu_chang?.[id], so_sanh: value };
}

// Không bắt buộc vẫn ghi bên nên cân nhắc mua, để FOB và DAP so ra khác nhau.
function insuranceText(insurance) {
  const side = BEN_TEXT[insurance.ai];
  if (insurance.bat_buoc) return `${side} mua, tối thiểu ${insurance.muc}`;
  return `Không bắt buộc, ${side.toLowerCase()} nên cân nhắc`;
}

// Bảng tóm tắt một điều kiện. Thông quan và local charges đọc từ chặng, để dữ liệu chỉ có một chỗ.
// so_sanh là giá trị dùng để so hai điều kiện; rủi ro so theo vị trí, không so câu chữ.
export function summaryRows(data, term, cachGiaoId) {
  const way = findWay(term, cachGiaoId);
  const group = data.nhom.find((item) => item.id === term.phuong_thuc);
  const groupText = `Nhóm ${term.nhom_chu}, ${group.ten.toLowerCase()}`;
  return [
    { id: 'nhom', nhan: 'Nhóm', gia_tri: groupText, so_sanh: groupText },
    { id: 'giao-hang', nhan: 'Giao hàng', gia_tri: way.giao_hang, so_sanh: way.giao_hang },
    { id: 'rui-ro', nhan: 'Rủi ro chuyển', gia_tri: way.rui_ro.mo_ta, so_sanh: way.rui_ro.vi_tri },
    { id: 'thong-quan-xk', nhan: 'Thông quan xuất khẩu', ...bothSides(data, way, 'thong-quan-xk') },
    { id: 'thong-quan-nk', nhan: 'Thông quan nhập khẩu', ...bothSides(data, way, 'thong-quan-nk') },
    { id: 'bao-hiem', nhan: 'Bảo hiểm', gia_tri: insuranceText(term.bao_hiem), ghi_chu: term.bao_hiem.ghi_chu, so_sanh: insuranceText(term.bao_hiem) },
    { id: 'local-xuat', nhan: 'Local charges đầu xuất', ...bothSides(data, way, 'phi-noi-di') },
    { id: 'local-nhap', nhan: 'Local charges đầu nhập', ...bothSides(data, way, 'phi-noi-den') },
  ];
}

export function stepRows(data, term, cachGiaoId) {
  const way = findWay(term, cachGiaoId);
  return data.chang.map((step, index) => ({
    id: `chang-${step.id}`,
    nhan: `${index + 1}. ${step.ten}`,
    ...bothSides(data, way, step.id),
  }));
}

// Hai bên so sánh có dạng { term, cachGiao }; khác nhau thì khac = true.
export function compareRows(data, left, right) {
  const rowsOf = (side) => [...summaryRows(data, side.term, side.cachGiao), ...stepRows(data, side.term, side.cachGiao)];
  const rightRows = rowsOf(right);
  return rowsOf(left).map((row, index) => {
    const other = rightRows[index];
    return {
      id: row.id,
      nhan: row.nhan,
      a: row.gia_tri,
      b: other.gia_tri,
      ghiChuA: row.ghi_chu,
      ghiChuB: other.ghi_chu,
      khac: row.so_sanh !== other.so_sanh,
    };
  });
}

// Tên một bên khi so sánh: FCA kèm cách giao, vì hai cách giao khác nhau.
export function sideLabel(side) {
  if (side.term.cach_giao.length < 2) return side.term.ma;
  // Chỉ hạ chữ cái đầu, để viết tắt như ICD giữ nguyên chữ hoa.
  const name = findWay(side.term, side.cachGiao).ten;
  return `${side.term.ma} (${name[0].toLowerCase()}${name.slice(1)})`;
}

export function termCopyText(data, term, cachGiaoId) {
  const way = findWay(term, cachGiaoId);
  return [
    `${term.ma} (${term.ten_en}): ${term.ten_vi}, Incoterms 2020`,
    ...(term.cach_giao.length > 1 ? [`Cách giao: ${way.ten}`] : []),
    ...summaryRows(data, term, cachGiaoId).map((row) => `${row.nhan}: ${row.gia_tri}`),
    'Ai trả từng chặng:',
    ...stepRows(data, term, cachGiaoId).map((row) => `${row.nhan}: ${row.gia_tri}`),
    `Cách ghi: ${term.cach_ghi.vi_du}`,
    THAM_KHAO,
  ].join('\n');
}

export function compareCopyText(data, left, right) {
  const [nameA, nameB] = [sideLabel(left), sideLabel(right)];
  return [
    `So sánh ${nameA} và ${nameB} (Incoterms 2020)`,
    ...compareRows(data, left, right).map((row) => `${row.nhan}: ${nameA} ${row.a}; ${nameB} ${row.b}${row.khac ? ' (khác)' : ''}`),
    THAM_KHAO,
  ].join('\n');
}
