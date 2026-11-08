import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  checkContainer,
  checkContainerList,
  checkDigit,
  containerCopyText,
  containerSteps,
  letterValue,
  ownerIndex,
  sourceText,
  splitContainerList,
} from '../site/assets/js/calc/so-container.js';

const OWNER_DATA = JSON.parse(readFileSync(new URL('../site/data/owner-codes.json', import.meta.url), 'utf8'));
const OWNERS = ownerIndex(OWNER_DATA);
const check = (text) => checkContainer(text, OWNERS);
// Dán từ Word hay Excel hay gặp dấu cách không ngắt và gạch nối dài; dán từ web hay dính ký tự vô hình.
const char = (code) => String.fromCharCode(code);
const NBSP = char(0xa0);
const EN_DASH = char(0x2013);
const SOFT_HYPHEN = char(0xad);
const ZERO_WIDTH_SPACE = char(0x200b);
const MINUS = char(0x2212);

// Bảng mã chủ sở hữu trong MO-TA-DU-AN.md, chép tay để sửa nhầm file JSON thì test báo đỏ.
const BANG_DAC_TA = {
  MSC: ['MSCU', 'MEDU'],
  Maersk: ['MAEU', 'MRKU', 'MSKU', 'MRSU', 'MNBU', 'PONU'],
  'CMA CGM': ['CMAU', 'CGMU', 'CXDU', 'ECMU'],
  COSCO: ['COSU', 'CBHU', 'CCLU'],
  'Hapag-Lloyd': ['HLBU', 'HLXU', 'HLCU'],
  ONE: ['ONEU', 'TLLU', 'KKLU'],
  Evergreen: ['EGHU', 'EISU', 'EITU', 'EGSU'],
  OOCL: ['OOLU', 'OOCU'],
  'Yang Ming': ['YMLU', 'YMMU'],
  HMM: ['HDMU', 'HMMU'],
  ZIM: ['ZIMU', 'ZCSU'],
  PIL: ['PCIU', 'PILU'],
  'Wan Hai': ['WHLU', 'WHSU'],
  'T.S. Lines': ['TLXU'],
  'Hamburg Süd': ['SUDU', 'ALBU'],
  APL: ['APLU', 'APRU'],
  'Gold Star Line': ['GOSU'],
  SITC: ['SITU'],
  KMTC: ['KMTU'],
};

test('CSQU3054383 hợp lệ, ví dụ chuẩn của ISO 6346', () => {
  const result = check('CSQU3054383');
  assert.equal(result.trangThai, 'hop-le');
  assert.equal(result.chuSoDung, 3);
  assert.equal(result.chuSoNhap, 3);
  assert.equal(result.maChuSoHuu, 'CSQ');
  assert.equal(result.loaiThietBi, 'U');
  assert.equal(result.soSeri, '305438');
  assert.equal(result.tinhToan.tong, 6185);
  assert.equal(result.tinhToan.du, 3);
});

test('CSQU3054384 báo sai và gợi ý số cuối là 3', () => {
  const result = check('CSQU3054384');
  assert.equal(result.trangThai, 'sai-chu-so');
  assert.equal(result.chuSoNhap, 4);
  assert.equal(result.chuSoDung, 3);
  assert.match(result.thongBao, /phải là 3/);
});

test('không phân biệt hoa thường, tự bỏ khoảng trắng và gạch nối', () => {
  for (const text of ['csqu3054383', 'CSQU 305438 3', 'CSQU-305438-3', ' cSqU 305438-3 ', `CSQU${NBSP}305438${EN_DASH}3`]) {
    const [item] = splitContainerList(text);
    assert.equal(item.so, 'CSQU3054383', text);
    assert.equal(check(item.so).trangThai, 'hop-le', text);
  }
});

test('chữ cái đổi ra số từ A = 10, bỏ qua 11, 22, 33', () => {
  const expected = {
    A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20, K: 21, L: 23, M: 24,
    N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31, U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
  };
  for (const [letter, value] of Object.entries(expected)) assert.equal(letterValue(letter), value, letter);
  assert.equal(letterValue('7'), 7);
});

test('dư 10 thì chữ số kiểm tra là 0', () => {
  // Dò một số sê-ri cho ra dư 10 thay vì viết cứng, để test tự kiểm lại phép chia.
  let serial;
  for (let n = 0; n < 1000 && !serial; n += 1) {
    const candidate = `CSQU${String(n).padStart(6, '0')}`;
    if (checkDigit(candidate).du === 10) serial = candidate;
  }
  assert.ok(serial, 'phải có ít nhất một số sê-ri dư 10');
  assert.equal(checkDigit(serial).chuSo, 0);
  assert.equal(check(`${serial}0`).trangThai, 'hop-le');
  assert.equal(check(`${serial}1`).chuSoDung, 0);
});

test('báo đúng loại lỗi định dạng, không tự sửa', () => {
  const cases = [
    ['CSQU30543831', /11 ký tự/],
    ['CS1U3054383', /4 ký tự đầu phải là chữ cái/],
    ['CSQU305438A', /7 ký tự cuối phải là chữ số/],
    ['CSQUA054383', /7 ký tự cuối phải là chữ số/],
    ['CSQA3054383', /U, J hoặc Z/],
  ];
  for (const [text, message] of cases) {
    const result = check(text);
    assert.equal(result.trangThai, 'sai-dinh-dang', text);
    assert.match(result.thongBao, message, text);
    assert.equal(result.chuSoDung, null, text);
  }
});

test('tự bỏ ký tự vô hình và dấu trừ khi dán từ web', () => {
  for (const text of [`CSQU3054383${ZERO_WIDTH_SPACE}`, `CSQU${SOFT_HYPHEN}3054383`, `CSQU${MINUS}305438${MINUS}3`]) {
    const [item] = splitContainerList(text);
    assert.equal(item.so, 'CSQU3054383');
  }
});

test('không tự đổi ký tự lạ thành chữ cái giống nó', () => {
  // ſ (s dài) và ß viết hoa thành S, SS; chữ toàn chiều rộng nhìn như chữ thường.
  for (const text of [`C${char(0x17f)}QU3054383`, `${char(0xdf)}QU3054383`, `${char(0xff23)}SQU3054383`]) {
    const result = check(text);
    assert.equal(result.trangThai, 'sai-dinh-dang', text);
    assert.match(result.thongBao, /ký tự không hợp lệ/, text);
  }
});

test('báo rõ ký tự không hợp lệ thay vì chỉ báo sai độ dài', () => {
  assert.match(check('CSQU.3054383').thongBao, /ký tự không hợp lệ: \./);
  assert.match(check('CSQU/3054383').thongBao, /ký tự không hợp lệ: \//);
  assert.match(check('CONT:CSQU3054383').thongBao, /ký tự không hợp lệ: :/);
  assert.match(check('CSQU.305/4383').thongBao, /\., \//);
});

test('danh sách rất dài vẫn chạy nhanh', () => {
  const lines = Array.from({ length: 30000 }, (_, n) => `CSQU${String(n % 1000).padStart(6, '0')}0`);
  const started = Date.now();
  const result = checkContainerList(lines.join('\n'), OWNERS);
  assert.equal(result.tong, 30000);
  assert.equal(result.ketQua[1000].trungVoi, 1);
  assert.ok(Date.now() - started < 2000, `chạy mất ${Date.now() - started} ms`);
});

test('gõ chữ O hoặc I ở phần số thì nhắc dễ nhầm với 0, 1', () => {
  assert.match(check('CSQU3O54383').thongBao, /O, I/);
  assert.match(check('CSQU3054I83').thongBao, /O, I/);
  assert.doesNotMatch(check('CSQU305438A').thongBao, /O, I/);
});

test('loại thiết bị J và Z cũng hợp lệ', () => {
  for (const category of ['J', 'Z']) {
    const first = `CSQ${category}305438`;
    const result = check(`${first}${checkDigit(first).chuSo}`);
    assert.equal(result.trangThai, 'hop-le', category);
    assert.equal(result.loaiThietBi, category);
  }
});

test('thiếu đúng chữ số cuối thì gợi ý số đủ', () => {
  const result = check('CSQU305438');
  assert.equal(result.trangThai, 'thieu-chu-so');
  assert.equal(result.chuSoNhap, null);
  assert.equal(result.chuSoDung, 3);
  assert.match(result.thongBao, /CSQU3054383/);
});

test('chưa gõ xong thì báo chưa đủ ký tự, không báo sai', () => {
  for (const text of ['C', 'CSQU', 'CSQU30543']) {
    assert.equal(check(text).trangThai, 'chua-du', text);
  }
  assert.equal(check('CSQA').trangThai, 'sai-dinh-dang');
  assert.equal(check('CS1').trangThai, 'sai-dinh-dang');
});

test('tách danh sách theo xuống dòng, dấu phẩy, chấm phẩy và tab', () => {
  const items = splitContainerList('CSQU3054383\nCSQU3054384, MSCU1234566;CSQU305438\tcsqu 305438 3\r\n\n');
  assert.deepEqual(items.map((item) => item.so), [
    'CSQU3054383', 'CSQU3054384', 'MSCU1234566', 'CSQU305438', 'CSQU3054383',
  ]);
});

test('nhiều số trên một dòng chỉ tách khi mỗi cụm đủ 11 ký tự đúng mẫu', () => {
  assert.deepEqual(splitContainerList('CSQU3054383 MSCU1234566').map((item) => item.so), ['CSQU3054383', 'MSCU1234566']);
  assert.deepEqual(splitContainerList('CSQU 305438 3').map((item) => item.so), ['CSQU3054383']);
  assert.deepEqual(splitContainerList('CSQU3054383 MSCU 123456 6').map((item) => item.so), ['CSQU3054383MSCU1234566']);
});

test('dòng ghép nhiều số thì nhắc đặt mỗi số một dòng', () => {
  const result = check('CSQU3054383MSCU1234566');
  assert.equal(result.trangThai, 'sai-dinh-dang');
  assert.match(result.thongBao, /22/);
  assert.match(result.thongBao, /mỗi số một dòng/);
});

test('ô trống hoặc chỉ có dấu ngăn thì chưa có kết quả', () => {
  assert.equal(checkContainerList('', OWNERS), null);
  assert.equal(checkContainerList(' ,;\n - ', OWNERS), null);
});

test('danh sách đếm số hợp lệ và đánh dấu số trùng', () => {
  const result = checkContainerList('CSQU3054383\nCSQU3054384\ncsqu 305438-3', OWNERS);
  assert.equal(result.tong, 3);
  assert.equal(result.hopLe, 2);
  assert.deepEqual(result.ketQua.map((item) => item.thuTu), [1, 2, 3]);
  assert.deepEqual(result.ketQua.map((item) => item.trungVoi), [null, null, 1]);
});

test('số chưa gõ xong không bị đánh dấu trùng', () => {
  const result = checkContainerList('CSQU\nCSQU', OWNERS);
  assert.deepEqual(result.ketQua.map((item) => item.trungVoi), [null, null]);
});

test('tra tên hãng theo 4 chữ đầu', () => {
  assert.equal(check('MSCU1234566').hang, 'MSC');
  assert.equal(check('MSCU1234566').trangThai, 'hop-le');
  assert.equal(check('CSQU3054383').hang, null);
  assert.equal(checkContainer('MSCU1234566').hang, null);
});

test('owner-codes.json đúng mẫu, không trùng mã, có nguồn và ngày', () => {
  assert.equal(OWNER_DATA.hang.length, 19);
  const codes = OWNER_DATA.hang.flatMap((item) => item.ma);
  for (const code of codes) assert.match(code, /^[A-Z]{3}[UJZ]$/, code);
  assert.equal(new Set(codes).size, codes.length);
  for (const item of OWNER_DATA.hang) assert.ok(item.ten && item.ma.length > 0, item.ten);
  assert.ok(OWNER_DATA.nguon.length >= 2);
  for (const source of OWNER_DATA.nguon) assert.match(source.link, /^https:\/\//);
  assert.match(OWNER_DATA.ngay_cap_nhat, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.equal(OWNERS.get('MAEU'), 'Maersk');
  assert.equal(OWNERS.get('KMTU'), 'KMTC');
});

test('owner-codes.json khớp từng hãng và từng mã với bảng đặc tả', () => {
  const fromJson = Object.fromEntries(OWNER_DATA.hang.map((item) => [item.ten, item.ma]));
  assert.deepEqual(fromJson, BANG_DAC_TA);
});

test('ghi chú nguồn nói rõ ShipsGo chỉ dùng cho SITC và KMTC', () => {
  const text = sourceText(OWNER_DATA);
  assert.match(text, /theo Terminal49, riêng SITC, KMTC theo ShipsGo/);
  assert.match(text, /02\/11\/2026/);
  assert.match(text, /19 hãng/);
});

test('cách tính liệt kê từng ký tự, tổng và số dư', () => {
  const steps = containerSteps(checkContainerList('CSQU3054383', OWNERS));
  const text = steps.join('\n');
  assert.match(text, /C → 13 × 1 = 13/);
  assert.match(text, /8 → 8 × 512 = 4\.096/);
  assert.match(text, /6\.185/);
  assert.match(text, /dư 3/);
});

test('cách tính dùng số đầu tiên tính được và ghi rõ số đó', () => {
  const steps = containerSteps(checkContainerList('CSQU\nCSQU3054384', OWNERS));
  assert.match(steps[0], /số thứ 2/);
  assert.match(steps[0], /CSQU3054384/);
  assert.ok(containerSteps(checkContainerList('CSQU', OWNERS)).length > 0);
});

test('copy kết quả mỗi số một dòng', () => {
  const text = containerCopyText(checkContainerList('CSQU3054383\nCSQU3054384\nMSCU1234566', OWNERS));
  const lines = text.split('\n');
  assert.match(lines[0], /2\/3/);
  assert.match(text, /CSQU3054383: Hợp lệ/);
  assert.match(text, /CSQU3054384: Sai chữ số kiểm tra/);
  assert.match(text, /MSC/);
});
