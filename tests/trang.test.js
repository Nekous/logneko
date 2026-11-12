import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const GOC = 'https://logneko.netlify.app';
const site = (path) => new URL(`../site${path}`, import.meta.url);
const doc = (path) => readFileSync(site(path), 'utf8');

const TRANG = ['/', ...readdirSync(site('/tools/')).filter((ten) => ten.endsWith('.html')).map((ten) => `/tools/${ten}`)];

const giaiMa = (chu) => chu.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const the = (html, mau) => {
  const khop = html.match(mau);
  return khop ? giaiMa(khop[1]) : undefined;
};
const meta = (html, ten) => the(html, new RegExp(`<meta (?:property|name)="${ten}" content="([^"]*)">`));

test('Đủ 9 trang: trang chủ và 8 công cụ', () => {
  assert.equal(TRANG.length, 9);
});

for (const path of TRANG) {
  const html = doc(path === '/' ? '/index.html' : path);

  test(`${path}: tiêu đề và mô tả khi chia sẻ trùng tiêu đề, mô tả của trang`, () => {
    const tieuDe = the(html, /<title>(.*?)<\/title>/);
    const moTa = meta(html, 'description');
    assert.ok(tieuDe && moTa, 'thiếu <title> hoặc description');
    assert.equal(meta(html, 'og:title'), tieuDe);
    assert.equal(meta(html, 'og:description'), moTa);
    assert.equal(meta(html, 'og:site_name'), 'LOGNEKO');
    assert.equal(meta(html, 'og:locale'), 'vi_VN');
    assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
  });

  test(`${path}: đường dẫn chuẩn trỏ đúng trang`, () => {
    assert.equal(meta(html, 'og:url'), `${GOC}${path}`);
    assert.equal(the(html, /<link rel="canonical" href="([^"]*)">/), `${GOC}${path}`);
  });

  test(`${path}: ảnh chia sẻ và biểu tượng tab trỏ tới file có thật`, () => {
    assert.equal(meta(html, 'og:image'), `${GOC}/assets/img/chia-se.jpg`);
    assert.equal(meta(html, 'og:image:width'), '1200');
    assert.equal(meta(html, 'og:image:height'), '630');
    const bieuTuong = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]* href="([^"]*)">/g)].map((khop) => khop[1]);
    assert.equal(bieuTuong.length, 3, 'cần favicon 32, 48 và apple-touch-icon');
    for (const href of bieuTuong) assert.ok(existsSync(site(href)), `thiếu ${href}`);
    assert.ok(!html.includes('href="data:,"'), 'còn biểu tượng trống cũ');
  });
}

test('Ảnh chia sẻ đúng cỡ 1200×630', () => {
  const anh = readFileSync(site('/assets/img/chia-se.jpg'));
  // Đọc cỡ ảnh JPEG ở khối SOF (FFC0 hoặc FFC2): cao 2 byte rồi rộng 2 byte.
  let i = 2;
  while (i < anh.length && !(anh[i] === 0xFF && (anh[i + 1] === 0xC0 || anh[i + 1] === 0xC2))) {
    i += 2 + anh.readUInt16BE(i + 2);
  }
  assert.ok(i < anh.length, 'không đọc được cỡ ảnh');
  assert.deepEqual([anh.readUInt16BE(i + 7), anh.readUInt16BE(i + 5)], [1200, 630]);
});

test('Ảnh nền và logo mà CSS, thanh trên nhắc tới đều có file', () => {
  const nguon = doc('/assets/css/tokens.css') + doc('/assets/css/base.css') + doc('/assets/css/home.css')
    + doc('/assets/js/core/layout.js');
  const anh = [...new Set([...nguon.matchAll(/\/assets\/img\/[\w.-]+/g)].map((khop) => khop[0]))];
  assert.ok(anh.length >= 8, `chỉ thấy ${anh.length} ảnh`);
  for (const path of anh) assert.ok(existsSync(site(path)), `thiếu ${path}`);
});

test('Ảnh nền có đủ bản sáng và tối cho cả hai chế độ', () => {
  const tokens = doc('/assets/css/tokens.css');
  for (const ten of ['cang-sang-960', 'cang-sang-1600', 'cang-sang-2400', 'cang-toi-960', 'cang-toi-1600', 'cang-toi-2400']) {
    assert.ok(tokens.includes(`/assets/img/${ten}.webp`), `tokens.css chưa dùng ${ten}`);
  }
  // Ảnh tối khai báo hai lần: theo máy (prefers-color-scheme) và theo nút bấm (data-theme).
  assert.equal(tokens.match(/cang-toi-1600\.webp/g).length, 4);
});
