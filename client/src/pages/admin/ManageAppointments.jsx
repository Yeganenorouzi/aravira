import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useAsync, useApp } from '../../lib/store.jsx';
import { Spinner, Alert, Price, StatusBadge, Empty, Input, Select, Sheet, Duration, STATUS_LABELS } from '../../components/ui.jsx';
import JalaliCalendar from '../../components/JalaliCalendar.jsx';
import { formatJalali, formatTime, toPersianDigits, todayISO } from '@shared/jalali.js';

const STATUS_FLOW = ['pending', 'confirmed', 'done', 'noshow', 'canceled'];

export default function ManageAppointments() {
  const { toast } = useApp();
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [date, setDate] = useState('');
  const [picker, setPicker] = useState(false);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState('');

  const { data, loading, error, reload } = useAsync(
    () => api.admin.appointments({ status, q, date }),
    [status, q, date]
  );

  const list = data?.appointments || [];

  async function setStatusOf(a, next) {
    setBusy(a.id);
    try {
      await api.admin.setStatus(a.id, next);
      toast(`وضعیت به «${STATUS_LABELS[next]}» تغییر کرد`);
      setDetail(null);
      reload();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h3>مدیریت نوبت‌ها</h3>
          <div className="filter-row">
            <Input
              icon="🔍"
              placeholder="نام، شماره یا کد پیگیری"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ minWidth: 190 }}
            />
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">همه‌ی وضعیت‌ها</option>
              {STATUS_FLOW.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </Select>
            <button className="btn soft sm" onClick={() => setPicker(true)}>
              {date ? formatJalali(date, { short: true }) : '📅 فیلتر تاریخ'}
            </button>
            {date && (
              <button className="btn outline sm" onClick={() => setDate('')}>حذف فیلتر</button>
            )}
            <button className="btn soft sm" onClick={() => setDate(todayISO())}>امروز</button>
          </div>
        </div>

        <div className="panel-body tight">
          <Alert kind="error">{error}</Alert>
          {loading ? (
            <Spinner />
          ) : list.length === 0 ? (
            <Empty icon="📅" title="نوبتی با این فیلترها پیدا نشد" />
          ) : (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>تاریخ و ساعت</th>
                    <th>مشتری</th>
                    <th>خدمت</th>
                    <th>آرایشگر</th>
                    <th>مبلغ</th>
                    <th>وضعیت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id}>
                      <td className="nowrap">
                        <div className="cell-main">{formatJalali(a.date, { short: true })}</div>
                        <div className="cell-sub">{formatTime(a.time)}</div>
                      </td>
                      <td>
                        <div className="cell-main">{a.customer?.name || '—'}</div>
                        <div className="cell-sub ltr">{toPersianDigits(a.customer?.phone || '')}</div>
                      </td>
                      <td>
                        <div className="cell-main">{a.service?.title || a.serviceTitle}</div>
                        <div className="cell-sub">کد {toPersianDigits(a.code)}</div>
                      </td>
                      <td>{a.staff?.name || '—'}</td>
                      <td className="nowrap"><Price amount={a.total} /></td>
                      <td><StatusBadge status={a.status} /></td>
                      <td className="nowrap">
                        <div className="row" style={{ gap: 6 }}>
                          {a.status === 'pending' && (
                            <button
                              className="btn xs soft"
                              disabled={busy === a.id}
                              onClick={() => setStatusOf(a, 'confirmed')}
                            >
                              تأیید
                            </button>
                          )}
                          {a.status === 'confirmed' && (
                            <button
                              className="btn xs soft"
                              disabled={busy === a.id}
                              onClick={() => setStatusOf(a, 'done')}
                            >
                              انجام شد
                            </button>
                          )}
                          <button className="btn xs outline" onClick={() => setDetail(a)}>
                            جزئیات
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

      {/* انتخاب تاریخ */}
      <Sheet open={picker} onClose={() => setPicker(false)} title="انتخاب تاریخ" sub="برای فیلتر کردن نوبت‌ها">
        <JalaliCalendar
          value={date || todayISO()}
          onChange={(iso) => { setDate(iso); setPicker(false); }}
          maxAdvanceDays={365}
          allowPast
        />
      </Sheet>

      {/* جزئیات نوبت */}
      <Sheet
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="جزئیات نوبت"
        sub={detail ? `کد پیگیری ${toPersianDigits(detail.code)}` : ''}
      >
        {detail && (
          <>
            <div className="detail-line">
              <span className="ico">👤</span>
              <span className="txt">
                <span className="k">مشتری</span>
                <div className="v">
                  {detail.customer?.name} — <span className="ltr">{toPersianDigits(detail.customer?.phone || '')}</span>
                </div>
              </span>
            </div>
            {detail.customer?.email && (
              <div className="detail-line">
                <span className="ico">✉️</span>
                <span className="txt">
                  <span className="k">ایمیل</span>
                  <div className="v ltr">{detail.customer.email}</div>
                </span>
              </div>
            )}
            <div className="detail-line">
              <span className="ico">💅</span>
              <span className="txt">
                <span className="k">خدمت</span>
                <div className="v">
                  {detail.service?.title} • <bdi><Duration minutes={detail.duration} /></bdi>
                </div>
              </span>
            </div>
            <div className="detail-line">
              <span className="ico">📅</span>
              <span className="txt">
                <span className="k">زمان</span>
                <div className="v">
                  {formatJalali(detail.date, { withWeekday: true })} — {formatTime(detail.time)}
                </div>
              </span>
            </div>
            <div className="detail-line">
              <span className="ico">💳</span>
              <span className="txt">
                <span className="k">صورتحساب</span>
                <div className="v">
                  <Price amount={detail.total} /> ({detail.paymentMethod === 'cash' ? 'در محل' : detail.paymentMethod === 'online' ? 'آنلاین' : 'کارت به کارت'})
                </div>
              </span>
            </div>
            {detail.note && (
              <div className="detail-line">
                <span className="ico">📝</span>
                <span className="txt">
                  <span className="k">یادداشت مشتری</span>
                  <div className="v" style={{ fontSize: 12.5 }}>{detail.note}</div>
                </span>
              </div>
            )}

            <div className="mt-16">
              <label className="small bold">تغییر وضعیت</label>
              <div className="row wrap mt-8" style={{ gap: 7 }}>
                {STATUS_FLOW.map((s) => (
                  <button
                    key={s}
                    className={'btn xs ' + (detail.status === s ? '' : 'outline')}
                    disabled={detail.status === s || busy === detail.id}
                    onClick={() => setStatusOf(detail, s)}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
              <p className="small muted mt-12">
                با تأیید یا لغو نوبت، پیامک و ایمیل اطلاع‌رسانی به‌صورت خودکار برای مشتری ارسال می‌شود.
              </p>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
