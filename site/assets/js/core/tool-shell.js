// Khuôn chung của trang công cụ: trang chỉ khai báo ô nhập, hàm tính và cách trình bày.
import { formatNumber, parseNumber } from './format.js';
import { SO_LAN_TOI_DA, docLichSu, nhanThoiGian, themLichSu, xoaHet, xoaMotLan } from './lich-su.js';
import { isLive, loadTools, toolHref } from './tools.js';
import { saveTransfer, takeTransfer } from './transfer.js';
import { xuatKetQua } from './xuat.js';

const PROMPT_EMPTY = 'Nhập đủ các ô để xem kết quả.';
const PROMPT_INVALID = 'Sửa ô đang báo lỗi để xem kết quả.';
const NUMBER_HINT = 'Cách gõ số: dấu chấm (.) ngăn phần nghìn, dấu phẩy (,) ngăn phần thập phân. Ví dụ: 1.234,5.';
const ERROR_NOT_NUMBER = 'Chưa đọc được số này. Dấu chấm ngăn phần nghìn, dấu phẩy ngăn phần thập phân, ví dụ 1.234,5.';
const ERROR_CALCULATE = 'Không tính được với số liệu này.';
const ERROR_TRANSFER = 'Trình duyệt chặn chuyển số liệu, bạn hãy mở công cụ kia và nhập lại.';
const ERROR_EXPORT = 'Không tạo được file. Bạn thử lại, hoặc dùng nút Copy kết quả.';
const STATUS_RESET_MS = 2500;
// Kết quả đứng yên chừng này thì coi như người dùng đã tính xong, lưu vào lịch sử.
const HISTORY_DELAY_MS = 3000;
// Trình đọc màn hình chỉ đọc câu tổng khi người dùng ngừng gõ chừng này, không đọc theo từng phím.
const ANNOUNCE_DELAY_MS = 1000;
const CONFIRM_CLEAR_MS = 4000;
// Dòng "Đọc là" phải hiện đủ số đã gõ, không làm tròn như kết quả.
const READING_MAX_DECIMALS = 10;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createControl(field) {
  if (field.type === 'select') {
    const select = el('select', 'tool-input');
    for (const option of field.options) {
      const item = el('option', '', option.label);
      item.value = option.value;
      select.append(item);
    }
    return select;
  }
  if (field.type === 'textarea') {
    const area = el('textarea', 'tool-input');
    area.rows = field.rows ?? 4;
    return area;
  }
  const input = el('input', 'tool-input');
  input.type = 'text';
  input.autocomplete = 'off';
  // Ô chữ như tên phí không mở bàn phím số.
  if (field.type !== 'text') input.inputMode = 'decimal';
  return input;
}

function isNumberField(field) {
  return !['select', 'textarea', 'text'].includes(field.type);
}

export function createField(field) {
  const id = `field-${field.name}`;
  const wrap = el('div', 'tool-field');
  const labelText = field.unit ? `${field.label} (${field.unit})` : field.label;
  const label = el('label', '', field.optional ? `${labelText}, tùy chọn` : labelText);
  label.htmlFor = id;

  const control = createControl(field);
  control.id = id;
  if (field.placeholder) control.placeholder = field.placeholder;
  // Thuộc tính riêng của từng ô, như ô số container tự gõ chữ hoa và không sửa chính tả.
  for (const [name, value] of Object.entries(field.attrs ?? {})) control.setAttribute(name, value);

  const error = el('p', 'tool-field-error');
  error.id = `${id}-loi`;
  error.hidden = true;

  const reading = el('p', 'tool-field-reading');
  reading.id = `${id}-doc-la`;
  reading.hidden = true;

  wrap.append(label, control);
  // Lời dặn cách nhập cho ô chữ; ô số đã có dòng "Đọc là" dùng chung chỗ mô tả.
  if (field.hint) {
    const hint = el('p', 'tool-field-reading', field.hint);
    hint.id = `${id}-huong-dan`;
    control.setAttribute('aria-describedby', hint.id);
    wrap.append(hint);
  }
  wrap.append(error, reading);
  return { field, wrap, control, error, reading };
}

function setFieldState({ control, error, reading }, message, readingText) {
  error.textContent = message;
  error.hidden = !message;
  reading.textContent = readingText;
  reading.hidden = !readingText;

  if (message) control.setAttribute('aria-invalid', 'true');
  else control.removeAttribute('aria-invalid');

  if (message) control.setAttribute('aria-describedby', error.id);
  else if (readingText) control.setAttribute('aria-describedby', reading.id);
  else control.removeAttribute('aria-describedby');
}

// Đọc một ô số và hiện "Đọc là" hoặc lỗi; ô hẹp truyền field.errorText để lỗi ngắn hơn.
export function readNumberField(item) {
  const { field, control } = item;
  const number = parseNumber(control.value);
  const invalid = control.value.trim() !== '' && number === null;
  const readingText = number === null ? '' : `Đọc là: ${formatNumber(number, { toiDa: READING_MAX_DECIMALS })}`;
  setFieldState(item, invalid ? field.errorText ?? ERROR_NOT_NUMBER : '', readingText);
  return { number, invalid };
}

// Đọc các ô khai báo sẵn; number trả về số, ô trống và số sai đều không lọt vào values.
function readFields(items) {
  const values = {};
  let missing = false;
  let invalid = false;

  for (const item of items) {
    const { field, control } = item;
    const raw = control.value;

    if (!isNumberField(field)) {
      values[field.name] = raw;
    } else {
      const reading = readNumberField(item);
      values[field.name] = reading.number;
      if (reading.invalid) invalid = true;
    }

    if (raw.trim() === '' && !field.optional) missing = true;
  }
  return { values, missing, invalid };
}

export function createCopyButton(getText, onCopy) {
  const button = el('button', 'btn btn--primary', 'Copy kết quả');
  button.type = 'button';
  const status = el('span', 'tool-status');
  status.setAttribute('role', 'status');
  let timer;

  button.addEventListener('click', async () => {
    onCopy?.();
    try {
      await navigator.clipboard.writeText(getText());
      status.textContent = 'Đã copy.';
    } catch (error) {
      console.error(error);
      status.textContent = 'Trình duyệt chặn copy, bạn hãy chọn chữ và copy thủ công.';
    }
    clearTimeout(timer);
    timer = setTimeout(() => { status.textContent = ''; }, STATUS_RESET_MS);
  });
  return { button, status };
}

async function loadToolList() {
  try {
    const data = await loadTools();
    return data.cong_cu;
  } catch (error) {
    // Thiếu tên, mô tả và nút chuyển thì công cụ vẫn tính được.
    console.error(error);
    return [];
  }
}

// Nút chuyển số liệu sang công cụ khác; công cụ đích chưa hoạt động thì không có nút.
function createTransferButtons(transfer, tools, source, getValue, status, onTransfer) {
  const buttons = [];
  for (const { den, nhan, data } of transfer) {
    const target = tools.find((tool) => tool.id === den);
    if (!target || !isLive(target)) continue;

    const button = el('button', 'btn', nhan);
    button.type = 'button';
    button.addEventListener('click', () => {
      onTransfer();
      if (saveTransfer(den, { tu: source?.ten, data: data(getValue()) })) {
        window.location.href = toolHref(target);
      } else {
        status.textContent = ERROR_TRANSFER;
      }
    });
    buttons.push(button);
  }
  return buttons;
}

// Nút Xuất PDF/ảnh mở hàng phụ có hai lựa chọn. Thư viện chỉ tải khi bấm Tải PDF hoặc Tải ảnh.
function createExport({ id, getTitle, body, onExport }) {
  const toggle = el('button', 'btn', 'Xuất PDF/ảnh');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  const panel = el('div', 'tool-export');
  panel.id = `${id}-xuat`;
  panel.hidden = true;
  toggle.setAttribute('aria-controls', panel.id);

  const status = el('span', 'tool-status');
  status.setAttribute('role', 'status');
  const choices = [['pdf', 'Tải PDF'], ['png', 'Tải ảnh']].map(([dang, nhan]) => {
    const button = el('button', 'btn', nhan);
    button.type = 'button';
    button.addEventListener('click', async () => {
      onExport();
      choices.forEach((item) => { item.disabled = true; });
      status.textContent = 'Đang tạo file…';
      try {
        const { ten, soTrang } = await xuatKetQua({ id, tenCongCu: getTitle(), body, dang });
        status.textContent = soTrang > 1 ? `Đã tải ${ten} (${soTrang} trang).` : `Đã tải ${ten}.`;
      } catch (error) {
        console.error(error);
        status.textContent = ERROR_EXPORT;
      } finally {
        choices.forEach((item) => { item.disabled = false; });
      }
    });
    return button;
  });
  panel.append(...choices, status);

  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });
  return { toggle, panel };
}

// Khối gập "Lịch sử": mỗi dòng bấm để điền lại, nút × xóa riêng, "Xóa hết" phải bấm hai lần.
function createHistory(id, onPick) {
  const details = el('details', 'tool-history');
  const summary = el('summary');
  const intro = el('p', 'tool-history-note', `Lưu trên máy này, tối đa ${SO_LAN_TOI_DA} lần gần nhất.`);
  const list = el('ol', 'tool-history-list');
  const empty = el('p', 'tool-history-note', 'Chưa có lần tính nào.');
  const clear = el('button', 'btn tool-history-clear', 'Xóa hết lịch sử');
  clear.type = 'button';
  details.append(summary, intro, list, empty, clear);

  let confirmTimer;
  const resetClear = () => {
    clearTimeout(confirmTimer);
    clear.textContent = 'Xóa hết lịch sử';
    delete clear.dataset.confirm;
  };

  const render = (ds) => {
    summary.textContent = `Lịch sử (${ds.length})`;
    empty.hidden = ds.length > 0;
    clear.hidden = ds.length === 0;
    list.replaceChildren(...ds.map((muc) => {
      const item = el('li', 'tool-history-item');
      const pick = el('button', 'tool-history-pick');
      pick.type = 'button';
      const time = nhanThoiGian(muc.luc);
      pick.append(el('span', 'tool-history-time', time), el('span', 'tool-history-text', muc.tomTat));
      pick.setAttribute('aria-label', `Điền lại lần tính lúc ${time}: ${muc.tomTat}`);
      pick.addEventListener('click', () => onPick(muc));
      const remove = el('button', 'tool-history-remove', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Xóa lần tính lúc ${time}`);
      remove.addEventListener('click', () => render(xoaMotLan(id, muc.luc)));
      item.append(pick, remove);
      return item;
    }));
  };

  clear.addEventListener('click', () => {
    if (clear.dataset.confirm) {
      resetClear();
      render(xoaHet(id));
      return;
    }
    clear.dataset.confirm = 'true';
    clear.textContent = 'Bấm lần nữa để xóa hết';
    confirmTimer = setTimeout(resetClear, CONFIRM_CLEAR_MS);
  });

  render(docLichSu(id));
  return {
    details,
    save(entry) {
      render(themLichSu(id, entry));
    },
  };
}

export async function mountTool(config) {
  const { id, fields = [], renderInputs, example, calculate, renderResult, steps, copyText, transfer = [], stickyTotal, historyText, note } = config;
  // Trang chỉ có một ô thì nói thẳng cần nhập gì, thay cho câu chung.
  const emptyText = config.emptyText ?? PROMPT_EMPTY;
  const tools = await loadToolList();
  const tool = tools.find((item) => item.id === id);
  const root = document.getElementById('tool-root');

  const head = el('header', 'tool-head');
  head.append(el('h1', '', tool?.ten ?? document.title));
  if (tool?.mo_ta) head.append(el('p', 'tool-lead', tool.mo_ta));

  const inputs = el('section', 'tool-panel tool-inputs');
  inputs.setAttribute('aria-label', 'Ô nhập');
  const items = fields.map(createField);
  const hasNumberInput = renderInputs || fields.some(isNumberField);
  if (hasNumberInput) inputs.append(el('p', 'tool-number-hint', NUMBER_HINT));
  inputs.append(...items.map((item) => item.wrap));

  const message = el('p', 'tool-message');
  const body = el('div', 'tool-result-body');
  const output = el('div', 'tool-output');

  const how = el('details', 'tool-how');
  const stepList = el('ol');
  how.append(el('summary', '', 'Xem cách tính'), stepList);

  // Lịch sử lưu bộ số đang đưa vào calculate, kèm một dòng tóm tắt lấy từ thanh tổng.
  let current = null;
  let currentValues = null;
  let saveTimer;
  const history = createHistory(id, (muc) => {
    fillInputs(muc.duLieu);
    notice.textContent = `Đã điền lại lần tính lúc ${nhanThoiGian(muc.luc)}.`;
    notice.hidden = false;
  });
  const saveHistory = () => {
    clearTimeout(saveTimer);
    if (!current || !currentValues) return;
    const tomTat = historyText?.(current) ?? stickyTotal?.(current) ?? copyText(current).split('\n')[0];
    history.save({ tomTat, duLieu: currentValues });
  };

  const copy = createCopyButton(() => copyText(current), saveHistory);
  const exporter = createExport({ id, getTitle: () => tool?.ten ?? document.title, body, onExport: saveHistory });
  const actions = el('div', 'tool-actions');
  actions.append(
    copy.button,
    ...createTransferButtons(transfer, tools, tool, () => current, copy.status, saveHistory),
    exporter.toggle,
    copy.status,
  );
  output.append(how, actions, exporter.panel);

  // Khung kết quả không tự đọc: đọc cả bảng và cách tính sau mỗi phím gõ thì quá dài.
  // Trình đọc màn hình chỉ đọc một câu tổng ở dòng ẩn announcer.
  const announcer = el('p', 'sr-only');
  announcer.setAttribute('role', 'status');
  const result = el('section', 'tool-panel tool-result');
  result.setAttribute('aria-label', 'Kết quả');
  result.append(announcer, message, body, output);

  // Danh sách dài đẩy khung kết quả xuống xa, nên trên điện thoại giữ tổng trong tầm mắt.
  // Câu tổng đã đọc qua announcer, thanh này không đọc lặp lại.
  const sticky = el('p', 'tool-sticky-total');
  sticky.hidden = true;
  sticky.setAttribute('aria-hidden', 'true');

  const showMessage = (text, isError = false) => {
    current = null;
    currentValues = null;
    clearTimeout(saveTimer);
    message.textContent = text;
    message.hidden = false;
    message.classList.toggle('is-error', isError);
    body.replaceChildren();
    output.hidden = true;
    sticky.hidden = true;
  };

  const showResult = (values, value) => {
    current = value;
    // Chép riêng để lần gõ sau không đổi luôn bộ số chờ lưu.
    currentValues = JSON.parse(JSON.stringify(values));
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveHistory, HISTORY_DELAY_MS);
    message.hidden = true;
    body.replaceChildren();
    renderResult(value, body);
    stepList.replaceChildren(...steps(values, value).map((step) => el('li', '', step)));
    output.hidden = false;
    if (stickyTotal) {
      sticky.textContent = stickyTotal(value);
      sticky.hidden = false;
    }
  };

  let custom;

  const update = () => {
    const { values, missing, invalid: fieldInvalid } = readFields(items);
    let invalid = fieldInvalid;
    if (custom) {
      const state = custom.read();
      Object.assign(values, state.values);
      invalid ||= state.invalid;
    }
    if (invalid) return showMessage(PROMPT_INVALID);
    if (missing) return showMessage(emptyText);

    let value;
    try {
      value = calculate(values);
    } catch (error) {
      console.error(error);
      return showMessage(ERROR_CALCULATE, true);
    }
    if (!value) return showMessage(emptyText);
    if (value.loi) return showMessage(value.loi, true);
    return showResult(values, value);
  };

  // Lúc mới mở trang không đọc gì; chỉ đọc sau khi người dùng gõ, bấm, điền ví dụ hay nhận số.
  let announceOn = false;
  let announceTimer;
  const announce = () => {
    if (!announceOn) return;
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      const text = current ? (stickyTotal?.(current) ?? copyText(current).split('\n')[0]) : message.textContent;
      if (text && text !== announcer.textContent) announcer.textContent = text;
    }, ANNOUNCE_DELAY_MS);
  };
  const onUserChange = () => {
    announceOn = true;
    update();
    announce();
  };

  // Ô nhập đặc biệt, như danh sách kiện của CBM, tự vẽ và trả về { read, fill }.
  // read() trả về { values, invalid }; ô thiếu do calculate tự xét bằng cách trả về null.
  if (renderInputs) {
    const slot = el('div', 'tool-custom');
    inputs.append(slot);
    custom = renderInputs(slot, onUserChange);
  }

  const notice = el('p', 'tool-received');
  notice.setAttribute('role', 'status');
  notice.hidden = true;
  inputs.prepend(notice);

  const fillInputs = (data) => {
    // Ô dữ liệu không nhắc tới thì trả về mặc định, để số cũ không làm sai kết quả.
    for (const { field, control } of items) {
      const fallback = field.type === 'select' ? field.options[0].value : '';
      const value = data[field.name] ?? fallback;
      // Số lưu trong lịch sử phải viết lại kiểu Việt Nam, để 52,5 không thành "52.5" rồi bị đọc là 52.500.
      control.value = isNumberField(field) && typeof value === 'number'
        ? formatNumber(value, { toiDa: READING_MAX_DECIMALS })
        : value;
    }
    custom?.fill(data);
    onUserChange();
  };

  if (example) {
    const fill = el('button', 'btn', 'Điền ví dụ');
    fill.type = 'button';
    fill.addEventListener('click', () => {
      notice.hidden = true;
      fillInputs(example);
    });
    const row = el('div', 'tool-actions');
    row.append(fill);
    inputs.append(row);
  }

  inputs.append(history.details);
  if (stickyTotal) inputs.append(sticky);
  inputs.addEventListener('input', onUserChange);

  const layout = el('div', 'tool-layout');
  layout.append(inputs, result);
  root.replaceChildren(head, layout);
  if (note) root.append(el('p', 'tool-note', note));

  const received = takeTransfer(id);
  if (received) {
    fillInputs(received.data);
    notice.textContent = [`Đã nhận số liệu từ công cụ ${received.tu}.`, received.data.ghiChuChuyen].filter(Boolean).join(' ');
    notice.hidden = false;
  } else {
    update();
  }
}
