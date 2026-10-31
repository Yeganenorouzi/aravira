/**
 * داده‌ی اولیه‌ی نمونه.
 * با `npm run seed` یا هنگام اولین اجرای سرور ساخته می‌شود.
 */
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, load, save, insert, newId, getSettings, saveSettings, DEFAULT_SETTINGS } from './lib/db.js';
import { todayISO, addDays } from '../shared/jalali.js';
import { createPromo, createGiftCard } from './lib/promos.js';
import { issueLicense, MODULE_IDS, clearLicenseCache } from './lib/modules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CATEGORIES = [
  { id: 'cat-hair', title: 'مو', icon: '💇‍♀️', order: 1 },
  { id: 'cat-skin', title: 'پوست و صورت', icon: '🧖‍♀️', order: 2 },
  { id: 'cat-nail', title: 'ناخن', icon: '💅', order: 3 },
  { id: 'cat-makeup', title: 'آرایش', icon: '💄', order: 4 },
  { id: 'cat-spa', title: 'اسپا و ماساژ', icon: '🌿', order: 5 },
];

const SERVICES = [
  {
    id: 'srv-cut', title: 'کوتاهی و براشینگ', categoryId: 'cat-hair', icon: '✂️',
    description: 'کوتاهی تخصصی مو همراه با براشینگ و حالت‌دهی نهایی با محصولات حرفه‌ای.',
    price: 850000, duration: 60, popular: true, discountPercent: 0,
    gradient: 'linear-gradient(135deg,#f3a6ae,#e0828c)',
  },
  {
    id: 'srv-color', title: 'رنگ مو', categoryId: 'cat-hair', icon: '🎨',
    description: 'رنگ‌آمیزی کامل مو با رنگ‌های بدون آمونیاک و متناسب با رنگ پوست شما.',
    price: 1850000, duration: 120, popular: true, discountPercent: 20,
    gradient: 'linear-gradient(135deg,#c98bb2,#a56ba8)',
  },
  {
    id: 'srv-highlight', title: 'هایلایت و بالیاژ', categoryId: 'cat-hair', icon: '✨',
    description: 'تکنیک بالیاژ و هایلایت برای ایجاد عمق و درخشندگی طبیعی در مو.',
    price: 2600000, duration: 180, popular: true, discountPercent: 0,
    gradient: 'linear-gradient(135deg,#e8b98a,#d99a63)',
  },
  {
    id: 'srv-keratin', title: 'کراتینه و احیای مو', categoryId: 'cat-hair', icon: '🧴',
    description: 'صاف و احیا کردن موهای آسیب‌دیده با کراتین اصل و ماندگاری بالا.',
    price: 3200000, duration: 150, popular: false, discountPercent: 10,
    gradient: 'linear-gradient(135deg,#9ac4d8,#6fa3bd)',
  },
  {
    id: 'srv-facial', title: 'پاکسازی و فیشیال', categoryId: 'cat-skin', icon: '🧖‍♀️',
    description: 'پاکسازی عمیق پوست، میکرودرم و ماسک آبرسان برای شادابی و روشنی پوست.',
    price: 1200000, duration: 75, popular: true, discountPercent: 0,
    gradient: 'linear-gradient(135deg,#a8d5c3,#7cbfa5)',
  },
  {
    id: 'srv-brow', title: 'اصلاح و طراحی ابرو', categoryId: 'cat-skin', icon: '👁️',
    description: 'اصلاح صورت و طراحی ابرو متناسب با فرم چهره.',
    price: 350000, duration: 30, popular: true, discountPercent: 0,
    gradient: 'linear-gradient(135deg,#d7a9c9,#bd84ae)',
  },
  {
    id: 'srv-mani', title: 'مانیکور و لاک ژل', categoryId: 'cat-nail', icon: '💅',
    description: 'مانیکور کامل، فرم‌دهی ناخن و اجرای لاک ژل با ماندگاری سه هفته.',
    price: 750000, duration: 60, popular: true, discountPercent: 0,
    gradient: 'linear-gradient(135deg,#f2a9b8,#e07f95)',
  },
  {
    id: 'srv-pedi', title: 'پدیکور', categoryId: 'cat-nail', icon: '🦶',
    description: 'پدیکور تخصصی همراه با اسکراب، ماساژ و لاک.',
    price: 680000, duration: 60, popular: false, discountPercent: 0,
    gradient: 'linear-gradient(135deg,#b9b4e0,#8d86cc)',
  },
  {
    id: 'srv-makeup', title: 'میکاپ مجلسی', categoryId: 'cat-makeup', icon: '💄',
    description: 'آرایش مجلسی با محصولات برند، شامل پایه، سایه و مژه.',
    price: 2400000, duration: 90, popular: true, discountPercent: 0,
    gradient: 'linear-gradient(135deg,#e88fa0,#cf6579)',
  },
  {
    id: 'srv-bride', title: 'میکاپ عروس', categoryId: 'cat-makeup', icon: '👰',
    description: 'پکیج کامل عروس شامل میکاپ، شینیون، اصلاح و تست گریم.',
    price: 12500000, duration: 300, popular: false, discountPercent: 0,
    gradient: 'linear-gradient(135deg,#f0d3a7,#dcb173)',
  },
  {
    id: 'srv-massage', title: 'ماساژ ریلکسی', categoryId: 'cat-spa', icon: '🌿',
    description: 'ماساژ آرام‌بخش تمام بدن با روغن‌های گیاهی در فضایی آرام.',
    price: 1500000, duration: 90, popular: false, discountPercent: 15,
    gradient: 'linear-gradient(135deg,#9fd0c0,#6cae9b)',
  },
  {
    id: 'srv-hairspa', title: 'هیر اسپا', categoryId: 'cat-spa', icon: '💆‍♀️',
    description: 'ماساژ سر و درمان تخصصی پوست سر برای تقویت ریشه‌ی مو.',
    price: 980000, duration: 60, popular: true, discountPercent: 0,
    gradient: 'linear-gradient(135deg,#f0b3bb,#dd8591)',
  },
];

const STAFF = [
  {
    id: 'stf-sara', name: 'سارا جوادی', title: 'متخصص رنگ و مو', avatar: '👩‍🦰',
    bio: 'با بیش از ۱۰ سال سابقه در رنگ، بالیاژ و احیای مو.',
    rating: 4.9, reviews: 120,
    serviceIds: ['srv-cut', 'srv-color', 'srv-highlight', 'srv-keratin', 'srv-hairspa'],
    offDays: [6], shift: { open: '09:00', close: '19:00' },
  },
  {
    id: 'stf-nasim', name: 'نسیم رضایی', title: 'میکاپ آرتیست', avatar: '💃',
    bio: 'میکاپ آرتیست عروس و مجلسی، فارغ‌التحصیل دوره‌های بین‌المللی.',
    rating: 4.8, reviews: 98,
    serviceIds: ['srv-makeup', 'srv-bride', 'srv-brow'],
    offDays: [6], shift: { open: '10:00', close: '20:00' },
  },
  {
    id: 'stf-mahsa', name: 'مهسا کریمی', title: 'ناخن‌کار حرفه‌ای', avatar: '👩',
    bio: 'طراحی ناخن، کاشت و لاک ژل با بالاترین کیفیت.',
    rating: 5, reviews: 143,
    serviceIds: ['srv-mani', 'srv-pedi'],
    offDays: [5, 6], shift: { open: '09:00', close: '18:00' },
  },
  {
    id: 'stf-elham', name: 'الهام مرادی', title: 'متخصص پوست و اسپا', avatar: '🧕',
    bio: 'پاکسازی پوست، فیشیال تخصصی و ماساژ درمانی.',
    rating: 4.7, reviews: 76,
    serviceIds: ['srv-facial', 'srv-brow', 'srv-massage', 'srv-hairspa'],
    offDays: [6], shift: { open: '11:00', close: '20:00' },
  },
];

const OFFERS = [
  {
    id: 'off-color', title: '۲۰٪ تخفیف رنگ مو', subtitle: 'فقط تا پایان این هفته',
    percent: 20, gradient: 'linear-gradient(135deg,#e0828c,#b8566a)', serviceId: 'srv-color',
  },
  {
    id: 'off-spa', title: 'پکیج اسپا و ماساژ', subtitle: '۱۵٪ تخفیف ویژه‌ی اعضای باشگاه',
    percent: 15, gradient: 'linear-gradient(135deg,#6cae9b,#3f8873)', serviceId: 'srv-massage',
  },
  {
    id: 'off-keratin', title: 'کراتینه با ۱۰٪ تخفیف', subtitle: 'ویژه‌ی نوبت‌های روزهای ابتدای هفته',
    percent: 10, gradient: 'linear-gradient(135deg,#6fa3bd,#44748d)', serviceId: 'srv-keratin',
  },
];

export function ensureSeed({ force = false } = {}) {
  load();
  const already = db.services.length > 0;
  if (already && !force) return { seeded: false };

  if (force) {
    db.services = [];
    db.staff = [];
    db.categories = [];
    db.offers = [];
    db.appointments = [];
    db.messages = [];
    db.users = db.users.filter((u) => u.role === 'admin');
  }

  db.categories = CATEGORIES.map((c) => ({ ...c, createdAt: new Date().toISOString() }));
  db.services = SERVICES.map((s) => ({ ...s, active: true, image: '', createdAt: new Date().toISOString() }));
  db.staff = STAFF.map((s) => ({ ...s, active: true, vacations: [], createdAt: new Date().toISOString() }));
  db.offers = OFFERS.map((o) => ({ ...o, active: true, expiresAt: addDays(todayISO(), 30), createdAt: new Date().toISOString() }));

  // حساب مدیر
  if (!db.users.some((u) => u.role === 'admin')) {
    insert('users', {
      id: 'usr-admin',
      role: 'admin',
      username: 'admin',
      name: 'مدیر سالن',
      phone: '09120000000',
      email: '',
      passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10),
    });
  }

  // مشتری نمونه + چند نوبت
  let demo = db.users.find((u) => u.phone === '09121234567');
  if (!demo) {
    demo = insert('users', {
      id: 'usr-demo',
      role: 'customer',
      name: 'مهسا احمدی',
      phone: '09121234567',
      email: '',
      birthday: '',
      points: 320,
      visits: 4,
      totalSpent: 5400000,
      lastVisit: addDays(todayISO(), -12),
      phoneVerified: true,
    });
  }

  const demoAppointments = [
    { serviceId: 'srv-cut', staffId: 'stf-sara', date: addDays(todayISO(), 2), time: '11:00', status: 'confirmed' },
    { serviceId: 'srv-mani', staffId: 'stf-mahsa', date: addDays(todayISO(), 6), time: '15:30', status: 'pending' },
    { serviceId: 'srv-facial', staffId: 'stf-elham', date: addDays(todayISO(), -12), time: '13:00', status: 'done' },
    { serviceId: 'srv-color', staffId: 'stf-sara', date: addDays(todayISO(), -28), time: '10:00', status: 'done' },
  ];

  const settings = getSettings();
  for (const a of demoAppointments) {
    const srv = db.services.find((s) => s.id === a.serviceId);
    const subtotal = srv.price;
    const discount = Math.round((subtotal * (srv.discountPercent || 0)) / 100);
    const tax = Math.round(((subtotal - discount) * settings.taxPercent) / 100);
    insert('appointments', {
      code: String(100000 + Math.floor(Math.random() * 899999)),
      userId: demo.id,
      serviceTitle: srv.title,
      duration: srv.duration,
      paymentMethod: 'cash',
      paymentStatus: a.status === 'done' ? 'paid' : 'unpaid',
      subtotal,
      discount,
      discountPercent: srv.discountPercent || 0,
      tax,
      taxPercent: settings.taxPercent,
      total: subtotal - discount + tax,
      deposit: Math.round(((subtotal - discount + tax) * settings.depositPercent) / 100),
      ...a,
    });
  }

  // کدهای تخفیف نمونه
  db.promos = [];
  db.giftcards = [];
  db.reviews = [];
  db.ledger = [];

  const promoSamples = [
    {
      code: 'WELCOME30', title: 'خوش‌آمدگویی مشتری تازه', type: 'percent', value: 30,
      maxDiscount: 500000, usageLimit: 0, perUserLimit: 1, firstVisitOnly: true,
      expiresAt: addDays(todayISO(), 90),
    },
    {
      code: 'NOWRUZ', title: 'جشنواره‌ی نوروزی', type: 'percent', value: 15,
      minAmount: 1000000, maxDiscount: 800000, usageLimit: 100, perUserLimit: 1,
      expiresAt: addDays(todayISO(), 45),
    },
    {
      code: 'HAIR200', title: '۲۰۰ هزار تومان تخفیف خدمات مو', type: 'amount', value: 200000,
      minAmount: 1500000, usageLimit: 50, perUserLimit: 1,
      serviceIds: ['srv-color', 'srv-highlight', 'srv-keratin'],
      expiresAt: addDays(todayISO(), 60),
    },
  ];
  for (const p of promoSamples) {
    try { createPromo(p); } catch { /* کد تکراری */ }
  }

  // کارت هدیه‌ی نمونه
  try {
    createGiftCard({
      code: 'GIFT-2026', amount: 1000000,
      recipientName: 'مهسا احمدی', recipientPhone: '09121234567',
      buyerName: 'سالن زیبایی رُز', message: 'هدیه‌ای کوچک برای شما 🌸',
      expiresAt: addDays(todayISO(), 180),
    });
  } catch { /* موجود است */ }

  if (!db.settings?.salonName) saveSettings(DEFAULT_SETTINGS);

  // لایسنس توسعه: فقط وقتی کلید خصوصی فروشنده روی همین دستگاه باشد.
  // روی نصب مشتری این فایل وجود ندارد، پس فقط هسته فعال می‌ماند.
  try {
    const keyFile = path.join(__dirname, '..', 'license-private.pem');
    if (fs.existsSync(keyFile) && !process.env.LICENSE) {
      const paid = MODULE_IDS.filter((id) => id !== 'core');
      const token = issueLicense(
        {
          v: 1,
          salon: DEFAULT_SETTINGS.salonName,
          licenseId: 'LIC-DEV',
          modules: paid,
          issuedAt: todayISO(),
          expiresAt: addDays(todayISO(), 365),
          customer: 'نسخه‌ی توسعه',
        },
        fs.readFileSync(keyFile, 'utf8')
      );
      saveSettings({ license: token });
      clearLicenseCache();
      console.log('[seed] لایسنس توسعه ساخته شد (همه‌ی ماژول‌ها فعال)');
    }
  } catch (err) {
    console.warn('[seed] ساخت لایسنس توسعه انجام نشد:', err.message);
  }

  save();
  console.log('[seed] داده‌ی نمونه ساخته شد (مدیر: admin / ' + (process.env.ADMIN_PASSWORD || 'admin123') + ')');
  return { seeded: true };
}

// اجرای مستقیم: node server/seed.js --force
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  ensureSeed({ force: process.argv.includes('--force') });
  setTimeout(() => process.exit(0), 200);
}
