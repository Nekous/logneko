// Tìm kiếm chung trên trang chủ: số container, mã HS, Incoterms, công cụ, từ điển.
// Hàm thuần, chạy được cả trong test.
import { idCongCu, taoDiaChi, timMucCoHang } from './tu-dien.js';
import { splitContainerList } from './so-container.js';
import { isLive, toolHref } from '../core/tools.js';

// Từ điển có hơn 200 mục, nên chỉ hiện vài dòng đầu, còn lại mở trang từ điển.
export const SO_DONG_TU_DIEN = 5;

// 4 chữ cái + 6 số (chưa có chữ số kiểm tra) hoặc 7 số.
const MAU_SO_CONT = /^[A-Z]{4}\d{6,7}$/;
// Mã HS gõ kiểu "8471", "8471.30" hay "8471 30".
const MAU_HS = /^\d[\d.\s]*$/;
const HS_NGAN_NHAT = 2;
const HS_DAI_NHAT = 8;
const LINK_INCOTERMS = /^incoterms\.html\?dk=([A-Z]+)$/;

function timCongCu(congCu, id) {
  return congCu.find((tool) => tool.id === id) ?? null;
}

// Công cụ chưa hoạt động thì không có link, chỉ có nhãn Sắp có.
function denCongCu(tool, href = tool && toolHref(tool)) {
  return tool && isLive(tool) ? { href, nhan: null } : { href: null, nhan: 'Sắp có' };
}

function nhomSoCont(congCu, chu) {
  const items = splitContainerList(chu);
  if (!items.length || !items.every((item) => MAU_SO_CONT.test(item.so))) return null;
  const tool = timCongCu(congCu, 'so-container');
  if (!tool) return null;
  const so = items.map((item) => item.so);
  return {
    id: 'so-container',
    ten: 'Số container',
    dong: [{
      tieuDe: so.length === 1 ? `Kiểm tra số container ${so[0]}` : `Kiểm tra ${so.length} số container`,
      phu: '',
      moTa: 'Xem số có đúng chuẩn ISO 6346 không, kèm mã chủ sở hữu và loại thiết bị.',
      ...denCongCu(tool),
      chuyen: { den: tool.id, data: { danhSach: so.join('\n') } },
      linkPhu: [],
    }],
  };
}

function nhomHs(congCu, chu) {
  if (!MAU_HS.test(chu)) return null;
  const ma = chu.replace(/[.\s]/g, '');
  if (ma.length < HS_NGAN_NHAT || ma.length > HS_DAI_NHAT) return null;
  const tool = timCongCu(congCu, 'hs-code');
  if (!tool) return null;
  return {
    id: 'hs',
    ten: 'Mã HS',
    dong: [{ tieuDe: `Mã HS ${ma}`, phu: tool.ten, moTa: tool.mo_ta, ...denCongCu(tool), linkPhu: [] }],
  };
}

// Đổi điều kiện Incoterms và công cụ thành "mục" tạm, để tìm cùng một luật với từ điển.
function mucIncoterms(term) {
  return { id: term.ma.toLowerCase(), thuat_ngu: term.ma, ten_day_du: term.ten_en, nghia: term.ten_vi, term };
}

// Chỉ khớp tên công cụ; khớp cả câu mô tả thì gõ "c" hay "phi" ra gần đủ 8 công cụ.
function mucCongCu(tool) {
  return { id: tool.id, thuat_ngu: tool.ten, ten_day_du: tool.ten, nghia: '', tool };
}

// Mục từ điển của chính điều kiện đó (id fob cho FOB), không có thì lấy mục khác trỏ vào nó.
function mucTuDienCua(tuDien, ma) {
  const tro = (tuDien?.muc ?? []).filter((muc) => LINK_INCOTERMS.exec(muc.cong_cu ?? '')?.[1] === ma);
  return tro.find((muc) => muc.id === ma.toLowerCase()) ?? tro[0] ?? null;
}

function linkTuDien(muc, q) {
  return `/tools/tu-dien.html${taoDiaChi({ q, muc: muc.id })}`;
}

function nhomIncoterms(incoterms, tuDien, congCu, chu, daGop) {
  const tool = timCongCu(congCu, 'incoterms');
  const found = timMucCoHang({ muc: incoterms.dieu_kien.map(mucIncoterms) }, chu);
  if (!found.length) return null;
  return {
    id: 'incoterms',
    ten: 'Incoterms 2020',
    hang: found[0].hang,
    dong: found.map(({ muc: { term } }) => {
      const muc = mucTuDienCua(tuDien, term.ma);
      if (muc) daGop.add(muc.id);
      return {
        tieuDe: term.ma,
        phu: term.ten_en,
        moTa: term.ten_vi,
        ...denCongCu(tool, `/tools/incoterms.html?dk=${term.ma}`),
        linkPhu: muc ? [{ ten: 'Đọc trong từ điển', href: linkTuDien(muc) }] : [],
      };
    }),
  };
}

function nhomCongCu(congCu, chu) {
  const found = timMucCoHang({ muc: congCu.map(mucCongCu) }, chu);
  if (!found.length) return null;
  return {
    id: 'cong-cu',
    ten: 'Công cụ',
    hang: found[0].hang,
    dong: found.map(({ muc: { tool } }) => ({ tieuDe: tool.ten, phu: '', moTa: tool.mo_ta, ...denCongCu(tool), linkPhu: [] })),
  };
}

function nhomTuDien(tuDien, congCu, chu, daGop) {
  const tatCa = timMucCoHang(tuDien, chu);
  const found = tatCa.filter(({ muc }) => !daGop.has(muc.id));
  if (!found.length) return null;
  const dong = found.slice(0, SO_DONG_TU_DIEN).map(({ muc }) => {
    const tool = muc.cong_cu ? timCongCu(congCu, idCongCu(muc.cong_cu)) : null;
    return {
      tieuDe: muc.thuat_ngu,
      phu: muc.ten_day_du === muc.thuat_ngu ? '' : muc.ten_day_du,
      moTa: muc.nghia,
      href: linkTuDien(muc, chu),
      nhan: null,
      linkPhu: tool && isLive(tool) ? [{ ten: `Mở công cụ: ${tool.ten}`, href: `/tools/${muc.cong_cu}` }] : [],
    };
  });
  return {
    id: 'tu-dien',
    ten: 'Từ điển',
    hang: found[0].hang,
    dong,
    // Đếm cả mục đã gộp vào Incoterms, vì trang từ điển với cùng chữ gõ sẽ hiện đủ.
    xemTatCa: found.length > dong.length
      ? { ten: `Xem tất cả ${tatCa.length} mục trong từ điển`, href: `/tools/tu-dien.html${taoDiaChi({ q: chu })}` }
      : null,
  };
}

// nguon: { congCu, incoterms, tuDien }; nguồn nào chưa tải được thì để null, các nhóm khác vẫn tìm.
// Số container và mã HS luôn đứng đầu vì nhận theo mẫu; ba nhóm còn lại xếp theo độ khớp
// của dòng đầu (gõ "phi" thì từ điển có "Phí..." lên trước), bằng nhau thì giữ thứ tự
// Incoterms, Công cụ, Từ điển. Ô trống thì trả danh sách rỗng.
export function timChung({ congCu, incoterms = null, tuDien = null }, chuGo) {
  const chu = String(chuGo ?? '').trim();
  if (!chu) return [];
  const tools = congCu ?? [];
  // Incoterms tìm trước, để mục từ điển đã gộp vào dòng Incoterms không hiện lại ở nhóm Từ điển.
  const daGop = new Set();
  const theoMau = [nhomSoCont(tools, chu), nhomHs(tools, chu)];
  const theoChu = [
    incoterms ? nhomIncoterms(incoterms, tuDien, tools, chu, daGop) : null,
    nhomCongCu(tools, chu),
    tuDien ? nhomTuDien(tuDien, tools, chu, daGop) : null,
  ].filter(Boolean).sort((a, b) => a.hang - b.hang);
  return [...theoMau.filter(Boolean), ...theoChu];
}

// Tổng số dòng đang hiện, để báo cho trình đọc màn hình.
export function demDong(nhom) {
  return nhom.reduce((tong, item) => tong + item.dong.length, 0);
}
