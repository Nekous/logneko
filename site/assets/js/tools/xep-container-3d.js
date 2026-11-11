// Khung 3D của trang xếp container. Three.js chỉ tải khi có kết quả đầu tiên.
// Khung giữ nguyên giữa các lần gõ: mỗi lần chỉ vẽ lại cont và thùng, không tạo lại WebGL.
import { formatNumber } from '../core/format.js';
import { viTriThung } from '../calc/xep-container.js';

const THREE_URL = '/assets/js/vendor/three/three-logneko.min.js';
// Màu theo tầng, hai tầng sát nhau luôn khác hẳn nhau; rõ trên cả nền sáng lẫn tối.
const MAU_TANG = ['#5C6F16', '#D8F21C', '#8FA51E', '#C9B458', '#3E4C12', '#B9CF2E'];
// Màu vỏ cont theo tông LOGNEKO, cố định để rõ trên nền kem, nền tối và cả tờ xuất nền trắng.
const MAU_KHUNG = '#5E6650';
const MAU_GOC = '#3F4634';
const MAU_KHOA = '#9AA088';
const MAU_GAN_SANG = '#A3B26A';
const MAU_GAN_TOI = '#6E7D3A';
const MAU_GO_SANG = '#A8865B';
const MAU_GO_TOI = '#7E6140';
const MAU_CUA = '#D8F21C';
const CM_PER_M = 100;
const FOV = 35;
// Nhìn từ phía cửa, chếch lên trên, để thấy cả mặt cửa lẫn chiều dài cont.
const HUONG_NHIN = [0.9, 0.75, 1.25];
const KHE = 0.05;
const KHE_TOI_DA_CM = 2;
// Kích thước chi tiết vỏ cont, tính bằng cm; chỉ để hình giống cont, không dùng trong phép tính.
const KHUNG_CM = 8;
const GOC_CM = 14;
const BUOC_GAN_CM = 28;
const VAN_GO_CM = 30;
const DAY_CANH_CM = 4;
const THANH_KHOA_CM = 3;

let threePromise;
function loadThree() {
  threePromise ??= import(THREE_URL).catch((error) => {
    threePromise = undefined;
    throw error;
  });
  return threePromise;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Mỗi cánh cửa rộng nửa lòng cont cộng nửa khung, hai cánh đóng lại thì khít giữa.
const canhCuaCm = (long) => (long.rong + KHUNG_CM) / 2;

// Bán kính khối cầu bao cả cont, khung và hai cánh cửa đang mở, tính bằng mét.
const banKinh = (long) => Math.hypot(long.dai + KHUNG_CM * 2 + canhCuaCm(long), long.rong + KHUNG_CM * 2, long.cao + KHUNG_CM * 2) / CM_PER_M / 2;

function caption(result, gop) {
  const ten = result.loai.ten;
  const so = formatNumber(result.soThungHinh);
  const dau = result.soThungHinh === result.moiCont ? `Hình một cont ${ten} đầy, ${so} thùng` : `Hình ${so} thùng trong một cont ${ten}`;
  const them = gop ? '; nhiều thùng quá nên mỗi tầng vẽ thành một khối' : '';
  return `${dau}, xếp từ vách đầu cont ra cửa${them}.`;
}

function legend(nz) {
  const list = el('ul', 'xc-3d-legend');
  list.setAttribute('aria-label', 'Màu theo tầng');
  const so = Math.min(nz, MAU_TANG.length);
  for (let tang = 0; tang < so; tang += 1) {
    const item = el('li');
    const chip = el('span', 'xc-3d-chip');
    chip.style.background = MAU_TANG[tang];
    item.append(chip, `Tầng ${tang + 1}`);
    list.append(item);
  }
  if (nz > MAU_TANG.length) list.append(el('li', '', 'màu lặp lại từ tầng 7'));
  return list;
}

// Vân sọc lặp lại: sọc chạy dọc theo trục v của mặt (gân vách) hoặc ngang (ván sàn).
function vanSoc(THREE, sang, toi, doc, soMoiMet) {
  const canvas = document.createElement('canvas');
  canvas.width = doc ? 32 : 2;
  canvas.height = doc ? 2 : 32;
  const ctx = canvas.getContext('2d');
  const grad = doc ? ctx.createLinearGradient(0, 0, 32, 0) : ctx.createLinearGradient(0, 0, 0, 32);
  grad.addColorStop(0, sang);
  grad.addColorStop(0.45, toi);
  grad.addColorStop(0.55, toi);
  grad.addColorStop(1, sang);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!doc) {
    // Khe giữa hai tấm ván.
    ctx.fillStyle = toi;
    ctx.fillRect(0, 0, 2, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(doc ? soMoiMet : 1, doc ? 1 : soMoiMet);
  return texture;
}

// Tọa độ vân của khối lòng cont đổi sang mét, để gân và ván giữ đúng bước dù cont dài hay ngắn.
// Thứ tự mặt của BoxGeometry: x dương, x âm, y dương, y âm, z dương, z âm; mỗi mặt 4 đỉnh.
function uvTheoMet(geometry, dai, rong, cao) {
  const kichThuoc = [[rong, cao], [rong, cao], [dai, rong], [dai, rong], [dai, cao], [dai, cao]];
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) {
    const [u, v] = kichThuoc[Math.floor(i / 4)];
    uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
  }
}

export function createViewer() {
  const figure = el('figure', 'xc-3d');
  const stage = el('div', 'xc-3d-stage');
  const status = el('p', 'xc-3d-status', 'Đang tải hình 3D…');
  stage.append(status);
  const note = el('figcaption', 'xc-3d-note');
  const legendSlot = el('div');
  const tools = el('div', 'xc-3d-tools');
  // Bản xuất là ảnh tĩnh nên bỏ nút và lời dặn thao tác.
  tools.dataset.xuat = 'bo';
  const reset = el('button', 'btn xc-3d-reset', 'Đặt lại góc nhìn');
  reset.type = 'button';
  reset.disabled = true;
  tools.append(reset, el('span', 'xc-3d-hint', 'Vuốt ngang hoặc kéo chuột để xoay; chụm hai ngón hoặc lăn chuột để phóng to; phím mũi tên để dời, thêm Shift để xoay.'));
  figure.append(stage, tools, legendSlot, note);

  let view = null;
  let latest = null;
  let failed = false;

  const render = () => view?.renderer.render(view.scene, view.camera);

  const resize = () => {
    if (!view) return;
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    view.renderer.setSize(width, height, false);
    view.camera.aspect = width / height;
    view.camera.updateProjectionMatrix();
    render();
  };

  // Đặt máy ảnh vừa khít cả cont lẫn hai cánh cửa đang mở, tính theo góc nhìn hẹp hơn
  // (điện thoại dọc thì là góc ngang).
  const fitCamera = () => {
    if (!view || !latest) return;
    const { THREE, camera, controls } = view;
    const { cao } = latest.long;
    const canh = canhCuaCm(latest.long);
    const ban = banKinh(latest.long);
    const doc = THREE.MathUtils.degToRad(FOV) / 2;
    const ngang = Math.atan(Math.tan(doc) * camera.aspect);
    // Khối cầu bao quanh rộng hơn cont thật, nên đứng gần hơn một chút cho hình đầy khung,
    // nhưng vẫn chừa chỗ cho cánh cửa chĩa về phía máy ảnh.
    const xa = ban / Math.sin(Math.min(doc, ngang)) * 0.95;
    const huong = new THREE.Vector3(...HUONG_NHIN).normalize();
    controls.target.set(canh / 2 / CM_PER_M, cao / CM_PER_M / 2, 0);
    camera.position.copy(controls.target).addScaledVector(huong, xa);
    camera.near = xa / 100;
    camera.far = xa * 10;
    camera.updateProjectionMatrix();
    controls.minDistance = ban * 0.3;
    controls.maxDistance = xa * 3;
    controls.update();
    render();
  };

  const draw = () => {
    if (!view || !latest) return;
    const { THREE, scene, vatLieu, hop } = view;
    // Vật liệu, vân và khối hộp mẫu dùng chung giữa các lần vẽ; chỉ giải phóng hình học riêng của lần trước.
    if (view.group) {
      view.group.traverse((node) => {
        if (node.geometry && node.geometry !== hop) node.geometry.dispose();
        if (node.isInstancedMesh) node.dispose();
      });
      scene.remove(view.group);
    }
    const group = new THREE.Group();
    const m = (value) => value / CM_PER_M;
    const D = m(latest.long.dai);
    const W = m(latest.long.rong);
    const H = m(latest.long.cao);
    const k = m(KHUNG_CM);
    // Gốc tọa độ ở giữa sàn cont; trục x theo chiều dài (vách đầu ở x âm, cửa ở x dương), y đứng, z theo chiều rộng.
    const goc = new THREE.Vector3(-D / 2, 0, -W / 2);

    // Khối hộp mẫu cạnh 1 m, kéo giãn thành cột, dầm, thanh khóa.
    const thanh = (material, [x, y, z], [sx, sy, sz]) => {
      const mesh = new THREE.Mesh(hop, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      group.add(mesh);
      return mesh;
    };

    // Vách gân và sàn gỗ: chỉ vẽ mặt trong, nên vách phía gần máy ảnh tự ẩn, xoay hướng nào cũng thấy thùng.
    const long = new THREE.BoxGeometry(D, H, W);
    uvTheoMet(long, D, W, H);
    const vach = new THREE.Mesh(long, [vatLieu.mo, vatLieu.vach, vatLieu.vach, vatLieu.san, vatLieu.vach, vatLieu.vach]);
    vach.position.set(0, H / 2, 0);
    group.add(vach);

    // Khung thép nằm ngay ngoài lòng cont để không đè lên thùng.
    const xKhung = D / 2 + k / 2;
    const zKhung = W / 2 + k / 2;
    const yDuoi = -k / 2;
    const yTren = H + k / 2;
    const cuaCao = m(latest.loai.cua.cao);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) thanh(vatLieu.khung, [sx * xKhung, H / 2, sz * zKhung], [k, H + k * 2, k]);
    }
    for (const y of [yDuoi, yTren]) {
      for (const sz of [-1, 1]) thanh(vatLieu.khung, [0, y, sz * zKhung], [D, k, k]);
    }
    thanh(vatLieu.khung, [-xKhung, yDuoi, 0], [k, k, W]);
    thanh(vatLieu.khung, [-xKhung, yTren, 0], [k, k, W]);
    thanh(vatLieu.khung, [xKhung, yDuoi, 0], [k, k, W]);
    // Dầm trên cửa: từ mép trên ô cửa lên tới nóc.
    thanh(vatLieu.khung, [xKhung, (cuaCao + H + k) / 2, 0], [k, H + k - cuaCao, W]);
    const g = m(GOC_CM);
    for (const sx of [-1, 1]) {
      for (const y of [yDuoi, yTren]) {
        for (const sz of [-1, 1]) thanh(vatLieu.goc, [sx * xKhung, y, sz * zKhung], [g, g, g]);
      }
    }

    // Ô cửa tô xanh chanh rất nhạt để biết đầu nào là lối vào.
    const cuaRong = m(latest.loai.cua.rong);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(cuaRong, cuaCao), vatLieu.oCua);
    door.rotation.y = Math.PI / 2;
    door.position.set(D / 2, cuaCao / 2, 0);
    group.add(door);

    // Hai cánh cửa mở 90°, chĩa ra ngoài như lúc đóng hàng; mặt có thanh khóa quay ra hai bên.
    const canh = m(canhCuaCm(latest.long));
    const day = m(DAY_CANH_CM);
    const xBanLe = D / 2 + k;
    for (const sz of [-1, 1]) {
      const z = sz * (zKhung + k / 2 + day / 2);
      const xGiua = xBanLe + canh / 2;
      thanh(vatLieu.tamCanh, [xGiua, cuaCao / 2, z], [canh, cuaCao, day]);
      // Viền cánh.
      const v = m(5);
      thanh(vatLieu.khung, [xGiua, cuaCao - v / 2, z], [canh, v, day * 1.2]);
      thanh(vatLieu.khung, [xGiua, v / 2, z], [canh, v, day * 1.2]);
      thanh(vatLieu.khung, [xBanLe + v / 2, cuaCao / 2, z], [v, cuaCao, day * 1.2]);
      thanh(vatLieu.khung, [xBanLe + canh - v / 2, cuaCao / 2, z], [v, cuaCao, day * 1.2]);
      // Hai thanh khóa dọc và tay nắm, nằm ở mặt ngoài cánh.
      const t = m(THANH_KHOA_CM);
      const zNgoai = z + sz * (day / 2 + t / 2);
      for (const phan of [0.3, 0.7]) {
        const x = xBanLe + canh * phan;
        thanh(vatLieu.khoa, [x, cuaCao / 2, zNgoai], [t, cuaCao * 0.96, t]);
        thanh(vatLieu.khoa, [x + m(8), cuaCao * 0.48, zNgoai + sz * t], [m(18), t, t]);
      }
    }

    const { a, b, c, nz } = latest.huong;
    const khe = Math.min(Math.min(a, b, c) * KHE, KHE_TOI_DA_CM);
    const colors = MAU_TANG.map((hex) => new THREE.Color(hex));
    const { thung, khoi } = viTriThung(latest);

    if (thung) {
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(m(a - khe), m(c - khe), m(b - khe)), vatLieu.thung, thung.length);
      const matrix = new THREE.Matrix4();
      thung.forEach((item, index) => {
        matrix.makeTranslation(goc.x + m(item.x + a / 2), m(item.z + c / 2), goc.z + m(item.y + b / 2));
        mesh.setMatrixAt(index, matrix);
        mesh.setColorAt(index, colors[item.tang % colors.length]);
      });
      group.add(mesh);
    } else {
      for (const item of khoi) {
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(m(item.dx - khe), m(item.dz - khe), m(item.dy - khe)),
          vatLieu.khoi[item.tang % vatLieu.khoi.length],
        );
        block.position.set(goc.x + m(item.x + item.dx / 2), m(item.z + item.dz / 2), goc.z + m(item.y + item.dy / 2));
        group.add(block);
      }
    }

    scene.add(group);
    view.group = group;
    legendSlot.replaceChildren(legend(nz));
    note.textContent = caption(latest, !thung);
    render();
  };

  const init = (THREE) => {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(3, 6, 4);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 1000);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.addEventListener('change', render);
    // OrbitControls chặn mọi thao tác chạm trên hình, nên trên điện thoại không cuộn trang qua được.
    // Cho vuốt dọc cuộn trang, vuốt ngang mới xoay hình.
    renderer.domElement.style.touchAction = 'pan-y';
    renderer.domElement.tabIndex = 0;
    controls.listenToKeyEvents(renderer.domElement);
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', 'Hình 3D các thùng trong container');
    status.remove();
    stage.append(renderer.domElement);

    const vatLieu = {
      mo: new THREE.MeshBasicMaterial({ visible: false }),
      vach: new THREE.MeshBasicMaterial({
        map: vanSoc(THREE, MAU_GAN_SANG, MAU_GAN_TOI, true, CM_PER_M / BUOC_GAN_CM),
        side: THREE.BackSide, transparent: true, opacity: 0.4, depthWrite: false,
      }),
      san: new THREE.MeshBasicMaterial({ map: vanSoc(THREE, MAU_GO_SANG, MAU_GO_TOI, false, CM_PER_M / VAN_GO_CM), side: THREE.BackSide }),
      khung: new THREE.MeshLambertMaterial({ color: MAU_KHUNG }),
      goc: new THREE.MeshLambertMaterial({ color: MAU_GOC }),
      khoa: new THREE.MeshLambertMaterial({ color: MAU_KHOA }),
      tamCanh: new THREE.MeshLambertMaterial({ color: MAU_GAN_TOI, transparent: true, opacity: 0.35, depthWrite: false }),
      oCua: new THREE.MeshBasicMaterial({ color: MAU_CUA, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }),
      thung: new THREE.MeshLambertMaterial(),
      khoi: MAU_TANG.map((hex) => new THREE.MeshLambertMaterial({ color: hex })),
    };
    view = { THREE, renderer, scene, camera, controls, group: null, vatLieu, hop: new THREE.BoxGeometry(1, 1, 1) };

    new ResizeObserver(resize).observe(stage);
    reset.disabled = false;
    reset.addEventListener('click', fitCamera);
  };

  return {
    element: figure,
    show(result) {
      const doiCont = !latest || latest.loai.id !== result.loai.id;
      latest = result;
      if (failed) return;
      if (view) {
        draw();
        if (doiCont) fitCamera();
        return;
      }
      loadThree().then((THREE) => {
        if (!view) init(THREE);
        resize();
        draw();
        fitCamera();
      }).catch((error) => {
        console.error(error);
        failed = true;
        status.textContent = 'Không tải được hình 3D. Các con số bên trên vẫn đúng; bạn thử tải lại trang.';
        tools.hidden = true;
      });
    },
  };
}
