export const SYS_TITLE_REGEX = /^(IMG(?:[-_E])?|PXL|VID|MOV|MVI|DSC|CIMG|GH0\d|GX0\d|DJI|RPReplay|Screen Recording)[\-_ \s]?[0-9A-Za-z_\- ]{3,}$/;

export function isSystemTitle(title) {
  return SYS_TITLE_REGEX.test(title || '');
}

export function randInt(min, maxInclusive) {
  return Math.floor(Math.random() * (maxInclusive - min + 1)) + min;
}

export function pad2(n) { return String(n).padStart(2, '0'); }

export function digits(len) {
  let out = '';
  for (let i = 0; i < len; i++) out += randInt(0, 9);
  return out;
}

export function generateFromTemplate(tpl, yearMin, yearMax) {
  const y0 = parseInt(yearMin, 10) || 2014;
  const y1 = parseInt(yearMax, 10) || 2025;
  const year = randInt(Math.min(y0, y1), Math.max(y0, y1));
  const month = pad2(randInt(1, 12));
  const day = pad2(randInt(1, 28));
  let out = tpl;
  out = out.replaceAll('YYYY', String(year));
  out = out.replaceAll('MM', String(month));
  out = out.replaceAll('DD', String(day));
  out = out.replaceAll('######', digits(6));
  out = out.replaceAll('####', digits(4));
  return out;
}

