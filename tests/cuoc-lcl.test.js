import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateLcl, formatRt, lclCopyText, lclSteps, roundCents } from '../site/assets/js/calc/cuoc-lcl.js';

// Các số dưới đây là số tự đặt, không lấy từ báo giá thật.
const fee = (ten, soTien, cachTinh = 'rt') => ({ ten, soTien, cachTinh });
const close = (actual, expected, digits = 9) => {
  assert.ok(Math.abs(actual - expected) < 10 ** -digits, `${actual} khác ${expected}`);
};

test('ví dụ đặc tả: 3 CBM, 500 kg, 20 USD/RT ra RT 3, cước 60 USD', () => {
  const result = calculateLcl({ tongCbm: 3, gw: 500, donGia: 20, mucToiThieu: 1 });
  assert.equal(result.tan, 0.5);
  assert.equal(result.rt, 3);
  assert.equal(result.benThang, 'the-tich');
  assert.equal(result.theoToiThieu, false);
  assert.equal(result.cuocBien, 60);
  assert.equal(result.tongChiPhi, null);
});

test('hàng nặng thì RT tính theo trọng lượng', () => {
  const result = calculateLcl({ tongCbm: 1, gw: 2500, donGia: 20, mucToiThieu: 1 });
  assert.equal(result.rt, 2.5);
  assert.equal(result.benThang, 'trong-luong');
  assert.equal(result.cuocBien, 50);
});

test('CBM bằng số tấn thì ghi bằng nhau, kể cả khi có sai số nhỏ', () => {
  assert.equal(calculateLcl({ tongCbm: 2, gw: 2000 }).benThang, 'bang-nhau');
  assert.equal(calculateLcl({ tongCbm: 0.1 + 0.2, gw: 300 }).benThang, 'bang-nhau');
});

test('RT dưới mức tối thiểu thì tính theo mức tối thiểu; để trống thì không áp', () => {
  const minimum = calculateLcl({ tongCbm: 0.4, gw: 100, donGia: 20, mucToiThieu: 1 });
  assert.equal(minimum.rtTruocToiThieu, 0.4);
  assert.equal(minimum.rt, 1);
  assert.equal(minimum.theoToiThieu, true);
  assert.equal(minimum.cuocBien, 20);

  const none = calculateLcl({ tongCbm: 0.4, gw: 100, donGia: 20, mucToiThieu: null });
  assert.equal(none.rt, 0.4);
  assert.equal(none.theoToiThieu, false);
  close(none.cuocBien, 8);

  const exact = calculateLcl({ tongCbm: 1, gw: 100, mucToiThieu: 1 });
  assert.equal(exact.theoToiThieu, false);
});

test('RT không làm tròn; kết quả hiện tối đa 3 số lẻ', () => {
  const result = calculateLcl({ tongCbm: 1.23456, gw: 100, donGia: 10, mucToiThieu: 1 });
  assert.equal(result.rt, 1.23456);
  assert.equal(result.cuocBien, 12.35);
  assert.equal(formatRt(result.rt), '1,235');
});

test('mỗi khoản tiền làm tròn tới 0,01 USD trước khi cộng, nên phép cộng trên trang luôn khớp', () => {
  assert.equal(roundCents(1.005), 1.01);
  assert.equal(roundCents(0.1 + 0.2), 0.3);

  const result = calculateLcl({
    tongCbm: 1.234,
    gw: 100,
    donGia: 1,
    phiXuat: [fee('CFS fee', 1, 'rt')],
    phiNhap: [fee('THC', 1, 'rt')],
  });
  assert.equal(result.cuocBien, 1.23);
  assert.equal(result.tongPhiXuat, 1.23);
  assert.equal(result.tongPhiNhap, 1.23);
  assert.equal(result.tongChiPhi, 3.69);
  assert.ok(lclSteps(result).join('\n').includes('cước biển 1,23 + đầu xuất 1,23 + đầu nhập 1,23 = 3,69 USD'));
});

test('phí theo RT nhân với RT đã áp mức tối thiểu, phí theo lô cộng một lần', () => {
  const result = calculateLcl({
    tongCbm: 0.5,
    gw: 200,
    donGia: 20,
    mucToiThieu: 1,
    phiXuat: [fee('CFS fee', 10, 'rt')],
    phiNhap: [fee('D/O fee', 30, 'lo')],
  });
  assert.equal(result.rt, 1);
  assert.deepEqual(result.dongPhiXuat.map((item) => item.thanhTien), [10]);
  assert.deepEqual(result.dongPhiNhap.map((item) => item.thanhTien), [30]);
  assert.equal(result.tongChiPhi, 60);

  const big = calculateLcl({ tongCbm: 3, gw: 500, donGia: 20, phiXuat: [fee('CFS fee', 10, 'rt'), fee('Bill fee', 30, 'lo')] });
  assert.deepEqual(big.dongPhiXuat.map((item) => item.thanhTien), [30, 30]);
  assert.equal(big.tongChiPhi, 120);
});

// Ví dụ trong tài liệu chi phí LCL của Khải; tài liệu ghi các đơn giá này chỉ để minh họa.
test('ví dụ tài liệu: 2,4 CBM, 1.800 kg, phí đầu xuất, tổng 169,20 USD', () => {
  const result = calculateLcl({
    tongCbm: 2.4,
    gw: 1800,
    donGia: 10,
    mucToiThieu: 1,
    phiXuat: [
      fee('CFS fee', 15, 'rt'),
      fee('THC', 8, 'rt'),
      fee('Bill fee', 35, 'lo'),
      fee('AFR (đi Nhật)', 30, 'lo'),
      fee('Handling fee', 25, 'lo'),
    ],
  });
  assert.equal(result.rt, 2.4);
  assert.equal(result.benThang, 'the-tich');
  close(result.cuocBien, 24);
  close(result.tongPhiXuat, 145.2);
  assert.equal(result.tongPhiNhap, 0);
  close(result.tongChiPhi, 169.2);
  assert.ok(lclCopyText(result).includes('Tổng chi phí: 169,20 USD'));
});

test('tổng chi phí cộng cả phí đầu xuất và phí đầu nhập', () => {
  const result = calculateLcl({
    tongCbm: 1.2,
    gw: 3000,
    donGia: 10,
    phiXuat: [fee('CFS fee', 5, 'rt')],
    phiNhap: [fee('D/O fee', 40, 'lo'), fee('CIC', 2, 'rt')],
  });
  assert.equal(result.rt, 3);
  assert.equal(result.benThang, 'trong-luong');
  assert.equal(result.tongPhiXuat, 15);
  assert.equal(result.tongPhiNhap, 46);
  assert.equal(result.tongChiPhi, 91);
});

test('dòng phí trống bỏ qua, có tên mà thiếu số tiền thì chưa tính, thiếu tên thì tự đặt tên', () => {
  const result = calculateLcl({
    tongCbm: 3,
    gw: 500,
    donGia: 20,
    phiXuat: [fee('', null), fee('THC', null), fee('  ', 5, 'lo')],
    phiNhap: [fee('D/O fee', null)],
  });
  assert.deepEqual(result.chuaTinh, [{ dau: 'xuat', stt: 2 }, { dau: 'nhap', stt: 1 }]);
  assert.equal(result.dongPhiXuat.length, 1);
  assert.equal(result.dongPhiXuat[0].ten, 'Phí dòng 3');
  assert.equal(result.tongChiPhi, 65);
  assert.ok(lclCopyText(result).includes('Phí đầu xuất dòng 2, phí đầu nhập dòng 1 chưa có số tiền, chưa tính vào tổng.'));
});

test('không có đơn giá thì vẫn ra RT, chưa có cước và tổng', () => {
  const result = calculateLcl({ tongCbm: 3, gw: 500, phiNhap: [fee('D/O fee', 30, 'lo')] });
  assert.equal(result.rt, 3);
  assert.equal(result.cuocBien, null);
  assert.equal(result.tongChiPhi, null);
  assert.equal(result.dongPhiNhap[0].thanhTien, 30);
});

test('chưa có CBM hoặc GW thì trả về null', () => {
  assert.equal(calculateLcl({ tongCbm: null, gw: 500 }), null);
  assert.equal(calculateLcl({ tongCbm: 3, gw: null }), null);
});

test('số bằng 0 hoặc âm báo lỗi nêu đúng ô', () => {
  const base = { tongCbm: 3, gw: 500 };
  for (const value of [0, -1]) {
    assert.ok(calculateLcl({ ...base, tongCbm: value }).loi.startsWith('Tổng CBM'));
    assert.ok(calculateLcl({ ...base, gw: value }).loi.startsWith('Tổng GW'));
    assert.ok(calculateLcl({ ...base, donGia: value }).loi.startsWith('Đơn giá'));
    assert.ok(calculateLcl({ ...base, mucToiThieu: value }).loi.startsWith('Mức tối thiểu'));
    assert.ok(calculateLcl({ ...base, phiXuat: [fee('CFS fee', value)] }).loi.startsWith('Phí đầu xuất dòng 1'));
    assert.ok(calculateLcl({ ...base, phiNhap: [fee('D/O fee', value)] }).loi.startsWith('Phí đầu nhập dòng 1'));
  }
});

test('số rất lớn báo lỗi, không ra NaN hay Infinity', () => {
  assert.ok(calculateLcl({ tongCbm: 1e308, gw: 500, donGia: 1e308 }).loi);
  assert.ok(calculateLcl({ tongCbm: 3, gw: 500, donGia: 20, phiXuat: [fee('CFS fee', 1e308), fee('THC', 1e308)] }).loi);
  assert.ok(calculateLcl({ tongCbm: 3, gw: 500, donGia: 20, phiXuat: [fee('CFS fee', 1e308)], phiNhap: [fee('THC', 1e308)] }).loi);
});

test('cách tính và nội dung copy dùng đúng số đã nhập', () => {
  const result = calculateLcl({
    tongCbm: 3,
    gw: 500,
    donGia: 20,
    mucToiThieu: 1,
    phiXuat: [fee('CFS', 10, 'rt'), fee('Bill fee', 5, 'lo')],
    phiNhap: [fee('D/O', 30, 'lo')],
  });
  const steps = lclSteps(result).join('\n');
  assert.ok(steps.includes('500 ÷ 1000 = 0,5 tấn'));
  assert.ok(steps.includes('So 3 CBM với 0,5 tấn, lấy số lớn hơn: 3 RT (tính theo thể tích)'));
  assert.ok(steps.includes('3 RT không thấp hơn mức tối thiểu 1 RT'));
  assert.ok(steps.includes('Cước biển: 3 × 20,00 = 60,00 USD'));
  assert.ok(steps.includes('Phí đầu xuất, CFS: 3 × 10,00 = 30,00 USD (theo RT)'));
  assert.ok(steps.includes('Phí đầu xuất, Bill fee: 5,00 USD (theo lô)'));
  assert.ok(steps.includes('Cộng phí đầu xuất: 30,00 + 5,00 = 35,00 USD'));
  assert.ok(steps.includes('Phí đầu nhập, D/O: 30,00 USD (theo lô)'));
  assert.ok(!steps.includes('Cộng phí đầu nhập'));
  assert.ok(steps.includes('Tổng chi phí: cước biển 60,00 + đầu xuất 35,00 + đầu nhập 30,00 = 125,00 USD'));

  const copied = lclCopyText(result);
  assert.ok(copied.includes('RT: 3 (tính theo thể tích)'));
  assert.ok(copied.includes('Tổng GW: 500 kg (0,5 tấn)'));
  assert.ok(copied.includes('Cước biển: 60,00 USD'));
  assert.ok(copied.includes('Phí đầu xuất: 35,00 USD\n- CFS (theo RT): 30,00 USD\n- Bill fee (theo lô): 5,00 USD'));
  assert.ok(copied.includes('Phí đầu nhập: 30,00 USD\n- D/O (theo lô): 30,00 USD'));
  assert.ok(copied.includes('Tổng chi phí: 125,00 USD'));
});

test('cách tính ghi rõ khi áp mức tối thiểu và giữ đủ số lẻ của RT', () => {
  const minimum = lclSteps(calculateLcl({ tongCbm: 0.4, gw: 100, donGia: 20, mucToiThieu: 1 })).join('\n');
  assert.ok(minimum.includes('0,4 RT thấp hơn mức tối thiểu 1 RT, nên RT = 1'));

  const precise = lclSteps(calculateLcl({ tongCbm: 1.23456, gw: 100, donGia: 10 })).join('\n');
  assert.ok(precise.includes('Cước biển: 1,23456 × 10,00 = 12,35 USD'));
});
