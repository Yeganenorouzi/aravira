import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAsync, useApp } from '../../lib/store.jsx';
import { Spinner, Alert, Price, StatusBadge, Empty } from '../../components/ui.jsx';
import { formatJalali, formatTime, toPersianDigits, todayISO } from '@shared/jalali.js';

export default function Dashboard() {
  const nav = useNavigate();
  const { toast } = useApp();
  const { data: stats, loading, error } = useAsync(() => api.admin.stats(), []);
  const { data: todayList } = useAsync(
    () => api.admin.appointments({ date: todayISO() }),
    []
  );

  if (loading) return <Spinner />;
  if (error) return <Alert kind="error">{error}</Alert>;

  const maxRevenue = Math.max(...(stats?.daily || []).map((d) => d.revenue), 1);

  const KPIS = [
    { ico: '📅', v: toPersianDigits(stats.todayCount), k: 'نوبت امروز' },
    { ico: '⏳', v: toPersianDigits(stats.pendingCount), k: 'در انتظار تأیید' },
    { ico: '🔜', v: toPersianDigits(stats.upcomingCount), k: 'نوبت‌های پیش رو' },
    { ico: '👥', v: toPersianDigits(stats.customersCount), k: 'مشتریان' },
    { ico: '💰', v: <Price amount={stats.revenue30} />, k: 'درآمد ۳۰ روز اخیر' },
    { ico: '✉️', v: toPersianDigits(stats.messagesSent), k: 'پیام ارسال‌شده' },
  ];

  return (
    <>
      <div className="kpi-grid">
        {KPIS.map((k) => (
          <div className="kpi" key={k.k}>
            <div className="ico">{k.ico}</div>
            <div>
              <div className="v">{k.v}</div>
              <div className="k">{k.k}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>عملکرد هفته‌ی گذشته</h3>
          <span className="small muted">تعداد نوبت و درآمد روزانه</span>
        </div>
        <div className="panel-body">
          <div className="bars">
            {stats.daily.map((d) => (
              <div className="bar-col" key={d.date} title={`${d.label}: ${toPersianDigits(d.count)} نوبت`}>
                <span className="val">{toPersianDigits(d.count)}</span>
                <div
                  className="bar"
                  style={{ height: `${Math.max((d.revenue / maxRevenue) * 100, 4)}%` }}
                />
                <span className="lbl">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>نوبت‌های امروز</h3>
          <button className="btn soft sm" onClick={() => nav('/admin/appointments')}>
            مدیریت نوبت‌ها
          </button>
        </div>
        <div className="panel-body tight">
          {!todayList?.appointments?.length ? (
            <Empty icon="☕" title="امروز نوبتی ثبت نشده" text="روز آرامی پیش رو دارید" />
          ) : (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>ساعت</th>
                    <th>مشتری</th>
                    <th>خدمت</th>
                    <th>آرایشگر</th>
                    <th>مبلغ</th>
                    <th>وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {todayList.appointments.map((a) => (
                    <tr key={a.id}>
                      <td className="cell-main nowrap">{formatTime(a.time)}</td>
                      <td>
                        <div className="cell-main">{a.customer?.name || '—'}</div>
                        <div className="cell-sub ltr">{toPersianDigits(a.customer?.phone || '')}</div>
                      </td>
                      <td>{a.service?.title || a.serviceTitle}</td>
                      <td>{a.staff?.name || '—'}</td>
                      <td className="nowrap"><Price amount={a.total} /></td>
                      <td><StatusBadge status={a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>پرطرفدارترین خدمات</h3>
          <button
            className="btn soft sm"
            onClick={async () => {
              try {
                const res = await api.admin.runScheduler();
                toast(
                  `${toPersianDigits(res.reminders.sent)} یادآوری و ${toPersianDigits(res.birthdays.sent)} تبریک تولد ارسال شد`
                );
              } catch (err) {
                toast(err.message, 'error');
              }
            }}
          >
            اجرای دستی یادآوری‌ها
          </button>
        </div>
        <div className="panel-body">
          {stats.topServices.map((s, i) => {
            const max = stats.topServices[0]?.count || 1;
            return (
              <div key={s.id} style={{ marginBottom: 13 }}>
                <div className="row between small" style={{ marginBottom: 5 }}>
                  <span className="bold">
                    {toPersianDigits(i + 1)}. {s.title}
                  </span>
                  <span className="muted">{toPersianDigits(s.count)} نوبت</span>
                </div>
                <div style={{ height: 7, background: 'var(--rose-50)', borderRadius: 99 }}>
                  <div
                    style={{
                      width: `${(s.count / max) * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(to left, var(--rose), var(--rose-200))',
                      borderRadius: 99,
                    }}
                  />
                </div>
              </div>
            );
          })}
          {!stats.topServices.length && <p className="muted small center">هنوز نوبتی ثبت نشده است</p>}
        </div>
      </div>

      <p className="center small muted mt-16">
        امروز: {formatJalali(todayISO(), { withWeekday: true })}
      </p>
    </>
  );
}
