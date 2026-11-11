import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateCbm, cbmCopyText, cbmSteps, formatCbm, parsePackingList, xepContainerData } from '../site/assets/js/calc/cbm.js';
import { formatNumber } from '../site/assets/js/core/format.js';

const line = (soKien, dai, rong, cao, trongLuong = null) => ({ soKien, dai, rong, cao, trongLuong });
const BLANK = line(null, null, null, null);
const LO_B = [line(2, 92, 61, 37), line(1, 78, 63, 40), line(1, 87, 58, 34)];
const close = (actual, expected, digits = 4) => {
  assert.ok(Math.abs(actual - expected) < 10 ** -digits, `${actual} khác ${expected}`);
};

test('Lô B trong bài học ra 783.412 cm³, 0,7834 CBM, 4 kiện', () => {
  const result = calculateCbm({ kien: LO_B, donViKichThuoc: 'cm' });
  assert.equal(result.tongCm3, 783412);
  assert.equal(formatCbm(result.tongCbm), '0,7834');
  assert.equal(result.tongKien, 4);
  assert.deepEqual(result.dong.map((item) => formatCbm(item.cbm)), ['0,4153', '0,1966', '0,1716']);
});

test('cùng lô nhập bằng mét ra cùng kết quả', () => {
  const kien = [line(2, 0.92, 0.61, 0.37), line(1, 0.78, 0.63, 0.4), line(1, 0.87, 0.58, 0.34)];
  const result = calculateCbm({ kien, donViKichThuoc: 'm' });
  close(result.tongCbm, 0.783412, 9);
  close(result.tongCm3, 783412, 3);
});

test('1 inch = 2,54 cm', () => {
  const result = calculateCbm({ kien: [line(1, 10, 10, 10)], donViKichThuoc: 'inch' });
  close(result.tongCbm, 0.016387064, 9);
});

test('quy đổi: 1 m³ = 35,3147 ft³, 84 kg = 185,1883 lb, 100 lb = 45,359237 kg', () => {
  const m3 = calculateCbm({ kien: [line(1, 1, 1, 1)], donViKichThuoc: 'm' });
  close(m3.tongCbm, 1, 9);
  close(m3.tongFt3, 35.3147, 9);

  const kg = calculateCbm({ kien: LO_B, donViKichThuoc: 'cm', donViTrongLuong: 'kg', tongGw: 84 });
  assert.equal(kg.gwKg, 84);
  assert.equal(formatNumber(kg.gwLb), '185,1883');

  const lb = calculateCbm({ kien: LO_B, donViKichThuoc: 'cm', donViTrongLuong: 'lb', tongGw: 100 });
  close(lb.gwKg, 45.359237, 9);
  close(lb.gwLb, 100, 9);
});

test('GW cộng từ trọng lượng mỗi kiện nhân số kiện', () => {
  const result = calculateCbm({ kien: [line(2, 10, 10, 10, 10), line(1, 10, 10, 10, 5)], donViKichThuoc: 'cm' });
  assert.equal(result.gwKg, 25);
  assert.equal(result.gwCach, 'tung-kien');
  assert.equal(result.gwGhiChu, null);
});

test('chưa nhập trọng lượng thì không có GW và không báo thiếu', () => {
  const result = calculateCbm({ kien: LO_B, donViKichThuoc: 'cm' });
  assert.equal(result.gwKg, null);
  assert.equal(result.gwLb, null);
  assert.equal(result.gwGhiChu, null);
});

test('thiếu trọng lượng một dòng thì không cộng ra tổng thiếu', () => {
  const result = calculateCbm({ kien: [line(1, 10, 10, 10, 5), line(1, 10, 10, 10), line(1, 10, 10, 10)], donViKichThuoc: 'cm' });
  assert.equal(result.gwKg, null);
  assert.equal(result.gwGhiChu, 'Thiếu trọng lượng dòng 2, 3');
  close(result.tongCbm, 0.003, 9);
});

test('nhập cả hai cách thì không đoán, CBM vẫn hiện', () => {
  const result = calculateCbm({ kien: [line(1, 10, 10, 10, 5)], donViKichThuoc: 'cm', tongGw: 84 });
  assert.equal(result.gwKg, null);
  assert.equal(result.gwGhiChu, 'Đang có cả hai cách, hãy giữ một');
  close(result.tongCbm, 0.001, 9);
});

test('dòng trống bị bỏ qua, số thứ tự dòng vẫn đúng', () => {
  const result = calculateCbm({ kien: [BLANK, line(1, 10, 10, 10), BLANK], donViKichThuoc: 'cm' });
  assert.deepEqual(result.dong.map((item) => item.stt), [2]);
  assert.deepEqual(result.chuaTinh, []);
});

test('dòng gõ dở chưa tính vào tổng và được nêu tên, cả trong nội dung copy', () => {
  const result = calculateCbm({ kien: [line(1, 10, 10, 10), line(2, 50, null, null)], donViKichThuoc: 'cm' });
  close(result.tongCbm, 0.001, 9);
  assert.equal(result.tongKien, 1);
  assert.deepEqual(result.chuaTinh, [2]);
  assert.ok(cbmCopyText(result).includes('Dòng 2 chưa đủ số, chưa tính vào tổng'));
});

test('dòng chỉ có trọng lượng cũng là gõ dở', () => {
  const result = calculateCbm({ kien: [line(1, 10, 10, 10), line(null, null, null, null, 5)], donViKichThuoc: 'cm' });
  assert.deepEqual(result.chuaTinh, [2]);
});

test('chưa có dòng nào đủ số thì trả về null', () => {
  assert.equal(calculateCbm({ kien: [], donViKichThuoc: 'cm' }), null);
  assert.equal(calculateCbm({ kien: [BLANK], donViKichThuoc: 'cm' }), null);
  assert.equal(calculateCbm({ kien: [line(2, 50, null, null)], donViKichThuoc: 'cm' }), null);
  assert.equal(calculateCbm({ kien: [BLANK], donViKichThuoc: 'cm', tongGw: 84 }), null);
});

test('số 0, số âm, số kiện lẻ báo lỗi và ghi rõ dòng nào', () => {
  const cases = [
    [line(0, 10, 10, 10), 'Dòng 1'],
    [line(-1, 10, 10, 10), 'Dòng 1'],
    [line(1.5, 10, 10, 10), 'Dòng 1'],
    [line(1, 0, 10, 10), 'Dòng 1'],
    [line(1, 10, -10, 10), 'Dòng 1'],
    [line(1, 10, 10, 10, 0), 'Dòng 1'],
    [line(1, 10, 10, 10, -5), 'Dòng 1'],
    [line(1, -10, null, null), 'Dòng 1'],
  ];
  for (const [item, name] of cases) {
    const result = calculateCbm({ kien: [item], donViKichThuoc: 'cm' });
    assert.ok(result?.loi?.startsWith(name), JSON.stringify(item));
  }
  assert.ok(calculateCbm({ kien: [line(1, 10, 10, 10), line(0, 10, 10, 10)], donViKichThuoc: 'cm' }).loi.startsWith('Dòng 2'));
});

test('Tổng GW bằng 0 hoặc âm báo lỗi', () => {
  for (const tongGw of [0, -84]) {
    assert.ok(calculateCbm({ kien: LO_B, donViKichThuoc: 'cm', tongGw }).loi.includes('Tổng GW'));
  }
});

test('số rất lớn báo lỗi, không ra Infinity', () => {
  const huge = 1e200;
  const result = calculateCbm({ kien: [line(1, huge, huge, huge)], donViKichThuoc: 'cm' });
  assert.ok(result.loi);
  const heavy = calculateCbm({ kien: [line(1e200, 10, 10, 10, 1e200)], donViKichThuoc: 'cm' });
  assert.ok(heavy.loi);
});

test('kích thước phải dưới 100 m, tính sau khi đổi đơn vị', () => {
  const over = [
    [line(1, 10000, 10, 10), 'cm'],
    [line(1, 10, 92500, 10), 'cm'],
    [line(1, 10, 10, 100), 'm'],
    [line(1, 3938, 10, 10), 'inch'],
    [line(1, 10000, null, null), 'cm'],
  ];
  for (const [item, donViKichThuoc] of over) {
    const result = calculateCbm({ kien: [item], donViKichThuoc });
    assert.ok(result?.loi?.startsWith('Dòng 1') && result.loi.includes('dưới 100 m'), JSON.stringify(item));
  }

  const under = [
    [line(1, 9999.99, 10, 10), 'cm'],
    [line(1, 99.99, 10, 10), 'm'],
    [line(1, 3937, 10, 10), 'inch'],
  ];
  for (const [item, donViKichThuoc] of under) {
    assert.ok(!calculateCbm({ kien: [item], donViKichThuoc }).loi, JSON.stringify(item));
  }
});

test('số lớn nhưng tính được thì vẫn ra số hữu hạn', () => {
  const result = calculateCbm({ kien: [line(1000000, 9999, 2350, 2390, 28000)], donViKichThuoc: 'cm' });
  assert.ok(Number.isFinite(result.tongCbm));
  assert.ok(Number.isFinite(result.tongFt3));
  assert.ok(Number.isFinite(result.gwLb));
});

test('CBM quá nhỏ hiện "dưới 0,0001" thay vì 0', () => {
  const result = calculateCbm({ kien: [line(1, 1, 1, 1)], donViKichThuoc: 'cm' });
  assert.equal(formatCbm(result.tongCbm), 'dưới 0,0001');
  assert.equal(formatCbm(0.0001), '0,0001');
  assert.equal(formatCbm(0.00005), '0,0001');
  assert.equal(formatCbm(0), '0');
});

test('dán nhanh: dạng trong đặc tả và bài học', () => {
  const { kien, loi } = parsePackingList('2(92*61*37)\n1(78*63*40)CM\n1(87*58*34)cm', 'cm');
  assert.equal(loi, null);
  assert.deepEqual(kien, [
    { soKien: 2, dai: 92, rong: 61, cao: 37 },
    { soKien: 1, dai: 78, rong: 63, cao: 40 },
    { soKien: 1, dai: 87, rong: 58, cao: 34 },
  ]);
  const result = calculateCbm({ kien, donViKichThuoc: 'cm' });
  assert.equal(result.tongCm3, 783412);
});

test('dán nhanh: mọi dấu nhân và dấu ngăn cách', () => {
  const expected = [{ soKien: 2, dai: 92, rong: 61, cao: 37 }, { soKien: 1, dai: 78, rong: 63, cao: 40 }];
  for (const text of [
    '2(92*61*37)+1(78*63*40)',
    '2(92×61×37) + 1(78×63×40)',
    '2(92x61x37); 1(78x63x40)',
    '2(92X61X37), 1(78X63X40)',
    '2 ( 92 * 61 * 37 ),1 (78*63*40)',
  ]) {
    assert.deepEqual(parsePackingList(text, 'cm'), { kien: expected, loi: null }, text);
  }
});

test('dán nhanh: số trong ngoặc đọc theo kiểu Việt Nam', () => {
  assert.deepEqual(parsePackingList('2(92,5*61*37)', 'cm').kien, [{ soKien: 2, dai: 92.5, rong: 61, cao: 37 }]);
  assert.deepEqual(parsePackingList('2(92.5*61*37)', 'cm').kien, [{ soKien: 2, dai: 92500, rong: 61, cao: 37 }]);
});

test('dán nhanh: phần không đọc được thì báo đúng phần đó và không thêm dòng nào', () => {
  const { kien, loi } = parsePackingList('2(92*61*37)\nTOTAL 0.7834 CBM', 'cm');
  assert.deepEqual(kien, []);
  assert.ok(loi.includes('TOTAL 0.7834 CBM'));

  for (const text of ['abc', '2(92*61)', '1,5(92*61*37)', '-2(92*61*37)', '2(92*61*37)MM', '2(1.2.3*61*37)']) {
    const parsed = parsePackingList(text, 'cm');
    assert.deepEqual(parsed.kien, [], text);
    assert.ok(parsed.loi, text);
  }
});

test('dán nhanh: báo nguyên dòng bị sai để dễ tìm, không báo mẩu thừa', () => {
  for (const bad of ['1,5(92*61*37)', '-2(92*61*37)', '2(92*61*37) inches', '2(92*61*37) cm.']) {
    const { kien, loi } = parsePackingList(`1(78*63*40)\n${bad}\n1(87*58*34)`, 'cm');
    assert.deepEqual(kien, [], bad);
    assert.ok(loi.includes(`"${bad}"`), loi);
  }
});

test('dán nhanh: chỉ có dấu ngăn cách thì coi như chưa có gì để đọc', () => {
  const { kien, loi } = parsePackingList('+ ; ,', 'cm');
  assert.deepEqual(kien, []);
  assert.ok(loi.startsWith('Chưa có gì để đọc'));
});

test('dán nhanh: đuôi đơn vị lệch ô đang chọn thì báo lỗi, không đoán', () => {
  const { kien, loi } = parsePackingList('2(36*24*12)INCH', 'cm');
  assert.deepEqual(kien, []);
  assert.ok(loi.includes('inch') && loi.includes('cm'));
  assert.equal(parsePackingList('2(36*24*12)INCH', 'inch').loi, null);
  assert.equal(parsePackingList('2(36*24*12)in', 'inch').loi, null);
  assert.equal(parsePackingList('2(1*2*3)M', 'm').loi, null);
  assert.ok(parsePackingList('2(1*2*3)M', 'cm').loi);
});

test('dán nhanh: ô trống báo nhắc', () => {
  for (const text of ['', '   \n ']) {
    const parsed = parsePackingList(text, 'cm');
    assert.deepEqual(parsed.kien, []);
    assert.ok(parsed.loi);
  }
});

test('cách tính và nội dung copy dùng đúng số đã nhập, không có NaN', () => {
  const result = calculateCbm({ kien: LO_B, donViKichThuoc: 'cm', donViTrongLuong: 'kg', tongGw: 84 });
  const steps = cbmSteps(result).join('\n');
  assert.ok(steps.includes('0,92 × 0,61 × 0,37 × 2'));
  assert.ok(steps.includes('0,783412'));
  assert.ok(steps.includes('35,3147'));
  assert.ok(steps.includes('0,45359237'));

  const copied = cbmCopyText(result);
  assert.ok(copied.includes('0,7834 CBM'));
  assert.ok(copied.includes('84 kg'));
  assert.ok(copied.includes('185,1883 lb'));
  assert.ok(copied.includes('2 × 92 × 61 × 37 cm'));

  for (const text of [steps, copied]) {
    assert.ok(!/NaN|Infinity|undefined|null/.test(text), text);
  }
});

test('cách tính nêu đúng đơn vị khi nhập inch và lb', () => {
  const result = calculateCbm({ kien: [line(2, 10, 10, 10, 5)], donViKichThuoc: 'inch', donViTrongLuong: 'lb' });
  const steps = cbmSteps(result).join('\n');
  assert.ok(steps.includes('2,54'));
  assert.ok(steps.includes('2 × 5 = 10 lb'));
  assert.ok(steps.includes('10 × 0,45359237'));
  assert.ok(cbmCopyText(result).includes('10 lb'));
});

test('chuyển sang xếp container: một dòng, đổi ra cm và kg; tổng GW chia đều từng kiện', () => {
  const metres = xepContainerData(calculateCbm({ kien: [line(10, 0.5, 0.4, 0.3, 22)], donViKichThuoc: 'm', donViTrongLuong: 'lb' }));
  close(metres.dai, 50, 9);
  close(metres.rong, 40, 9);
  close(metres.cao, 30, 9);
  close(metres.trongLuong, 22 * 0.45359237, 9);
  assert.equal(metres.soThung, 10);
  assert.equal(metres.ghiChuChuyen, '');

  const tong = xepContainerData(calculateCbm({ kien: [line(4, 50, 40, 30)], tongGw: 100 }));
  assert.equal(tong.trongLuong, 25);
  assert.match(tong.ghiChuChuyen, /tổng GW chia số kiện/);

  const none = xepContainerData(calculateCbm({ kien: [line(4, 50, 40, 30)] }));
  assert.equal(none.trongLuong, null);
});

test('chuyển sang xếp container: còn dòng chưa đủ số thì không chia tổng GW', () => {
  // Tổng GW gồm cả hàng của dòng gõ dở, chia cho 4 kiện dòng đầu sẽ ra số nặng hơn thật.
  const data = xepContainerData(calculateCbm({ kien: [line(4, 50, 40, 30), line(2, 50, null, null)], tongGw: 100 }));
  assert.equal(data.trongLuong, null);
  assert.equal(data.soThung, 4);
  assert.doesNotMatch(data.ghiChuChuyen, /tổng GW chia số kiện/);
  assert.match(data.ghiChuChuyen, /chỉ nhận dòng đầu/);
});

test('chuyển sang xếp container: nhiều dòng thì chỉ lấy dòng đầu và ghi rõ', () => {
  const data = xepContainerData(calculateCbm({ kien: LO_B, tongGw: 84 }));
  assert.deepEqual([data.dai, data.rong, data.cao, data.soThung], [92, 61, 37, 2]);
  // Tổng GW là của cả lô nhiều loại kiện, không chia cho dòng đầu.
  assert.equal(data.trongLuong, null);
  assert.match(data.ghiChuChuyen, /chỉ nhận dòng đầu/);
});
