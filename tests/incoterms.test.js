import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  compareCopyText,
  compareRows,
  findTerm,
  findWay,
  parseSelection,
  selectionQuery,
  summaryRows,
  termCopyText,
} from '../site/assets/js/calc/incoterms.js';

const DATA = JSON.parse(readFileSync(new URL('../site/data/incoterms.json', import.meta.url), 'utf8'));
const TERMS = DATA.dieu_kien;
const codes = (list) => list.map((term) => term.ma);
const term = (ma) => TERMS.find((item) => item.ma === ma);
// Mọi cách giao của mọi điều kiện, để FCA được soát cả hai cách.
const ways = TERMS.flatMap((item) => item.cach_giao.map((way) => ({ term: item, way })));
const chang = (way, id) => way.chang[DATA.chang.findIndex((item) => item.id === id)];
const VAN_CHUYEN = DATA.chang.filter((item) => !item.id.startsWith('thong-quan'));

// Bảng 9 chặng Khải đã duyệt trong kế hoạch, chép tay để sửa nhầm một ô trong JSON thì test báo đỏ.
// B: người bán, M: người mua, ½: chia hai bên. Số cuối là vị trí rủi ro (số chặng đã xong).
const BANG_DA_DUYET = {
  'EXW kho-ban': ['M M M M M M M M M', 0],
  'FCA kho-ban': ['B M B M M M M M M', 1],
  'FCA cang': ['B B B M M M M M M', 2],
  'CPT nguoi-cho-dau-tien': ['B B B B B ½ M M M', 2],
  'CIP nguoi-cho-dau-tien': ['B B B B B ½ M M M', 2],
  'DAP noi-den': ['B B B B B B M B M', 8],
  'DPU noi-den': ['B B B B B B M B B', 9],
  'DDP noi-den': ['B B B B B B B B M', 8],
  'FAS doc-man-tau': ['B B B ½ M M M M M', 3.5],
  'FOB tren-tau': ['B B B B M M M M M', 4],
  'CFR tren-tau': ['B B B B B ½ M M M', 4],
  'CIF tren-tau': ['B B B B B ½ M M M', 4],
};
const KY_HIEU = { ban: 'B', mua: 'M', chia: '½' };
// Bên nên cân nhắc mua bảo hiểm (hoặc bắt buộc mua với CIF, CIP).
const BAO_HIEM_AI = {
  EXW: 'mua', FCA: 'mua', CPT: 'mua', CIP: 'ban', DAP: 'ban', DPU: 'ban',
  DDP: 'ban', FAS: 'mua', FOB: 'mua', CFR: 'mua', CIF: 'ban',
};

test('đủ 11 điều kiện, đúng thứ tự và đúng 2 nhóm phương thức', () => {
  assert.deepEqual(codes(TERMS), ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF']);
  assert.deepEqual(codes(TERMS.filter((item) => item.phuong_thuc === 'moi-phuong-thuc')), ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']);
  assert.deepEqual(codes(TERMS.filter((item) => item.phuong_thuc === 'bien')), ['FAS', 'FOB', 'CFR', 'CIF']);
  assert.deepEqual(DATA.nhom.map((item) => item.id), ['moi-phuong-thuc', 'bien']);
});

test('từng ô và vị trí rủi ro khớp đúng bảng đã duyệt', () => {
  const actual = Object.fromEntries(ways.map(({ term: item, way }) => [
    `${item.ma} ${way.id}`,
    [way.chang.map((value) => KY_HIEU[value]).join(' '), way.rui_ro.vi_tri],
  ]));
  assert.deepEqual(actual, BANG_DA_DUYET);
});

test('bên nên mua bảo hiểm của từng mã đúng bảng', () => {
  assert.deepEqual(Object.fromEntries(TERMS.map((item) => [item.ma, item.bao_hiem.ai])), BAO_HIEM_AI);
});

test('nhóm chữ E, F, C, D đúng theo tài liệu', () => {
  const byGroup = (letter) => codes(TERMS.filter((item) => item.nhom_chu === letter)).sort();
  assert.deepEqual(byGroup('E'), ['EXW']);
  assert.deepEqual(byGroup('F'), ['FAS', 'FCA', 'FOB']);
  assert.deepEqual(byGroup('C'), ['CFR', 'CIF', 'CIP', 'CPT']);
  assert.deepEqual(byGroup('D'), ['DAP', 'DDP', 'DPU']);
});

test('chỉ CIF và CIP bắt buộc người bán mua bảo hiểm: CIF ICC (C), CIP ICC (A)', () => {
  assert.deepEqual(term('CIF').bao_hiem, { ...term('CIF').bao_hiem, bat_buoc: true, ai: 'ban', muc: 'ICC (C)' });
  assert.deepEqual(term('CIP').bao_hiem, { ...term('CIP').bao_hiem, bat_buoc: true, ai: 'ban', muc: 'ICC (A)' });
  for (const item of TERMS.filter((t) => !['CIF', 'CIP'].includes(t.ma))) {
    assert.equal(item.bao_hiem.bat_buoc, false, item.ma);
    assert.equal(item.bao_hiem.muc, null, item.ma);
    assert.ok(item.bao_hiem.ghi_chu, item.ma);
  }
});

test('mỗi cách giao đủ 9 chặng, giá trị hợp lệ, ô chia có ghi chú, vị trí rủi ro hợp lệ', () => {
  assert.equal(DATA.chang.length, 9);
  for (const { term: item, way } of ways) {
    const name = `${item.ma} ${way.id}`;
    assert.equal(way.chang.length, 9, name);
    assert.ok(way.ten && way.giao_hang && way.rui_ro.mo_ta, name);
    way.chang.forEach((value, index) => {
      assert.ok(['ban', 'mua', 'chia'].includes(value), `${name} chặng ${index + 1}`);
      if (value === 'chia') assert.ok(way.ghi_chu_chang?.[DATA.chang[index].id], `${name} chặng ${index + 1} thiếu ghi chú`);
    });
    for (const id of Object.keys(way.ghi_chu_chang ?? {})) assert.ok(DATA.chang.some((item) => item.id === id), `${name}: ${id}`);
    const { vi_tri: position } = way.rui_ro;
    assert.ok(position >= 0 && position <= 9 && Number.isInteger(position * 2), name);
  }
});

test('thông quan: EXW người mua làm cả hai, DDP người bán làm cả hai, còn lại bán XK mua NK', () => {
  for (const { term: item, way } of ways) {
    const expected = { EXW: ['mua', 'mua'], DDP: ['ban', 'ban'] }[item.ma] ?? ['ban', 'mua'];
    assert.deepEqual([chang(way, 'thong-quan-xk'), chang(way, 'thong-quan-nk')], expected, `${item.ma} ${way.id}`);
  }
});

test('rủi ro chuyển ở nước xuất khẩu với nhóm E, F, C; ở nước nhập khẩu với nhóm D', () => {
  // Hết chặng 4 là hàng đã lên phương tiện chính ở nơi đi; từ chặng 6 là đã sang nước nhập khẩu.
  for (const { term: item, way } of ways) {
    if (item.nhom_chu === 'D') assert.ok(way.rui_ro.vi_tri >= 6, item.ma);
    else assert.ok(way.rui_ro.vi_tri <= 4, `${item.ma} ${way.id}`);
  }
});

test('E, F, D: điểm chi phí trùng điểm rủi ro; C: người bán trả cước chính dù rủi ro đã chuyển', () => {
  for (const { term: item, way } of ways) {
    const name = `${item.ma} ${way.id}`;
    const position = way.rui_ro.vi_tri;
    const mismatched = VAN_CHUYEN.filter((step) => {
      const index = DATA.chang.indexOf(step) + 1;
      const value = way.chang[index - 1];
      if (value === 'chia') return !(index - 1 < position && position < index);
      return value !== (index <= position ? 'ban' : 'mua');
    }).map((step) => step.id);

    if (item.nhom_chu === 'C') {
      assert.equal(chang(way, 'cuoc-chinh'), 'ban', name);
      assert.ok(position < DATA.chang.findIndex((step) => step.id === 'cuoc-chinh') + 1, name);
      assert.ok(mismatched.includes('cuoc-chinh'), name);
    } else {
      assert.deepEqual(mismatched, [], name);
    }
  }
});

test('DPU là điều kiện duy nhất người bán dỡ hàng tại nơi đến', () => {
  const unloading = ways.filter(({ way }) => chang(way, 'do-kho-mua') === 'ban').map(({ term: item }) => item.ma);
  assert.deepEqual(unloading, ['DPU']);
});

test('FCA có đúng 2 cách giao: tại kho người bán và tại cảng hoặc ICD', () => {
  assert.deepEqual(term('FCA').cach_giao.map((way) => way.id), ['kho-ban', 'cang']);
  for (const item of TERMS.filter((t) => t.ma !== 'FCA')) assert.equal(item.cach_giao.length, 1, item.ma);
});

test('cách ghi chứa chính mã đó và "Incoterms 2020"; có lỗi hay gặp và tóm tắt', () => {
  assert.equal(term('FOB').cach_ghi.vi_du, 'FOB Cat Lai Port, Vietnam, Incoterms 2020');
  for (const item of TERMS) {
    for (const text of [item.cach_ghi.mau, item.cach_ghi.vi_du]) {
      assert.ok(text.startsWith(`${item.ma} `), `${item.ma}: ${text}`);
      assert.ok(text.includes('Incoterms 2020'), `${item.ma}: ${text}`);
    }
    assert.ok(item.ten_en && item.ten_vi && item.tom_tat, item.ma);
    assert.ok(item.loi_hay_gap.length > 0, item.ma);
  }
  assert.ok(DATA.loi_chung.length > 0);
  assert.ok(DATA.nguon && DATA.cap_nhat);
});

test('lỗi dùng FOB/CIF cho hàng container được nhắc đúng chỗ', () => {
  for (const ma of ['FOB', 'CIF', 'CFR', 'FAS']) {
    assert.ok(term(ma).loi_hay_gap.some((text) => text.includes('container')), ma);
  }
});

test('findTerm không phân biệt hoa thường, mã lạ trả về null', () => {
  assert.equal(findTerm(DATA, 'fob').ma, 'FOB');
  assert.equal(findTerm(DATA, ' Cif ').ma, 'CIF');
  assert.equal(findTerm(DATA, 'DAT'), null);
  assert.equal(findTerm(DATA, ''), null);
  assert.equal(findTerm(DATA, null), null);
});

test('findWay lấy đúng cách giao, id lạ thì lấy cách đầu', () => {
  assert.equal(findWay(term('FCA'), 'cang').id, 'cang');
  assert.equal(findWay(term('FCA'), 'xyz').id, 'kho-ban');
  assert.equal(findWay(term('FOB')).id, term('FOB').cach_giao[0].id);
});

test('parseSelection đọc địa chỉ, bỏ mã sai và mã so sánh trùng', () => {
  assert.deepEqual(parseSelection(DATA, '?dk=fob&ss=CIF'), { a: 'FOB', b: 'CIF', fca: 'kho-ban' });
  assert.deepEqual(parseSelection(DATA, '?dk=FCA&fca=cang'), { a: 'FCA', b: null, fca: 'cang' });
  assert.deepEqual(parseSelection(DATA, '?dk=DAT&ss=FOB'), { a: 'FOB', b: null, fca: 'kho-ban' });
  assert.deepEqual(parseSelection(DATA, '?dk=FOB&ss=fob'), { a: 'FOB', b: null, fca: 'kho-ban' });
  assert.deepEqual(parseSelection(DATA, '?fca=lung-tung'), { a: null, b: null, fca: 'kho-ban' });
  assert.deepEqual(parseSelection(DATA, ''), { a: null, b: null, fca: 'kho-ban' });
});

test('selectionQuery ghi lại địa chỉ, chỉ ghi fca khi đang xem FCA cách khác mặc định', () => {
  assert.equal(selectionQuery({ a: 'FOB', b: 'CIF', fca: 'kho-ban' }), '?dk=FOB&ss=CIF');
  assert.equal(selectionQuery({ a: 'FOB', b: null, fca: 'cang' }), '?dk=FOB');
  assert.equal(selectionQuery({ a: 'CIF', b: 'FCA', fca: 'cang' }), '?dk=CIF&ss=FCA&fca=cang');
  assert.equal(selectionQuery({ a: null, b: null, fca: 'kho-ban' }), '');
  const round = { a: 'FCA', b: 'CPT', fca: 'cang' };
  assert.deepEqual(parseSelection(DATA, selectionQuery(round)), round);
});

test('summaryRows đọc thông quan và local charges từ chặng', () => {
  const rows = Object.fromEntries(summaryRows(DATA, term('FOB')).map((row) => [row.id, row]));
  assert.equal(rows['thong-quan-xk'].gia_tri, 'Người bán');
  assert.equal(rows['thong-quan-nk'].gia_tri, 'Người mua');
  assert.equal(rows['local-xuat'].gia_tri, 'Người bán');
  assert.equal(rows['local-nhap'].gia_tri, 'Người mua');
  assert.equal(rows['bao-hiem'].gia_tri, 'Không bắt buộc, người mua nên cân nhắc');

  const cif = Object.fromEntries(summaryRows(DATA, term('CIF')).map((row) => [row.id, row]));
  assert.equal(cif['bao-hiem'].gia_tri, 'Người bán mua, tối thiểu ICC (C)');
  assert.equal(cif['local-nhap'].gia_tri, 'Chia hai bên');
  assert.ok(cif['local-nhap'].ghi_chu);

  const exw = Object.fromEntries(summaryRows(DATA, term('EXW')).map((row) => [row.id, row]));
  assert.equal(exw['thong-quan-xk'].gia_tri, 'Người mua');

  const fcaPort = Object.fromEntries(summaryRows(DATA, term('FCA'), 'cang').map((row) => [row.id, row]));
  assert.equal(fcaPort['giao-hang'].gia_tri, findWay(term('FCA'), 'cang').giao_hang);
});

test('compareRows FOB với CIF: khác ở cước chính, phí nơi đến và bảo hiểm; giống ở thông quan và rủi ro', () => {
  const rows = compareRows(DATA, { term: term('FOB') }, { term: term('CIF') });
  const flags = Object.fromEntries(rows.map((row) => [row.id, row.khac]));
  assert.equal(flags['chang-cuoc-chinh'], true);
  assert.equal(flags['chang-phi-noi-den'], true);
  assert.equal(flags['bao-hiem'], true);
  assert.equal(flags['thong-quan-xk'], false);
  assert.equal(flags['thong-quan-nk'], false);
  assert.equal(flags['rui-ro'], false);
  assert.equal(flags['chang-phi-noi-di'], false);
  assert.ok(rows.every((row) => row.nhan && row.a !== undefined && row.b !== undefined));
});

test('compareRows FOB với DAP: bảo hiểm cùng không bắt buộc nhưng khác bên nên mua', () => {
  const rows = compareRows(DATA, { term: term('FOB') }, { term: term('DAP') });
  const insurance = rows.find((row) => row.id === 'bao-hiem');
  assert.equal(insurance.khac, true);
  assert.equal(insurance.b, 'Không bắt buộc, người bán nên cân nhắc');
});

test('compareRows hai cách giao FCA khác nhau ở chặng chở tới nơi đi', () => {
  const rows = compareRows(DATA, { term: term('FCA'), cachGiao: 'kho-ban' }, { term: term('FCA'), cachGiao: 'cang' });
  const different = rows.filter((row) => row.khac).map((row) => row.id);
  assert.ok(different.includes('chang-cho-noi-di'));
  assert.ok(!different.includes('chang-cuoc-chinh'));
});

test('chữ Copy có mã, cách ghi, đủ 9 chặng và dòng tham khảo', () => {
  const text = termCopyText(DATA, term('FOB'));
  assert.ok(text.startsWith('FOB (Free On Board)'));
  assert.ok(text.includes('FOB Cat Lai Port, Vietnam, Incoterms 2020'));
  assert.ok(text.includes('9. '));
  assert.ok(text.includes('chỉ để tham khảo'));

  const fca = termCopyText(DATA, term('FCA'), 'cang');
  assert.ok(fca.includes(findWay(term('FCA'), 'cang').ten));

  const port = compareCopyText(DATA, { term: term('FCA'), cachGiao: 'cang' }, { term: term('CPT') });
  assert.ok(port.startsWith('So sánh FCA (giao tại cảng hoặc ICD) và CPT'));

  const both = compareCopyText(DATA, { term: term('FOB') }, { term: term('CIF') });
  assert.ok(both.startsWith('So sánh FOB và CIF'));
  assert.ok(both.includes('(khác)'));
  assert.ok(both.includes('chỉ để tham khảo'));
});
