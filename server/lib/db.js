/**
 * ذخیره‌ساز ساده‌ی مبتنی بر فایل JSON
 * بدون وابستگی نیتیو، مناسب اجرا روی ویندوز بدون ابزار build
 * نوشتن به صورت atomic (نوشتن در فایل موقت + rename) انجام می‌شود.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY = {
  users: [],
  services: [],
  staff: [],
  appointments: [],
  otps: [],
  messages: [],
  settings: {},
  categories: [],
  offers: [],
  promos: [],      // کدهای تخفیف
  giftcards: [],   // کارت‌های هدیه
  reviews: [],     // نظر و امتیاز مشتریان
  ledger: [],      // گردش اعتبار و امتیاز مشتری
};

let cache = null;
let writeQueue = Promise.resolve();

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function load() {
  if (cache) return cache;
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    cache = structuredClone(EMPTY);
    fs.writeFileSync(DB_FILE, JSON.stringify(cache, null, 2), 'utf8');
    return cache;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    cache = { ...structuredClone(EMPTY), ...JSON.parse(raw || '{}') };
  } catch (err) {
    console.error('[db] فایل داده خوانده نشد، نسخه‌ی پشتیبان ساخته می‌شود:', err.message);
    fs.copyFileSync(DB_FILE, DB_FILE + '.corrupt-' + Date.now());
    cache = structuredClone(EMPTY);
  }
  return cache;
}

/** نوشتن صف‌بندی‌شده و atomic روی دیسک */
export function save() {
  const snapshot = JSON.stringify(cache, null, 2);
  writeQueue = writeQueue.then(async () => {
    ensureDir();
    const tmp = DB_FILE + '.' + process.pid + '.tmp';
    await fsp.writeFile(tmp, snapshot, 'utf8');
    await fsp.rename(tmp, DB_FILE);
  }).catch((err) => console.error('[db] خطا در ذخیره‌سازی:', err.message));
  return writeQueue;
}

export const db = new Proxy({}, {
  get: (_t, prop) => load()[prop],
  set: (_t, prop, value) => { load()[prop] = value; return true; },
});

export function flush() {
  return writeQueue;
}

/* ---------- ابزارهای مجموعه‌ها ---------- */

export function newId(prefix = '') {
  return prefix + crypto.randomBytes(8).toString('hex');
}

export function nowISO() {
  return new Date().toISOString();
}

export function insert(collection, doc) {
  const row = { id: doc.id || newId(), createdAt: nowISO(), ...doc };
  load()[collection].push(row);
  save();
  return row;
}

export function update(collection, id, patch) {
  const list = load()[collection];
  const i = list.findIndex((r) => r.id === id);
  if (i === -1) return null;
  list[i] = { ...list[i], ...patch, id, updatedAt: nowISO() };
  save();
  return list[i];
}

export function remove(collection, id) {
  const list = load()[collection];
  const i = list.findIndex((r) => r.id === id);
  if (i === -1) return false;
  list.splice(i, 1);
  save();
  return true;
}

export function find(collection, predicate) {
  return load()[collection].find(predicate) || null;
}

export function filter(collection, predicate) {
  return load()[collection].filter(predicate);
}

/* ---------- تنظیمات ---------- */

export const DEFAULT_SETTINGS = {
  salonName: 'سالن زیبایی رُز',
  tagline: 'زیبایی و اصالت، طراحی‌شده برای شما',
  address: 'تهران، خیابان ولیعصر، پلاک ۱۲۰',
  phone: '۰۲۱-۸۸۰۰۱۲۳۴',
  taxPercent: 9,
  depositPercent: 30,
  currency: 'تومان',
  slotStepMinutes: 30,
  maxAdvanceDays: 45,
  minLeadMinutes: 60,
  cancelWindowHours: 6,
  reminderHoursBefore: 24,
  workingHours: {
    // شنبه = 0 ... جمعه = 6
    0: { open: '09:00', close: '20:00', closed: false },
    1: { open: '09:00', close: '20:00', closed: false },
    2: { open: '09:00', close: '20:00', closed: false },
    3: { open: '09:00', close: '20:00', closed: false },
    4: { open: '09:00', close: '20:00', closed: false },
    5: { open: '10:00', close: '18:00', closed: false },
    6: { open: '00:00', close: '00:00', closed: true },
  },
  holidays: [],
  sms: {
    provider: 'console', // console | kavenegar | smsir | melipayamak
    apiKey: '',
    sender: '',
    enabled: true,
    templates: {},
  },
  email: {
    enabled: true,
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from: '',
  },
  notify: {
    onBooking: true,
    onCancel: true,
    onReminder: true,
    onBirthday: true,
    onReviewRequest: true,
    channels: { sms: true, email: true },
  },

  /* ---------- باشگاه مشتریان ---------- */
  loyalty: {
    enabled: true,
    pointsPerUnit: 10000,      // به ازای هر ۱۰٬۰۰۰ تومان خرید، ۱ امتیاز
    pointValue: 1000,          // ارزش هر امتیاز هنگام استفاده (تومان)
    minPointsToRedeem: 50,
    tiers: [
      { id: 'bronze', title: 'برنزی', icon: '🥉', minSpent: 0, discountPercent: 0, pointsMultiplier: 1 },
      { id: 'silver', title: 'نقره‌ای', icon: '🥈', minSpent: 5000000, discountPercent: 5, pointsMultiplier: 1.25 },
      { id: 'gold', title: 'طلایی', icon: '🥇', minSpent: 15000000, discountPercent: 10, pointsMultiplier: 1.5 },
    ],
  },

  /* ---------- دعوت از دوستان ---------- */
  referral: {
    enabled: true,
    referrerReward: 200000,    // اعتبار هدیه برای معرف (تومان)
    refereeReward: 150000,     // اعتبار هدیه برای کاربر تازه (تومان)
    rewardOnFirstDone: true,   // پاداش پس از اولین نوبت انجام‌شده پرداخت شود
  },

  /* ---------- نظرسنجی ---------- */
  reviews: {
    enabled: true,
    autoPublish: true,
    requestAfterHours: 2,      // چند ساعت پس از انجام نوبت، درخواست نظر ارسال شود
  },
};

export function getSettings() {
  const s = load().settings || {};
  return deepMerge(structuredClone(DEFAULT_SETTINGS), s);
}

export function saveSettings(patch) {
  load().settings = deepMerge(getSettings(), patch);
  save();
  return getSettings();
}

export function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      target[k] = deepMerge(target[k] && typeof target[k] === 'object' ? target[k] : {}, v);
    } else if (v !== undefined) {
      target[k] = v;
    }
  }
  return target;
}
