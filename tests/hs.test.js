import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  CHU_THICH,
  boGach,
  chepMa,
  chuThichKyHieu,
  chuongCua,
  docMa,
  duongDan,
  hienThue,
  laMa,
  tenTep,
  timTheoMa,
  timTheoTen,
} from '../site/assets/js/calc/hs.js';

const HS = new URL('../site/data/hs/', import.meta.url);
const readJson = (file) => JSON.parse(readFileSync(new URL(file, HS), 'utf8'));
const META = readJson('meta.json');
const CHI_MUC = readJson('chi-muc.json');
const CHUONG = new Map(META.chuong.map((ch) => [ch.so, readJson(ch.file)]));
const tatCaDong = () => [...CHUONG.values()].flatMap((ch) => ch.dong);
const timDong = (ma) => CHUONG.get(chuongCua(ma)).dong.find((dong) => dong.ma === ma);

test('meta ghi đúng file nguồn, ngày cập nhật và đủ chương', () => {
  assert.equal(META.nguon, 'BIEU THUE XNK 2026.04.05.xlsx');
  assert.equal(META.cap_nhat, '2026-04-05');
  // 97 chương có mã (01–97 trừ 77, cộng Chương 98) và Chương 77 để dành, không có mã.
  assert.equal(META.chuong.length, 98);
  assert.deepEqual(META.chuong_khong_co_ma, [77]);
  for (const ch of META.chuong) {
    assert.equal(ch.file, tenTep(ch.so));
    assert.ok(existsSync(new URL(ch.file, HS)), ch.file);
    assert.ok(ch.vi, `Chương ${ch.so} có tên`);
  }
  assert.equal(META.phan.length, 21);
  assert.equal(META.chuong.find((ch) => ch.so === 98).phan, null);
});

test('Đủ 12.000 dòng mã 8 số, số mã khác nhau khớp dữ liệu', () => {
  const dong8 = tatCaDong().filter((dong) => dong.ma?.length === 8);
  assert.equal(dong8.length, 12000);
  assert.equal(META.so_dong_ma_8_so, 12000);
  assert.equal(META.so_ma_8_so, new Set(dong8.map((dong) => dong.ma)).size);
  assert.equal(META.so_ma_8_so, 11871);
  assert.equal(META.so_dong_chuong_98, 586);
  assert.equal(META.so_ma_chuong_98, 457);
});

test('Con số trên trang chủ khớp số mã khác nhau của dữ liệu', () => {
  const tools = JSON.parse(readFileSync(new URL('../site/data/tools.json', import.meta.url), 'utf8'));
  const stat = tools.so_lieu.find((item) => item.can === 'hs-code');
  assert.equal(stat.so, META.so_ma_8_so.toLocaleString('vi-VN'));
  assert.equal(tools.cong_cu.find((tool) => tool.id === 'hs-code').trang_thai, 'hoat-dong');
});

test('Mỗi dòng nằm đúng chương của 2 số đầu mã', () => {
  for (const [so, ch] of CHUONG) {
    for (const dong of ch.dong) if (dong.ma) assert.equal(chuongCua(dong.ma), so, dong.ma);
  }
});

test('Chương 98 nối hai chiều với mã gốc', () => {
  const dong98 = CHUONG.get(98).dong.filter((dong) => dong.ma?.length === 8);
  const goc8 = dong98.filter((dong) => dong.goc?.length === 8);
  const goc4 = dong98.filter((dong) => dong.goc?.length === 4);
  const khongGoc = dong98.filter((dong) => !dong.goc);
  assert.equal(goc8.length, 569);
  assert.equal(goc4.length, 6);
  assert.equal(khongGoc.length, 11);
  for (const dong of [...goc8, ...goc4]) {
    const goc = timDong(dong.goc);
    assert.ok(goc, `${dong.ma} trỏ tới ${dong.goc}`);
    assert.ok(goc.ch98.some((item) => item.ma === dong.ma), `${dong.goc} có liên kết ngược tới ${dong.ma}`);
  }
  // Ví dụ chép từ file: tôm hùm Na Uy hun khói 98041500 ứng 03061500.
  const dong = CHUONG.get(98).dong.find((item) => item.ma === '98041500');
  assert.equal(dong.goc, '03061500');
  assert.deepEqual(dong.ud, ['27', '26/2023/NĐ-CP', '15/07/2023']);
  assert.deepEqual(timDong('03061500').ud, ['10', '26/2023/NĐ-CP', '15/07/2023']);
  assert.equal(timDong('03061500').ch98[0].ma, '98041500');
});

test('Mã 7 số bất thường trong Chương 98 được giữ nguyên và liệt kê', () => {
  assert.deepEqual(META.ma_bat_thuong.map((item) => item.ma), ['9849170', '9849170', '9849170', '9849190']);
});

test('Ô thuế dạng chữ giữ nguyên văn', () => {
  const dong = tatCaDong();
  const ud = dong.map((item) => item.ud?.[0] ?? '');
  assert.equal(ud.filter((text) => text.startsWith('Theo hướng dẫn')).length, 264);
  assert.equal(ud.filter((text) => text.includes('NHN')).length, 31);
  assert.equal(dong.filter((item) => item.vat?.[0].includes('*')).length, 1028);
  assert.deepEqual(timDong('87021010').ud, ['Theo hướng dẫn tại khoản 1.1 Chương 98', '26/2023/NĐ-CP', '15/07/2023']);
  assert.equal(timDong('87021010').tt[0], '150% thuế MFN');
  assert.equal(timDong('01012900').vat[0], '*/5/8/10');
  assert.equal(timDong('01012900').tt[0], '7.5');
});

test('Lỗi gõ ngày của file gốc đã sửa và được ghi lại; mọi ô ngày đúng dạng', () => {
  assert.deepEqual(META.da_sua, [{ tu: '30/06/20025', thanh: '30/06/2025', so_o: 1561 }]);
  assert.equal(timDong('87021010').vat[2], '30/06/2025');
  for (const dong of tatCaDong()) {
    for (const key of ['tt', 'ud', 'vat']) {
      const ngay = dong[key]?.[2];
      if (ngay) assert.match(ngay, /^\d{2}\/\d{2}\/\d{4}$/, `${dong.ma} ${key}`);
    }
  }
});

test('Chỉ mục tìm theo tên trỏ cha hợp lệ', () => {
  assert.equal(CHI_MUC.length, tatCaDong().filter((dong) => !dong.loai).length);
  CHI_MUC.forEach(([, , , , cha], i) => assert.ok(cha < i, `dòng ${i}`));
});

test('Đọc mã: các cách gõ đúng và các ca lỗi', () => {
  assert.deepEqual(docMa('8471'), { ma: '8471' });
  assert.deepEqual(docMa('8471.30'), { ma: '847130' });
  assert.deepEqual(docMa(' 84 71 30 20 '), { ma: '84713020' });
  assert.deepEqual(docMa('0306.15.00'), { ma: '03061500' });
  assert.match(docMa('1').loi, /ít nhất 2/);
  assert.match(docMa('123456789').loi, /dài nhất 8.*9/);
  assert.match(docMa('84a1').loi, /chỉ gồm chữ số/);
  assert.equal(laMa('8471.30'), true);
  assert.equal(laMa('tôm'), false);
  assert.equal(laMa('8471 laptop'), false);
  assert.equal(laMa('  '), false);
});

test('Tìm theo mã: 2 số ra các nhóm, mã dài hơn ra cả dòng con không có mã', () => {
  const c01 = CHUONG.get(1);
  const nhom = timTheoMa(c01, '01');
  assert.equal(nhom.loai, 'chuong');
  assert.deepEqual(nhom.dong.map((i) => c01.dong[i].ma), ['0101', '0102', '0103', '0104', '0105', '0106']);

  const ngua = timTheoMa(c01, '0101');
  assert.equal(ngua.loai, 'ma');
  assert.deepEqual(ngua.dong.map((i) => c01.dong[i].ma || boGach(c01.dong[i].vi)),
    ['0101', 'Ngựa:', '01012100', '01012900', '010130', '01013010', '01013090', '01019000']);

  const c84 = CHUONG.get(84);
  const may = timTheoMa(c84, '847130');
  assert.deepEqual(may.dong.map((i) => c84.dong[i].ma), ['847130', '84713020', '84713090']);
  assert.deepEqual(may.duongDan.map((i) => c84.dong[i].ma), ['8471']);

  const mot = timTheoMa(c01, '01012100');
  assert.deepEqual(mot.dong.map((i) => c01.dong[i].ma), ['01012100']);
  assert.deepEqual(mot.duongDan.map((i) => c01.dong[i].ma || boGach(c01.dong[i].vi)), ['0101', 'Ngựa:']);

  assert.deepEqual(timTheoMa(c84, '84799999'), { loai: 'khong-co', ganNhat: '84799' });
});

test('Mã 98 ứng nhiều mã gốc thì ra đủ các dòng', () => {
  const c98 = CHUONG.get(98);
  const kq = timTheoMa(c98, '98041900');
  assert.deepEqual(kq.dong.map((i) => c98.dong[i].goc), ['03061900', '03099012']);
});

test('Tìm theo tên: không dấu, theo dòng cha, tiếng Anh', () => {
  const ma = (chu) => timTheoTen(CHI_MUC, chu).ketQua.map((item) => item.ma);
  assert.equal(ma('ca phe')[0], '0901');
  assert.equal(ma('cà phê')[0], '0901');
  assert.equal(ma('laptop')[0], '84713020');
  // Dòng 9804... chỉ ghi "Tôm hùm Na Uy", chữ "hun khói" nằm ở dòng cha 9804.
  assert.ok(timTheoTen(CHI_MUC, 'tom hun khoi', { gioiHan: 100 }).ketQua.some((item) => item.ma === '98041500'));
  assert.deepEqual(timTheoTen(CHI_MUC, '   '), { ketQua: [], tong: 0 });
  assert.equal(timTheoTen(CHI_MUC, 'zzzzqq').tong, 0);
  const nhieu = timTheoTen(CHI_MUC, 'tom', { gioiHan: 5 });
  assert.equal(nhieu.ketQua.length, 5);
  assert.ok(nhieu.tong > 5);
});

test('Đường dẫn cha', () => {
  const c01 = CHUONG.get(1);
  const i = c01.dong.findIndex((dong) => dong.ma === '01022911');
  assert.deepEqual(duongDan(c01.dong, i).map((k) => c01.dong[k].ma || boGach(c01.dong[k].vi)),
    ['0102', 'Gia súc:', '010229', 'Gia súc đực:']);
});

test('Hiện mức thuế: số viết kiểu Việt Nam kèm %, chữ giữ nguyên văn', () => {
  assert.equal(hienThue('40.5'), '40,5%');
  assert.equal(hienThue('0'), '0%');
  assert.equal(hienThue('7.5'), '7,5%');
  assert.equal(hienThue('150% thuế MFN'), '150% thuế MFN');
  assert.equal(hienThue('*/5/8/10'), '*/5/8/10');
  assert.equal(hienThue('Theo hướng dẫn tại khoản 1.1 Chương 98'), 'Theo hướng dẫn tại khoản 1.1 Chương 98');
  assert.equal(hienThue(undefined), '');
});

test('Chú thích chỉ hiện cho ký hiệu có trong dòng', () => {
  assert.deepEqual(chuThichKyHieu(timDong('01012900')), [CHU_THICH.sao, CHU_THICH.vat]);
  assert.deepEqual(chuThichKyHieu(timDong('87021010')), [CHU_THICH.vat, CHU_THICH.chuong98]);
  const nhn = tatCaDong().find((dong) => dong.ud?.[0].includes('NHN'));
  assert.ok(chuThichKyHieu(nhn).includes(CHU_THICH.nhn));
  assert.deepEqual(chuThichKyHieu({ vat: ['10', '', ''] }), []);
});

test('Nội dung Copy có mã, 3 mức thuế và nguồn', () => {
  const text = chepMa(timDong('01012900'), META);
  assert.match(text, /^Mã HS 01012900: Loại khác/);
  assert.match(text, /NK ưu đãi: 5% \(26\/2023\/NĐ-CP, hiệu lực 15\/07\/2023\)/);
  assert.match(text, /NK thông thường: 7,5%/);
  assert.match(text, /VAT: \*\/5\/8\/10/);
  assert.match(text, /BIEU THUE XNK 2026\.04\.05\.xlsx, cập nhật 05\/04\/2026/);
});
