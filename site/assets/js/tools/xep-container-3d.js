// Khung 3D của trang xếp container. Three.js chỉ tải khi có kết quả đầu tiên.
// Khung giữ nguyên giữa các lần gõ: mỗi lần chỉ vẽ lại thùng, không tạo lại WebGL.
import { formatNumber } from '../core/format.js';
import { viTriThung } from '../calc/xep-container.js';

const THREE_URL = '/assets/js/vendor/three/three-logneko.min.js';
// Màu theo tầng, hai tầng sát nhau luôn khác hẳn nhau; rõ trên cả nền sáng lẫn tối.
const MAU_TANG = ['#5C6F16', '#D8F21C', '#8FA51E', '#C9B458', '#3E4C12', '#B9CF2E'];
// Viền cont một màu cố định, rõ trên nền kem, nền tối và cả tờ xuất nền trắng (xuất lúc đang tối vẫn rõ).
const MAU_VIEN = '#7D8270';
const CM_PER_M = 100;
const FOV = 35;
// Nhìn từ phía cửa, chếch lên trên, để thấy cả mặt cửa lẫn chiều dài cont.
const HUONG_NHIN = [0.9, 0.75, 1.25];
const KHE = 0.05;
const KHE_TOI_DA_CM = 2;

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

const cssColor = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

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

  // Đặt máy ảnh vừa khít cả cont, tính theo góc nhìn hẹp hơn (điện thoại dọc thì là góc ngang).
  const fitCamera = () => {
    if (!view || !latest) return;
    const { THREE, camera, controls } = view;
    const { dai, rong, cao } = latest.long;
    const ban = Math.hypot(dai, rong, cao) / CM_PER_M / 2;
    const doc = THREE.MathUtils.degToRad(FOV) / 2;
    const ngang = Math.atan(Math.tan(doc) * camera.aspect);
    // Khối cầu bao quanh cont rộng hơn cont thật, nên đứng gần hơn một chút cho hình đầy khung.
    const xa = ban / Math.sin(Math.min(doc, ngang)) * 0.85;
    const huong = new THREE.Vector3(...HUONG_NHIN).normalize();
    controls.target.set(0, cao / CM_PER_M / 2, 0);
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
    const { THREE, scene } = view;
    if (view.group) {
      view.group.traverse((node) => {
        node.geometry?.dispose();
        node.material?.dispose();
      });
      scene.remove(view.group);
    }
    const group = new THREE.Group();
    const { dai, rong, cao } = latest.long;
    const m = (value) => value / CM_PER_M;
    // Gốc tọa độ ở giữa sàn cont; trục x theo chiều dài (vách đầu ở x âm, cửa ở x dương), y đứng, z theo chiều rộng.
    const goc = new THREE.Vector3(-m(dai) / 2, 0, -m(rong) / 2);

    const lineColor = new THREE.Color(MAU_VIEN);
    const shell = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(m(dai), m(cao), m(rong))),
      new THREE.LineBasicMaterial({ color: lineColor }),
    );
    shell.position.set(0, m(cao) / 2, 0);
    group.add(shell);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(m(dai), m(rong)),
      new THREE.MeshBasicMaterial({ color: lineColor, transparent: true, opacity: 0.12, side: THREE.DoubleSide }),
    );
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);

    // Mặt cửa tô nhạt để biết đầu nào là cửa.
    const { cua } = latest.loai;
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(m(cua.rong), m(cua.cao)),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cssColor('--accent') || '#D8F21C'), transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
    );
    door.rotation.y = Math.PI / 2;
    door.position.set(m(dai) / 2, m(cua.cao) / 2, 0);
    group.add(door);

    const { a, b, c, nz } = latest.huong;
    const khe = Math.min(Math.min(a, b, c) * KHE, KHE_TOI_DA_CM);
    const colors = MAU_TANG.map((hex) => new THREE.Color(hex));
    const { thung, khoi } = viTriThung(latest);

    if (thung) {
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(m(a - khe), m(c - khe), m(b - khe)), new THREE.MeshLambertMaterial(), thung.length);
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
          new THREE.MeshLambertMaterial({ color: colors[item.tang % colors.length] }),
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
    view = { THREE, renderer, scene, camera, controls, group: null };

    new ResizeObserver(resize).observe(stage);
    // Đổi sáng/tối thì vẽ lại để màu viền cont theo kịp.
    new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);
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
