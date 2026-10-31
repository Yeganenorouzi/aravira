#!/usr/bin/env node
/**
 * ابزار صدور لایسنس — فقط برای فروشنده.
 *
 *   node scripts/license.js keygen
 *       یک‌بار اجرا می‌شود و جفت کلید می‌سازد.
 *       کلید خصوصی (license-private.pem) را هرگز به مشتری ندهید.
 *
 *   node scripts/license.js issue --salon "سالن رز" --modules marketing,notifications --months 12
 *       توکن لایسنس می‌سازد تا مشتری در پنل وارد کند.
 *
 *   node scripts/license.js verify <token>
 *       اعتبار یک توکن را بررسی می‌کند.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { issueLicense, verifyLicense, MODULES, MODULE_IDS } from '../server/lib/modules.js';
import { todayISO, addDays, formatJalali, toJalali, toGregorianISO } from '../shared/jalali.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PRIVATE_FILE = path.join(ROOT, 'license-private.pem');
const PUBLIC_FILE = path.join(ROOT, 'server', 'license-public.pem');

/* ---------- خواندن آرگومان‌ها ---------- */
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

/* ---------- ساخت جفت کلید ---------- */
function keygen() {
  if (fs.existsSync(PRIVATE_FILE) && !args.force) {
    console.error('\n⚠️  کلید خصوصی از قبل وجود دارد: ' + PRIVATE_FILE);
    console.error('   ساخت دوباره، همه‌ی لایسنس‌های صادرشده را باطل می‌کند.');
    console.error('   اگر مطمئن هستید: node scripts/license.js keygen --force\n');
    process.exit(1);
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const priv = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const pub = publicKey.export({ type: 'spki', format: 'pem' });

  fs.writeFileSync(PRIVATE_FILE, priv, 'utf8');
  fs.writeFileSync(PUBLIC_FILE, pub, 'utf8');

  console.log('\n✅ جفت کلید ساخته شد\n');
  console.log('  کلید خصوصی (نزد شما بماند): ' + PRIVATE_FILE);
  console.log('  کلید عمومی (همراه برنامه):  ' + PUBLIC_FILE);
  console.log('\n⚠️  از کلید خصوصی نسخه‌ی پشتیبان بگیرید. اگر گم شود، دیگر نمی‌توانید');
  console.log('   لایسنس تازه صادر کنید و باید کلید عمومی همه‌ی نصب‌ها را عوض کنید.\n');
}

/* ---------- صدور لایسنس ---------- */
function issue() {
  if (!fs.existsSync(PRIVATE_FILE)) {
    console.error('\n❌ کلید خصوصی پیدا نشد. ابتدا اجرا کنید: node scripts/license.js keygen\n');
    process.exit(1);
  }

  const salon = args.salon || args.s;
  if (!salon || salon === true) {
    console.error('\n❌ نام سالن الزامی است:  --salon "نام سالن"\n');
    process.exit(1);
  }

  const paid = MODULE_IDS.filter((id) => id !== 'core');
  let modules;
  if (args.all) {
    modules = paid;
  } else if (args.modules && args.modules !== true) {
    modules = String(args.modules).split(',').map((m) => m.trim()).filter(Boolean);
  } else {
    modules = [];
  }

  const unknown = modules.filter((m) => !MODULE_IDS.includes(m));
  if (unknown.length) {
    console.error(`\n❌ ماژول ناشناخته: ${unknown.join(', ')}`);
    console.error(`   ماژول‌های موجود: ${paid.join(', ')}\n`);
    process.exit(1);
  }

  // تاریخ انقضا: --months یا --expires (شمسی ۱۴۰۵/۱۲/۲۹ یا میلادی)
  let expiresAt = '';
  if (args.expires && args.expires !== true) {
    const v = String(args.expires).trim();
    if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(v)) {
      const [y, m, d] = v.split(/[/-]/).map(Number);
      expiresAt = y < 1700 ? toGregorianISO(y, m, d) : `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    } else {
      console.error('\n❌ قالب تاریخ نامعتبر. مثال: --expires 1406/09/30\n');
      process.exit(1);
    }
  } else if (args.perpetual) {
    expiresAt = '';
  } else {
    const months = Number(args.months) || 12;
    expiresAt = addDays(todayISO(), Math.round(months * 30.44));
  }

  const payload = {
    v: 1,
    salon,
    licenseId: 'LIC-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
    modules,
    issuedAt: todayISO(),
    expiresAt,
    customer: args.customer && args.customer !== true ? String(args.customer) : '',
  };

  const privateKey = fs.readFileSync(PRIVATE_FILE, 'utf8');
  const token = issueLicense(payload, privateKey);

  console.log('\n✅ لایسنس صادر شد\n');
  console.log('  سالن:        ' + payload.salon);
  console.log('  شناسه:       ' + payload.licenseId);
  console.log('  ماژول‌ها:    ' + (modules.length ? modules.join('، ') : 'فقط هسته'));
  console.log('  صدور:        ' + formatJalali(payload.issuedAt));
  console.log('  اعتبار تا:   ' + (expiresAt ? formatJalali(expiresAt) : 'دائمی'));
  console.log('\n  توکن (برای مشتری ارسال کنید):\n');
  console.log(token);
  console.log('');

  if (args.out && args.out !== true) {
    fs.writeFileSync(args.out, token, 'utf8');
    console.log('  در فایل ذخیره شد: ' + args.out + '\n');
  }
}

/* ---------- بررسی لایسنس ---------- */
function verify() {
  const token = args._[1] || args.token;
  if (!token) {
    console.error('\n❌ توکن را وارد کنید: node scripts/license.js verify <token>\n');
    process.exit(1);
  }
  const res = verifyLicense(token);
  if (!res.valid) {
    console.error('\n❌ نامعتبر: ' + res.error + '\n');
    process.exit(1);
  }
  console.log('\n' + (res.expired ? '⚠️  امضا درست است ولی اعتبار تمام شده' : '✅ لایسنس معتبر است') + '\n');
  console.log('  سالن:      ' + res.payload.salon);
  console.log('  شناسه:     ' + res.payload.licenseId);
  console.log('  ماژول‌ها:  ' + (res.payload.modules?.join('، ') || 'فقط هسته'));
  console.log('  اعتبار تا: ' + (res.payload.expiresAt ? formatJalali(res.payload.expiresAt) : 'دائمی'));
  console.log('');
}

/* ---------- فهرست ماژول‌ها ---------- */
function list() {
  console.log('\nماژول‌های قابل فروش:\n');
  for (const m of MODULES) {
    const tag = m.always ? '[همیشه فعال]' : m.implemented ? '' : '[به‌زودی]';
    const price = m.price ? m.price.toLocaleString('fa-IR') + ' تومان' : '—';
    console.log(`  ${m.icon}  ${m.id.padEnd(14)} ${m.title}  ${tag}`);
    console.log(`     قیمت: ${price}`);
    console.log(`     ${m.summary}\n`);
  }
}

/* ---------- اجرا ---------- */
switch (cmd) {
  case 'keygen': keygen(); break;
  case 'issue': issue(); break;
  case 'verify': verify(); break;
  case 'list': list(); break;
  default:
    console.log(`
ابزار لایسنس سامانه‌ی نوبت‌دهی

  node scripts/license.js keygen
      ساخت جفت کلید (یک‌بار، در ابتدای کار)

  node scripts/license.js list
      نمایش ماژول‌ها و قیمت‌ها

  node scripts/license.js issue --salon "سالن رز" --modules marketing,notifications
      صدور لایسنس ۱۲ ماهه

      --all                همه‌ی ماژول‌ها
      --months 6           مدت اعتبار به ماه (پیش‌فرض ۱۲)
      --expires 1406/09/30 تاریخ انقضای مشخص (شمسی)
      --perpetual          بدون انقضا
      --customer "نام"     نام خریدار (اختیاری)
      --out license.txt    ذخیره در فایل

  node scripts/license.js verify <token>
      بررسی یک لایسنس
`);
}
