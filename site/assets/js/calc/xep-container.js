// Xếp một loại thùng vào container theo lưới. Hàm thuần, chạy được cả trong test.
import { formatNumber } from '../core/format.js';

const CM3_PER_M3 = 1000000;
const KG_PER_TON = 1000;
// 590 ÷ 59 phải ra đúng 10, không ra 9 vì sai số của máy tính.
const EPSILON = 1e-9;
const PERCENT_DECIMALS = { toiDa: 1 };
const M3_DECIMALS = { toiDa: 6 };
// Chặn số quá nhỏ hoặc quá lớn: thùng nhỏ hơn thì hình 3D vẽ hàng trăm nghìn khối, số thùng lớn hơn thì mất chính xác.
const CANH_TOI_THIEU_CM = 0.1;
const KG_TOI_THIEU = 0.001;
const SO_THUNG_TOI_DA = 1e9;
// Quá chừng này thùng thì hình 3D gộp mỗi tầng thành một khối, để điện thoại không bị đơ.
export const SO_THUNG_VE_TOI_DA = 20000;

export const XOAY_TEXT = {
  'moi-huong': 'Xoay mọi hướng',
  'giu-mat-tren': 'Chỉ xoay ngang, giữ mặt trên',
  khong: 'Không xoay',
};

export const GIOI_HAN_TEXT = {
  'kich-thuoc': 'Kích thước lòng cont',
  'so-tang': 'Số tầng tối đa',
  'tai-trong': 'Tải trọng hàng của cont',
};

const fitCount = (space, size) => Math.floor(space / size + EPSILON);
const isFilled = (value) => value !== null && value !== undefined;
const cm = (value) => `${formatNumber(value)} cm`;
const kg = (value) => `${formatNumber(value)} kg`;

export function formatPercent(value) {
  return `${formatNumber(value, PERCENT_DECIMALS)}%`;
}

// Hướng đặt thùng: a nằm theo chiều dài cont, b theo chiều rộng, c dựng đứng.
function orientations({ dai, rong, cao }, xoay) {
  if (xoay === 'khong') return [[dai, rong, cao]];
  if (xoay === 'giu-mat-tren') return [[dai, rong, cao], [rong, dai, cao]];
  return [
    [dai, rong, cao], [dai, cao, rong], [rong, dai, cao],
    [rong, cao, dai], [cao, dai, rong], [cao, rong, dai],
  ];
}

// Thùng có hai cạnh bằng nhau thì vài hướng trùng nhau, chỉ giữ một.
function uniqueOrientations(list) {
  const seen = new Set();
  return list.filter((item) => {
    const key = item.join('×');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tryOrientation([a, b, c], loai, soTangToiDa) {
  const { long, cua } = loai;
  if (a > long.dai || b > long.rong || c > long.cao) return { a, b, c, loai: 'long', soLuong: 0 };
  // Thùng phải lọt qua cửa: cạnh ngang không quá rộng cửa, cạnh đứng không quá cao cửa.
  if (b > cua.rong || c > cua.cao) return { a, b, c, loai: 'cua', soLuong: 0 };
  const nx = fitCount(long.dai, a);
  const ny = fitCount(long.rong, b);
  const nzMax = fitCount(long.cao, c);
  const nz = isFilled(soTangToiDa) ? Math.min(nzMax, soTangToiDa) : nzMax;
  return { a, b, c, loai: 'xep-duoc', nx, ny, nz, nzMax, soLuong: nx * ny * nz };
}

function inputError({ dai, rong, cao, trongLuong, soThung, soTangToiDa, nguongOws }) {
  if ([dai, rong, cao].some((value) => value <= 0)) return 'Kích thước thùng phải lớn hơn 0.';
  if ([dai, rong, cao].some((value) => value < CANH_TOI_THIEU_CM)) return 'Mỗi cạnh thùng phải từ 0,1 cm trở lên.';
  if (isFilled(trongLuong) && trongLuong <= 0) return 'Trọng lượng mỗi thùng phải lớn hơn 0, không có thì để trống.';
  if (isFilled(trongLuong) && trongLuong < KG_TOI_THIEU) return 'Trọng lượng mỗi thùng phải từ 0,001 kg trở lên.';
  if (isFilled(soThung) && (!Number.isInteger(soThung) || soThung < 1)) {
    return 'Số thùng phải là số nguyên từ 1 trở lên, không có thì để trống.';
  }
  if (isFilled(soThung) && soThung > SO_THUNG_TOI_DA) return 'Số thùng tối đa 1.000.000.000.';
  if (isFilled(soTangToiDa) && (!Number.isInteger(soTangToiDa) || soTangToiDa < 1)) {
    return 'Số tầng tối đa phải là số nguyên từ 1 trở lên, không giới hạn thì để trống.';
  }
  if (isFilled(nguongOws) && nguongOws <= 0) return 'Ngưỡng nhắc OWS phải lớn hơn 0, không cần nhắc thì để trống.';
  return '';
}

function noFitError(cacHuong, loai) {
  if (cacHuong.some((item) => item.loai === 'cua')) {
    return `Thùng không lọt cửa cont ${loai.ten} (rộng ${cm(loai.cua.rong)}, cao ${cm(loai.cua.cao)}) theo hướng nào được phép. Bạn thử cho xoay thùng hoặc chọn cont khác.`;
  }
  return `Thùng lớn hơn lòng cont ${loai.ten} theo mọi hướng được phép. Bạn thử cho xoay thùng hoặc chọn cont khác.`;
}

// Số liệu của một cont chở n thùng: thể tích, trọng lượng và có cần nhắc OWS không.
function contInfo(n, ctx) {
  const { theTichThung, theTichLong, trongLuong, taiTrong, nguongOwsKg } = ctx;
  const kgHang = isFilled(trongLuong) ? n * trongLuong : null;
  return {
    soThung: n,
    theTich: n * theTichThung,
    phanTramTheTich: n * theTichThung / theTichLong * 100,
    kg: kgHang,
    // Nhân trước rồi chia để 28% không thành 28,000000000000004%.
    phanTramTai: isFilled(kgHang) ? kgHang * 100 / taiTrong : null,
    ows: isFilled(kgHang) && isFilled(nguongOwsKg) && kgHang >= nguongOwsKg,
  };
}

// values: kích thước cm, trọng lượng kg mỗi thùng, loaiCont là id trong container.json.
// Trả về null khi chưa đủ kích thước, { loi } khi số liệu sai.
export function calculateXep(values, data) {
  const { dai, rong, cao, trongLuong = null, soThung = null, loaiCont, xoay = 'moi-huong', soTangToiDa = null, nguongOws = null } = values;
  if (![dai, rong, cao].every(isFilled)) return null;
  const error = inputError(values);
  if (error) return { loi: error };

  const loai = data.loai.find((item) => item.id === loaiCont);
  if (!loai) return { loi: 'Chưa chọn loại cont.' };
  const taiTrong = loai.tai_trong_hang_kg;
  if (isFilled(trongLuong) && trongLuong > taiTrong) {
    return { loi: `Một thùng đã nặng hơn tải trọng hàng tối đa của cont ${loai.ten} (${kg(taiTrong)}).` };
  }

  const cacHuong = uniqueOrientations(orientations({ dai, rong, cao }, xoay)).map((item) => tryOrientation(item, loai, soTangToiDa));
  // Nhiều thùng nhất; hòa thì chọn hướng ít tầng hơn, chồng thấp thì ổn định hơn.
  let huong = null;
  for (const item of cacHuong) {
    if (item.soLuong === 0) continue;
    if (!huong || item.soLuong > huong.soLuong || (item.soLuong === huong.soLuong && item.nz < huong.nz)) huong = item;
  }
  if (!huong) return { loi: noFitError(cacHuong, loai) };
  // Chỉ ghi "chọn hướng ít tầng hơn" khi hướng hòa số thùng thật sự cao tầng hơn.
  const hoaSoThung = cacHuong.some((item) => item !== huong && item.soLuong === huong.soLuong && item.nz > huong.nz);

  const luoi = huong.soLuong;
  const theoTai = isFilled(trongLuong) ? fitCount(taiTrong, trongLuong) : null;
  const moiCont = isFilled(theoTai) ? Math.min(luoi, theoTai) : luoi;
  let gioiHan = 'kich-thuoc';
  if (isFilled(theoTai) && theoTai < luoi) gioiHan = 'tai-trong';
  else if (huong.nz < huong.nzMax) gioiHan = 'so-tang';

  const ows = data.ows ?? { ap_dung: [] };
  const apOws = ows.ap_dung.includes(loai.id);
  const ctx = {
    theTichThung: (dai * rong * cao) / CM3_PER_M3,
    theTichLong: (loai.long.dai * loai.long.rong * loai.long.cao) / CM3_PER_M3,
    trongLuong,
    taiTrong,
    nguongOwsKg: apOws && isFilled(nguongOws) ? nguongOws * KG_PER_TON : null,
  };

  const thungNeuXepDay = isFilled(soThung) ? Math.min(soThung, luoi) : luoi;
  let soCont = null;
  let soContDay = null;
  let contCuoi = null;
  if (isFilled(soThung)) {
    soCont = Math.ceil(soThung / moiCont);
    soContDay = Math.floor(soThung / moiCont);
    const du = soThung - soContDay * moiCont;
    if (du > 0) contCuoi = contInfo(du, ctx);
  }

  const result = {
    dai, rong, cao, trongLuong, soThung, xoay, soTangToiDa,
    nguongOws: ctx.nguongOwsKg === null ? null : nguongOws,
    loai,
    long: loai.long,
    apOws,
    cacHuong,
    huong,
    hoaSoThung,
    luoi,
    theoTai,
    moiCont,
    gioiHan,
    // Chỉ cảnh báo khi số thùng thật sự cần xếp làm cont vượt tải; lô ít thùng thì không báo đỏ.
    soNeuXepDay: thungNeuXepDay,
    vuotTai: isFilled(trongLuong) && thungNeuXepDay * trongLuong > taiTrong + EPSILON,
    kgNeuXepDay: isFilled(trongLuong) ? thungNeuXepDay * trongLuong : null,
    theTichThung: ctx.theTichThung,
    theTichLong: ctx.theTichLong,
    contDay: contInfo(moiCont, ctx),
    soCont,
    soContDay,
    contCuoi,
    // Chỉ cần một cont thì vẽ đúng số thùng thật, còn lại vẽ một cont đầy.
    soThungHinh: isFilled(soThung) && soThung < moiCont ? soThung : moiCont,
  };
  if (![result.contDay.phanTramTheTich, result.contDay.kg ?? 0, soCont ?? 0].every(Number.isFinite)) {
    return { loi: 'Số quá lớn hoặc quá nhỏ nên không tính được. Bạn xem lại các ô đã nhập.' };
  }
  return result;
}

// "40 × 30 × 50 cm"
export function huongText({ a, b, c }) {
  return `${[a, b, c].map((value) => formatNumber(value)).join(' × ')} cm`;
}

export function luoiText({ nx, ny, nz }) {
  return `${formatNumber(nx)} × ${formatNumber(ny)} × ${formatNumber(nz)}`;
}

export function soContText(result) {
  if (!isFilled(result.soCont)) return '';
  const cuoi = result.contCuoi && result.soCont > 1 ? ` (cont cuối ${formatNumber(result.contCuoi.soThung)} thùng)` : '';
  return `${formatNumber(result.soCont)} cont${cuoi}`;
}

export function vuotTaiText(result) {
  const dau = result.soNeuXepDay === result.luoi
    ? `Xếp đầy theo kích thước được ${formatNumber(result.luoi)} thùng`
    : `Xếp cả ${formatNumber(result.soNeuXepDay)} thùng vào một cont`;
  return `${dau}, nặng ${kg(result.kgNeuXepDay)}, vượt tải trọng hàng tối đa ${kg(result.loai.tai_trong_hang_kg)} của cont ${result.loai.ten}. Mỗi cont chỉ nên xếp ${formatNumber(result.moiCont)} thùng.`;
}

export function owsText(result) {
  const cont = [];
  if (result.contDay.ows && result.soContDay !== 0) cont.push(result.soCont === 1 ? 'cont này' : 'mỗi cont đầy');
  if (result.contCuoi?.ows) cont.push(result.soCont === 1 ? 'cont này' : 'cont cuối');
  if (cont.length === 0) return '';
  return `Hàng trong ${[...new Set(cont)].join(' và ')} từ ${formatNumber(result.nguongOws)} tấn trở lên (không tính vỏ): có thể bị phụ phí quá tải (OWS). Ngưỡng và mức phí tùy hãng, hỏi lại hãng tàu.`;
}

function huongStep(item, loai) {
  const ten = `Đặt ${huongText(item)}`;
  if (item.loai === 'long') return `${ten}: lớn hơn lòng cont, không xếp được.`;
  if (item.loai === 'cua') {
    const ly = item.b > loai.cua.rong ? `rộng ${cm(item.b)}, hơn cửa rộng ${cm(loai.cua.rong)}` : `cao ${cm(item.c)}, hơn cửa cao ${cm(loai.cua.cao)}`;
    return `${ten}: không lọt cửa cont (${ly}).`;
  }
  const { long } = loai;
  const tang = item.nz < item.nzMax ? `min(⌊${formatNumber(long.cao)} ÷ ${formatNumber(item.c)}⌋, ${formatNumber(item.nz)} tầng)` : `⌊${formatNumber(long.cao)} ÷ ${formatNumber(item.c)}⌋`;
  return `${ten}: ⌊${formatNumber(long.dai)} ÷ ${formatNumber(item.a)}⌋ × ⌊${formatNumber(long.rong)} ÷ ${formatNumber(item.b)}⌋ × ${tang} = ${luoiText(item)} = ${formatNumber(item.soLuong)} thùng.`;
}

export function xepSteps(result) {
  const { loai, long, huong } = result;
  const steps = [
    `Lòng cont ${loai.ten}: dài ${cm(long.dai)}, rộng ${cm(long.rong)}, cao ${cm(long.cao)}; cửa rộng ${cm(loai.cua.rong)}, cao ${cm(loai.cua.cao)}. Mỗi hướng đặt thùng ghi theo dài × rộng × cao của cont; ⌊ ⌋ là lấy phần nguyên.`,
    ...result.cacHuong.map((item) => huongStep(item, loai)),
  ];
  const chon = `Chọn đặt ${huongText(huong)} vì xếp được nhiều thùng nhất (${formatNumber(huong.soLuong)} thùng)`;
  steps.push(result.hoaSoThung ? `${chon}; có hướng khác cũng bằng số thùng này nên chọn hướng ít tầng hơn (${formatNumber(huong.nz)} tầng).` : `${chon}.`);
  if (isFilled(result.theoTai)) {
    steps.push(`Theo tải trọng: ⌊${formatNumber(loai.tai_trong_hang_kg)} ÷ ${formatNumber(result.trongLuong)}⌋ = ${formatNumber(result.theoTai)} thùng. Mỗi cont = min(${formatNumber(result.luoi)}, ${formatNumber(result.theoTai)}) = ${formatNumber(result.moiCont)} thùng.`);
  }
  if (isFilled(result.soCont)) {
    const cuoi = result.contCuoi && result.soCont > 1 ? `; cont cuối ${formatNumber(result.soThung)} − ${formatNumber(result.soContDay)} × ${formatNumber(result.moiCont)} = ${formatNumber(result.contCuoi.soThung)} thùng` : '';
    steps.push(`Số cont = ⌈${formatNumber(result.soThung)} ÷ ${formatNumber(result.moiCont)}⌉ = ${formatNumber(result.soCont)}${cuoi}.`);
  }
  const hinh = result.soCont === 1 && result.contCuoi ? result.contCuoi : result.contDay;
  steps.push(`Thể tích lòng = ${formatNumber(long.dai / 100)} × ${formatNumber(long.rong / 100)} × ${formatNumber(long.cao / 100)} = ${formatNumber(result.theTichLong, M3_DECIMALS)} m³ (tính từ kích thước lòng nên lệch nhẹ so với ${formatNumber(loai.the_tich_cbm)} CBM trong bảng thông số).`);
  steps.push(`% thể tích = ${formatNumber(hinh.soThung)} × ${formatNumber(result.theTichThung, M3_DECIMALS)} m³ ÷ ${formatNumber(result.theTichLong, M3_DECIMALS)} m³ = ${formatPercent(hinh.phanTramTheTich)}.`);
  if (isFilled(hinh.kg)) {
    steps.push(`% tải trọng = ${formatNumber(hinh.soThung)} × ${kg(result.trongLuong)} ÷ ${kg(loai.tai_trong_hang_kg)} = ${formatPercent(hinh.phanTramTai)}.`);
  }
  return steps;
}

export function xepCopyText(result) {
  const { loai, long, huong } = result;
  const lines = [
    `Xếp container ${loai.ten} (lòng ${formatNumber(long.dai)} × ${formatNumber(long.rong)} × ${formatNumber(long.cao)} cm)`,
    `Thùng: ${formatNumber(result.dai)} × ${formatNumber(result.rong)} × ${formatNumber(result.cao)} cm${isFilled(result.trongLuong) ? `, ${kg(result.trongLuong)}/thùng` : ''}; ${XOAY_TEXT[result.xoay].toLowerCase()}${isFilled(result.soTangToiDa) ? `, tối đa ${formatNumber(result.soTangToiDa)} tầng` : ''}`,
    `Mỗi cont: ${formatNumber(result.moiCont)} thùng, đặt ${huongText(huong)}, lưới ${luoiText(huong)}`,
    `Bị giới hạn bởi: ${GIOI_HAN_TEXT[result.gioiHan].toLowerCase()}`,
  ];
  if (isFilled(result.soCont)) lines.push(`Số thùng ${formatNumber(result.soThung)}: cần ${soContText(result)}`);
  const hinh = result.soCont === 1 && result.contCuoi ? result.contCuoi : result.contDay;
  lines.push(`Thể tích đã dùng: ${formatPercent(hinh.phanTramTheTich)}`);
  if (isFilled(hinh.kg)) lines.push(`Tải trọng đã dùng: ${formatPercent(hinh.phanTramTai)} (${kg(hinh.kg)})`);
  if (result.vuotTai) lines.push(vuotTaiText(result));
  const ows = owsText(result);
  if (ows) lines.push(ows);
  lines.push('Số liệu cont chỉ để tham khảo, đối chiếu với hãng tàu.');
  return lines.join('\n');
}

// Vị trí từng thùng trong một cont, tính bằng cm từ góc vách đầu cont, sàn, vách trái.
// Xếp từ vách đầu ra cửa: mỗi hàng ngang lấp hết chiều rộng, từ tầng dưới lên, rồi sang hàng kế.
// Quá toiDa thùng thì trả về khối gộp theo tầng thay cho từng thùng.
export function viTriThung(result, toiDa = SO_THUNG_VE_TOI_DA) {
  const { a, b, c, ny, nz } = result.huong;
  const n = result.soThungHinh;
  const moiHang = ny * nz;
  if (n <= toiDa) {
    const thung = [];
    for (let i = 0; i < n; i += 1) {
      const hang = Math.floor(i / moiHang);
      const trong = i % moiHang;
      const tang = Math.floor(trong / ny);
      thung.push({ x: hang * a, y: (trong % ny) * b, z: tang * c, tang });
    }
    return { thung, khoi: null };
  }

  const hangDay = Math.floor(n / moiHang);
  const du = n - hangDay * moiHang;
  const khoi = [];
  for (let tang = 0; tang < nz; tang += 1) {
    if (hangDay > 0) khoi.push({ x: 0, y: 0, z: tang * c, dx: hangDay * a, dy: ny * b, dz: c, tang });
  }
  // Hàng cuối chưa đầy: các tầng đủ chiều rộng, rồi phần lẻ ở tầng trên cùng.
  const tangDu = Math.floor(du / ny);
  const le = du % ny;
  const x = hangDay * a;
  for (let tang = 0; tang < tangDu; tang += 1) khoi.push({ x, y: 0, z: tang * c, dx: a, dy: ny * b, dz: c, tang });
  if (le > 0) khoi.push({ x, y: 0, z: tangDu * c, dx: a, dy: le * b, dz: c, tang: tangDu });
  return { thung: null, khoi };
}
