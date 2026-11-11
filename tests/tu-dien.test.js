import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  chuanHoa,
  docDiaChi,
  idCongCu,
  khoangCach,
  kiemTraDuLieu,
  taoDiaChi,
  timMuc,
} from '../site/assets/js/calc/tu-dien.js';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const DATA = readJson('../site/data/tu-dien.json');
const INCOTERMS = readJson('../site/data/incoterms.json');
const MA_INCOTERMS = INCOTERMS.dieu_kien.map((term) => term.ma);
const TRANG = readdirSync(new URL('../site/tools/', import.meta.url)).filter((file) => file.endsWith('.html'));
const BOI_CANH = { trang: TRANG, maIncoterms: MA_INCOTERMS };

// Bộ mục mẫu tự đặt, để test cách tìm không phụ thuộc nội dung từ điển thật.
const muc = (id, thuat_ngu, ten_day_du, nghia, nhom, extra = {}) => ({
  id, thuat_ngu, ten_day_du, nghia, giai_thich: 'Giải thích.', vi_du: 'Ví dụ.', nhom,
  lien_quan: [], cong_cu: null, nguon: ['mau'], ...extra,
});
const MAU = {
  nhom: ['biển', 'phí', 'chứng từ', 'Incoterms'],
  tai_lieu: { mau: 'Tài liệu mẫu' },
  muc: [
    muc('thc', 'THC', 'Terminal Handling Charge', 'Phí xếp dỡ container tại cảng.', 'phí'),
    muc('thl', 'THL', 'Terminal Handling at Loading', 'Phí xếp dỡ tại cảng xếp hàng.', 'phí'),
    muc('do', 'D/O', 'Delivery Order', 'Lệnh giao hàng cho người nhận.', 'chứng từ'),
    muc('demurrage', 'Demurrage', 'Demurrage', 'Phí lưu container tại bãi cảng quá hạn.', 'phí', { bi_danh: ['DEM'] }),
    muc('detention', 'Detention', 'Detention', 'Phí giữ container ngoài cảng quá hạn.', 'phí', { bi_danh: ['DET'] }),
    muc('cbm', 'CBM', 'Cubic Meter', 'Mét khối, đơn vị đo thể tích hàng.', 'biển', { cong_cu: 'cbm.html' }),
    muc('fob', 'FOB', 'Free On Board', 'Giao hàng lên tàu tại cảng đi.', 'Incoterms', { cong_cu: 'incoterms.html?dk=FOB' }),
    muc('20dc', "20'DC", '20-foot Dry Container', 'Container khô loại 20 feet.', 'biển'),
    muc('cy', 'CY', 'Container Yard', 'Bãi container tại cảng.', 'biển'),
  ],
};
const ids = (list) => list.map((item) => item.id);
const tim = (chu, opts) => ids(timMuc(MAU, chu, opts));

test('chuẩn hóa bỏ dấu, dấu câu và khoảng trắng', () => {
  assert.equal(chuanHoa('D/O'), 'do');
  assert.equal(chuanHoa(' d o '), 'do');
  assert.equal(chuanHoa("20'DC"), '20dc');
  assert.equal(chuanHoa('m³'), 'm3');
  assert.equal(chuanHoa('Lệnh giao hàng'), 'lenhgiaohang');
});

test('khoảng cách gõ sai: thiếu, thừa, sai, đổi chỗ hai ký tự', () => {
  assert.equal(khoangCach('demurage', 'demurrage'), 1);
  assert.equal(khoangCach('detnetion', 'detention'), 1);
  assert.equal(khoangCach('termnial', 'terminal'), 1);
  assert.equal(khoangCach('thc', 'thl'), 1);
  assert.equal(khoangCach('abc', 'abc'), 0);
  assert.ok(khoangCach('container', 'cbm', 2) > 2);
});

test('viết tắt ngắn chỉ khớp chính xác hoặc phần đầu: THC không ra THL', () => {
  assert.deepEqual(tim('THC'), ['thc']);
  assert.deepEqual(tim('thl'), ['thl']);
  // CBM đứng sau vì nghĩa có chữ "thể tích".
  assert.deepEqual(tim('th'), ['thc', 'thl', 'cbm']);
  assert.deepEqual(tim('cbn'), []);
});

test('D/O gõ kiểu nào cũng ra', () => {
  for (const chu of ['D/O', 'DO', 'd o', 'd.o']) assert.equal(tim(chu)[0], 'do', chu);
});

// Trước đây "B/L" tách thành "b" và "l", khớp với gần như mọi câu nghĩa (64 mục).
test('viết tắt có dấu gạch chéo không tách thành chữ cái lẻ', () => {
  assert.deepEqual(tim('D/O'), ['do']);
  for (const chu of ['B/L', 'D/O', 'c/o']) {
    const ra = timMuc(DATA, chu);
    assert.ok(ra.length <= 20, `${chu}: ${ra.length} mục`);
    assert.equal(ra[0].id, chuanHoa(chu), chu);
  }
  assert.ok(ids(timMuc(DATA, 'b/l')).includes('surrendered-bl'));
});

test('gõ sai nhẹ từ 4 ký tự vẫn tìm được', () => {
  assert.deepEqual(tim('demurage'), ['demurrage']);
  assert.deepEqual(tim('Detension'), ['detention']);
  assert.deepEqual(tim('termnal'), ['thc', 'thl']);
  assert.deepEqual(tim('xyzw'), []);
});

test('tìm theo tên tiếng Anh, bí danh và nghĩa tiếng Việt không dấu', () => {
  assert.deepEqual(tim('delivery order'), ['do']);
  assert.deepEqual(tim('free on'), ['fob']);
  assert.deepEqual(tim('DEM'), ['demurrage']);
  assert.deepEqual(tim('lenh giao hang'), ['do']);
  assert.deepEqual(tim('lệnh giao'), ['do']);
  assert.deepEqual(tim("20'dc"), ['20dc']);
  assert.deepEqual(tim('20 dc'), ['20dc']);
});

test('xếp hạng: đúng tên, đầu tên, tên tiếng Anh, nghĩa, gõ sai', () => {
  // "container": CY và 20'DC khớp tên tiếng Anh, THC khớp nghĩa; cùng hạng thì xếp A–Z.
  assert.deepEqual(tim('container'), ['20dc', 'cy', 'demurrage', 'detention', 'thc']);
  // "c": đầu tên CBM, CY; chữ trong tên tiếng Anh 20'DC, THC; chữ trong nghĩa (container, cho, cảng).
  assert.deepEqual(tim('c'), ['cbm', 'cy', '20dc', 'thc', 'do', 'demurrage', 'detention', 'fob', 'thl']);
  assert.deepEqual(tim('de'), ['demurrage', 'detention', 'do']);
});

test('ô trống trả cả danh sách A–Z, có lọc nhóm', () => {
  assert.deepEqual(tim(''), ['20dc', 'cbm', 'cy', 'do', 'demurrage', 'detention', 'fob', 'thc', 'thl']);
  assert.deepEqual(tim('  ', { nhom: 'biển' }), ['20dc', 'cbm', 'cy']);
  assert.deepEqual(tim('thc', { nhom: 'biển' }), []);
});

test('đọc và tạo địa chỉ ?q=&nhom=&muc=', () => {
  assert.deepEqual(docDiaChi(MAU, '?q=%20thc%20&nhom=ph%C3%AD&muc=thc'), { q: 'thc', nhom: 'phí', muc: 'thc' });
  assert.deepEqual(docDiaChi(MAU, '?nhom=khac&muc=khong-co'), { q: '', nhom: null, muc: null });
  assert.equal(taoDiaChi({ q: '', nhom: null, muc: null }), '');
  assert.equal(taoDiaChi({ q: 'd/o', nhom: 'phí', muc: 'do' }), '?q=d%2Fo&nhom=ph%C3%AD&muc=do');
  const vong = taoDiaChi({ q: 'd/o', nhom: 'phí', muc: 'do' });
  assert.deepEqual(docDiaChi(MAU, vong), { q: 'd/o', nhom: 'phí', muc: 'do' });
});

test('idCongCu lấy tên công cụ từ link', () => {
  assert.equal(idCongCu('cbm.html'), 'cbm');
  assert.equal(idCongCu('incoterms.html?dk=FOB'), 'incoterms');
});

test('kiểm tra dữ liệu bắt được lỗi thường gặp', () => {
  assert.deepEqual(kiemTraDuLieu(MAU, BOI_CANH), []);
  const sai = structuredClone(MAU);
  sai.muc[0].nhom = 'khác';
  sai.muc[1].lien_quan = ['khong-co', 'thl'];
  sai.muc[2].cong_cu = 'khong-co.html';
  sai.muc[3].nguon = ['la'];
  sai.muc[4].bi_danh = ['DEM'];
  sai.muc[5].nghia = 'Thiếu dấu chấm';
  sai.muc[6].cong_cu = 'incoterms.html?dk=XYZ';
  sai.muc[7].id = '20 DC';
  sai.muc[8].gia = 100;
  const loi = kiemTraDuLieu(sai, BOI_CANH).join('\n');
  for (const doan of ['nhóm "khác"', 'liên quan tới "khong-co"', 'tự liên quan', 'khong-co.html', 'nguồn "la"',
    'trùng với demurrage', 'dấu kết câu', 'dk=XYZ', 'id chỉ dùng', 'trường lạ "gia"']) {
    assert.ok(loi.includes(doan), doan);
  }
});

test('tu-dien.json: khung đúng và không có lỗi dữ liệu', () => {
  assert.deepEqual(DATA.nhom, ['biển', 'air', 'chứng từ', 'phí', 'Incoterms', 'kho', 'hải quan', 'các bên']);
  assert.ok(DATA.nguon && DATA.cap_nhat);
  assert.match(DATA.cap_nhat, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(kiemTraDuLieu(DATA, BOI_CANH), []);
});

test('tu-dien.json: tên tài liệu nguồn không chứa tên công ty hay tên người', () => {
  const text = Object.values(DATA.tai_lieu).join(' ');
  assert.ok(!/[A-Z]{2,}/.test(text.replace(/FCL|LCL|ISO|LOGNEKO/g, '')), text);
});

// Mục khác (như POL) được trỏ sang một mã làm ví dụ; mục là chính mã Incoterms thì phải trỏ đúng mã đó.
test('tu-dien.json: mục là mã Incoterms trỏ đúng mã trên trang Incoterms', () => {
  for (const item of DATA.muc.filter((entry) => MA_INCOTERMS.includes(entry.thuat_ngu))) {
    assert.equal(item.nhom, 'Incoterms', item.id);
    assert.equal(item.cong_cu, `incoterms.html?dk=${item.thuat_ngu}`, item.id);
  }
});

// Đặc tả ghi khoảng 150–200 mục; Khải duyệt nới lên 250 sau đợt rà soát 2026-11-11.
test('tu-dien.json: đủ 11 mã Incoterms và có 150–250 mục', () => {
  const ma = DATA.muc.filter((item) => item.nhom === 'Incoterms').map((item) => item.thuat_ngu);
  for (const code of MA_INCOTERMS) assert.ok(ma.includes(code), code);
  assert.ok(DATA.muc.length >= 150 && DATA.muc.length <= 250, String(DATA.muc.length));
});

test('tu-dien.json: tìm trên dữ liệu thật ra đúng mục và đúng công cụ', () => {
  const dau = (chu) => timMuc(DATA, chu)[0];
  assert.equal(dau('CBM').cong_cu, 'cbm.html');
  assert.equal(dau('FOB').cong_cu, 'incoterms.html?dk=FOB');
  assert.equal(dau('thc').id, 'thc');
  assert.equal(dau('demurage').id, 'demurrage');
  assert.ok(!ids(timMuc(DATA, 'thc')).includes('thl'));
});
