import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatNumber, HAI_SO_LE, parseNumber } from '../site/assets/js/core/format.js';

test('8 ví dụ của Khải: dấu chấm là phần nghìn, dấu phẩy là thập phân', () => {
  assert.equal(parseNumber('314.766'), 314766);
  assert.equal(parseNumber('314,766'), 314.766);
  assert.equal(parseNumber('52.5'), 52500);
  assert.equal(parseNumber('0.766'), 766);
  assert.equal(parseNumber('52,5'), 52.5);
  assert.equal(parseNumber('0,766'), 0.766);
  assert.equal(parseNumber('1234.567'), 1234567);
  assert.equal(parseNumber('1234,567'), 1234.567);
});

test('phần nghìn viết thiếu được bù số 0 cho đủ 3 chữ số', () => {
  assert.equal(parseNumber('52.50'), 52500);
  assert.equal(parseNumber('0.78'), 780);
});

test('có cả hai dấu thì dấu chấm đứng trước, dấu phẩy đứng sau', () => {
  assert.equal(parseNumber('1.234,5'), 1234.5);
  assert.equal(parseNumber('1.234.567,89'), 1234567.89);
  assert.equal(parseNumber('1.234.567'), 1234567);
});

test('dấu phẩy thập phân không có số ở một bên vẫn đọc được', () => {
  assert.equal(parseNumber(',5'), 0.5);
  assert.equal(parseNumber('52,'), 52);
});

test('bỏ khoảng trắng', () => {
  assert.equal(parseNumber('12 345'), 12345);
  assert.equal(parseNumber('  7,5 '), 7.5);
  assert.equal(parseNumber('12 345'), 12345);
});

test('giữ nguyên số 0, số âm và số đã ở dạng number', () => {
  assert.equal(parseNumber('0'), 0);
  assert.equal(parseNumber('-5'), -5);
  assert.equal(parseNumber('-1.234,5'), -1234.5);
  assert.equal(parseNumber('-1.234'), -1234);
  assert.equal(parseNumber(3.5), 3.5);
});

test('ô trống và chữ trả về null, không ra NaN', () => {
  for (const value of ['', '   ', null, undefined, 'abc', '12abc', '1e5', 'Infinity', 'NaN', ',', '.', '-', NaN, Infinity]) {
    assert.equal(parseNumber(value), null, String(value));
  }
});

test('cách viết sai dấu trả về null thay vì đoán', () => {
  for (const value of ['1,2,3', '1,234,567', '1,234.5', '1,234,567.89', '1.2,3.4', '1.23.45', '1.234.5', '52.5,5', '1.2345', '.766', '52.']) {
    assert.equal(parseNumber(value), null, value);
  }
});

test('hiện số theo kiểu Việt Nam', () => {
  assert.equal(formatNumber(0.7834), '0,7834');
  assert.equal(formatNumber(314766), '314.766');
  assert.equal(formatNumber(1234.5), '1.234,5');
  assert.equal(formatNumber(1234.567), '1.234,567');
  assert.equal(formatNumber(1234567), '1.234.567');
  assert.equal(formatNumber(-5), '-5');
  assert.equal(formatNumber(0), '0');
});

test('giới hạn số chữ số thập phân', () => {
  assert.equal(formatNumber(130.5686, { toiDa: 2 }), '130,57');
  assert.equal(formatNumber(52.5, { toiThieu: 2 }), '52,50');
  assert.equal(formatNumber(1234567, { toiThieu: 2 }), '1.234.567,00');
  assert.equal(formatNumber(0.123456789), '0,1235');
});

test('kết quả nào cần ,00 thì bật riêng bằng HAI_SO_LE', () => {
  assert.equal(formatNumber(60, HAI_SO_LE), '60,00');
  assert.equal(formatNumber(1234567, HAI_SO_LE), '1.234.567,00');
  assert.equal(formatNumber(60.5, HAI_SO_LE), '60,50');
  assert.equal(formatNumber(60.126, HAI_SO_LE), '60,13');
  assert.equal(formatNumber(60), '60');
});

test('không hiện -0 khi làm tròn', () => {
  assert.equal(formatNumber(-0), '0');
  assert.equal(formatNumber(-0.00001), '0');
});

test('số không hợp lệ hiện gạch ngang, không hiện NaN', () => {
  for (const value of [NaN, Infinity, -Infinity, null, undefined, 'abc']) {
    assert.equal(formatNumber(value), '—', String(value));
  }
});
