import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useAsync } from '../lib/store.jsx';
import { TopBar, Spinner, Alert, Art, Empty, Input } from '../components/ui.jsx';
import { formatJalali, formatTime, toPersianDigits } from '@shared/jalali.js';

const RATING_LABELS = ['', 'خیلی بد', 'بد', 'متوسط', 'خوب', 'عالی'];

function Stars({ value, onChange, size = 38 }) {
  return (
    <div className="stars" role="radiogroup" aria-label="امتیاز">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={'star' + (n <= value ? ' on' : '')}
          style={{ fontSize: size }}
          onClick={() => onChange(n)}
          role="radio"
          aria-checked={n === value}
          aria-label={`${n} ستاره`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function ReviewForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast } = useApp();

  const [rating, setRating] = useState(0);
  const [staffRating, setStaffRating] = useState(0);
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { data, loading } = useAsync(() => api.awaitingReview(), []);
  const list = data?.appointments || [];
  const available = data?.tags || [];

  // اگر id داده شده باشد همان نوبت، وگرنه اولین نوبت در انتظار نظر
  const appt = id ? list.find((a) => a.id === id) : list[0];

  const toggleTag = (t) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  async function submit() {
    setError('');
    if (!rating) return setError('لطفاً امتیاز خود را انتخاب کنید');
    setBusy(true);
    try {
      const res = await api.submitReview(appt.id, {
        rating,
        staffRating: staffRating || rating,
        comment,
        tags,
      });
      toast(`نظر شما ثبت شد — ${toPersianDigits(res.bonusPoints)} امتیاز هدیه گرفتید 🌸`);
      nav('/appointments');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="screen"><Spinner /></div>;

  if (!appt) {
    return (
      <div className="screen">
        <TopBar title="ثبت نظر" />
        <div className="screen-body">
          <Empty
            icon="✍️"
            title="نوبتی برای نظر دادن ندارید"
            text="پس از انجام نوبت می‌توانید تجربه‌تان را ثبت کنید"
            action={<button className="btn" onClick={() => nav('/appointments')}>نوبت‌های من</button>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="screen has-cta">
      <TopBar title="نظر شما" sub="تجربه‌تان را با ما در میان بگذارید" />

      <div className="screen-body">
        <Alert kind="error">{error}</Alert>

        <div className="card">
          <div className="row" style={{ gap: 12 }}>
            <Art item={appt.service} />
            <div className="grow">
              <div className="bold">{appt.service?.title || appt.serviceTitle}</div>
              <div className="small muted">با {appt.staff?.name}</div>
              <div className="small muted">
                <bdi>{formatJalali(appt.date, { short: true })}</bdi> • <bdi>{formatTime(appt.time)}</bdi>
              </div>
            </div>
          </div>
        </div>

        <div className="section center">
          <h2 style={{ fontSize: 16 }}>تجربه‌ی کلی شما چطور بود؟</h2>
          <Stars value={rating} onChange={setRating} />
          <div className="rating-label">{RATING_LABELS[rating] || 'ستاره‌ها را لمس کنید'}</div>
        </div>

        {rating > 0 && (
          <>
            <div className="section">
              <div className="section-head"><h2>چه چیزی خوب بود؟</h2></div>
              <div className="row wrap" style={{ gap: 7 }}>
                {available.map((t) => (
                  <button
                    key={t}
                    className={'chip' + (tags.includes(t) ? ' on' : '')}
                    onClick={() => toggleTag(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="section">
              <div className="section-head">
                <h2>امتیاز به {appt.staff?.name}</h2>
              </div>
              <div className="center">
                <Stars value={staffRating || rating} onChange={setStaffRating} size={28} />
              </div>
            </div>

            <div className="section">
              <div className="section-head"><h2>توضیح بیشتر (اختیاری)</h2></div>
              <Input
                as="textarea"
                placeholder="تجربه‌ی خود را بنویسید..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
              />
            </div>
          </>
        )}

        <Alert kind="info">با ثبت نظر، ۱۰ امتیاز به باشگاه مشتریان شما اضافه می‌شود.</Alert>
      </div>

      <div className="cta-bar">
        <button className="btn" onClick={submit} disabled={busy || !rating}>
          {busy ? <span className="spinner sm on-dark" /> : 'ثبت نظر'}
        </button>
      </div>
    </div>
  );
}
