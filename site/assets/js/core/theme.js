// Chạy ngay trong <head>, trước khi vẽ trang, để không bị nháy màu khi tải.
(function () {
  var KEY = 'logneko:theme';
  var root = document.documentElement;

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function save(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* trình duyệt chặn lưu thì chỉ đổi cho trang này */ }
  }

  // ?theme=dark chỉ để xem thử và chụp màn hình, không lưu lại.
  var preview = new URLSearchParams(location.search).get('theme');
  var chosen = preview === 'dark' || preview === 'light' ? preview : read();
  if (chosen === 'dark' || chosen === 'light') root.dataset.theme = chosen;

  document.addEventListener('click', function (event) {
    if (!event.target.closest('[data-theme-toggle]')) return;
    var isDark = root.dataset.theme
      ? root.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    var next = isDark ? 'light' : 'dark';
    root.dataset.theme = next;
    save(next);
  });
})();
