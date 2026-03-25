export const MONTH_DAY_ANCHOR_YEAR = '2000';

export const EMPTY_PERIOD_FIELDS = Object.freeze({
  periodStartMonth: '',
  periodStartDay: '',
  periodEndMonth: '',
  periodEndDay: '',
});

const DAYS_BY_MONTH = Object.freeze({
  '01': 31,
  '02': 29,
  '03': 31,
  '04': 30,
  '05': 31,
  '06': 30,
  '07': 31,
  '08': 31,
  '09': 30,
  '10': 31,
  '11': 30,
  '12': 31,
});

function toPaddedNumber(value, min, max) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return '';
  return String(parsed).padStart(2, '0');
}

export function sanitizeMonthValue(value) {
  return toPaddedNumber(value, 1, 12);
}

export function sanitizeDayValue(value) {
  return toPaddedNumber(value, 1, 31);
}

export function getDaysInMonth(month) {
  const normalizedMonth = sanitizeMonthValue(month);
  return normalizedMonth ? DAYS_BY_MONTH[normalizedMonth] : 31;
}

export function isValidMonthDay(month, day) {
  const normalizedMonth = sanitizeMonthValue(month);
  const normalizedDay = sanitizeDayValue(day);
  if (!normalizedMonth || !normalizedDay) return false;
  return Number(normalizedDay) <= getDaysInMonth(normalizedMonth);
}

export function serializeMonthDay(month, day) {
  if (!isValidMonthDay(month, day)) return '';
  return `${sanitizeMonthValue(month)}-${sanitizeDayValue(day)}`;
}

export function normalizeMonthDayToken(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})$/);
  if (!match) return '';
  return serializeMonthDay(match[2], match[3]);
}

export function splitMonthDayToken(value) {
  const token = normalizeMonthDayToken(value);
  if (!token) return { month: '', day: '' };
  const [month, day] = token.split('-');
  return { month, day };
}

function normalizePeriodBound({ month, day, legacyToken }) {
  const normalizedMonth = sanitizeMonthValue(month);
  const normalizedDay = sanitizeDayValue(day);

  if (normalizedMonth) {
    const nextDay =
      normalizedDay && Number(normalizedDay) <= getDaysInMonth(normalizedMonth) ? normalizedDay : '';
    return { month: normalizedMonth, day: nextDay };
  }

  if (!normalizedDay && legacyToken) {
    return splitMonthDayToken(legacyToken);
  }

  return { month: '', day: '' };
}

export function extractPeriodFields(filters = {}) {
  const source = filters && typeof filters === 'object' ? filters : {};
  const start = normalizePeriodBound({
    month: source.periodStartMonth,
    day: source.periodStartDay,
    legacyToken: source.d1,
  });
  const end = normalizePeriodBound({
    month: source.periodEndMonth,
    day: source.periodEndDay,
    legacyToken: source.d2,
  });

  return {
    periodStartMonth: start.month,
    periodStartDay: start.day,
    periodEndMonth: end.month,
    periodEndDay: end.day,
  };
}

export function normalizeCustomFilters(filters = {}, defaults = {}) {
  const source = filters && typeof filters === 'object' ? filters : {};
  const {
    d1,
    d2,
    periodStartMonth,
    periodStartDay,
    periodEndMonth,
    periodEndDay,
    ...rest
  } = source;

  return {
    ...defaults,
    ...rest,
    ...extractPeriodFields({
      d1,
      d2,
      periodStartMonth,
      periodStartDay,
      periodEndMonth,
      periodEndDay,
    }),
  };
}

export function getPeriodTokens(filters = {}) {
  return {
    d1: serializeMonthDay(filters.periodStartMonth, filters.periodStartDay),
    d2: serializeMonthDay(filters.periodEndMonth, filters.periodEndDay),
  };
}

export function hasCompletePeriodRange(filters = {}) {
  const { d1, d2 } = getPeriodTokens(filters);
  return Boolean(d1 && d2);
}

export function isPeriodFilterIncomplete(filters = {}) {
  return Boolean(filters?.period_enabled) && !hasCompletePeriodRange(filters);
}

export function buildApiDateFromMonthDay(month, day) {
  const token = serializeMonthDay(month, day);
  return token ? `${MONTH_DAY_ANCHOR_YEAR}-${token}` : '';
}

export function buildPeriodApiParams(filters = {}) {
  if (!hasCompletePeriodRange(filters)) return {};
  return {
    d1: buildApiDateFromMonthDay(filters.periodStartMonth, filters.periodStartDay),
    d2: buildApiDateFromMonthDay(filters.periodEndMonth, filters.periodEndDay),
  };
}

export function formatMonthDayLabel(month, day, locale = 'fr') {
  if (!isValidMonthDay(month, day)) return '';
  const formatter = new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return formatter.format(new Date(Date.UTC(2000, Number(month) - 1, Number(day))));
}

export function formatPeriodLabel(filters = {}, locale = 'fr') {
  const start = formatMonthDayLabel(filters.periodStartMonth, filters.periodStartDay, locale);
  const end = formatMonthDayLabel(filters.periodEndMonth, filters.periodEndDay, locale);
  return [start, end].filter(Boolean).join(' → ');
}
