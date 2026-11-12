"""Chuyển logo và hai ảnh nền cảng của Khải thành các file nhẹ cho web.

Cách chạy, từ thư mục gốc dự án:
    python scripts/toi-uu-anh.py

Chỉ đọc ba ảnh gốc ở thư mục gốc (không sửa, không xóa). Ghi ra site/assets/img/:
- cang-sang-960/1600/2400.webp, cang-toi-...: ảnh nền đã cắt mép phải để bỏ dấu sao Gemini.
- logo-96.png (thanh trên), logo-192.png (chân trang, ảnh chia sẻ): nền trong suốt, số là chiều cao.
- favicon-32.png, favicon-48.png (vuông, nền trong suốt), apple-touch-icon.png (180 px, nền kem).
Đổi ảnh gốc thì chạy lại là đủ.
"""

import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

GOC = Path(__file__).resolve().parent.parent
OUT = GOC / 'site' / 'assets' / 'img'

LOGO = GOC / 'Ảnh Logo LOGNEKO.png'
NEN = {'sang': GOC / 'Ảnh nền sáng.png', 'toi': GOC / 'Ảnh nền tối.png'}

# Dấu sao Gemini nằm ở x 2592–2685 trên ảnh rộng 2752; cắt mép phải tới 2570 là mất hẳn.
NEN_RONG_GIU = 2570
NEN_CO = (960, 1600, 2400)
WEBP_CHAT_LUONG = 80

NEN_KEM = (250, 247, 238)  # #FAF7EE, nền trang chế độ sáng
GAN_TRANG = 235            # điểm ảnh có mọi kênh trên mức này coi là nền trắng
VIEN_LOANG = 2             # số điểm ảnh làm mềm quanh hình để không còn viền trắng


def ghi(anh, ten, **tuy_chon):
    duong_dan = OUT / ten
    anh.save(duong_dan, **tuy_chon)
    print(f'  {ten:<24} {anh.width}×{anh.height}  {duong_dan.stat().st_size / 1024:7.1f} KB')


def lam_nen():
    for ten, duong_dan in NEN.items():
        anh = Image.open(duong_dan).convert('RGB')
        anh = anh.crop((0, 0, NEN_RONG_GIU, anh.height))
        for rong in NEN_CO:
            cao = round(anh.height * rong / anh.width)
            nho = anh.resize((rong, cao), Image.LANCZOS)
            ghi(nho, f'cang-{ten}-{rong}.webp', quality=WEBP_CHAT_LUONG, method=6)


def tach_nen_logo(anh):
    """Xóa phần nền trắng nối liền với 4 góc; mắt, mũi, mũi tên nằm trong hình nên vẫn trắng."""
    rgb = anh.convert('RGB')
    r, g, b = rgb.split()
    min_kenh = ImageChops.darker(ImageChops.darker(r, g), b)

    # Vùng gần trắng = 255, còn lại = 0; loang từ 4 góc thành 128 để biết đâu là nền ngoài.
    mat_na = min_kenh.point(lambda v: 255 if v > GAN_TRANG else 0)
    for goc in ((0, 0), (mat_na.width - 1, 0), (0, mat_na.height - 1), (mat_na.width - 1, mat_na.height - 1)):
        if mat_na.getpixel(goc) == 255:
            ImageDraw.floodfill(mat_na, goc, 128, thresh=0)
    nen = mat_na.point(lambda v: 255 if v == 128 else 0)
    vien = nen.filter(ImageFilter.MaxFilter(VIEN_LOANG * 2 + 1))

    ra = Image.new('RGBA', rgb.size)
    px_rgb, px_nen, px_vien, px_ra = rgb.load(), nen.load(), vien.load(), ra.load()
    for y in range(rgb.height):
        for x in range(rgb.width):
            r, g, b = px_rgb[x, y]
            if px_nen[x, y]:
                px_ra[x, y] = (0, 0, 0, 0)
            elif px_vien[x, y]:
                # Điểm ở rìa hình là màu hình trộn với trắng: ước độ đục từ kênh tối nhất
                # (navy và cam của logo đều có kênh tối nhất khoảng 32), rồi bỏ phần trắng.
                a = max(0.0, min(1.0, (255 - min(r, g, b)) / 222))
                if a == 0:
                    px_ra[x, y] = (0, 0, 0, 0)
                else:
                    tach = [max(0, min(255, round((c - (1 - a) * 255) / a))) for c in (r, g, b)]
                    px_ra[x, y] = (*tach, round(a * 255))
            else:
                px_ra[x, y] = (r, g, b, 255)
    return ra.crop(ra.getchannel('A').getbbox())


def vuong(anh, canh, le=0.06, nen=(0, 0, 0, 0)):
    o = Image.new('RGBA', (canh, canh), nen)
    trong = round(canh * (1 - 2 * le))
    ti_le = trong / max(anh.size)
    nho = anh.resize((round(anh.width * ti_le), round(anh.height * ti_le)), Image.LANCZOS)
    o.alpha_composite(nho, ((canh - nho.width) // 2, (canh - nho.height) // 2))
    return o


def lam_logo():
    hinh = tach_nen_logo(Image.open(LOGO))
    for cao in (96, 192):
        ghi(hinh.resize((round(hinh.width * cao / hinh.height), cao), Image.LANCZOS), f'logo-{cao}.png', optimize=True)
    for canh in (32, 48):
        ghi(vuong(hinh, canh, le=0.02), f'favicon-{canh}.png', optimize=True)
    ghi(vuong(hinh, 180, le=0.12, nen=(*NEN_KEM, 255)).convert('RGB'), 'apple-touch-icon.png', optimize=True)


def main():
    thieu = [p.name for p in (LOGO, *NEN.values()) if not p.exists()]
    if thieu:
        sys.exit(f'Không thấy ảnh gốc: {", ".join(thieu)}')
    OUT.mkdir(parents=True, exist_ok=True)
    print('Ảnh nền:')
    lam_nen()
    print('Logo:')
    lam_logo()


if __name__ == '__main__':
    main()
