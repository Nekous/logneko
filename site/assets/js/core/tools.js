// Đọc danh sách công cụ. Các hàm thuần ở đây chạy được cả trong test.

let cached;

export function loadTools() {
  cached ??= fetch('/data/tools.json').then((response) => {
    if (!response.ok) throw new Error(`Không tải được tools.json (${response.status})`);
    return response.json();
  });
  return cached;
}

export function isLive(tool) {
  return tool.trang_thai === 'hoat-dong';
}

export function toolHref(tool) {
  return `/tools/${tool.id}.html`;
}

// Chỉ trả về con số đúng với công cụ đã có; số phụ thuộc công cụ chưa xong thì ẩn.
export function statsFor(data) {
  const live = new Set(data.cong_cu.filter(isLive).map((tool) => tool.id));
  const total = data.cong_cu.length;

  let label = `công cụ trong lộ trình, ${live.size} đã dùng được`;
  if (live.size === 0) label = 'công cụ đang xây dựng';
  if (live.size === total) label = 'công cụ miễn phí';

  return [
    { so: String(total), nhan: label },
    ...data.so_lieu.filter((stat) => !stat.can || live.has(stat.can)),
  ];
}
