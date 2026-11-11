import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { chiaTrang, dongThoiGian, tenFile } from '../site/assets/js/core/xuat.js';

test('Tên file có tên công cụ, ngày giờ và đuôi', () => {
  assert.equal(tenFile('cbm', new Date(2026, 10, 11, 14, 30), 'png'), 'logneko-cbm-20261111-1430.png');
  assert.equal(tenFile('cuoc-lcl', new Date(2026, 0, 2, 9, 5), 'pdf'), 'logneko-cuoc-lcl-20260102-0905.pdf');
});

test('Dòng ngày giờ trên bản xuất', () => {
  assert.equal(dongThoiGian(new Date(2026, 1, 1, 9, 5)), 'Xuất lúc 09:05, 01/02/2026');
});

test('Chia trang khi kết quả dài hơn một trang', () => {
  assert.deepEqual(chiaTrang(500, 1000), [0]);
  assert.deepEqual(chiaTrang(1000, 1000), [0]);
  assert.deepEqual(chiaTrang(1001, 1000), [0, 1000]);
  assert.deepEqual(chiaTrang(2000, 1000), [0, 1000]);
  assert.deepEqual(chiaTrang(3500, 1000), [0, 1000, 2000, 3000]);
  assert.deepEqual(chiaTrang(0, 1000), [0]);
});

test('Chia trang chọn chỗ cắt an toàn thấp nhất còn vừa trang', () => {
  // Dòng chữ nằm từ 950 đến 1050: cắt ở 950, trang sau bắt đầu từ đó.
  assert.deepEqual(chiaTrang(1800, 1000, [300, 950, 1050, 1700]), [0, 950]);
  assert.deepEqual(chiaTrang(2200, 1000, [300, 950, 1050, 1700]), [0, 950, 1700]);
  // Chỗ cắt ở 0 hay bằng đúng vị trí đang đứng thì bỏ qua, không lặp trang rỗng.
  assert.deepEqual(chiaTrang(1500, 1000, [0, 1000]), [0, 1000]);
  // Không có chỗ cắt nào vừa trang thì cắt đúng mép trang.
  assert.deepEqual(chiaTrang(2500, 1000, [2600]), [0, 1000, 2000]);
  // Ảnh vừa một trang thì không cắt dù có chỗ cắt.
  assert.deepEqual(chiaTrang(900, 1000, [400]), [0]);
});

test('Thư viện ngoài nằm trong vendor, kèm giấy phép, và không tải sẵn ở trang công cụ', () => {
  const vendor = new URL('../site/assets/js/vendor/', import.meta.url);
  for (const file of ['html2canvas.min.js', 'jspdf.umd.min.js', 'html2canvas-LICENSE.txt', 'jspdf-LICENSE.txt']) {
    assert.ok(readFileSync(new URL(file, vendor)).length > 0, file);
  }
  for (const page of ['cbm', 'chargeable-weight', 'cuoc-lcl', 'so-container']) {
    const html = readFileSync(new URL(`../site/tools/${page}.html`, import.meta.url), 'utf8');
    assert.ok(!html.includes('vendor/'), `${page}.html không được tải thư viện xuất sẵn`);
  }
});
