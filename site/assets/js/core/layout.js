// Thanh trên và chân trang dùng chung, sửa một chỗ là đổi cả 9 trang.
import { isLive, loadTools, toolHref } from './tools.js';

const THEME_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg>';
const MENU_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

function renderHeader() {
  const slot = document.getElementById('site-header');
  slot.innerHTML = `
    <div class="container">
      <header class="site-header">
        <a class="logo" href="/"><img class="logo-mark" src="/assets/img/logo-96.png" alt="" width="43" height="36">LOGNEKO</a>
        <nav class="site-nav" id="site-nav" aria-label="Điều hướng chính">
          <a class="btn" href="/#cong-cu">Công cụ</a>
          <a class="btn" href="/#cong-cu" data-link="tu-dien">Từ điển</a>
          <a class="btn btn--primary" href="/#cong-cu">Mở công cụ</a>
        </nav>
        <button class="icon-btn" type="button" data-theme-toggle aria-label="Đổi chế độ sáng hoặc tối">${THEME_ICON}</button>
        <button class="icon-btn menu-btn" type="button" aria-label="Mở menu" aria-expanded="false" aria-controls="site-nav">${MENU_ICON}</button>
      </header>
    </div>`;

  const nav = slot.querySelector('#site-nav');
  const menuButton = slot.querySelector('.menu-btn');
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
  };
  menuButton.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
}

function toolLinks(tools) {
  const list = document.createElement('ul');
  for (const tool of tools) {
    const item = document.createElement('li');
    if (isLive(tool)) {
      const link = document.createElement('a');
      link.href = toolHref(tool);
      link.textContent = tool.ten;
      item.append(link);
    } else {
      item.className = 'footer-soon';
      item.textContent = `${tool.ten} (sắp có)`;
    }
    list.append(item);
  }
  return list;
}

function renderFooter() {
  const slot = document.getElementById('site-footer');
  slot.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <a class="footer-logo" href="/"><img class="logo-mark" src="/assets/img/logo-192.png" alt="" width="86" height="72">LOGNEKO</a>
        <div class="footer-cols">
          <section data-col="tinh-toan"><h3>Công cụ</h3></section>
          <section data-col="tra-cuu"><h3>Tra cứu</h3></section>
          <section>
            <h3>Về LOGNEKO</h3>
            <ul><li><a href="/#nguon-du-lieu">Dữ liệu từ đâu</a></li></ul>
          </section>
        </div>
        <p class="footer-note">
          Mã chủ sở hữu container theo
          <a href="https://terminal49.com/tools/scac-code-lookup" target="_blank" rel="noopener">Terminal49</a>
          và ShipsGo (<a href="https://shipsgo.com/fr/ocean/container-prefixes/situ/container-tracking" target="_blank" rel="noopener">SITC</a>,
          <a href="https://shipsgo.com/ocean/container-prefixes/kmtu/container-tracking" target="_blank" rel="noopener">KMTC</a>).
          Kết quả chỉ để tham khảo.
          © ${new Date().getFullYear()} LOGNEKO.
        </p>
      </div>
    </footer>`;
}

async function fillFromTools() {
  const data = await loadTools();
  const footer = document.getElementById('site-footer');
  footer.querySelector('[data-col="tinh-toan"]').append(
    toolLinks(data.cong_cu.filter((tool) => tool.nhom === 'Tính toán')),
  );
  footer.querySelector('[data-col="tra-cuu"]').append(
    toolLinks(data.cong_cu.filter((tool) => tool.nhom !== 'Tính toán')),
  );

  const dictionary = data.cong_cu.find((tool) => tool.id === 'tu-dien');
  if (dictionary && isLive(dictionary)) {
    document.querySelector('[data-link="tu-dien"]').href = toolHref(dictionary);
  }
}

renderHeader();
renderFooter();
// Lỗi tải danh sách chỉ làm thiếu liên kết công cụ, thanh trên vẫn dùng được.
fillFromTools().catch((error) => console.error(error));
