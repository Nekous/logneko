import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateXep, viTriThung, xepCopyText, xepSteps } from '../site/assets/js/calc/xep-container.js';

const DATA = JSON.parse(readFileSync(new URL('../site/data/container.json', import.meta.url), 'utf8'));

// Ô trống là null, như khi trang đọc ô nhập.
const BASE = {
  dai: 50, rong: 40, cao: 30, trongLuong: null, soThung: null,
  loaiCont: '20gp', xoay: 'moi-huong', soTangToiDa: null, nguongOws: 18,
};
const xep = (values) => calculateXep({ ...BASE, ...values }, DATA);
const huong = (result) => [result.huong.nx, result.huong.ny, result.huong.nz];

// Bảng thông số trong MO-TA-DU-AN.md, chép tay để sửa nhầm file JSON thì test báo đỏ.
const BANG_DAC_TA = {
  '20gp': { ten: "20'GP", long: [590, 235, 239], cua: [234, 228], cbm: 33, vo: '2,2–2,3', gross: 30.48, tai: 28000, ngoai: '6,06 × 2,44 × 2,59' },
  '40gp': { ten: "40'GP", long: [1203, 235, 239], cua: [234, 228], cbm: 67, vo: '3,7–3,8', gross: 32.5, tai: 28500, ngoai: '12,19 × 2,44 × 2,59' },
  '40hc': { ten: "40'HC", long: [1203, 235, 270], cua: [234, 258], cbm: 76, vo: '3,9–4,0', gross: 32.5, tai: 28500, ngoai: '12,19 × 2,44 × 2,90' },
};

test('container.json khớp từng ô của bảng thông số trong đặc tả', () => {
  assert.deepEqual(DATA.loai.map((loai) => loai.id), Object.keys(BANG_DAC_TA));
  for (const loai of DATA.loai) {
    const bang = BANG_DAC_TA[loai.id];
    assert.equal(loai.ten, bang.ten);
    assert.deepEqual([loai.long.dai, loai.long.rong, loai.long.cao], bang.long, loai.id);
    assert.deepEqual([loai.cua.rong, loai.cua.cao], bang.cua, loai.id);
    assert.equal(loai.the_tich_cbm, bang.cbm);
    assert.equal(loai.vo_tan, bang.vo);
    assert.equal(loai.max_gross_tan, bang.gross);
    assert.equal(loai.tai_trong_hang_kg, bang.tai);
    assert.equal(loai.ngoai_m, bang.ngoai);
  }
  assert.match(DATA.ghi_chu, /tham khảo, đối chiếu với hãng tàu/);
  assert.ok(DATA.ngay_cap_nhat);
});

test('nguồn hiện trên trang không có tên riêng hay file nội bộ', () => {
  assert.match(DATA.nguon, /tham khảo/);
  assert.doesNotMatch(DATA.nguon, /Khải|MO-TA|\.md/);
});

test('OWS chỉ ghi ngưỡng cho cont 20\', không ghi số tiền', () => {
  assert.deepEqual(DATA.ows.ap_dung, ['20gp']);
  assert.equal(DATA.ows.nguong_tan, 18);
  assert.match(DATA.ows.ghi_chu, /tùy hãng/);
  assert.doesNotMatch(JSON.stringify(DATA), /USD|\$/);
});

test('ví dụ đặc tả: 50 × 40 × 30 vào 20\'GP ra 392 thùng, chọn 14 × 7 × 4 (ít tầng hơn)', () => {
  const result = xep({});
  assert.equal(result.moiCont, 392);
  assert.equal(result.luoi, 392);
  assert.deepEqual(huong(result), [14, 7, 4]);
  assert.deepEqual([result.huong.a, result.huong.b, result.huong.c], [40, 30, 50]);
  assert.equal(result.hoaSoThung, true);
  assert.equal(result.gioiHan, 'kich-thuoc');
});

test('hòa số thùng mà cùng số tầng thì không ghi "chọn hướng ít tầng hơn"', () => {
  const result = xep({ dai: 83, rong: 58, cao: 53 });
  assert.equal(result.moiCont, 112);
  assert.equal(result.huong.nz, 4);
  const hoa = result.cacHuong.filter((item) => item.soLuong === result.moiCont);
  assert.ok(hoa.length > 1, 'ca này phải có hơn một hướng ra 112 thùng');
  assert.ok(hoa.every((item) => item.nz === 4));
  assert.equal(result.hoaSoThung, false);
  assert.doesNotMatch(xepSteps(result).join('\n'), /ít tầng hơn/);
});

test('chặn số quá nhỏ hoặc quá lớn', () => {
  assert.match(xep({ dai: 0.09 }).loi, /0,1 cm/);
  assert.equal(xep({ dai: 0.1, rong: 0.1, cao: 0.1 }).loi, undefined);
  assert.match(xep({ soThung: 1000000001 }).loi, /tối đa 1\.000\.000\.000/);
  assert.equal(xep({ soThung: 1000000000 }).loi, undefined);
  assert.match(xep({ trongLuong: 0.0009 }).loi, /0,001 kg/);
  assert.equal(xep({ trongLuong: 0.001 }).loi, undefined);
});

test('tổng trọng lượng bằng đúng tải trọng thì không báo vượt vì sai số máy tính', () => {
  // 0,07 × 400.000 trên máy tính ra 28.000,000000000004.
  const result = xep({ dai: 1, rong: 1, cao: 1, trongLuong: 0.07, soThung: 400000 });
  assert.equal(result.loi, undefined);
  assert.equal(result.vuotTai, false);
});

test('không xoay thì giữ hướng đặt thẳng: 11 × 5 × 7 = 385 thùng', () => {
  const result = xep({ xoay: 'khong' });
  assert.equal(result.moiCont, 385);
  assert.deepEqual(huong(result), [11, 5, 7]);
  assert.equal(result.cacHuong.length, 1);
});

test('chỉ xoay ngang thì cạnh cao luôn dựng đứng', () => {
  const result = xep({ xoay: 'giu-mat-tren' });
  assert.equal(result.cacHuong.length, 2);
  assert.ok(result.cacHuong.every((item) => item.c === 30));
  // 590 ÷ 40 = 14, 235 ÷ 50 = 4, 239 ÷ 30 = 7 → 392, hơn 11 × 5 × 7 = 385.
  assert.equal(result.moiCont, 392);
  assert.deepEqual(huong(result), [14, 4, 7]);
});

test('xoay mọi hướng thử đủ 6 hướng; thùng có cạnh bằng nhau thì bỏ hướng trùng', () => {
  assert.equal(xep({}).cacHuong.length, 6);
  assert.equal(xep({ dai: 50, rong: 50, cao: 30 }).cacHuong.length, 3);
  assert.equal(xep({ dai: 40, rong: 40, cao: 40 }).cacHuong.length, 1);
});

test('số tầng tối đa giới hạn số thùng và có thể đổi hướng xếp', () => {
  const result = xep({ soTangToiDa: 3 });
  // Chỉ cho 3 tầng: 40 × 30 × 50 được 14 × 7 × 3 = 294, hơn 30 × 40 × 50 được 19 × 5 × 3 = 285.
  assert.equal(result.moiCont, 294);
  assert.deepEqual(huong(result), [14, 7, 3]);
  assert.equal(result.gioiHan, 'so-tang');

  // Không chạm giới hạn thì vẫn ghi là kích thước lòng cont.
  assert.equal(xep({ soTangToiDa: 10 }).gioiHan, 'kich-thuoc');
});

test('bị giới hạn bởi tải trọng: thùng 100 kg chỉ xếp được 280 thùng mỗi cont 20\'', () => {
  const result = xep({ trongLuong: 100 });
  assert.equal(result.luoi, 392);
  assert.equal(result.theoTai, 280);
  assert.equal(result.moiCont, 280);
  assert.equal(result.gioiHan, 'tai-trong');
  assert.equal(result.vuotTai, true);
  assert.equal(result.kgNeuXepDay, 39200);
  assert.equal(result.contDay.kg, 28000);
  assert.equal(result.contDay.phanTramTai, 100);
});

test('lô ít thùng, chưa tới tải trọng thì không báo vượt tải', () => {
  const result = xep({ trongLuong: 100, soThung: 200 });
  assert.equal(result.vuotTai, false);
  assert.equal(result.soCont, 1);
  assert.equal(result.contCuoi.kg, 20000);
  // 300 thùng × 100 kg = 30 tấn: vượt, nên chia 2 cont 280 + 20.
  const nang = xep({ trongLuong: 100, soThung: 300 });
  assert.equal(nang.vuotTai, true);
  assert.equal(nang.kgNeuXepDay, 30000);
  assert.equal(nang.soCont, 2);
  assert.equal(nang.contCuoi.soThung, 20);
});

test('hàng nhẹ thì tải trọng không giới hạn, không cảnh báo vượt tải', () => {
  const result = xep({ trongLuong: 20 });
  assert.equal(result.moiCont, 392);
  assert.equal(result.vuotTai, false);
  assert.equal(result.contDay.kg, 7840);
  assert.equal(result.contDay.phanTramTai, 28);
});

test('một thùng nặng hơn tải trọng của cont thì báo lỗi', () => {
  assert.ok(xep({ trongLuong: 28001 }).loi);
  assert.ok(!xep({ trongLuong: 28000 }).loi);
});

test('cửa cont: thùng cao 235 cm đứng thẳng không lọt cửa 228 cm dù lòng cao 239 cm', () => {
  const dung = { dai: 100, rong: 100, cao: 235, xoay: 'khong' };
  const result = xep(dung);
  assert.ok(result.loi);
  assert.match(result.loi, /cửa/);

  // Cho xoay thì đặt nằm, vẫn xếp được.
  const nam = xep({ ...dung, xoay: 'moi-huong' });
  assert.ok(nam.moiCont > 0);
  assert.ok(nam.huong.c <= 228);
  assert.ok(nam.cacHuong.some((item) => item.loai === 'cua'));

  // 40'HC có cửa cao 258 cm nên đứng thẳng vẫn lọt.
  assert.equal(xep({ ...dung, loaiCont: '40hc' }).moiCont, 24);
});

test('thùng lớn hơn lòng cont theo mọi hướng thì báo lỗi', () => {
  const result = xep({ dai: 600, rong: 240, cao: 240 });
  assert.match(result.loi, /lớn hơn lòng cont/);
});

test('có số thùng thì tính số cont và số thùng ở cont cuối', () => {
  const result = xep({ soThung: 1000 });
  assert.equal(result.soCont, 3);
  assert.equal(result.soContDay, 2);
  assert.equal(result.contCuoi.soThung, 216);

  const vua = xep({ soThung: 784 });
  assert.equal(vua.soCont, 2);
  assert.equal(vua.soContDay, 2);
  assert.equal(vua.contCuoi, null);

  const it = xep({ soThung: 100 });
  assert.equal(it.soCont, 1);
  assert.equal(it.soContDay, 0);
  assert.equal(it.contCuoi.soThung, 100);
  // Hình 3D vẽ đúng số thùng thật khi chỉ cần một cont.
  assert.equal(it.soThungHinh, 100);
  assert.equal(xep({ soThung: 1000 }).soThungHinh, 392);
});

test('% thể tích tính trên kích thước lòng cont', () => {
  const result = xep({});
  const theTichLong = 5.9 * 2.35 * 2.39;
  assert.ok(Math.abs(result.theTichLong - theTichLong) < 1e-9);
  assert.ok(Math.abs(result.contDay.phanTramTheTich - (392 * 0.06 / theTichLong) * 100) < 1e-9);
  assert.equal(result.contDay.phanTramTai, null);
});

test('OWS: cont 20\' chở từ ngưỡng trở lên thì nhắc; ngưỡng sửa được; cont 40\' không nhắc', () => {
  // 392 thùng × 50 kg = 19.600 kg ≥ 18 tấn.
  assert.equal(xep({ trongLuong: 50 }).contDay.ows, true);
  assert.equal(xep({ trongLuong: 50, nguongOws: 20 }).contDay.ows, false);
  assert.equal(xep({ trongLuong: 40 }).contDay.ows, false);
  // Đúng bằng ngưỡng cũng nhắc: 360 thùng × 50 kg = 18.000 kg.
  assert.equal(xep({ trongLuong: 50, soThung: 360 }).contCuoi.ows, true);
  assert.equal(xep({ trongLuong: 50, loaiCont: '40gp' }).contDay.ows, false);
  // Để trống ngưỡng thì không nhắc; chưa có trọng lượng thì không xét.
  assert.equal(xep({ trongLuong: 50, nguongOws: null }).contDay.ows, false);
  assert.equal(xep({}).contDay.ows, false);
  // Cont cuối nhẹ hơn thì xét riêng.
  const result = xep({ trongLuong: 50, soThung: 500 });
  assert.equal(result.contDay.ows, true);
  assert.equal(result.contCuoi.ows, false);
});

test('số lạ: ô trống trả về null, số 0 hay âm báo lỗi, số thùng và số tầng phải nguyên', () => {
  assert.equal(xep({ dai: null }), null);
  assert.equal(xep({ cao: null }), null);
  for (const values of [
    { dai: 0 }, { rong: -5 }, { trongLuong: 0 }, { trongLuong: -1 },
    { soThung: 0 }, { soThung: 2.5 }, { soTangToiDa: 0 }, { soTangToiDa: 1.5 },
    { nguongOws: 0 }, { loaiCont: 'khong-co' },
  ]) {
    const result = xep(values);
    assert.ok(result?.loi, JSON.stringify(values));
  }
});

test('không có NaN trong cách tính và chữ copy', () => {
  for (const values of [{}, { trongLuong: 100, soThung: 1000 }, { soTangToiDa: 3, loaiCont: '40hc' }]) {
    const result = xep(values);
    const text = [...xepSteps(result), xepCopyText(result)].join('\n');
    assert.doesNotMatch(text, /NaN|undefined|Infinity/);
  }
  assert.match(xepSteps(xep({})).join('\n'), /ít tầng hơn/);
  assert.match(xepCopyText(xep({})), /392 thùng/);
  assert.match(xepCopyText(xep({})), /tham khảo/);
});

test('viTriThung: đúng số thùng, xếp từ vách đầu cont, không thùng nào ra ngoài lòng cont', () => {
  const result = xep({ soThung: 100 });
  const { thung, khoi } = viTriThung(result);
  assert.equal(khoi, null);
  assert.equal(thung.length, 100);
  const { a, b, c } = result.huong;
  const { dai, rong, cao } = result.long;
  for (const item of thung) {
    assert.ok(item.x >= 0 && item.x + a <= dai);
    assert.ok(item.y >= 0 && item.y + b <= rong);
    assert.ok(item.z >= 0 && item.z + c <= cao);
    assert.equal(item.z, item.tang * c);
  }
  // 100 thùng chưa đầy hai hàng ngang 7 × 4 = 28, nên chỉ chiếm 4 hàng đầu tính từ vách.
  assert.ok(thung.every((item) => item.x < 4 * a));
  assert.equal(new Set(thung.map((item) => `${item.x},${item.y},${item.z}`)).size, 100);
});

test('viTriThung: quá nhiều thùng thì gộp thành khối theo tầng, đủ thể tích', () => {
  const result = xep({ dai: 10, rong: 10, cao: 10, loaiCont: '40hc' });
  assert.ok(result.soThungHinh > 20000);
  const { thung, khoi } = viTriThung(result, 20000);
  assert.equal(thung, null);
  const tong = khoi.reduce((sum, item) => sum + item.dx * item.dy * item.dz, 0);
  assert.equal(tong, result.soThungHinh * 1000);
  assert.ok(khoi.every((item) => item.x + item.dx <= result.long.dai && item.z + item.dz <= result.long.cao));

  // Số thùng lẻ hàng: khối cuối chỉ dài bằng số thùng còn lại.
  const le = xep({ dai: 10, rong: 10, cao: 10, loaiCont: '40hc', soThung: 30005 });
  const { khoi: khoiLe } = viTriThung(le, 20000);
  assert.equal(khoiLe.reduce((sum, item) => sum + item.dx * item.dy * item.dz, 0), 30005 * 1000);
});

test('Three.js nằm trong vendor kèm giấy phép, trang chỉ tải khi cần chứ không gắn sẵn', () => {
  const vendor = new URL('../site/assets/js/vendor/three/', import.meta.url);
  assert.ok(readFileSync(new URL('three-logneko.min.js', vendor)).length > 0);
  assert.match(readFileSync(new URL('LICENSE.txt', vendor), 'utf8'), /MIT/);
  const html = readFileSync(new URL('../site/tools/xep-container.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('vendor/'));
});
