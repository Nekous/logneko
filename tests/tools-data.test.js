import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { statsFor } from '../site/assets/js/core/tools.js';

const dataDir = new URL('../site/data/', import.meta.url);
const readJson = (name) => JSON.parse(readFileSync(new URL(name, dataDir), 'utf8'));
const withLive = (data, ...ids) => ({
  ...data,
  cong_cu: data.cong_cu.map((tool) => ({ ...tool, trang_thai: ids.includes(tool.id) ? 'hoat-dong' : 'sap-co' })),
});

test('mọi file JSON trong site/data hợp lệ', () => {
  for (const name of readdirSync(dataDir).filter((file) => file.endsWith('.json'))) {
    assert.doesNotThrow(() => readJson(name), name);
  }
});

test('tools.json có đủ 8 công cụ, đúng tên file và 3 nhóm', () => {
  const { cong_cu: tools, nhom } = readJson('tools.json');
  assert.deepEqual(tools.map((tool) => tool.id), [
    'cbm', 'chargeable-weight', 'cuoc-lcl', 'xep-container',
    'so-container', 'incoterms', 'hs-code', 'tu-dien',
  ]);
  const count = (name) => tools.filter((tool) => tool.nhom === name).length;
  assert.deepEqual(nhom.map(count), [4, 3, 1]);
  for (const tool of tools) {
    assert.ok(['sap-co', 'hoat-dong'].includes(tool.trang_thai), tool.id);
    for (const field of ['ten', 'mo_ta', 'nhap', 'ket_qua']) assert.ok(tool[field], `${tool.id}.${field}`);
  }
});

test('số liệu chỉ phụ thuộc công cụ có thật', () => {
  const data = readJson('tools.json');
  const ids = data.cong_cu.map((tool) => tool.id);
  for (const stat of data.so_lieu.filter((item) => item.can)) assert.ok(ids.includes(stat.can), stat.can);
});

test('chưa có công cụ nào chạy thì không nêu số Incoterms và mã HS', () => {
  const stats = statsFor(withLive(readJson('tools.json')));
  assert.equal(stats[0].nhan, 'công cụ đang xây dựng');
  const text = stats.map((stat) => stat.so).join(' ');
  assert.ok(!text.includes('12.000'));
  assert.ok(!stats.some((stat) => stat.can));
});

test('số liệu hiện dần theo công cụ đã chạy', () => {
  const data = readJson('tools.json');
  const partly = statsFor(withLive(data, 'cbm', 'incoterms'));
  assert.equal(partly[0].nhan, 'công cụ trong lộ trình, 2 đã dùng được');
  assert.ok(partly.some((stat) => stat.can === 'incoterms'));
  assert.ok(!partly.some((stat) => stat.can === 'hs-code'));

  const all = statsFor(withLive(data, ...data.cong_cu.map((tool) => tool.id)));
  assert.equal(all[0].nhan, 'công cụ miễn phí');
  assert.ok(all.some((stat) => stat.can === 'hs-code'));
});
