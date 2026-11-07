// Tìm gợi ý theo chữ đang gõ. Hàm thuần, chạy được cả trong test.

// Bỏ dấu tiếng Việt và chuyển chữ thường, để gõ "phi ha" vẫn ra "Phí hạ tầng".
export function boDau(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

// Dấu câu như "/" và "()" coi như khoảng trắng: "d/o" và "d o" như nhau.
function chuanHoa(text) {
  return boDau(text).replace(/[^a-z0-9]+/g, ' ').trim();
}

function khopDauChu(text, query) {
  return ` ${chuanHoa(text)}`.includes(` ${query}`);
}

// Khớp đầu tên xếp trước, rồi đầu một chữ trong tên, rồi tên khác. Ô trống thì trả cả danh sách.
export function timGoiY(chu, ds) {
  const query = chuanHoa(chu);
  if (!query) return [...ds];

  const hang = (muc) => {
    if (chuanHoa(muc.ten).startsWith(query)) return 0;
    if (khopDauChu(muc.ten, query)) return 1;
    if ((muc.goi_y ?? []).some((ten) => khopDauChu(ten, query))) return 2;
    return null;
  };

  return ds
    .map((muc, viTri) => ({ muc, viTri, hang: hang(muc) }))
    .filter((item) => item.hang !== null)
    .sort((a, b) => a.hang - b.hang || a.viTri - b.viTri)
    .map((item) => item.muc);
}

// Phần chữ còn thiếu để điền tiếp. Chỉ điền khi tên bắt đầu đúng y chữ đã gõ, để không thay chữ người dùng.
export function phanHoanThanh(chu, ten) {
  if (!chu || !ten.toLowerCase().startsWith(chu.toLowerCase())) return '';
  return ten.slice(chu.length);
}
