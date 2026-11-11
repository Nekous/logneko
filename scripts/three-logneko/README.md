# Bản Three.js rút gọn cho LOGNEKO

`site/assets/js/vendor/three/three-logneko.min.js` là Three.js 0.187.0 chỉ gồm các phần ghi trong `entry.js`, gộp một file và nén bằng esbuild. Giấy phép MIT nằm cạnh file đó (`LICENSE.txt`).

Dựng lại (cần Node, có mạng): chép `entry.js` vào một thư mục tạm ngoài dự án, rồi chạy trong thư mục đó:

```
npm init -y
npm install three@0.187.0 esbuild@0.25
npx esbuild entry.js --bundle --minify --format=esm --legal-comments=none --outfile=<thư mục dự án>/site/assets/js/vendor/three/three-logneko.min.js
cp node_modules/three/LICENSE <thư mục dự án>/site/assets/js/vendor/three/LICENSE.txt
```

Bản hiện tại: 555 KB, nén gzip còn khoảng 138 KB.

Khung 3D cần thêm phần nào của Three.js thì thêm vào `entry.js` rồi dựng lại.
