// Khuôn chung của trang công cụ: trang chỉ khai báo ô nhập, hàm tính và cách trình bày.
import { formatNumber, parseNumber } from './format.js';
import { loadTools } from './tools.js';

const PROMPT_EMPTY = 'Nhập đủ các ô để xem kết quả.';
const PROMPT_INVALID = 'Sửa ô đang báo lỗi để xem kết quả.';
const NUMBER_HINT = 'Cách gõ số: dấu chấm (.) ngăn phần nghìn, dấu phẩy (,) ngăn phần thập phân. Ví dụ: 1.234,5.';
const ERROR_NOT_NUMBER = 'Chưa đọc được số này. Dấu chấm ngăn phần nghìn, dấu phẩy ngăn phần thập phân, ví dụ 1.234,5.';
const ERROR_CALCULATE = 'Không tính được với số liệu này.';
const STATUS_RESET_MS = 2500;
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
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  return input;
}

function createField(field) {
  const id = `field-${field.name}`;
  const wrap = el('div', 'tool-field');
  const labelText = field.unit ? `${field.label} (${field.unit})` : field.label;
  const label = el('label', '', field.optional ? `${labelText}, tùy chọn` : labelText);
  label.htmlFor = id;

  const control = createControl(field);
  control.id = id;
  if (field.placeholder) control.placeholder = field.placeholder;

  const error = el('p', 'tool-field-error');
  error.id = `${id}-loi`;
  error.hidden = true;

  const reading = el('p', 'tool-field-reading');
  reading.id = `${id}-doc-la`;
  reading.hidden = true;

  wrap.append(label, control, error, reading);
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

// Đọc các ô khai báo sẵn; number trả về số, ô trống và số sai đều không lọt vào values.
function readFields(items) {
  const values = {};
  let missing = false;
  let invalid = false;

  for (const item of items) {
    const { field, control } = item;
    const raw = control.value;
    const isBlank = raw.trim() === '';
    let message = '';
    let readingText = '';

    if (field.type === 'select' || field.type === 'textarea') {
      values[field.name] = raw;
    } else {
      const number = parseNumber(raw);
      values[field.name] = number;
      if (!isBlank && number === null) message = ERROR_NOT_NUMBER;
      if (number !== null) readingText = `Đọc là: ${formatNumber(number, { toiDa: READING_MAX_DECIMALS })}`;
    }

    setFieldState(item, message, readingText);
    if (message) invalid = true;
    if (isBlank && !field.optional) missing = true;
  }
  return { values, missing, invalid };
}

function createCopyButton(getText) {
  const button = el('button', 'btn btn--primary', 'Copy kết quả');
  button.type = 'button';
  const status = el('span', 'tool-status');
  status.setAttribute('role', 'status');
  let timer;

  button.addEventListener('click', async () => {
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

async function findTool(id) {
  try {
    const data = await loadTools();
    return data.cong_cu.find((tool) => tool.id === id);
  } catch (error) {
    // Thiếu tên và mô tả thì công cụ vẫn tính được.
    console.error(error);
    return undefined;
  }
}

export async function mountTool(config) {
  const { id, fields = [], renderInputs, example, calculate, renderResult, steps, copyText, note } = config;
  const tool = await findTool(id);
  const root = document.getElementById('tool-root');

  const head = el('header', 'tool-head');
  head.append(el('h1', '', tool?.ten ?? document.title));
  if (tool?.mo_ta) head.append(el('p', 'tool-lead', tool.mo_ta));

  const inputs = el('section', 'tool-panel tool-inputs');
  inputs.setAttribute('aria-label', 'Ô nhập');
  const items = fields.map(createField);
  const hasNumberInput = renderInputs || fields.some((field) => field.type !== 'select' && field.type !== 'textarea');
  if (hasNumberInput) inputs.append(el('p', 'tool-number-hint', NUMBER_HINT));
  inputs.append(...items.map((item) => item.wrap));

  const message = el('p', 'tool-message');
  const body = el('div', 'tool-result-body');
  const output = el('div', 'tool-output');

  const how = el('details', 'tool-how');
  const stepList = el('ol');
  how.append(el('summary', '', 'Xem cách tính'), stepList);

  // Hàng nút: các giai đoạn sau thêm Chuyển công cụ và Xuất PDF/ảnh vào đây.
  let current = null;
  const copy = createCopyButton(() => copyText(current));
  const actions = el('div', 'tool-actions');
  actions.append(copy.button, copy.status);
  output.append(how, actions);

  const result = el('section', 'tool-panel tool-result');
  result.setAttribute('aria-label', 'Kết quả');
  result.setAttribute('aria-live', 'polite');
  result.append(message, body, output);

  const showMessage = (text, isError = false) => {
    current = null;
    message.textContent = text;
    message.hidden = false;
    message.classList.toggle('is-error', isError);
    body.replaceChildren();
    output.hidden = true;
  };

  const showResult = (values, value) => {
    current = value;
    message.hidden = true;
    body.replaceChildren();
    renderResult(value, body);
    stepList.replaceChildren(...steps(values, value).map((step) => el('li', '', step)));
    output.hidden = false;
  };

  let custom;

  const update = () => {
    const { values, missing, invalid } = readFields(items);
    if (custom) Object.assign(values, custom.read());
    if (invalid) return showMessage(PROMPT_INVALID);
    if (missing) return showMessage(PROMPT_EMPTY);

    let value;
    try {
      value = calculate(values);
    } catch (error) {
      console.error(error);
      return showMessage(ERROR_CALCULATE, true);
    }
    if (!value) return showMessage(PROMPT_EMPTY);
    if (value.loi) return showMessage(value.loi, true);
    return showResult(values, value);
  };

  // Ô nhập đặc biệt, như danh sách kiện của CBM, tự vẽ và trả về { read, fill }.
  if (renderInputs) {
    const slot = el('div', 'tool-custom');
    inputs.append(slot);
    custom = renderInputs(slot, update);
  }

  if (example) {
    const fill = el('button', 'btn', 'Điền ví dụ');
    fill.type = 'button';
    fill.addEventListener('click', () => {
      // Ô ví dụ không nhắc tới thì trả về mặc định, để số cũ không làm sai kết quả ví dụ.
      for (const { field, control } of items) {
        const fallback = field.type === 'select' ? field.options[0].value : '';
        control.value = example[field.name] ?? fallback;
      }
      custom?.fill(example);
      update();
    });
    const row = el('div', 'tool-actions');
    row.append(fill);
    inputs.append(row);
  }

  inputs.addEventListener('input', update);

  const layout = el('div', 'tool-layout');
  layout.append(inputs, result);
  root.replaceChildren(head, layout);
  if (note) root.append(el('p', 'tool-note', note));

  update();
}
