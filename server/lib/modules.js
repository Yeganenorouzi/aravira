/**
 * سامانه‌ی ماژول و لایسنس.
 *
 * هر ماژول جداگانه فروخته می‌شود. فعال بودن ماژول‌ها با یک «لایسنس امضاشده»
 * تعیین می‌گردد که فروشنده با کلید خصوصی صادر می‌کند و برنامه فقط با کلید
 * عمومی آن را تأیید می‌کند. بنابراین مدیر سالن نمی‌تواند خودش ماژول پولی را
 * روشن کند؛ فقط می‌تواند لایسنسی را که دریافت کرده وارد کند.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSettings, saveSettings } from './db.js';
import { todayISO, diffDays, formatJalali } from '../../shared/jalali.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_KEY_FILE = path.join(__dirname, '..', 'license-public.pem');

/* ============================================================
   فهرست ماژول‌ها
   ============================================================ */

export const MODULES = [
  {
    id: 'core',
    title: 'هسته‌ی نوبت‌دهی',
    icon: '📅',
    always: true,
    implemented: true,
    price: 0,
    summary: 'بخش پایه که همیشه فعال است.',
    features: [
      'رزرو آنلاین با تقویم شمسی',
      'مدیریت خدمات و پرسنل و شیفت‌ها',
      'پرونده‌ی مشتریان (CRM)',
      'پیامک تراکنشی: کد ورود، تأیید رزرو و لغو',
      'پنل مدیریت و داشبورد',
    ],
  },
  {
    id: 'notifications',
    title: 'اطلاع‌رسانی پیشرفته',
    icon: '✉️',
    implemented: true,
    price: 3500000,
    summary: 'یادآوری خودکار، کانال ایمیل و ارسال گروهی.',
    features: [
      'یادآوری خودکار پیش از نوبت',
      'پیام تبریک تولد',
      'کانال ایمیل با قالب اختصاصی',
      'ارسال پیامک و ایمیل گروهی با قالب و متغیر',
      'پیام خوش‌آمدگویی مشتری تازه',
    ],
  },
  {
    id: 'marketing',
    title: 'باشگاه مشتریان و بازاریابی',
    icon: '🏆',
    implemented: true,
    price: 6900000,
    summary: 'وفادارسازی مشتری و ابزارهای فروش.',
    features: [
      'کد تخفیف با شرایط پیشرفته',
      'کارت هدیه با موجودی قابل خرج',
      'سطح‌بندی باشگاه با تخفیف دائمی',
      'امتیاز، اعتبار و دفتر گردش حساب',
      'دعوت از دوستان با کد معرف',
      'نظرسنجی و امتیازدهی پس از نوبت',
    ],
  },
  {
    id: 'accounting',
    title: 'حسابداری و صندوق',
    icon: '💰',
    implemented: false,
    price: 8900000,
    summary: 'صندوق روزانه، درآمد و هزینه، حقوق و پورسانت پرسنل.',
    features: [
      'صندوق روزانه و تراز',
      'ثبت درآمد و هزینه',
      'حقوق و پورسانت پرسنل',
      'گزارش سود و زیان',
      'صدور فاکتور و فیش قابل چاپ',
    ],
  },
  {
    id: 'inventory',
    title: 'انبار و فروش محصولات',
    icon: '📦',
    implemented: false,
    price: 5900000,
    summary: 'موجودی کالا و فروش محصول کنار خدمات.',
    features: [
      'موجودی کالا و هشدار کمبود',
      'فروش محصول همراه نوبت',
      'کسر خودکار مواد مصرفی هر خدمت',
      'گزارش گردش انبار',
    ],
  },
  {
    id: 'telegram',
    title: 'ربات تلگرام مدیریت',
    icon: '🤖',
    implemented: false,
    price: 2900000,
    summary: 'گزارش و اعلان لحظه‌ای در تلگرام مدیر.',
    features: [
      'اعلان نوبت تازه و لغو',
      'گزارش روزانه و هفتگی',
      'اعلان حذف و ویرایش فاکتور',
    ],
  },
];

export const MODULE_IDS = MODULES.map((m) => m.id);
const CORE_MODULES = MODULES.filter((m) => m.always).map((m) => m.id);

export function moduleById(id) {
  return MODULES.find((m) => m.id === id) || null;
}

/* ============================================================
   لایسنس
   ============================================================ */

let publicKeyCache;

function getPublicKey() {
  if (publicKeyCache !== undefined) return publicKeyCache;
  const fromEnv = process.env.LICENSE_PUBLIC_KEY;
  if (fromEnv) {
    publicKeyCache = fromEnv.replace(/\\n/g, '\n');
    return publicKeyCache;
  }
  publicKeyCache = fs.existsSync(PUBLIC_KEY_FILE)
    ? fs.readFileSync(PUBLIC_KEY_FILE, 'utf8')
    : null;
  return publicKeyCache;
}

const b64url = {
  encode: (buf) => Buffer.from(buf).toString('base64url'),
  decode: (str) => Buffer.from(str, 'base64url'),
};

/**
 * ساخت لایسنس (فقط سمت فروشنده، با کلید خصوصی)
 * @returns {string} توکن لایسنس
 */
export function issueLicense(payload, privateKeyPem) {
  const body = JSON.stringify(payload);
  const encoded = b64url.encode(body);
  const signature = crypto.sign(null, Buffer.from(encoded), privateKeyPem);
  return `SALON1.${encoded}.${b64url.encode(signature)}`;
}

/**
 * بررسی و رمزگشایی لایسنس
 * @returns {{valid:boolean, error?:string, payload?:object, expired?:boolean}}
 */
export function verifyLicense(token) {
  if (!token || typeof token !== 'string') return { valid: false, error: 'لایسنسی وارد نشده است' };

  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'SALON1') {
    return { valid: false, error: 'قالب لایسنس معتبر نیست' };
  }

  const publicKey = getPublicKey();
  if (!publicKey) {
    return { valid: false, error: 'کلید عمومی لایسنس روی سرور پیدا نشد' };
  }

  let ok = false;
  try {
    ok = crypto.verify(null, Buffer.from(parts[1]), publicKey, b64url.decode(parts[2]));
  } catch {
    return { valid: false, error: 'امضای لایسنس قابل بررسی نیست' };
  }
  if (!ok) return { valid: false, error: 'امضای لایسنس معتبر نیست' };

  let payload;
  try {
    payload = JSON.parse(b64url.decode(parts[1]).toString('utf8'));
  } catch {
    return { valid: false, error: 'محتوای لایسنس خوانده نشد' };
  }

  if (payload.expiresAt && diffDays(todayISO(), payload.expiresAt) > 0) {
    return { valid: true, expired: true, payload, error: 'اعتبار لایسنس به پایان رسیده است' };
  }
  return { valid: true, expired: false, payload };
}

/* ============================================================
   وضعیت ماژول‌ها
   ============================================================ */

let stateCache = null;
let stateCacheKey = '';

/** لایسنس فعلی: متغیر محیطی بر تنظیمات اولویت دارد */
function currentToken() {
  return process.env.LICENSE || getSettings().license || '';
}

/** وقتی لایسنس از متغیر محیطی می‌آید، از پنل قابل تغییر نیست */
export function isEnvManaged() {
  return Boolean(process.env.LICENSE);
}

/**
 * وضعیت کامل ماژول‌ها و لایسنس
 */
export function licenseState() {
  const token = currentToken();
  const today = todayISO();
  const key = token + '|' + today;
  if (stateCache && stateCacheKey === key) return stateCache;

  const state = {
    hasLicense: Boolean(token),
    envManaged: isEnvManaged(),
    valid: false,
    expired: false,
    error: '',
    salon: '',
    licenseId: '',
    issuedAt: '',
    expiresAt: '',
    daysLeft: null,
    enabled: [...CORE_MODULES],
  };

  if (token) {
    const res = verifyLicense(token);
    state.valid = res.valid && !res.expired;
    state.expired = Boolean(res.expired);
    state.error = res.error || '';
    if (res.payload) {
      state.salon = res.payload.salon || '';
      state.licenseId = res.payload.licenseId || '';
      state.issuedAt = res.payload.issuedAt || '';
      state.expiresAt = res.payload.expiresAt || '';
      if (state.expiresAt) state.daysLeft = -diffDays(today, state.expiresAt);
      if (state.valid) {
        const granted = (res.payload.modules || []).filter((m) => MODULE_IDS.includes(m));
        state.enabled = [...new Set([...CORE_MODULES, ...granted])];
      }
    }
  }

  stateCache = state;
  stateCacheKey = key;
  return state;
}

export function clearLicenseCache() {
  stateCache = null;
  stateCacheKey = '';
}

/** آیا این ماژول فعال است؟ */
export function hasModule(id) {
  return licenseState().enabled.includes(id);
}

export function enabledModules() {
  return licenseState().enabled;
}

/** ذخیره‌ی لایسنس تازه */
export function applyLicense(token) {
  if (isEnvManaged()) {
    return { ok: false, error: 'لایسنس از طریق متغیر محیطی سرور تنظیم شده و از پنل قابل تغییر نیست' };
  }
  const res = verifyLicense(token);
  if (!res.valid) return { ok: false, error: res.error };
  saveSettings({ license: token.trim() });
  clearLicenseCache();
  return { ok: true, state: licenseState(), expired: Boolean(res.expired) };
}

export function removeLicense() {
  if (isEnvManaged()) {
    return { error: 'لایسنس از طریق متغیر محیطی سرور تنظیم شده و از پنل قابل حذف نیست' };
  }
  saveSettings({ license: '' });
  clearLicenseCache();
  return licenseState();
}

/** فهرست ماژول‌ها همراه وضعیت، برای نمایش در پنل */
export function moduleCatalog() {
  const state = licenseState();
  return MODULES.map((m) => ({
    ...m,
    enabled: state.enabled.includes(m.id),
    locked: !state.enabled.includes(m.id),
  }));
}

/** خلاصه‌ی وضعیت برای نمایش به کاربر */
export function licenseSummary() {
  const state = licenseState();
  return {
    ...state,
    expiresAtFa: state.expiresAt ? formatJalali(state.expiresAt) : '',
    issuedAtFa: state.issuedAt ? formatJalali(state.issuedAt) : '',
  };
}

/* ============================================================
   میان‌افزار
   ============================================================ */

/** مسیرهایی که به یک ماژول نیاز دارند */
export function requireModule(id) {
  return (req, res, next) => {
    if (hasModule(id)) return next();
    const mod = moduleById(id);
    res.status(403).json({
      error: `ماژول «${mod?.title || id}» روی این نسخه فعال نیست`,
      moduleRequired: id,
      moduleTitle: mod?.title || id,
    });
  };
}
