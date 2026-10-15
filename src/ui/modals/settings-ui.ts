import { platform } from '../../platform';
import { openModal } from './modal';
import {
  DEFAULT_SETTINGS, SETTING_FIELDS, getSettings, updateSettings, type SettingField, type Settings,
} from '../../core/workspace/settings';

/** Remembered between openings so the dialog reopens on the tab the user was last using. */
let lastCategory: string | null = null;

/** Settings screen, generated from SETTING_FIELDS and split into one tab per category. Changes apply and save immediately. */
export async function openSettings() {
  const categories = [...new Set(SETTING_FIELDS.map((f) => f.category))];
  let active = lastCategory && categories.includes(lastCategory) ? lastCategory : categories[0];

  const body = document.createElement('div');
  body.className = 'settings';

  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  tabs.setAttribute('role', 'tablist');
  const panel = document.createElement('div');
  panel.className = 'setting-panel';
  panel.setAttribute('role', 'tabpanel');

  const footer = document.createElement('div');
  footer.className = 'setting-footer';
  const reset = document.createElement('button');
  const where = document.createElement('p');
  where.className = 'hint';
  platform().dataLocation().then((dir) => {
    where.textContent = `설정과 백업은 이 폴더에 저장됩니다: ${dir}`;
  }).catch(() => {});
  footer.append(reset, where);

  const render = () => {
    lastCategory = active;
    tabs.replaceChildren();
    for (const category of categories) {
      const tab = document.createElement('button');
      tab.className = 'tab' + (category === active ? ' active' : '');
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(category === active));
      tab.textContent = category;
      tab.addEventListener('click', () => { active = category; render(); });
      tabs.append(tab);
    }

    const s = getSettings();
    panel.replaceChildren(...SETTING_FIELDS.filter((f) => f.category === active).map((f) => renderField(f, s)));

    reset.textContent = `'${active}' 탭 기본값으로 되돌리기`;
  };

  reset.addEventListener('click', async () => {
    const patch: Record<string, unknown> = {};
    for (const f of SETTING_FIELDS.filter((x) => x.category === active)) patch[f.key] = DEFAULT_SETTINGS[f.key];
    await updateSettings(patch as Partial<Settings>);
    render();
  });

  body.append(tabs, panel, footer);
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
