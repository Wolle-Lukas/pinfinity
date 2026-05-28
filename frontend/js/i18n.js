import en from '../locales/en.js';
import de from '../locales/de.js';

const locales = { en, de };
let strings = en;

export function init() {
  const lang = (localStorage.getItem('pinfinity.lang') || navigator.language || 'en')
    .toLowerCase().split('-')[0];
  strings = locales[lang] ?? locales.en;
}

export function t(key, vars) {
  let str = strings[key];
  if (str === undefined) return key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}

export function applyToDOM() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
}
