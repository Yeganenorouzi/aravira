import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useAsync } from '../lib/store.jsx';
import { Art, StatusBadge, Price, Duration, Skeleton, Empty, Sheet, Alert } from '../components/ui.jsx';
import { formatJalali, formatTime, toPersianDigits, diffDays, todayISO } from '@shared/jalali.js';

export default function Appointments() {
  const nav = useNavigate();
  const { toast, settings, setBooking, hasModule } = useApp();
  const [tab, setTab] = useState('upcoming');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { data, loading, reload } = useAsync(() => api.myAppointments(tab), [tab]);
  const list = data?.appointments || [];

  async function doCancel() {
    setBusy(true);
    setError('');
    try {
      await api.cancel(cancelTarget.id, reason);
      toast('نوبت لغو شد');
      setCancelTarget(null);
      setReason('');
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const canCancel = (a) =>
    ['pending', 'confirmed'].includes(a.status) && diffDays(a.date, todayISO()) >= 0;

  return (
    <div className="screen">
      <div className="topbar">
        <span style={{ width: 40 }} />
        <h1>نوبت‌های من</h1>
        <span style={{ width: 40 }} />
      </div>

      <div className="screen-body">
        <div className="seg">
          <button className={tab === 'upcoming' ? 'on' : ''} onClick={() => setTab('upcoming')}>
            پیش رو
          </button>
          <button className={tab === 'past' ? 'on' : ''} onClick={() => setTab('past')}>
            گذشته
          </button>
          <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>
            همه
          </button>
        </div>

        {loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} h={130} />)
        ) : list.length === 0 ? (
          <Empty
            icon="📅"
            title={tab === 'upcoming' ? 'نوبت پیش رویی ندارید' : 'نوبتی ثبت نشده است'}
            text="برای رزرو، یکی از خدمات سالن را انتخاب کنید"
            action={<button className="btn" onClick={() => nav('/explore')}>رزرو نوبت</button>}
          />
        ) : (
          list.map((a) => (
            <div key={a.id} className="appt-card">
              <div className="appt-top">
                <Art item={a.service} />
                <div className="grow">
                  <div className="title">{a.service?.title || a.serviceTitle}</div>
                  <div className="who">با {a.staff?.name || '—'}</div>
                  <div style={{ marginTop: 6 }}>
                    <StatusBadge status={a.status} />
                  </div>
                </div>
                <div className="appt-when">
                  <span className="d">{formatJalali(a.date, { short: true })}</span>
                  <span className="t">{formatTime(a.time)}</span>
                </div>
              </div>

              <div className="appt-meta">
                <span>کد: <b>{toPersianDigits(a.code)}</b></span>
                <span>⏱ <Duration minutes={a.duration} /></span>
                <span>💳 <b><Price amount={a.payable ?? a.total} /></b></span>
                {a.totalSaved > 0 && (
                  <span className="badge confirmed">
                    <Price amount={a.totalSaved} /> تخفیف
                  </span>
                )}
              </div>

              {a.note && (
                <div className="small muted" style={{ marginTop: 8 }}>
                  📝 {a.note}
                </div>
              )}

              {hasModule('marketing') && a.status === 'done' && !a.reviewed && (
                <div className="appt-actions">
                  <button className="btn soft sm grow" onClick={() => nav('/review/' + a.id)}>
                    ✍️ ثبت نظر و دریافت ۱۰ امتیاز
                  </button>
                </div>
              )}

              {canCancel(a) && (
                <div className="appt-actions">
                  <button
                    className="btn soft sm grow"
                    onClick={() => {
                      // جابه‌جایی با همان خدمت و آرایشگر، فقط انتخاب زمان تازه
                      setBooking({
                        rescheduleId: a.id,
                        serviceId: a.service?.id || a.serviceId,
                        service: a.service,
                        staffId: a.staff?.id || a.staffId,
                        staff: a.staff,
                        date: a.date,
                        time: null,
                      });
                      nav('/book/time');
                    }}
                  >
                    جابه‌جایی
                  </button>
                  <button className="btn danger sm grow" onClick={() => setCancelTarget(a)}>
                    لغو نوبت
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Sheet
        open={Boolean(cancelTarget)}
        onClose={() => { setCancelTarget(null); setError(''); }}
        title="لغو نوبت"
        sub={
          cancelTarget
            ? `${cancelTarget.service?.title} – ${formatJalali(cancelTarget.date, { withWeekday: true })} ساعت ${formatTime(cancelTarget.time)}`
            : ''
        }
      >
        <Alert kind="error">{error}</Alert>
        <Alert kind="warn">
          لغو نوبت فقط تا {toPersianDigits(settings?.cancelWindowHours || 6)} ساعت پیش از زمان آن ممکن است.
        </Alert>

        <div className="field">
          <label>دلیل لغو (اختیاری)</label>
          <div className="input-wrap">
            <input
              placeholder="مثلاً تغییر برنامه"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <div className="btn-row">
          <button className="btn soft" onClick={() => setCancelTarget(null)}>انصراف</button>
          <button className="btn" onClick={doCancel} disabled={busy}>
            {busy ? <span className="spinner sm on-dark" /> : 'تأیید لغو'}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
