/**
 * تبدیل تاریخ میلادی <-> شمسی (الگوریتم جلالی)
 * در کل برنامه تاریخ‌ها به صورت رشته‌ی میلادی "YYYY-MM-DD" ذخیره می‌شوند
 * و فقط هنگام نمایش به شمسی تبدیل می‌گردند.
 */

const div = (a, b) => ~~(a / b);
const mod = (a, b) => a - ~~(a / b) * b;

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 1800, 1989,
  2020, 2466, 2746, 3167, 3570, 3785, 3885, 5000,
];

function jalCal(jy, withoutLeap) {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jm, jump, leap, leapG, march, n, i;

  if (jy < jp || jy >= BREAKS[bl - 1]) throw new Error('سال شمسی نامعتبر: ' + jy);

  for (i = 1; i < bl; i += 1) {
    jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  march = 20 + leapJ - leapG;

  if (!withoutLeap) {
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
  }
  return { leap, gy, march };
}

function g2d(gy, gm, gd) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy, jm, jd) {
  const r = jalCal(jy, true);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy, false);
  const jdn1f = g2d(gy, 3, r.march);
  let jd, jm, k;

  k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

/* ---------- API عمومی ---------- */

export const MONTHS_FA = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

/** روزهای هفته با شروع از شنبه */
export const WEEKDAYS_FA = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
export const WEEKDAYS_SHORT_FA = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export function isJalaliLeap(jy) {
  return jalCal(jy, false).leap === 0;
}

/** تعداد روزهای یک ماه شمسی */
export function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

/** "2026-10-31" یا Date  ->  { jy, jm, jd } */
export function toJalali(input) {
  const { gy, gm, gd } = parseGregorian(input);
  return d2j(g2d(gy, gm, gd));
}

/** { jy, jm, jd }  ->  "YYYY-MM-DD" میلادی */
export function toGregorianISO(jy, jm, jd) {
  const g = d2g(j2d(jy, jm, jd));
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}

/** شماره روز هفته‌ی ایرانی: شنبه = ۰ ... جمعه = ۶ */
export function jalaliWeekday(isoDate) {
  const d = isoToDate(isoDate);
  return (d.getDay() + 1) % 7;
}

/** "YYYY-MM-DD" -> "۹ آبان ۱۴۰۵" */
export function formatJalali(isoDate, { withWeekday = false, short = false, digits = true } = {}) {
  if (!isoDate) return '';
  const { jy, jm, jd } = toJalali(isoDate);
  const body = short
    ? `${jd} ${MONTHS_FA[jm - 1]}`
    : `${jd} ${MONTHS_FA[jm - 1]} ${jy}`;
  const out = withWeekday ? `${WEEKDAYS_FA[jalaliWeekday(isoDate)]}، ${body}` : body;
  return digits ? toPersianDigits(out) : out;
}

/** "YYYY-MM-DD" -> "۱۴۰۵/۰۸/۰۹" */
export function formatJalaliNumeric(isoDate, digits = true) {
  if (!isoDate) return '';
  const { jy, jm, jd } = toJalali(isoDate);
  const out = `${jy}/${pad(jm)}/${pad(jd)}`;
  return digits ? toPersianDigits(out) : out;
}

/** تاریخ امروز به صورت ISO میلادی بر اساس ساعت محلی */
export function todayISO(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** افزودن (یا کم کردن) تعداد روز به یک تاریخ ISO */
export function addDays(isoDate, days) {
  const d = isoToDate(isoDate);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

/** اختلاف دو تاریخ به روز (a - b) */
export function diffDays(aISO, bISO) {
  return g2dFromISO(aISO) - g2dFromISO(bISO);
}

/**
 * ساخت شبکه‌ی تقویم یک ماه شمسی
 * خروجی: آرایه‌ای از هفته‌ها، هر هفته ۷ خانه (شنبه تا جمعه)، خانه‌های خالی null
 */
export function buildJalaliMonth(jy, jm) {
  const len = jalaliMonthLength(jy, jm);
  const firstISO = toGregorianISO(jy, jm, 1);
  const offset = jalaliWeekday(firstISO);
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= len; d++) {
    cells.push({ jy, jm, jd: d, iso: toGregorianISO(jy, jm, d) });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** جابه‌جایی ماه شمسی */
export function shiftJalaliMonth(jy, jm, delta) {
  let m = jm + delta;
  let y = jy;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  return { jy: y, jm: m };
}

/* ---------- ابزارهای کمکی ---------- */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(value) {
  return String(value).replace(/\d/g, (d) => PERSIAN_DIGITS[+d]);
}

export function toEnglishDigits(value) {
  return String(value)
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** ۱۲۰۰۰۰ -> "۱۲۰٬۰۰۰" */
export function formatMoney(amount, { digits = true } = {}) {
  const s = Math.round(Number(amount) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return digits ? toPersianDigits(s) : s;
}

/** "14:30" -> "۱۴:۳۰" */
export function formatTime(hhmm, digits = true) {
  return digits ? toPersianDigits(hhmm || '') : hhmm || '';
}

/** "14:30" -> 870 دقیقه */
export function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}

/** 870 -> "14:30" */
export function minutesToTime(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function parseGregorian(input) {
  if (input instanceof Date) {
    return { gy: input.getFullYear(), gm: input.getMonth() + 1, gd: input.getDate() };
  }
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(input));
  if (!m) throw new Error('تاریخ نامعتبر: ' + input);
  return { gy: +m[1], gm: +m[2], gd: +m[3] };
}

function g2dFromISO(isoDate) {
  const { gy, gm, gd } = parseGregorian(isoDate);
  return g2d(gy, gm, gd);
}

function isoToDate(isoDate) {
  const { gy, gm, gd } = parseGregorian(isoDate);
  return new Date(gy, gm - 1, gd, 12, 0, 0);
}
