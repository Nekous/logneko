"""Chuyển biểu thuế xuất nhập khẩu (sheet BT2026) sang JSON cho công cụ tra mã HS.

Cách chạy, từ thư mục gốc dự án:
    python scripts/excel_to_json.py "nguon/BIEU THUE XNK 2026.04.05.xlsx"
    python scripts/excel_to_json.py <file> --so-dong 12050   # file mới có số dòng mã 8 số khác

Chỉ đọc file nguồn. Ghi ra site/data/hs/: meta.json, chi-muc.json, chuong-01.json ... chuong-98.json.
Mọi ô thuế, văn bản, ngày được giữ nguyên văn như trong file, không đổi chữ thành số.
Kiểm tra trước, ghi sau: số dòng khác kỳ vọng, thiếu chương hay mã 98 trỏ sai thì dừng, không ghi gì.
"""

import argparse
import json
import re
import sys
from pathlib import Path

import openpyxl

SHEET = 'BT2026'
DONG_DAU = 8  # dữ liệu bắt đầu từ dòng 8, dòng 3 là tiêu đề
SO_DONG_KY_VONG = 12000
SO_CHUONG_KY_VONG = 97

# Cột tính từ 0 (A = 0).
C_DAU = 1      # B: loại dòng (Phần, Chương, Chú giải, ...)
C_CAP = 4      # E: cấp 0-6
C_MA = 5       # F: mã hàng
C_VI = 6       # G: mô tả tiếng Việt
C_EN = 7       # H: mô tả tiếng Anh
C_DVT = 8      # I: đơn vị tính; riêng Chương 98 là mã hàng tương ứng ở chương gốc
C_THUE = {'tt': 10, 'ud': 13, 'vat': 16}  # K, N, Q; mỗi cột kèm văn bản và ngày hiệu lực ngay sau
MAX_COL = 19

OUT = Path(__file__).resolve().parent.parent / 'site' / 'data' / 'hs'

# Lỗi gõ trong file gốc mà Khải đã duyệt sửa. Chỉ sửa đúng các chuỗi liệt kê ở đây, ghi lại vào meta.json
# để trang tra cứu báo cho người dùng; mọi ô khác giữ nguyên văn.
SUA_LOI_GO = {'30/06/20025': '30/06/2025'}
NGAY_HOP_LE = re.compile(r'\d{2}/\d{2}/\d{4}')


def chu(value):
    """Ô trống thành chuỗi rỗng; còn lại giữ nguyên văn, chỉ bỏ khoảng trắng hai đầu."""
    if value is None:
        return ''
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).strip()


def ngay_tu_ten_file(path):
    found = re.search(r'(\d{4})\.(\d{2})\.(\d{2})', path.name)
    if not found:
        sys.exit(f'Lỗi: không đọc được ngày cập nhật trong tên file "{path.name}" (cần dạng 2026.04.05).')
    return f'{found[1]}-{found[2]}-{found[3]}'


def doc_dong(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    if SHEET not in wb.sheetnames:
        sys.exit(f'Lỗi: file không có sheet {SHEET}.')
    for so_dong, r in enumerate(wb[SHEET].iter_rows(min_row=DONG_DAU, max_col=MAX_COL, values_only=True), start=DONG_DAU):
        yield so_dong, [chu(c) for c in r] + [''] * (MAX_COL - len(r))


DA_SUA = {}  # chuỗi sai -> số ô đã sửa


def thue(r, key):
    col = C_THUE[key]
    bo = [r[col], r[col + 1], r[col + 2]]
    if bo[2] in SUA_LOI_GO:
        DA_SUA[bo[2]] = DA_SUA.get(bo[2], 0) + 1
        bo[2] = SUA_LOI_GO[bo[2]]
    return bo if any(bo) else None


def dung_du_lieu(path):
    phan = []        # [{so, vi, en, chu_giai, chuong: []}]
    chuong = {}      # so -> {so, vi, en, phan, chu_giai, dong: []}
    hien_tai = None  # chương đang đọc
    cho_ten = None   # 'phan' hoặc 'chuong': dòng kế tiếp là tên
    bat_thuong = []

    for so_dong, r in doc_dong(path):
        dau, cap, ma, vi, en = r[C_DAU], r[C_CAP], re.sub(r'\D', '', r[C_MA]), r[C_VI], r[C_EN]

        if dau == 'Phần':
            phan.append({'so': vi.replace('PHẦN', '').strip(), 'vi': '', 'en': '', 'chu_giai': [], 'chuong': []})
            cho_ten = 'phan'
            continue
        # Dòng "Chương" có cột B; riêng "Chương 98" không có, nhận theo chữ.
        so_chuong = re.fullmatch(r'Chương (\d+)', vi)
        if dau == 'Chương' or (not dau and not cap and not ma and so_chuong):
            so = int(so_chuong[1])
            # Chương 98 đứng sau Phần XXI nhưng không thuộc phần nào.
            thuoc_phan = len(phan) - 1 if dau == 'Chương' else None
            hien_tai = {'so': so, 'vi': '', 'en': '', 'phan': thuoc_phan, 'chu_giai': [], 'dong': []}
            chuong[so] = hien_tai
            if thuoc_phan is not None:
                phan[thuoc_phan]['chuong'].append(so)
            cho_ten = 'chuong'
            continue
        if cho_ten:
            muc = phan[-1] if cho_ten == 'phan' else hien_tai
            muc['vi'], muc['en'] = vi, en
            cho_ten = None
            continue
        if not vi and not ma:
            continue

        # Không có cấp, không có mã: chú giải, tên phân chương, bảng. Trước chương đầu của phần là chú giải phần.
        if not cap and not ma:
            dong_chu = {'vi': vi, 'en': en}
            if dau.startswith('Phân'):
                hien_tai['dong'].append({'loai': 'phan-chuong', **dong_chu})
            elif hien_tai is None or hien_tai['phan'] not in (None, len(phan) - 1):
                phan[-1]['chu_giai'].append(dong_chu)
            else:
                hien_tai['chu_giai'].append(dong_chu)
            continue

        dong = {'ma': ma, 'cap': int(cap) if cap.isdigit() else None, 'vi': vi, 'en': en}
        if hien_tai['so'] == 98:
            dong['goc'] = re.sub(r'\D', '', r[C_DVT])
        elif r[C_DVT]:
            dong['dvt'] = r[C_DVT]
        for key in C_THUE:
            bo = thue(r, key)
            if bo:
                dong[key] = bo
        if ma and len(ma) not in (4, 6, 8):
            bat_thuong.append({'dong_excel': so_dong, 'ma': ma, 'vi': vi, 'goc': dong.get('goc', '')})
        if ma and ma[:2] != f"{hien_tai['so']:02d}":
            sys.exit(f'Lỗi: dòng {so_dong} mã {ma} nằm trong Chương {hien_tai["so"]}.')
        hien_tai['dong'].append(dong)

    return phan, chuong, bat_thuong


def gan_cha(chuong):
    """Mỗi dòng trỏ tới dòng cha gần nhất có cấp nhỏ hơn, để dựng đường dẫn."""
    for ch in chuong.values():
        ngan_xep = []  # (cap, chỉ số)
        for i, dong in enumerate(ch['dong']):
            if dong.get('loai') == 'phan-chuong':
                ngan_xep = []
                continue
            cap = dong['cap'] if dong['cap'] is not None else 0
            while ngan_xep and ngan_xep[-1][0] >= cap:
                ngan_xep.pop()
            dong['cha'] = ngan_xep[-1][1] if ngan_xep else -1
            ngan_xep.append((cap, i))


def noi_chuong_98(chuong):
    """Gắn mã 98 vào dòng mã gốc. Dừng nếu mã gốc không có trong biểu."""
    theo_ma = {}
    for ch in chuong.values():
        if ch['so'] == 98:
            continue
        for dong in ch['dong']:
            if dong.get('ma'):
                theo_ma.setdefault(dong['ma'], dong)
    loi = []
    so_noi = 0
    for dong in chuong[98]['dong']:
        goc = dong.get('goc')
        if not goc:
            continue
        dich = theo_ma.get(goc)
        if not dich:
            loi.append(f"{dong['ma']} trỏ tới {goc}")
            continue
        dich.setdefault('ch98', []).append({k: dong[k] for k in ('ma', 'vi', 'tt', 'ud') if k in dong})
        so_noi += 1
    if loi:
        sys.exit('Lỗi: mã Chương 98 trỏ tới mã gốc không có trong biểu: ' + '; '.join(loi[:10]))
    return so_noi


def chi_muc(chuong):
    """Mỗi dòng có chữ: [mã, chương, mô tả Việt, mô tả Anh, chỉ số dòng cha trong chỉ mục]."""
    ds = []
    for so in sorted(chuong):
        goc = len(ds)
        vi_tri = {}
        for i, dong in enumerate(chuong[so]['dong']):
            if dong.get('loai') == 'phan-chuong':
                continue
            vi_tri[i] = len(ds)
            cha = vi_tri.get(dong['cha'], -1) if dong['cha'] >= 0 else -1
            ds.append([dong['ma'], so, dong['vi'], dong['en'], cha])
        assert all(c < len(ds) for *_, c in ds[goc:])
    return ds


def kiem_tra(chuong, so_dong_ky_vong):
    dong_8 = [d for ch in chuong.values() for d in ch['dong'] if len(d.get('ma', '')) == 8]
    if len(dong_8) != so_dong_ky_vong:
        sys.exit(f'Lỗi: có {len(dong_8)} dòng mã 8 số, kỳ vọng {so_dong_ky_vong}. '
                 'Nếu file mới thật sự đổi số dòng, chạy lại với --so-dong <số mới>.')
    # Chương không có mã nào (như Chương 77 để dành cho sau này) vẫn giữ, nhưng không tính vào 97.
    co_ma = [so for so, ch in chuong.items() if any(d.get('ma') for d in ch['dong'])]
    if len(co_ma) != SO_CHUONG_KY_VONG or 98 not in co_ma:
        sys.exit(f'Lỗi: có {len(co_ma)} chương có mã, kỳ vọng {SO_CHUONG_KY_VONG} (gồm Chương 98).')
    for so, ch in chuong.items():
        if not ch['vi']:
            sys.exit(f'Lỗi: Chương {so} thiếu tên.')
    return dong_8, sorted(set(chuong) - set(co_ma))


def ghi(path_file, data):
    text = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    path_file.write_text(text, encoding='utf-8')
    return len(text.encode('utf-8'))


def main():
    # Windows mặc định in bằng bảng mã cũ, chữ có dấu trong thông báo lỗi sẽ vỡ.
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description='Chuyển biểu thuế sang JSON cho LOGNEKO.')
    parser.add_argument('file', type=Path)
    parser.add_argument('--so-dong', type=int, default=SO_DONG_KY_VONG, help='số dòng mã 8 số kỳ vọng')
    args = parser.parse_args()
    if not args.file.exists():
        sys.exit(f'Lỗi: không thấy file {args.file}')
    print(f'Đọc {args.file.name} ...')
    phan, chuong, bat_thuong = dung_du_lieu(args.file)
    dong_8, chuong_trong = kiem_tra(chuong, args.so_dong)
    gan_cha(chuong)
    so_noi_98 = noi_chuong_98(chuong)
    index = chi_muc(chuong)

    dong_98 = [d for d in chuong[98]['dong'] if d.get('ma')]
    meta = {
        'nguon': args.file.name,
        'cap_nhat': ngay_tu_ten_file(args.file),
        'so_dong_ma_8_so': len(dong_8),
        'so_ma_8_so': len({d['ma'] for d in dong_8}),
        'so_dong_chuong_98': len([d for d in dong_98 if len(d['ma']) == 8]),
        'so_ma_chuong_98': len({d['ma'] for d in dong_98 if len(d['ma']) == 8}),
        'ma_bat_thuong': bat_thuong,
        'chuong_khong_co_ma': chuong_trong,
        'da_sua': [{'tu': tu, 'thanh': SUA_LOI_GO[tu], 'so_o': so} for tu, so in DA_SUA.items()],
        'phan': [{'so': p['so'], 'vi': p['vi'], 'en': p['en'], 'chuong': p['chuong']} for p in phan],
        'chuong': [{'so': so, 'vi': ch['vi'], 'en': ch['en'], 'phan': ch['phan'], 'file': f'chuong-{so:02d}.json'}
                   for so, ch in sorted(chuong.items())],
    }

    OUT.mkdir(parents=True, exist_ok=True)
    sizes = {'meta.json': ghi(OUT / 'meta.json', meta), 'chi-muc.json': ghi(OUT / 'chi-muc.json', index)}
    for so, ch in sorted(chuong.items()):
        p = phan[ch['phan']] if ch['phan'] is not None else None
        data = {'so': so, 'vi': ch['vi'], 'en': ch['en'],
                'phan': {'so': p['so'], 'vi': p['vi'], 'en': p['en'], 'chu_giai': p['chu_giai']} if p else None,
                'chu_giai': ch['chu_giai'], 'dong': ch['dong']}
        sizes[f'chuong-{so:02d}.json'] = ghi(OUT / f'chuong-{so:02d}.json', data)

    du_thua = sorted(f.name for f in OUT.glob('*.json') if f.name not in sizes)
    if du_thua:
        print('Cảnh báo: có file cũ không còn được tạo, chưa xóa:', ', '.join(du_thua))

    print(f"Dòng mã 8 số: {meta['so_dong_ma_8_so']}, mã khác nhau: {meta['so_ma_8_so']}")
    print(f"Chương 98: {meta['so_dong_chuong_98']} dòng mã 8 số, {meta['so_ma_chuong_98']} mã; "
          f"đã nối {so_noi_98} dòng với mã gốc")
    for item in meta['da_sua']:
        print(f"Đã sửa lỗi gõ ngày {item['tu']} thành {item['thanh']}: {item['so_o']} ô")
    ngay_la = sorted({bo[2] for ch in chuong.values() for d in ch['dong'] for k in C_THUE
                      if (bo := d.get(k)) and bo[2] and not NGAY_HOP_LE.fullmatch(bo[2])})
    if ngay_la:
        print('Cảnh báo: còn ô ngày không đúng dạng dd/mm/yyyy (giữ nguyên văn):', ', '.join(ngay_la[:10]))
    for so in chuong_trong:
        print(f"Chương {so} không có mã nào (giữ để hiện tên): {chuong[so]['vi']}")
    print(f'Mã không đủ 4/6/8 số (giữ nguyên văn): {len(bat_thuong)}')
    for item in bat_thuong:
        print(f"  dòng {item['dong_excel']}: {item['ma']} ({item['vi']}) -> gốc {item['goc']}")
    lon = sorted(((v, k) for k, v in sizes.items() if k.startswith('chuong')), reverse=True)[:3]
    print('Dung lượng (KB): meta', round(sizes['meta.json'] / 1024), '| chỉ mục', round(sizes['chi-muc.json'] / 1024),
          '| chương lớn nhất', ', '.join(f'{k} {round(v / 1024)}' for v, k in lon),
          '| tổng', round(sum(sizes.values()) / 1024))


if __name__ == '__main__':
    main()
