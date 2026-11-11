import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SO_DONG_TU_DIEN, demDong, maHsCua, timChung } from '../site/assets/js/calc/tim-kiem.js';
import { timMuc } from '../site/assets/js/calc/tu-dien.js';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const NGUON = {
  congCu: readJson('../site/data/tools.json').cong_cu,
  incoterms: readJson('../site/data/incoterms.json'),
  tuDien: readJson('../site/data/tu-dien.json'),
};

const tim = (chu, nguon = NGUON) => timChung(nguon, chu);
const nhom = (ketQua, id) => ketQua.find((item) => item.id === id);
const tieuDe = (ketQua, id) => nhom(ketQua, id)?.dong.map((dong) => dong.tieuDe) ?? [];

test('FOB: dòng đầu là Incoterms, gộp mục từ điển thành link phụ', () => {
  for (const chu of ['FOB', 'fob', 'free on board']) {
    const ketQua = tim(chu);
    assert.equal(ketQua[0].id, 'incoterms', chu);
    const dong = ketQua[0].dong[0];
    assert.equal(dong.tieuDe, 'FOB');
    assert.equal(dong.href, '/tools/incoterms.html?dk=FOB');
    assert.deepEqual(dong.linkPhu, [{ ten: 'Đọc trong từ điển', href: '/tools/tu-dien.html?muc=fob' }]);
    assert.ok(!tieuDe(ketQua, 'tu-dien').includes('FOB'), `${chu}: FOB không lặp ở nhóm Từ điển`);
  }
});

test('Mã có nhiều mục từ điển trỏ vào thì gộp đúng mục của chính mã đó', () => {
  // freight-collect cũng trỏ EXW, insurer cũng trỏ CIF.
  assert.equal(tim('giao tai xuong')[0].dong[0].linkPhu[0].href, '/tools/tu-dien.html?muc=exw');
  assert.equal(tim('CIF')[0].dong[0].linkPhu[0].href, '/tools/tu-dien.html?muc=cif');
});

test('THC: mục từ điển kèm link sang công cụ cước LCL, không ra THL', () => {
  const ketQua = tim('THC');
  const dong = nhom(ketQua, 'tu-dien').dong;
  assert.equal(dong[0].tieuDe, 'THC');
  assert.equal(dong[0].href, '/tools/tu-dien.html?q=THC&muc=thc');
  assert.deepEqual(dong[0].linkPhu, [{ ten: 'Mở công cụ: Cước LCL theo W/M', href: '/tools/cuoc-lcl.html' }]);
  assert.ok(!tieuDe(ketQua, 'tu-dien').includes('THL'));
});

test('Mã HS: nhận 2 đến 8 chữ số, link sang công cụ kèm mã', () => {
  for (const [chu, ma] of [['8471', '8471'], ['8471.30', '847130'], ['8471 30', '847130']]) {
    const ketQua = tim(chu);
    assert.equal(ketQua[0].id, 'hs', chu);
    assert.equal(ketQua[0].dong[0].tieuDe, `Mã HS ${ma}`);
    assert.equal(ketQua[0].dong[0].href, `/tools/hs-code.html?ma=${ma}`);
    assert.equal(ketQua[0].dong[0].nhan, null);
  }
  assert.equal(nhom(tim('8'), 'hs'), undefined);
  assert.equal(nhom(tim('123456789'), 'hs'), undefined);
  assert.equal(maHsCua('0306.15'), '030615');
  assert.equal(maHsCua('tôm'), null);
});

test('Mã HS: công cụ chưa chạy thì hiện Sắp có, không link', () => {
  const congCu = NGUON.congCu.map((tool) => (tool.id === 'hs-code' ? { ...tool, trang_thai: 'sap-co' } : tool));
  const dong = tim('8471', { ...NGUON, congCu })[0].dong[0];
  assert.equal(dong.href, null);
  assert.equal(dong.nhan, 'Sắp có');
});

test('Mã HS: đã tải chương thì hiện mô tả của mã', () => {
  const c84 = JSON.parse(readFileSync(new URL('../site/data/hs/chuong-84.json', import.meta.url), 'utf8'));
  const moTa = (chu) => tim(chu, { ...NGUON, hsChuong: { 84: c84 } })[0].dong[0].moTa;
  assert.match(moTa('84713020'), /^84713020: Máy tính xách tay/);
  // Gõ mã ngắn thì lấy dòng đầu tiên bắt đầu bằng mã đó, tức dòng nhóm.
  assert.match(moTa('8471'), /^8471: /);
  assert.equal(moTa('84799999'), 'Không có mã này trong biểu thuế.');
});

test('Số container: nhận số viết thường, có dấu cách, gạch nối; chuyển đủ số sang công cụ', () => {
  for (const chu of ['CSQU3054383', 'csqu 305438-3']) {
    const ketQua = tim(chu);
    assert.equal(ketQua[0].id, 'so-container', chu);
    const dong = ketQua[0].dong[0];
    assert.equal(dong.tieuDe, 'Kiểm tra số container CSQU3054383');
    assert.equal(dong.href, '/tools/so-container.html');
    assert.deepEqual(dong.chuyen, { den: 'so-container', data: { danhSach: 'CSQU3054383' } });
  }
  // Thiếu chữ số kiểm tra vẫn gợi ý, để trang số container nhắc số đủ.
  assert.equal(tim('CSQU305438')[0].id, 'so-container');
  const nhieu = tim('CSQU3054383, MSCU1234566')[0].dong[0];
  assert.equal(nhieu.tieuDe, 'Kiểm tra 2 số container');
  assert.equal(nhieu.chuyen.data.danhSach, 'CSQU3054383\nMSCU1234566');
  assert.equal(nhom(tim('CSQU'), 'so-container'), undefined);
});

test('Công cụ: khớp tên; công cụ sắp có không có link', () => {
  assert.equal(nhom(tim('cbm'), 'cong-cu').dong[0].href, '/tools/cbm.html');
  const container = nhom(tim('container'), 'cong-cu').dong;
  assert.deepEqual(container.map((dong) => dong.tieuDe).sort(), ['Kiểm tra số container', 'Xếp hàng vào container']);
  const xep = container.find((dong) => dong.tieuDe === 'Xếp hàng vào container');
  assert.equal(xep.href, '/tools/xep-container.html');

  // Công cụ nào đổi về sắp có thì mất link, chỉ còn nhãn.
  const sapCo = NGUON.congCu.map((tool) => (tool.id === 'xep-container' ? { ...tool, trang_thai: 'sap-co' } : tool));
  const dongSapCo = nhom(tim('container', { ...NGUON, congCu: sapCo }), 'cong-cu').dong.find((dong) => dong.tieuDe === 'Xếp hàng vào container');
  assert.equal(dongSapCo.href, null);
  assert.equal(dongSapCo.nhan, 'Sắp có');
});

test('Tên tiếng Việt không dấu tìm ra điều kiện Incoterms', () => {
  assert.deepEqual(tieuDe(tim('giao tai xuong'), 'incoterms'), ['EXW']);
});

test('Ô trống hoặc chữ không khớp thì không có nhóm nào', () => {
  assert.deepEqual(tim(''), []);
  assert.deepEqual(tim('   '), []);
  assert.deepEqual(tim(undefined), []);
  assert.deepEqual(tim('zzzz'), []);
});

test('Từ điển chỉ hiện vài dòng đầu, kèm link xem tất cả', () => {
  const tong = timMuc(NGUON.tuDien, 'phi').length;
  assert.ok(tong > SO_DONG_TU_DIEN);
  const tuDien = nhom(tim('phi'), 'tu-dien');
  assert.equal(tuDien.dong.length, SO_DONG_TU_DIEN);
  assert.deepEqual(tuDien.xemTatCa, { ten: `Xem tất cả ${tong} mục trong từ điển`, href: '/tools/tu-dien.html?q=phi' });
  assert.equal(nhom(tim('THC'), 'tu-dien').xemTatCa, null);
});

test('Nhóm khớp tên xếp trước nhóm chỉ khớp nghĩa', () => {
  // "phi" khớp đầu tên "Phí hạ tầng..." trong từ điển, còn Incoterms chỉ khớp nghĩa "cước phí".
  const ids = tim('phi').map((item) => item.id);
  assert.ok(ids.indexOf('tu-dien') < ids.indexOf('incoterms'));
  // Bằng nhau thì giữ thứ tự Incoterms, Công cụ, Từ điển.
  assert.deepEqual(tim('cbm').map((item) => item.id), ['cong-cu', 'tu-dien']);
});

test('Thiếu một nguồn thì các nhóm khác vẫn tìm', () => {
  assert.equal(tim('FOB', { ...NGUON, tuDien: null })[0].dong[0].linkPhu.length, 0);
  assert.equal(nhom(tim('THC', { ...NGUON, incoterms: null }), 'tu-dien').dong[0].tieuDe, 'THC');
  assert.equal(tim('8471', { congCu: null, incoterms: null, tuDien: null }).length, 0);
  assert.equal(nhom(tim('FOB', { ...NGUON, incoterms: null }), 'tu-dien').dong[0].tieuDe, 'FOB');
});

test('demDong đếm đủ dòng mọi nhóm', () => {
  const ketQua = tim('container');
  assert.equal(demDong(ketQua), ketQua.reduce((tong, item) => tong + item.dong.length, 0));
  assert.equal(demDong([]), 0);
});
