import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useAsync } from '../lib/store.jsx';
import { Spinner, Art, Price, StatusBadge } from '../components/ui.jsx';
import { formatJalali, formatTime, toPersianDigits } from '@shared/jalali.js';

export default function Success() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, settings } = useApp();

  const { data, loading } = useAsync(() => api.appointment(id), [id]);
  const appt = data?.appointment;

  if (loading) return <div className="screen"><Spinner /></div>;

  return (
    <div className="screen">
      <div className="success-wrap">
        <div className="success-ring">✓</div>
        <h2>نوبت شما ثبت شد!</h2>
        <p className="msg">
          جزئیات نوبت از طریق پیامک
          {user?.email ? ' و ایمیل' : ''} برای شما ارسال شد.
          <br />
          یک روز پیش از نوبت نیز یادآوری می‌کنیم.
        </p>

        {appt && (
          <>
            <div className="code-chip">
              کد پیگیری: <b>{toPersianDigits(appt.code)}</b>
            </div>

            <div className="card mt-20" style={{ width: '100%', textAlign: 'start' }}>
              <div className="summary-item">
                <Art item={appt.service} />
                <div className="grow">
                  <div className="bold">{appt.service?.title}</div>
                  <div className="small muted">با {appt.staff?.name}</div>
                </div>
                <StatusBadge status={appt.status} />
              </div>

              <div className="detail-line">
                <span className="ico">📅</span>
                <span className="txt">
                  <span className="k">تاریخ و ساعت</span>
                  <div className="v">
                    <bdi>{formatJalali(appt.date, { withWeekday: true })}</bdi> • <bdi>{formatTime(appt.time)}</bdi>
                  </div>
                </span>
              </div>
              <div className="detail-line">
                <span className="ico">📍</span>
                <span className="txt">
                  <span className="k">آدرس سالن</span>
                  <div className="v" style={{ fontSize: 12.5 }}>{settings?.address}</div>
                </span>
              </div>
              <div className="detail-line">
                <span className="ico">💳</span>
                <span className="txt">
                  <span className="k">مبلغ</span>
                  <div className="v"><Price amount={appt.total} /></div>
                </span>
              </div>
            </div>
          </>
        )}

        <div className="btn-row mt-20" style={{ width: '100%' }}>
          <button className="btn soft" onClick={() => nav('/home')}>صفحه‌ی اصلی</button>
          <button className="btn" onClick={() => nav('/appointments')}>نوبت‌های من</button>
        </div>
      </div>
    </div>
  );
}
