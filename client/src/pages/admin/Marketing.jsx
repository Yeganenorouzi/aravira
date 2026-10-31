import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useAsync, useApp } from '../../lib/store.jsx';
import {
  Spinner, Alert, Empty, Input, Select, Sheet, Field, Toggle, Price,
} from '../../components/ui.jsx';
import JalaliCalendar from '../../components/JalaliCalendar.jsx';
import { toPersianDigits, formatJalali, todayISO } from '@shared/jalali.js';

const BLANK_PROMO = {
  code: '', title: '', type: 'percent', value: 20,
  minAmount: 0, maxDiscount: 0, usageLimit: 0, perUserLimit: 1,
  serviceIds: [], startsAt: '', expiresAt: '', firstVisitOnly: false, active: true,
};

const BLANK_GIFT = {
  amount: 1000000, recipientName: '', recipientPhone: '',
  buyerName: '', message: '', expiresAt: '', notify: true,
};

/** انتخاب تاریخ شمسی به صورت دکمه + تقویم */
function DateButton({ value, onChange, placeholder = 'بدون محدودیت' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn outline sm" style={{ width: '100%' }} onClick={() => setOpen(true)}>
        {value ? formatJalali(value) : placeholder}
      </button>
      {value && (
        <button type="button" className="btn xs" style={{ marginTop: 6 }} onClick={() => onChange('')}>
          حذف تاریخ
        </button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="انتخاب تاریخ">
        <JalaliCalendar
          value={value || todayISO()}
          maxAdvanceDays={730}
          allowPast
          onChange={(iso) => { onChange(iso); setOpen(false); }}
        />
      </Sheet>
    </>
  );
}

export default function Marketing() {
  const { toast } = useApp();
  const [tab, setTab] = useState('promos');

  return (
    <>
      <div className="seg" style={{ maxWidth: 440 }}>
        <button className={tab === 'promos' ? 'on' : ''} onClick={() => setTab('promos')}>
          🏷️ کد تخفیف
        </button>
        <button className={tab === 'gifts' ? 'on' : ''} onClick={() => setTab('gifts')}>
          🎁 کارت هدیه
        </button>
        <button className={tab === 'reviews' ? 'on' : ''} onClick={() => setTab('reviews')}>
          ⭐ نظرها
        </button>
      </div>

      {tab === 'promos' && <Promos toast={toast} />}
      {tab === 'gifts' && <GiftCards toast={toast} />}
      {tab === 'reviews' && <Reviews toast={toast} />}
    </>
  );
}

/* ============================================================
   کدهای تخفیف
   ============================================================ */

function Promos({ toast }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK_PROMO);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const { data, loading, error, reload } = useAsync(() => api.admin.promos(), []);
  const { data: srvData } = useAsync(() => api.admin.services(), []);
  const promos = data?.promos || [];
  const services = (srvData?.services || []).filter((s) => s.active !== false);

  const open = (p) => {
    setEditing(p || 'new');
    setForm(p ? { ...BLANK_PROMO, ...p } : BLANK_PROMO);
    setErr('');
  };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleService = (id) =>
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id)
        ? f.serviceIds.filter((x) => x !== id)
        : [...f.serviceIds, id],
    }));

  async function save() {
    if (form.type === 'percent' && (form.value <= 0 || form.value > 100)) {
      return setErr('درصد تخفیف باید بین ۱ تا ۱۰۰ باشد');
    }
    if (form.value <= 0) return setErr('مقدار تخفیف باید بیشتر از صفر باشد');
    setBusy(true);
    setErr('');
    try {
      if (editing === 'new') {
        await api.admin.createPromo(form);
        toast('کد تخفیف ساخته شد');
      } else {
        await api.admin.updatePromo(editing.id, form);
        toast('تغییرات ذخیره شد');
      }
      setEditing(null);
      reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(p) {
    if (!confirm(`کد «${p.code}» حذف شود؟`)) return;
    try {
      await api.admin.deletePromo(p.id);
      toast('کد تخفیف حذف شد');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h3>کدهای تخفیف ({toPersianDigits(promos.length)})</h3>
          <button className="btn sm" onClick={() => open(null)}>+ کد تازه</button>
        </div>

        <div className="panel-body tight">
          <Alert kind="error">{error}</Alert>
          {loading ? (
            <Spinner />
          ) : promos.length === 0 ? (
            <Empty icon="🏷️" title="هنوز کد تخفیفی نساخته‌اید" text="با کد تخفیف، مشتریان تازه جذب کنید" />
          ) : (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>کد</th>
                    <th>تخفیف</th>
                    <th>شرایط</th>
                    <th>مصرف</th>
                    <th>اعتبار تا</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="cell-main ltr" style={{ letterSpacing: 1 }}>{p.code}</div>
                        <div className="cell-sub">{p.title || '—'}</div>
                      </td>
                      <td className="nowrap">
                        {p.type === 'percent'
                          ? <b>{toPersianDigits(p.value)}٪</b>
                          : <b><Price amount={p.value} /></b>}
                        {p.maxDiscount > 0 && (
                          <div className="cell-sub">سقف <Price amount={p.maxDiscount} /></div>
                        )}
                      </td>
                      <td className="cell-sub">
                        {p.minAmount > 0 && <div>حداقل <Price amount={p.minAmount} /></div>}
                        {p.firstVisitOnly && <div>فقط اولین نوبت</div>}
                        {p.serviceIds?.length > 0 && <div>{toPersianDigits(p.serviceIds.length)} خدمت خاص</div>}
                        {!p.minAmount && !p.firstVisitOnly && !p.serviceIds?.length && '—'}
                      </td>
                      <td className="nowrap">
                        {p.usageLimit > 0
                          ? `${toPersianDigits(p.usedCount || 0)} از ${toPersianDigits(p.usageLimit)}`
                          : `${toPersianDigits(p.usedCount || 0)} بار`}
                      </td>
                      <td className="cell-sub nowrap">
                        {p.expiresAt ? formatJalali(p.expiresAt, { short: true }) : 'نامحدود'}
                      </td>
                      <td>
                        <span className={'badge ' + (p.active !== false ? 'confirmed' : 'canceled')}>
                          {p.active !== false ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td className="nowrap">
                        <div className="row" style={{ gap: 6 }}>
                          <button className="btn xs soft" onClick={() => open(p)}>ویرایش</button>
                          <button className="btn xs danger" onClick={() => remove(p)}>حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Sheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'کد تخفیف تازه' : 'ویرایش کد تخفیف'}
        sub="شرایط استفاده را مشخص کنید"
      >
        <Alert kind="error">{err}</Alert>

        <div className="form-grid">
          <Field label="کد" hint={editing === 'new' ? 'خالی بگذارید تا خودکار ساخته شود' : 'کد قابل تغییر نیست'}>
            <Input
              ltr
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              disabled={editing !== 'new'}
              placeholder="NOWRUZ"
            />
          </Field>
          <Field label="عنوان">
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="جشنواره‌ی نوروزی" />
          </Field>
          <Field label="نوع تخفیف">
            <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
              <option value="percent">درصدی</option>
              <option value="amount">مبلغ ثابت</option>
            </Select>
          </Field>
          <Field label={form.type === 'percent' ? 'درصد تخفیف' : 'مبلغ تخفیف (تومان)'}>
            <Input ltr type="number" value={form.value} onChange={(e) => set('value', Number(e.target.value))} />
          </Field>
          {form.type === 'percent' && (
            <Field label="سقف تخفیف (تومان)" hint="۰ یعنی بدون سقف">
              <Input ltr type="number" value={form.maxDiscount} onChange={(e) => set('maxDiscount', Number(e.target.value))} />
            </Field>
          )}
          <Field label="حداقل مبلغ خرید" hint="۰ یعنی بدون شرط">
            <Input ltr type="number" value={form.minAmount} onChange={(e) => set('minAmount', Number(e.target.value))} />
          </Field>
          <Field label="سقف کل استفاده" hint="۰ یعنی نامحدود">
            <Input ltr type="number" value={form.usageLimit} onChange={(e) => set('usageLimit', Number(e.target.value))} />
          </Field>
          <Field label="سقف برای هر مشتری" hint="۰ یعنی نامحدود">
            <Input ltr type="number" value={form.perUserLimit} onChange={(e) => set('perUserLimit', Number(e.target.value))} />
          </Field>
          <Field label="شروع اعتبار">
            <DateButton value={form.startsAt} onChange={(v) => set('startsAt', v)} placeholder="از همین حالا" />
          </Field>
          <Field label="پایان اعتبار">
            <DateButton value={form.expiresAt} onChange={(v) => set('expiresAt', v)} />
          </Field>
        </div>

        <Field label="فقط برای این خدمات" hint="اگر چیزی انتخاب نشود، برای همه‌ی خدمات معتبر است">
          <div className="row wrap" style={{ gap: 6 }}>
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                className={'chip' + (form.serviceIds.includes(s.id) ? ' on' : '')}
                onClick={() => toggleService(s.id)}
              >
                {s.icon} {s.title}
              </button>
            ))}
          </div>
        </Field>

        <Toggle
          on={form.firstVisitOnly}
          onChange={(v) => set('firstVisitOnly', v)}
          label="فقط برای اولین نوبت"
          desc="مناسب جذب مشتری تازه"
        />
        <Toggle on={form.active !== false} onChange={(v) => set('active', v)} label="فعال" />

        <div className="btn-row mt-16">
          <button className="btn soft" onClick={() => setEditing(null)}>انصراف</button>
          <button className="btn" onClick={save} disabled={busy}>
            {busy ? <span className="spinner sm on-dark" /> : 'ذخیره'}
          </button>
        </div>
      </Sheet>
    </>
  );
}

/* ============================================================
   کارت‌های هدیه
   ============================================================ */

function GiftCards({ toast }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(BLANK_GIFT);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const { data, loading, error, reload } = useAsync(() => api.admin.giftcards(), []);
  const cards = data?.giftcards || [];
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const totalIssued = cards.reduce((s, c) => s + (Number(c.initialAmount) || 0), 0);
  const totalRemaining = cards.reduce((s, c) => s + (Number(c.balance) || 0), 0);

  async function save() {
    if (!form.amount || form.amount <= 0) return setErr('مبلغ کارت را وارد کنید');
    setBusy(true);
    setErr('');
    try {
      const res = await api.admin.createGiftCard(form);
      toast(`کارت هدیه ${res.giftcard.code} صادر شد`);
      setCreating(false);
      setForm(BLANK_GIFT);
      reload();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function resend(c) {
    try {
      await api.admin.resendGiftCard(c.id);
      toast('کارت هدیه دوباره ارسال شد');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function remove(c) {
    if (!confirm(`کارت «${c.code}» حذف شود؟`)) return;
    try {
      await api.admin.deleteGiftCard(c.id);
      toast('کارت هدیه حذف شد');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <>
      <div className="kpi-grid mt-16">
        <div className="kpi">
          <div className="ico">🎁</div>
          <div>
            <div className="v">{toPersianDigits(cards.length)}</div>
            <div className="k">کارت صادرشده</div>
          </div>
        </div>
        <div className="kpi">
          <div className="ico">💰</div>
          <div>
            <div className="v" style={{ fontSize: 16 }}><Price amount={totalIssued} /></div>
            <div className="k">مجموع مبلغ صادرشده</div>
          </div>
        </div>
        <div className="kpi">
          <div className="ico">⏳</div>
          <div>
            <div className="v" style={{ fontSize: 16 }}><Price amount={totalRemaining} /></div>
            <div className="k">مانده‌ی استفاده‌نشده</div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>کارت‌های هدیه</h3>
          <button className="btn sm" onClick={() => { setCreating(true); setErr(''); }}>
            + صدور کارت هدیه
          </button>
        </div>

        <div className="panel-body tight">
          <Alert kind="error">{error}</Alert>
          {loading ? (
            <Spinner />
          ) : cards.length === 0 ? (
            <Empty icon="🎁" title="هنوز کارت هدیه‌ای صادر نشده" text="کارت هدیه راهی عالی برای جذب مشتری تازه است" />
          ) : (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>کد</th>
                    <th>گیرنده</th>
                    <th>مبلغ اولیه</th>
                    <th>مانده</th>
                    <th>اعتبار تا</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((c) => (
                    <tr key={c.id}>
                      <td className="cell-main ltr nowrap">{c.code}</td>
                      <td>
                        <div className="cell-main">{c.recipientName || '—'}</div>
                        <div className="cell-sub ltr">{toPersianDigits(c.recipientPhone || '')}</div>
                      </td>
                      <td className="nowrap"><Price amount={c.initialAmount} /></td>
                      <td className="nowrap">
                        <b style={{ color: c.balance > 0 ? 'var(--ok)' : 'var(--muted)' }}>
                          <Price amount={c.balance} />
                        </b>
                      </td>
                      <td className="cell-sub nowrap">
                        {c.expiresAt ? formatJalali(c.expiresAt, { short: true }) : 'نامحدود'}
                      </td>
                      <td>
                        <span className={'badge ' + (c.balance > 0 && c.active !== false ? 'confirmed' : 'done')}>
                          {c.active === false ? 'غیرفعال' : c.balance > 0 ? 'قابل استفاده' : 'مصرف‌شده'}
                        </span>
                      </td>
                      <td className="nowrap">
                        <div className="row" style={{ gap: 6 }}>
                          {c.recipientPhone && (
                            <button className="btn xs soft" onClick={() => resend(c)}>ارسال مجدد</button>
                          )}
                          <button className="btn xs danger" onClick={() => remove(c)}>حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="صدور کارت هدیه"
        sub="کد کارت به صورت خودکار ساخته و برای گیرنده پیامک می‌شود"
      >
        <Alert kind="error">{err}</Alert>

        <div className="form-grid">
          <Field label="مبلغ کارت (تومان)">
            <Input ltr type="number" value={form.amount} onChange={(e) => set('amount', Number(e.target.value))} />
          </Field>
          <Field label="نام گیرنده">
            <Input value={form.recipientName} onChange={(e) => set('recipientName', e.target.value)} />
          </Field>
          <Field label="موبایل گیرنده" hint="برای ارسال کد کارت">
            <Input ltr value={form.recipientPhone} onChange={(e) => set('recipientPhone', e.target.value)} placeholder="09121234567" />
          </Field>
          <Field label="از طرف">
            <Input value={form.buyerName} onChange={(e) => set('buyerName', e.target.value)} placeholder="نام خریدار" />
          </Field>
          <Field label="اعتبار تا">
            <DateButton value={form.expiresAt} onChange={(v) => set('expiresAt', v)} />
          </Field>
          <div className="full">
            <Field label="پیام روی کارت">
              <Input as="textarea" value={form.message} onChange={(e) => set('message', e.target.value)} placeholder="تولدت مبارک 🌸" />
            </Field>
          </div>
        </div>

        <Toggle on={form.notify} onChange={(v) => set('notify', v)} label="ارسال پیامک به گیرنده" />

        <div className="btn-row mt-16">
          <button className="btn soft" onClick={() => setCreating(false)}>انصراف</button>
          <button className="btn" onClick={save} disabled={busy}>
            {busy ? <span className="spinner sm on-dark" /> : 'صدور کارت'}
          </button>
        </div>
      </Sheet>
    </>
  );
}

/* ============================================================
   نظرها
   ============================================================ */

function Reviews({ toast }) {
  const [filterState, setFilterState] = useState('');
  const [replying, setReplying] = useState(null);
  const [replyText, setReplyText] = useState('');

  const { data, loading, error, reload } = useAsync(
    () => api.admin.reviews(filterState ? { published: filterState } : {}),
    [filterState]
  );
  const reviews = data?.reviews || [];
  const summary = data?.summary;

  async function toggle(r) {
    try {
      await api.admin.updateReview(r.id, { published: !r.published });
      toast(r.published ? 'نظر پنهان شد' : 'نظر منتشر شد');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function saveReply() {
    try {
      await api.admin.updateReview(replying.id, { reply: replyText });
      toast('پاسخ ثبت شد');
      setReplying(null);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function remove(r) {
    if (!confirm('این نظر حذف شود؟')) return;
    try {
      await api.admin.deleteReview(r.id);
      toast('نظر حذف شد');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  const maxCount = Math.max(...Object.values(summary?.breakdown || { 1: 1 }), 1);

  return (
    <>
      {summary?.count > 0 && (
        <div className="panel">
          <div className="panel-head"><h3>خلاصه‌ی رضایت مشتریان</h3></div>
          <div className="panel-body">
            <div className="rating-overview">
              <div className="rating-big">
                <div className="num">{toPersianDigits(summary.average)}</div>
                <div className="review-stars">{'★'.repeat(Math.round(summary.average))}</div>
                <div className="of">از {toPersianDigits(summary.count)} نظر</div>
              </div>
              <div className="rating-bars">
                {[5, 4, 3, 2, 1].map((n) => (
                  <div className="rating-bar-row" key={n}>
                    <span>{toPersianDigits(n)} ★</span>
                    <span className="track">
                      <i style={{ width: ((summary.breakdown[n] || 0) / maxCount) * 100 + '%' }} />
                    </span>
                    <span>{toPersianDigits(summary.breakdown[n] || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h3>نظرهای مشتریان ({toPersianDigits(reviews.length)})</h3>
          <Select value={filterState} onChange={(e) => setFilterState(e.target.value)}>
            <option value="">همه</option>
            <option value="1">منتشرشده</option>
            <option value="0">پنهان</option>
          </Select>
        </div>

        <div className="panel-body">
          <Alert kind="error">{error}</Alert>
          {loading ? (
            <Spinner />
          ) : reviews.length === 0 ? (
            <Empty icon="⭐" title="هنوز نظری ثبت نشده" text="پس از انجام نوبت، از مشتری درخواست نظر می‌شود" />
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="review-item">
                <div className="review-head">
                  <span className="review-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  <span className="who">{r.userName}</span>
                  <span className="when">
                    <bdi>{formatJalali(r.createdAt.slice(0, 10), { short: true })}</bdi> • {r.serviceTitle} • {r.staffName}
                  </span>
                  <span className="grow" />
                  <span className={'badge ' + (r.published ? 'confirmed' : 'noshow')}>
                    {r.published ? 'منتشرشده' : 'پنهان'}
                  </span>
                </div>

                {r.comment && <div className="text">{r.comment}</div>}

                {r.tags?.length > 0 && (
                  <div className="review-tags">
                    {r.tags.map((t) => <span key={t}>{t}</span>)}
                  </div>
                )}

                {r.reply && <div className="review-reply">پاسخ سالن: {r.reply}</div>}

                <div className="row mt-8" style={{ gap: 6 }}>
                  <button className="btn xs soft" onClick={() => toggle(r)}>
                    {r.published ? 'پنهان کردن' : 'انتشار'}
                  </button>
                  <button
                    className="btn xs outline"
                    onClick={() => { setReplying(r); setReplyText(r.reply || ''); }}
                  >
                    {r.reply ? 'ویرایش پاسخ' : 'پاسخ'}
                  </button>
                  <button className="btn xs danger" onClick={() => remove(r)}>حذف</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Sheet
        open={Boolean(replying)}
        onClose={() => setReplying(null)}
        title="پاسخ به نظر"
        sub={replying ? `${replying.userName} — ${replying.serviceTitle}` : ''}
      >
        {replying?.comment && (
          <div className="card flat" style={{ marginBottom: 14 }}>
            <div className="small muted">{replying.comment}</div>
          </div>
        )}
        <Field label="پاسخ شما" hint="پاسخ در کنار نظر مشتری نمایش داده می‌شود">
          <Input
            as="textarea"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="از بازخورد شما سپاسگزاریم 🌸"
          />
        </Field>
        <div className="btn-row">
          <button className="btn soft" onClick={() => setReplying(null)}>انصراف</button>
          <button className="btn" onClick={saveReply}>ثبت پاسخ</button>
        </div>
      </Sheet>
    </>
  );
}
