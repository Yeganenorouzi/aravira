/** مدیریت ماژول‌ها و لایسنس (فقط مدیر) */
import express from 'express';
import { requireAdmin } from '../lib/auth.js';
import {
  moduleCatalog, licenseSummary, applyLicense, removeLicense, verifyLicense,
} from '../lib/modules.js';

const router = express.Router();
router.use(requireAdmin);

/** فهرست ماژول‌ها + وضعیت لایسنس */
router.get('/', (req, res) => {
  res.json({ modules: moduleCatalog(), license: licenseSummary() });
});

/** پیش‌نمایش یک لایسنس بدون ذخیره کردن */
router.post('/license/preview', (req, res) => {
  const result = verifyLicense(req.body?.token);
  if (!result.valid) return res.status(400).json({ error: result.error });
  res.json({
    ok: true,
    expired: Boolean(result.expired),
    payload: result.payload,
    warning: result.expired ? result.error : '',
  });
});

/** ثبت لایسنس تازه */
router.post('/license', (req, res) => {
  const result = applyLicense(req.body?.token);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({
    ok: true,
    expired: result.expired,
    license: licenseSummary(),
    modules: moduleCatalog(),
  });
});

/** حذف لایسنس (بازگشت به هسته) */
router.delete('/license', (req, res) => {
  const result = removeLicense();
  if (result?.error) return res.status(400).json({ error: result.error });
  res.json({ ok: true, license: licenseSummary(), modules: moduleCatalog() });
});

export default router;
