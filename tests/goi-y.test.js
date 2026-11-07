import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { boDau, phanHoanThanh, timGoiY } from '../site/assets/js/core/goi-y.js';

const PHI = JSON.parse(readFileSync(new URL('../site/data/phi-lcl.json', import.meta.url), 'utf8'));
const names = (list) => list.map((muc) => muc.ten);

test('phi-lcl.json có đủ hai đầu, mỗi phí có tên và cách tính, không có số tiền', () => {
  for (const dau of ['dau_xuat', 'dau_nhap']) {
    assert.ok(PHI[dau].length > 0, dau);
    const seen = new Set();
    for (const muc of PHI[dau]) {
      assert.equal(typeof muc.ten, 'string');
      assert.ok(muc.ten.trim(), dau);
      assert.ok(!seen.has(muc.ten), `trùng tên ${muc.ten}`);
      seen.add(muc.ten);
      assert.ok(['rt', 'lo'].includes(muc.cach_tinh), muc.ten);
      assert.ok(Array.isArray(muc.goi_y), muc.ten);
      assert.deepEqual(Object.keys(muc).sort(), ['cach_tinh', 'goi_y', 'ten'], muc.ten);
    }
  }
});

test('bỏ dấu tiếng Việt và chuyển chữ thường', () => {
  assert.equal(boDau('Phí hạ tầng cảng biển'), 'phi ha tang cang bien');
  assert.equal(boDau('Đầu xuất'), 'dau xuat');
});

test('gõ không dấu vẫn ra tên có dấu', () => {
  assert.deepEqual(names(timGoiY('phi ha', PHI.dau_xuat)), ['Phí hạ tầng cảng biển']);
  assert.deepEqual(names(timGoiY('thong quan', PHI.dau_nhap)), ['Thông quan nhập khẩu']);
});

test('tìm được bằng tên khác và bằng chữ giữa tên', () => {
  assert.deepEqual(names(timGoiY('delivery', PHI.dau_nhap)), ['D/O fee']);
  // "do" còn khớp "luồng đỏ" của phí kiểm hóa, nhưng D/O fee phải đứng đầu.
  assert.equal(names(timGoiY('do', PHI.dau_nhap))[0], 'D/O fee');
  assert.deepEqual(names(timGoiY('d/o', PHI.dau_nhap)), ['D/O fee']);
  assert.ok(names(timGoiY('doc', PHI.dau_xuat)).includes('Bill fee'));
  assert.ok(names(timGoiY('kho cfs', PHI.dau_xuat)).includes('Trucking ra kho CFS'));
});

test('tên khớp từ đầu xếp trước tên khớp ở giữa', () => {
  const found = names(timGoiY('c', PHI.dau_xuat));
  assert.equal(found[0], 'CFS fee');
  assert.ok(found.indexOf('ACI (đi Canada)') > found.indexOf('CFS fee'));
});

test('ô trống trả cả danh sách, chữ không khớp trả danh sách rỗng', () => {
  assert.equal(timGoiY('', PHI.dau_xuat).length, PHI.dau_xuat.length);
  assert.equal(timGoiY('   ', PHI.dau_nhap).length, PHI.dau_nhap.length);
  assert.deepEqual(timGoiY('xyz', PHI.dau_xuat), []);
});

test('chỉ điền tiếp khi tên bắt đầu đúng chữ đã gõ, không đổi chữ người dùng', () => {
  assert.equal(phanHoanThanh('c', 'CFS fee'), 'FS fee');
  assert.equal(phanHoanThanh('Phí', 'Phí hạ tầng cảng biển'), ' hạ tầng cảng biển');
  assert.equal(phanHoanThanh('phi', 'Phí hạ tầng cảng biển'), '');
  assert.equal(phanHoanThanh('THC', 'THC'), '');
  assert.equal(phanHoanThanh('', 'THC'), '');
});
