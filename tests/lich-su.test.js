import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SO_LAN_TOI_DA,
  docLichSu,
  nhanThoiGian,
  themLichSu,
  xoaHet,
  xoaMotLan,
} from '../site/assets/js/core/lich-su.js';

// Kho lưu giả, giống localStorage ở ba hàm dùng tới.
function khoGia() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data,
  };
}

// Kho của trình duyệt chặn lưu: mọi lệnh đều văng lỗi.
const khoBiChan = {
  getItem() { throw new Error('chặn'); },
  setItem() { throw new Error('chặn'); },
  removeItem() { throw new Error('chặn'); },
};

const luc = (phut) => new Date(2026, 10, 11, 14, phut);
const them = (storage, so, phut) => themLichSu('cbm', { tomTat: `${so} CBM`, duLieu: { so } }, { storage, now: luc(phut) });

// Ẩn console.error của các ca cố ý làm hỏng, để kết quả test dễ đọc.
function imLang(fn) {
  const goc = console.error;
  console.error = () => {};
  try { return fn(); } finally { console.error = goc; }
}

test('Chưa có gì thì lịch sử rỗng', () => {
  assert.deepEqual(docLichSu('cbm', khoGia()), []);
});

test('Lần mới nhất đứng đầu, lưu lại được sau khi đọc lại', () => {
  const kho = khoGia();
  them(kho, 1, 0);
  them(kho, 2, 1);
  const ds = docLichSu('cbm', kho);
  assert.deepEqual(ds.map((muc) => muc.duLieu.so), [2, 1]);
  assert.equal(ds[0].tomTat, '2 CBM');
  assert.equal(ds[0].luc, luc(1).toISOString());
});

test('Giữ tối đa 20 lần, bỏ lần cũ nhất', () => {
  const kho = khoGia();
  for (let i = 1; i <= SO_LAN_TOI_DA + 5; i += 1) them(kho, i, i);
  const ds = docLichSu('cbm', kho);
  assert.equal(SO_LAN_TOI_DA, 20);
  assert.equal(ds.length, 20);
  assert.equal(ds[0].duLieu.so, 25);
  assert.equal(ds.at(-1).duLieu.so, 6);
});

test('Cùng số liệu với lần cũ thì đưa lên đầu, không thêm dòng', () => {
  const kho = khoGia();
  them(kho, 1, 0);
  them(kho, 2, 1);
  const ds = them(kho, 1, 5);
  assert.deepEqual(ds.map((muc) => muc.duLieu.so), [1, 2]);
  assert.equal(ds[0].luc, luc(5).toISOString());
});

test('Xóa một lần và xóa hết', () => {
  const kho = khoGia();
  them(kho, 1, 0);
  them(kho, 2, 1);
  assert.deepEqual(xoaMotLan('cbm', luc(1).toISOString(), kho).map((muc) => muc.duLieu.so), [1]);
  assert.deepEqual(docLichSu('cbm', kho).map((muc) => muc.duLieu.so), [1]);
  assert.deepEqual(xoaHet('cbm', kho), []);
  assert.deepEqual(docLichSu('cbm', kho), []);
});

test('Mỗi công cụ một lịch sử riêng', () => {
  const kho = khoGia();
  them(kho, 1, 0);
  themLichSu('cuoc-lcl', { tomTat: '3 RT', duLieu: { rt: 3 } }, { storage: kho, now: luc(2) });
  assert.equal(docLichSu('cbm', kho).length, 1);
  assert.equal(docLichSu('cuoc-lcl', kho)[0].tomTat, '3 RT');
  xoaHet('cbm', kho);
  assert.equal(docLichSu('cuoc-lcl', kho).length, 1);
});

test('Dữ liệu hỏng hay sai dạng thì không văng lỗi', () => {
  const kho = khoGia();
  kho.setItem('logneko:lich-su:cbm', '{hỏng');
  assert.deepEqual(imLang(() => docLichSu('cbm', kho)), []);
  kho.setItem('logneko:lich-su:cbm', JSON.stringify({ khong: 'phai danh sach' }));
  assert.deepEqual(docLichSu('cbm', kho), []);
  // Dòng thiếu phần thì bỏ, dòng đủ thì giữ.
  kho.setItem('logneko:lich-su:cbm', JSON.stringify([
    { luc: 'x', tomTat: 'đủ', duLieu: {} },
    { luc: 'y', tomTat: 'thiếu dữ liệu' },
    null,
  ]));
  assert.deepEqual(docLichSu('cbm', kho).map((muc) => muc.tomTat), ['đủ']);
});

test('Trình duyệt chặn lưu thì trả rỗng, trang vẫn chạy', () => {
  imLang(() => {
    assert.deepEqual(docLichSu('cbm', khoBiChan), []);
    assert.deepEqual(them(khoBiChan, 1, 0), []);
    assert.deepEqual(xoaMotLan('cbm', 'x', khoBiChan), []);
    assert.deepEqual(xoaHet('cbm', khoBiChan), []);
  });
});

test('Nhãn thời gian có số 0 đứng đầu', () => {
  assert.equal(nhanThoiGian(new Date(2026, 1, 1, 9, 5)), '09:05, 01/02/2026');
  assert.equal(nhanThoiGian(new Date(2026, 10, 11, 14, 30).toISOString()), '14:30, 11/11/2026');
});
