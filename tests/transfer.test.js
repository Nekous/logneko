import assert from 'node:assert/strict';
import { test } from 'node:test';
import { saveTransfer, takeTransfer } from '../site/assets/js/core/transfer.js';

function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
  };
}

const brokenStorage = {
  getItem() { throw new Error('chặn'); },
  setItem() { throw new Error('chặn'); },
  removeItem() { throw new Error('chặn'); },
};

test('trang đích nhận đúng số liệu một lần, tải lại trang không điền lại', () => {
  const storage = memoryStorage();
  assert.equal(saveTransfer('chargeable-weight', { tu: 'CBM', data: { gw: 84 } }, storage), true);
  assert.deepEqual(takeTransfer('chargeable-weight', storage), { tu: 'CBM', data: { gw: 84 } });
  assert.equal(takeTransfer('chargeable-weight', storage), null);
});

test('trang khác không nhận và không làm mất số liệu của trang đích', () => {
  const storage = memoryStorage();
  saveTransfer('chargeable-weight', { tu: 'CBM', data: { gw: 84 } }, storage);
  assert.equal(takeTransfer('cuoc-lcl', storage), null);
  assert.deepEqual(takeTransfer('chargeable-weight', storage).data, { gw: 84 });
});

test('giữ nguyên số có phần lẻ', () => {
  const storage = memoryStorage();
  saveTransfer('chargeable-weight', { data: { gw: 45.359237 } }, storage);
  assert.equal(takeTransfer('chargeable-weight', storage).data.gw, 45.359237);
});

test('trình duyệt chặn lưu tạm thì báo false, không làm hỏng trang', () => {
  assert.equal(saveTransfer('chargeable-weight', { data: {} }, brokenStorage), false);
  assert.equal(takeTransfer('chargeable-weight', brokenStorage), null);
});

test('số liệu hỏng thì bỏ qua', () => {
  const storage = memoryStorage();
  storage.setItem('logneko-chuyen', '{hỏng');
  assert.equal(takeTransfer('chargeable-weight', storage), null);
});
