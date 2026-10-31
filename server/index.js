/** نقطه‌ی ورود سرور */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { load, flush } from './lib/db.js';
import { ensureSeed } from './seed.js';
import { startScheduler, stopScheduler } from './lib/notify.js';
import { licenseSummary, moduleById, enabledModules } from './lib/modules.js';

import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import appointmentRoutes from './routes/appointments.js';
import adminRoutes from './routes/admin.js';
import marketingRoutes from './routes/marketing.js';
import moduleRoutes from './routes/modules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');

load();
ensureSeed();

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api', marketingRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin/modules', moduleRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'مسیر موردنظر پیدا نشد' }));

// سرو کردن نسخه‌ی build شده‌ی کلاینت (در صورت وجود)
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
} else {
  app.get('/', (req, res) =>
    res
      .type('html')
      .send(
        '<div style="font-family:Tahoma;direction:rtl;padding:40px;text-align:center">' +
          '<h2>سرور فعال است ✅</h2>' +
          '<p>رابط کاربری هنوز build نشده است. برای حالت توسعه <code>npm run dev</code> و سپس آدرس <code>http://localhost:5173</code> را باز کنید.</p>' +
          '</div>'
      )
  );
}

// مدیریت خطاهای پیش‌بینی‌نشده
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'خطای داخلی سرور' });
});

const server = app.listen(PORT, () => {
  console.log(`\n🌸 سرور نوبت‌دهی روی http://localhost:${PORT} اجرا شد`);
  if (!fs.existsSync(CLIENT_DIST)) {
    console.log('   رابط کاربری (حالت توسعه): http://localhost:5173');
  }
  startScheduler();
});

async function shutdown(signal) {
  console.log(`\n[${signal}] در حال بستن سرور...`);
  stopScheduler();
  await flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;
