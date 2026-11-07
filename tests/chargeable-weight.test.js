import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculateChargeableWeight,
  chargeableCopyText,
  chargeableSteps,
  formatVw,
} from '../site/assets/js/calc/chargeable-weight.js';

const line = (soKien, dai, rong, cao) => ({ soKien, dai, rong, cao });
const LO_A = [line(1, 81, 29, 36), line(1, 81, 29, 26), line(1, 81, 29, 31), line(1, 81, 29, 41)];
const LO_B = [line(2, 92, 61, 37), line(1, 78, 63, 40), line(1, 87, 58, 34)];
const inUnit = (kien, factor) => kien.map((item) => line(item.soKien, item.dai * factor, item.rong * factor, item.cao * factor));
const close = (actual, expected, digits = 6) => {
  assert.ok(Math.abs(actual - expected) < 10 ** -digits, `${actual} khác ${expected}`);
};

test('Lô A: GW 34 kg, 314.766 cm³ ra VW 52,46 kg, CW 52,5 kg, hàng cồng kềnh', () => {
  const result = calculateChargeableWeight({ kien: LO_A, donViKichThuoc: 'cm', gw: 34 });
  assert.equal(result.tongCm3, 314766);
  assert.equal(formatVw(result.vw), '52,46');
  assert.equal(result.cw, 52.5);
  assert.equal(result.benThang, 'cong-kenh');
  assert.equal(result.heSo, 6000);
  assert.equal(result.buoc, 0.5);
});

test('Lô B: GW 84 kg, 783.412 cm³ ra VW 130,57 kg, CW 131 kg, hàng cồng kềnh', () => {
  const result = calculateChargeableWeight({ kien: LO_B, donViKichThuoc: 'cm', gw: 84 });
  assert.equal(result.tongCm3, 783412);
  assert.equal(formatVw(result.vw), '130,57');
  assert.equal(result.cw, 131);
  assert.equal(result.benThang, 'cong-kenh');
});

test('cùng lô nhập bằng mét và inch ra đúng kết quả', () => {
  const metres = calculateChargeableWeight({ kien: inUnit(LO_A, 0.01), donViKichThuoc: 'm', gw: 34 });
  close(metres.vw, 52.461);
  assert.equal(metres.cw, 52.5);

  const inches = calculateChargeableWeight({ kien: inUnit(LO_B, 1 / 2.54), donViKichThuoc: 'inch', gw: 84 });
  close(inches.vw, 130.568667);
  assert.equal(inches.cw, 131);
});

test('hãng bay cho chọn làm tròn lên 1 kg, mặc định 0,5 kg', () => {
  const result = calculateChargeableWeight({ kien: LO_A, donViKichThuoc: 'cm', gw: 34, lamTron: 1 });
  assert.equal(result.buoc, 1);
  assert.equal(result.cw, 53);
});

test('chuyển phát nhanh chia 5000, luôn làm tròn lên 1 kg', () => {
  for (const lamTron of [0.5, 1]) {
    const result = calculateChargeableWeight({ kien: LO_A, donViKichThuoc: 'cm', gw: 34, loaiDichVu: 'chuyen-phat', lamTron });
    assert.equal(result.heSo, 5000);
    assert.equal(result.buoc, 1);
    close(result.vw, 62.9532);
    assert.equal(result.cw, 63);
  }
});

test('GW lớn hơn thì là hàng nặng, CW làm tròn từ GW', () => {
  const result = calculateChargeableWeight({ kien: LO_A, donViKichThuoc: 'cm', gw: 100.2 });
  assert.equal(result.benThang, 'nang');
  assert.equal(result.cw, 100.5);
});

test('GW bằng VW thì ghi bằng nhau, kể cả khi nhập bằng mét', () => {
  const cm = calculateChargeableWeight({ kien: [line(1, 100, 100, 30)], donViKichThuoc: 'cm', gw: 50 });
  assert.equal(cm.benThang, 'bang-nhau');
  assert.equal(cm.cw, 50);
  const metres = calculateChargeableWeight({ kien: [line(1, 1, 1, 0.3)], donViKichThuoc: 'm', gw: 50 });
  assert.equal(metres.benThang, 'bang-nhau');
  assert.equal(metres.cw, 50);
});

test('CW đã đúng bậc thì giữ nguyên, không bị đẩy lên bậc trên', () => {
  const half = calculateChargeableWeight({ kien: [line(1, 150, 60, 35)], donViKichThuoc: 'cm', gw: 1 });
  assert.equal(half.vw, 52.5);
  assert.equal(half.cw, 52.5);
  const whole = calculateChargeableWeight({ kien: [line(1, 1, 1, 0.3)], donViKichThuoc: 'm', gw: 1, lamTron: 1 });
  assert.equal(whole.cw, 50);
  assert.equal(calculateChargeableWeight({ kien: [line(1, 1, 1, 1)], donViKichThuoc: 'cm', gw: 52.5 }).cw, 52.5);
});

test('mức tối thiểu: dưới thì lấy mức tối thiểu, bằng hoặc trên thì giữ CW', () => {
  const small = [line(1, 10, 10, 10)];
  const below = calculateChargeableWeight({ kien: small, donViKichThuoc: 'cm', gw: 5, mucToiThieu: 45 });
  assert.equal(below.cw, 45);
  assert.equal(below.cwLamTron, 5);
  assert.equal(below.theoToiThieu, true);

  const equal = calculateChargeableWeight({ kien: small, donViKichThuoc: 'cm', gw: 45, mucToiThieu: 45 });
  assert.equal(equal.cw, 45);
  assert.equal(equal.theoToiThieu, false);

  const above = calculateChargeableWeight({ kien: LO_A, donViKichThuoc: 'cm', gw: 34, mucToiThieu: 45 });
  assert.equal(above.cw, 52.5);
  assert.equal(above.theoToiThieu, false);
});

test('cước ước tính tính theo CW cuối cùng; không có đơn giá thì không có cước', () => {
  const rated = calculateChargeableWeight({ kien: LO_A, donViKichThuoc: 'cm', gw: 34, donGia: 5 });
  assert.equal(rated.cuoc, 262.5);
  const atMinimum = calculateChargeableWeight({ kien: [line(1, 10, 10, 10)], donViKichThuoc: 'cm', gw: 5, mucToiThieu: 45, donGia: 5 });
  assert.equal(atMinimum.cuoc, 225);
  assert.equal(calculateChargeableWeight({ kien: LO_A, donViKichThuoc: 'cm', gw: 34 }).cuoc, null);
});

test('chưa có GW hoặc chưa có dòng đủ số thì trả về null', () => {
  assert.equal(calculateChargeableWeight({ kien: LO_A, donViKichThuoc: 'cm', gw: null }), null);
  assert.equal(calculateChargeableWeight({ kien: [], donViKichThuoc: 'cm', gw: 34 }), null);
  assert.equal(calculateChargeableWeight({ kien: [line(1, 10, null, null)], donViKichThuoc: 'cm', gw: 34 }), null);
});

test('GW, mức tối thiểu, đơn giá bằng 0 hoặc âm báo lỗi nêu đúng ô', () => {
  const base = { kien: LO_A, donViKichThuoc: 'cm', gw: 34 };
  for (const value of [0, -1]) {
    assert.ok(calculateChargeableWeight({ ...base, gw: value }).loi.startsWith('GW'));
    assert.ok(calculateChargeableWeight({ ...base, mucToiThieu: value }).loi.startsWith('Mức tối thiểu'));
    assert.ok(calculateChargeableWeight({ ...base, donGia: value }).loi.startsWith('Đơn giá'));
  }
});

test('lỗi ở dòng kiện dùng chung với CBM, gồm giới hạn 100 m', () => {
  const error = (item) => calculateChargeableWeight({ kien: [item], donViKichThuoc: 'cm', gw: 34 }).loi;
  assert.ok(error(line(0, 10, 10, 10)).startsWith('Dòng 1'));
  assert.ok(error(line(1.5, 10, 10, 10)).startsWith('Dòng 1'));
  assert.ok(error(line(1, -10, 10, 10)).startsWith('Dòng 1'));
  assert.ok(error(line(1, 10000, 10, 10)).includes('dưới 100 m'));
});

test('dòng gõ dở chưa tính và được nêu tên trong nội dung copy', () => {
  const result = calculateChargeableWeight({ kien: [...LO_A, line(2, 50, null, null)], donViKichThuoc: 'cm', gw: 34 });
  assert.equal(result.tongCm3, 314766);
  assert.deepEqual(result.chuaTinh, [5]);
  assert.ok(chargeableCopyText(result).includes('Dòng 5 chưa đủ số, chưa tính vào tổng'));
});

test('số rất lớn báo lỗi, không ra NaN hay Infinity', () => {
  const heavy = calculateChargeableWeight({ kien: LO_A, donViKichThuoc: 'cm', gw: 1e308, donGia: 1e308 });
  assert.ok(heavy.loi);
  const many = calculateChargeableWeight({ kien: [line(1e308, 9000, 9000, 9000)], donViKichThuoc: 'cm', gw: 34 });
  assert.ok(many.loi);
});

test('cách tính và nội dung copy dùng đúng số đã nhập', () => {
  const result = calculateChargeableWeight({ kien: LO_A, donViKichThuoc: 'cm', gw: 34, mucToiThieu: 45, donGia: 5 });
  const steps = chargeableSteps(result).join('\n');
  assert.ok(steps.includes('81 × 29 × 36 × 1 = 84.564 cm³'));
  assert.ok(steps.includes('314.766 ÷ 6000 = 52,461 kg'));
  assert.ok(steps.includes('52,5 kg'));
  assert.ok(steps.includes('45 kg'));
  assert.ok(steps.includes('52,5 × 5,00 = 262,50 USD'));

  // Đơn giá nhiều số lẻ thì cách tính giữ đủ số, nhân lại phải khớp kết quả.
  const precise = calculateChargeableWeight({ kien: [line(1, 10, 10, 10)], donViKichThuoc: 'cm', gw: 50, donGia: 5.554 });
  assert.ok(chargeableSteps(precise).join('\n').includes('50 × 5,554 = 277,70 USD'));

  const copied = chargeableCopyText(result);
  assert.ok(copied.includes('CW: 52,5 kg'));
  assert.ok(copied.includes('Hàng cồng kềnh'));
  assert.ok(copied.includes('GW: 34 kg'));
  assert.ok(copied.includes('VW: 52,46 kg'));
  assert.ok(copied.includes('262,50 USD'));

  for (const text of [steps, copied]) {
    assert.ok(!/NaN|Infinity|undefined|null/.test(text), text);
  }
});

test('cách tính ghi rõ khi đổi đơn vị và khi theo mức tối thiểu', () => {
  const inches = calculateChargeableWeight({ kien: [line(1, 10, 10, 10)], donViKichThuoc: 'inch', gw: 5, mucToiThieu: 45 });
  const steps = chargeableSteps(inches).join('\n');
  assert.ok(steps.includes('1 inch = 2,54 cm'));
  assert.ok(steps.includes('25,4 × 25,4 × 25,4'));
  assert.ok(steps.includes('mức tối thiểu'));
  assert.ok(chargeableCopyText(inches).includes('Tính theo mức tối thiểu'));
});
