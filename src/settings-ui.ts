import { invoke } from '@tauri-apps/api/core';
import { openModal } from './modal';
import {
  DEFAULT_SETTINGS, SETTING_FIELDS, getSettings, updateSettings, type SettingField, type Settings,
} from './settings';

/** Settings screen, generated from SETTING_FIELDS. Every change is applied and saved immediately. */
export async function openSettings() {
  const body = document.createElement('div');
  body.className = 'settings';

  const render = () => {
    const s = getSettings();
    body.replaceChildren();

    const categories = [...new Set(SETTING_FIELDS.map((f) => f.category))];
    for (const category of categories) {
      const group = document.createElement('section');
      group.className = 'setting-group';
      const h = document.createElement('h3');
      h.textContent = category;
      group.append(h);
      for (const field of SETTING_FIELDS.filter((f) => f.category === category)) {
        group.append(renderField(field, s));
      }
      body.append(group);
    }

    const footer = document.createElement('div');
    footer.className = 'setting-footer';
    const reset = document.createElement('button');
    reset.textContent = '기본값으로 되돌리기';
    reset.addEventListener('click', async () => {
      const { recentFiles: _keep, ...defaults } = DEFAULT_SETTINGS;
      await updateSettings(defaults);
      render();
    });
    const where = document.createElement('p');
    where.className = 'hint';
    invoke<string>('get_data_dir').then((dir) => {
      where.textContent = `설정과 백업은 이 폴더에 저장됩니다: ${dir}`;
    }).catch(() => {});
    footer.append(reset, where);
    body.append(footer);
  };

  render();
  openModal('설정', body);
}

function renderField(field: SettingField, s: Settings): HTMLElement {
  const row = document.createElement('div');
  row.className = 'setting-row';

  const text = document.createElement('div');
  text.className = 'setting-text';
  const label = document.createElement('label');
  label.textContent = field.label;
  const desc = document.createElement('p');
  desc.className = 'hint';
  desc.textContent = field.description;
  text.append(label, desc);

  const control = document.createElement('div');
  control.className = 'setting-control';
  const value = s[field.key];

  if (field.type === 'boolean') {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value as boolean;
    input.id = `set-${field.key}`;
    label.htmlFor = input.id;
    input.addEventListener('change', () => updateSettings({ [field.key]: input.checked }));
    control.append(input);
  } else if (field.type === 'number') {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(field.min);
    input.max = String(field.max);
    input.value = String(value);
    input.id = `set-${field.key}`;
    label.htmlFor = input.id;
    input.addEventListener('change', () => {
      const n = Math.min(field.max, Math.max(field.min, Math.round(Number(input.value)) || field.min));
      input.value = String(n);
      updateSettings({ [field.key]: n });
    });
    control.append(input);
    if (field.unit) control.append(Object.assign(document.createElement('span'), { className: 'unit', textContent: field.unit }));
  } else {
    const select = document.createElement('select');
    select.id = `set-${field.key}`;
    label.htmlFor = select.id;
    for (const o of field.options) select.add(new Option(o.label, o.value, false, o.value === value));
    select.addEventListener('change', () => updateSettings({ [field.key]: select.value }));
    control.append(select);
  }

  row.append(text, control);
  return row;
}
