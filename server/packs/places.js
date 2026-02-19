export const PLACES = Object.freeze({
  BELGIUM: 7008,
  FRANCE: 6753,
  EUROPE: 67952,
  MEDITERRANEAN_BASIN: 53832,
});

export function toPlaceId(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : '';
}
