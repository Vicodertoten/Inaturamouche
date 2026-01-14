/* global Intl */
export function formatDate(dateInput, locale, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!dateInput) return '—';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch (e) {
    return d.toLocaleDateString();
  }
}

export function formatNumber(num, locale, options = {}) {
  if (num == null) return '—';
  try {
    return new Intl.NumberFormat(locale, options).format(num);
  } catch (e) {
    return String(num);
  }
}
