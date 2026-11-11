// Xuất khối kết quả thành ảnh PNG hoặc PDF. Hai thư viện ngoài chỉ tải khi người dùng bấm.
// Các hàm đầu file là hàm thuần, chạy được cả trong test.
import { nhanThoiGian } from './lich-su.js';

const VENDOR = '/assets/js/vendor';
const WEB = 'logneko.netlify.app';
const SHEET_WIDTH = 720;
const SCALE = 2;
// Khổ A4 dọc tính bằng mm, chừa lề mỗi bên.
const A4 = { rong: 210, cao: 297, le: 12 };

const hai = (so) => String(so).padStart(2, '0');

// logneko-cbm-20261111-1430.png
export function tenFile(id, date, duoi) {
  const ngay = `${date.getFullYear()}${hai(date.getMonth() + 1)}${hai(date.getDate())}`;
  return `logneko-${id}-${ngay}-${hai(date.getHours())}${hai(date.getMinutes())}.${duoi}`;
}

export function dongThoiGian(date) {
  return `Xuất lúc ${nhanThoiGian(date)}`;
}

// Ảnh cao hơn một trang thì cắt thành nhiều trang; trả về vị trí bắt đầu của từng trang.
// diemCat là các chỗ cắt an toàn (giữa hai dòng, giữa hai thẻ): chọn chỗ thấp nhất còn vừa trang,
// để không chia đôi một dòng chữ. Không có chỗ nào vừa thì cắt đúng mép trang.
export function chiaTrang(caoAnh, caoTrang, diemCat = []) {
  const viTri = [0];
  let y = 0;
  while (y + caoTrang < caoAnh) {
    const vua = diemCat.filter((diem) => diem > y && diem <= y + caoTrang);
    y = vua.length ? Math.max(...vua) : y + caoTrang;
    viTri.push(y);
  }
  return viTri;
}

// Mép trên và mép dưới của từng dòng, từng thẻ trong tờ xuất, tính bằng pixel của ảnh.
const KHOI_CAT = 'li, dl > div, p, h1, .tool-total, .export-head';
function diemCatAnToan(sheet) {
  const goc = sheet.getBoundingClientRect().top;
  const diem = new Set();
  for (const node of sheet.querySelectorAll(KHOI_CAT)) {
    const rect = node.getBoundingClientRect();
    if (!rect.height) continue;
    diem.add(Math.round((rect.top - goc) * SCALE));
    diem.add(Math.round((rect.bottom - goc) * SCALE));
  }
  return [...diem];
}

// Phần dưới chỉ chạy trong trình duyệt.

const daTai = new Map();

function taiScript(file) {
  if (!daTai.has(file)) {
    daTai.set(file, new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${VENDOR}/${file}`;
      script.onload = resolve;
      script.onerror = () => {
        daTai.delete(file);
        reject(new Error(`Không tải được ${file}`));
      };
      document.head.append(script);
    }));
  }
  return daTai.get(file);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Tờ xuất nằm ngoài màn hình: tên web, tên công cụ, giờ xuất, bản sao khối kết quả, chân tờ.
function dungTo(tenCongCu, body, date) {
  const sheet = el('div', 'export-sheet');
  sheet.style.width = `${SHEET_WIDTH}px`;
  const head = el('div', 'export-head');
  head.append(el('span', 'export-logo', 'LOGNEKO'), el('span', 'export-time', dongThoiGian(date)));
  const content = body.cloneNode(true);
  content.classList.add('export-body');
  // html2canvas vẽ cả phần đang gập, chồng lên dòng khác. Bản xuất giữ đúng cái đang thấy:
  // phần gập thì bỏ, phần mở thì giữ nội dung và bỏ dòng bấm "Chi tiết" vì trên giấy không bấm được.
  for (const details of content.querySelectorAll('details')) {
    if (details.open) details.querySelector(':scope > summary')?.remove();
    else details.remove();
  }
  sheet.append(head, el('h1', 'export-title', tenCongCu), content, el('p', 'export-foot', `${WEB} · Kết quả chỉ để tham khảo.`));
  return sheet;
}

function taiVe(href, ten) {
  const link = document.createElement('a');
  link.href = href;
  link.download = ten;
  document.body.append(link);
  link.click();
  link.remove();
}

async function luuPdf(canvas, ten, diemCat) {
  await taiScript('jspdf.umd.min.js');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const rong = A4.rong - A4.le * 2;
  const caoTrang = A4.cao - A4.le * 2;
  // Đổi chiều cao trang từ mm sang pixel của ảnh để cắt đúng chỗ.
  const pxMoiMm = canvas.width / rong;
  const caoTrangPx = Math.floor(caoTrang * pxMoiMm);
  const trang = document.createElement('canvas');
  trang.width = canvas.width;
  const batDau = chiaTrang(canvas.height, caoTrangPx, diemCat);
  batDau.forEach((y, index) => {
    const cao = (batDau[index + 1] ?? canvas.height) - y;
    trang.height = cao;
    const ctx = trang.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, trang.width, cao);
    ctx.drawImage(canvas, 0, y, canvas.width, cao, 0, 0, canvas.width, cao);
    if (index > 0) pdf.addPage();
    pdf.addImage(trang.toDataURL('image/png'), 'PNG', A4.le, A4.le, rong, cao / pxMoiMm);
  });
  pdf.save(ten);
  return pdf.getNumberOfPages();
}

// dang: 'png' hoặc 'pdf'. Trả về { ten, soTrang } để báo cho người dùng.
export async function xuatKetQua({ id, tenCongCu, body, dang, date = new Date() }) {
  await taiScript('html2canvas.min.js');
  await document.fonts?.ready;
  const sheet = dungTo(tenCongCu, body, date);
  document.body.append(sheet);
  try {
    const canvas = await window.html2canvas(sheet, {
      scale: SCALE,
      backgroundColor: '#FFFFFF',
      logging: false,
      // Bản xuất luôn dùng giao diện sáng để in và gửi; đổi trong bản sao nên màn hình không nháy.
      onclone: (doc) => { doc.documentElement.dataset.theme = 'light'; },
    });
    const ten = tenFile(id, date, dang);
    if (dang === 'pdf') return { ten, soTrang: await luuPdf(canvas, ten, diemCatAnToan(sheet)) };
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const url = URL.createObjectURL(blob);
    taiVe(url, ten);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return { ten, soTrang: 1 };
  } finally {
    sheet.remove();
  }
}
