import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useAsync, useApp } from '../../lib/store.jsx';
import { Spinner, Alert, Empty, Input, Sheet, Field, Price, Toggle } from '../../components/ui.jsx';
import { toPersianDigits, formatJalali } from '@shared/jalali.js';

export default function Customers() {
  const { toast } = useApp();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [crediting, setCrediting] = useState(null);
  const [creditForm, setCreditForm] = useState({ amount: 0, points: 0, note: '' });
  const [ledger, setLedger] = useState(null);

  const { data, loading, error, reload } = useAsync(() => api.admin.customers({ q }), [q]);
  const customers = data?.customers || [];

  const open = (c) => {
    setEditing(c);
    setForm({ name: c.name || '', email: c.email || '', notes: c.notes || '', points: c.points || 0, blocked: Boolean(c.blocked) });
  };

  async function save() {
    setBusy(true);
    try {
      await api.admin.updateCustomer(editing.id, form);
      toast('اطلاعات مشتری ذخیره شد');
      setEditing(null);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h3>باشگاه مشتریان ({toPersianDigits(customers.length)})</h3>
          <Input
            icon="🔍"
            placeholder="جستجوی نام، شماره یا ایمیل"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 220 }}
          />
        </div>

        <div className="panel-body tight">
          <Alert kind="error">{error}</Alert>
          {loading ? (
            <Spinner />
          ) : customers.length === 0 ? (
            <Empty icon="👥" title="مشتری‌ای پیدا نشد" />
          ) : (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>مشتری</th>
                    <th>نوبت‌ها</th>
                    <th>مجموع خرید</th>
                    <th>سطح</th>
                    <th>امتیاز / اعتبار</th>
                    <th>دعوت</th>
                    <th>آخرین مراجعه</th>
                    <th>تولد</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="row" style={{ gap: 10 }}>
                          <div className="avatar sm">{c.gender === 'male' ? '👨' : '👩'}</div>
                          <div>
                            <div className="cell-main">
                              {c.name || 'بدون نام'}
                              {c.blocked && <span className="badge canceled" style={{ marginInlineStart: 6 }}>مسدود</span>}
                            </div>
                            <div className="cell-sub ltr">{toPersianDigits(c.phone)}</div>
                            {c.email && <div className="cell-sub ltr">{c.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="cell-main">{toPersianDigits(c.appointmentsCount)}</div>
                        <div className="cell-sub">
                          {toPersianDigits(c.doneCount)} انجام‌شده
                          {c.canceledCount > 0 && <> • <bdi>{toPersianDigits(c.canceledCount)} لغو</bdi></>}
                        </div>
                      </td>
                      <td className="nowrap"><Price amount={c.totalSpent || 0} /></td>
                      <td className="nowrap">
                        {c.tierTitle ? (
                          <span className="badge rose">{c.tierIcon} {c.tierTitle}</span>
                        ) : '—'}
                      </td>
                      <td className="nowrap">
                        <div className="cell-main">{toPersianDigits(c.points || 0)} امتیاز</div>
                        {c.credit > 0 && (
                          <div className="cell-sub" style={{ color: 'var(--ok)' }}>
                            <Price amount={c.credit} /> اعتبار
                          </div>
                        )}
                      </td>
                      <td className="nowrap">
                        {c.referralCount > 0 ? `${toPersianDigits(c.referralCount)} نفر` : '—'}
                      </td>
                      <td className="cell-sub nowrap">
                        {c.lastVisit ? formatJalali(c.lastVisit, { short: true }) : '—'}
                      </td>
                      <td className="cell-sub nowrap">
                        {c.birthday ? formatJalali(c.birthday, { short: true }) : '—'}
                      </td>
                      <td className="nowrap">
                        <div className="row" style={{ gap: 6 }}>
                          <button className="btn xs soft" onClick={() => open(c)}>ویرایش</button>
                          <button
                            className="btn xs outline"
                            onClick={() => { setCrediting(c); setCreditForm({ amount: 0, points: 0, note: '' }); }}
                          >
                            شارژ
                          </button>
                          <button
                            className="btn xs outline"
                            onClick={async () => {
                              const res = await api.admin.customerLedger(c.id);
                              setLedger({ customer: c, entries: res.entries });
                            }}
                          >
                            گردش
                          </button>
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
        open={Boolean(crediting)}
        onClose={() => setCrediting(null)}
        title="شارژ اعتبار و امتیاز"
        sub={crediting ? `${crediting.name || 'مشتری'} — ${toPersianDigits(crediting.phone)}` : ''}
      >
        <div className="form-grid">
          <Field label="افزودن اعتبار (تومان)" hint="عدد منفی برای کسر">
            <Input ltr type="number" value={creditForm.amount}
              onChange={(e) => setCreditForm({ ...creditForm, amount: Number(e.target.value) })} />
          </Field>
          <Field label="افزودن امتیاز" hint="عدد منفی برای کسر">
            <Input ltr type="number" value={creditForm.points}
              onChange={(e) => setCreditForm({ ...creditForm, points: Number(e.target.value) })} />
          </Field>
          <div className="full">
            <Field label="علت" hint="در گردش حساب مشتری ثبت می‌شود">
              <Input value={creditForm.note}
                onChange={(e) => setCreditForm({ ...creditForm, note: e.target.value })}
                placeholder="مثلاً عذرخواهی بابت تأخیر" />
            </Field>
          </div>
        </div>
        <div className="btn-row mt-8">
          <button className="btn soft" onClick={() => setCrediting(null)}>انصراف</button>
          <button
            className="btn"
            onClick={async () => {
              try {
                await api.admin.grantCredit(crediting.id, creditForm);
                toast('حساب مشتری به‌روز شد');
                setCrediting(null);
                reload();
              } catch (e) {
                toast(e.message, 'error');
              }
            }}
          >
            ثبت
          </button>
        </div>
      </Sheet>

      <Sheet
        open={Boolean(ledger)}
        onClose={() => setLedger(null)}
        title="گردش امتیاز و اعتبار"
        sub={ledger ? ledger.customer.name || 'مشتری' : ''}
      >
        {!ledger?.entries?.length ? (
          <Empty icon="📜" title="گردشی ثبت نشده" />
        ) : (
          ledger.entries.map((e) => {
            const positive = (e.points || e.credit) > 0;
            return (
              <div key={e.id} className="ledger-row">
                <span className={'ledger-sign ' + (positive ? 'plus' : 'minus')}>{positive ? '+' : '−'}</span>
                <div className="grow">
                  <div className="small bold">{e.note || e.kind}</div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {formatJalali(e.createdAt.slice(0, 10), { short: true })}
                  </div>
                </div>
                <div className={'ledger-amount ' + (positive ? 'plus' : 'minus')}>
                  {e.kind === 'points'
                    ? `${toPersianDigits(Math.abs(e.points))} امتیاز`
                    : <Price amount={Math.abs(e.credit)} />}
                </div>
              </div>
            );
          })
        )}
        <button className="btn soft mt-16" onClick={() => setLedger(null)}>بستن</button>
      </Sheet>

      <Sheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="اطلاعات مشتری"
        sub={editing ? toPersianDigits(editing.phone) : ''}
      >
        <div className="form-grid">
          <Field label="نام">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="ایمیل">
            <Input ltr type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="امتیاز باشگاه">
            <Input ltr type="number" value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} />
          </Field>
          <div className="full">
            <Field label="یادداشت داخلی" hint="فقط برای کارکنان سالن قابل مشاهده است">
              <Input
                as="textarea"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="مثلاً حساسیت به رنگ‌های آمونیاک‌دار"
              />
            </Field>
          </div>
        </div>

        <Toggle
          on={form.blocked}
          onChange={(v) => setForm({ ...form, blocked: v })}
          label="مسدود کردن مشتری"
          desc="مشتری مسدود نمی‌تواند نوبت جدید رزرو کند"
        />

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
