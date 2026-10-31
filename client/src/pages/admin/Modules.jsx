import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useAsync, useApp } from '../../lib/store.jsx';
import { Spinner, Alert, Input, Field, Price, Sheet } from '../../components/ui.jsx';
import { toPersianDigits } from '@shared/jalali.js';

export default function Modules() {
  const { toast } = useApp();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [preview, setPreview] = useState(null);

  const { data, loading, error, reload } = useAsync(() => api.admin.modules(), []);
  const modules = data?.modules || [];
  const license = data?.license;

  async function doPreview() {
    setErr('');
    if (!token.trim()) return setErr('توکن لایسنس را وارد کنید');
    setBusy(true);
    try {
      const res = await api.admin.previewLicense(token.trim());
      setPreview(res);
    } catch (e) {
      setErr(e.message);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function doApply() {
    setBusy(true);
    setErr('');
    try {
      const res = await api.admin.applyLicense(token.trim());
      toast(res.expired ? 'لایسنس ثبت شد اما اعتبارش تمام شده' : 'لایسنس با موفقیت فعال شد 🎉');
      setToken('');
      setPreview(null);
      reload();
      // تنظیمات عمومی باید دوباره خوانده شود تا منوها به‌روز شوند
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function doRemove() {
    if (!confirm('لایسنس حذف شود؟ همه‌ی ماژول‌های پولی غیرفعال می‌شوند.')) return;
    try {
      await api.admin.removeLicense();
      toast('لایسنس حذف شد');
      setTimeout(() => window.location.reload(), 700);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  if (loading) return <Spinner />;
  if (error) return <Alert kind="error">{error}</Alert>;

  const activeCount = modules.filter((m) => m.enabled && !m.always).length;
  const lockedPaid = modules.filter((m) => m.locked);

  return (
    <>
      {/* وضعیت لایسنس */}
      <div className={'license-card' + (license.valid ? ' ok' : license.hasLicense ? ' bad' : '')}>
        <div className="row between wrap" style={{ gap: 14 }}>
          <div>
            <div className="lic-label">وضعیت لایسنس</div>
            <div className="lic-state">
              {!license.hasLicense && 'بدون لایسنس — فقط هسته فعال است'}
              {license.hasLicense && license.valid && 'فعال'}
              {license.hasLicense && license.expired && 'اعتبار تمام شده'}
              {license.hasLicense && !license.valid && !license.expired && (license.error || 'نامعتبر')}
            </div>
            {license.salon && (
              <div className="lic-meta">
                {license.salon}
                {license.licenseId && <> — شناسه {license.licenseId}</>}
              </div>
            )}
          </div>

          <div className="lic-right">
            <div className="lic-count">{toPersianDigits(activeCount)}</div>
            <div className="lic-count-k">ماژول فعال</div>
          </div>
        </div>

        {license.valid && license.expiresAtFa && (
          <div className="lic-meta mt-8">
            اعتبار تا <b>{license.expiresAtFa}</b>
            {license.daysLeft !== null && (
              <> — <bdi>{toPersianDigits(license.daysLeft)} روز</bdi> باقی مانده</>
            )}
          </div>
        )}
        {license.valid && license.daysLeft !== null && license.daysLeft <= 30 && (
          <Alert kind="warn">
            اعتبار لایسنس رو به پایان است. برای تمدید با پشتیبانی تماس بگیرید.
          </Alert>
        )}
        {license.envManaged && (
          <Alert kind="info">
            این لایسنس از طریق متغیر محیطی سرور (<span className="ltr">LICENSE</span>) تنظیم شده و
            از پنل قابل تغییر نیست.
          </Alert>
        )}
      </div>

      {/* فهرست ماژول‌ها */}
      <div className="module-grid">
        {modules.map((m) => (
          <div key={m.id} className={'module-card' + (m.enabled ? ' on' : '')}>
            <div className="mod-head">
              <span className="mod-icon">{m.icon}</span>
              <div className="grow">
                <div className="mod-title">{m.title}</div>
                <div className="mod-summary">{m.summary}</div>
              </div>
              <span className={'badge ' + (m.enabled ? 'confirmed' : m.implemented ? 'noshow' : 'pending')}>
                {m.enabled ? 'فعال' : m.implemented ? 'غیرفعال' : 'به‌زودی'}
              </span>
            </div>

            <ul className="mod-features">
              {m.features.map((f) => (
                <li key={f}>
                  <span className={m.enabled ? 'tick on' : 'tick'}>{m.enabled ? '✓' : '•'}</span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="mod-foot">
              {m.always ? (
                <span className="mod-price free">همیشه فعال</span>
              ) : (
                <span className="mod-price">
                  <Price amount={m.price} />
                  <small> / سالانه</small>
                </span>
              )}
              {!m.enabled && m.implemented && (
                <span className="small muted">برای فعال‌سازی لایسنس بگیرید</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ثبت لایسنس */}
      {!license.envManaged && (
        <div className="panel">
          <div className="panel-head">
            <h3>ثبت لایسنس</h3>
            {license.hasLicense && (
              <button className="btn outline sm" onClick={doRemove}>حذف لایسنس فعلی</button>
            )}
          </div>
          <div className="panel-body">
            <Alert kind="error">{err}</Alert>

            {lockedPaid.some((m) => m.implemented) && (
              <Alert kind="info">
                برای فعال کردن ماژول‌های قفل‌شده، توکن لایسنس را از پشتیبانی دریافت و اینجا وارد کنید.
              </Alert>
            )}

            <Field label="توکن لایسنس" hint="متن کاملی که از پشتیبانی دریافت کرده‌اید را اینجا بچسبانید">
              <Input
                as="textarea"
                ltr
                value={token}
                onChange={(e) => { setToken(e.target.value); setPreview(null); }}
                placeholder="SALON1...."
                style={{ minHeight: 90, fontSize: 12, wordBreak: 'break-all' }}
              />
            </Field>

            {preview && (
              <div className="card flat" style={{ marginBottom: 14 }}>
                <div className="bold small" style={{ marginBottom: 8 }}>محتوای لایسنس</div>
                <div className="detail-line">
                  <span className="ico">🏪</span>
                  <span className="txt"><span className="k">سالن</span>
                    <div className="v">{preview.payload.salon}</div></span>
                </div>
                <div className="detail-line">
                  <span className="ico">📦</span>
                  <span className="txt"><span className="k">ماژول‌ها</span>
                    <div className="v">
                      {(preview.payload.modules || []).length
                        ? preview.payload.modules
                            .map((id) => modules.find((m) => m.id === id)?.title || id)
                            .join('، ')
                        : 'فقط هسته'}
                    </div></span>
                </div>
                {preview.warning && <Alert kind="warn">{preview.warning}</Alert>}
              </div>
            )}

            <div className="row" style={{ gap: 10 }}>
              <button className="btn outline sm" onClick={doPreview} disabled={busy || !token.trim()}>
                بررسی
              </button>
              <button className="btn sm" onClick={doApply} disabled={busy || !token.trim()}>
                {busy ? <span className="spinner sm on-dark" /> : 'فعال‌سازی'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
