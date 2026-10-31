import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useAsync, useApp } from '../../lib/store.jsx';
import { Spinner, Alert, Empty, Input, Select, Field, Toggle } from '../../components/ui.jsx';
import { toPersianDigits } from '@shared/jalali.js';

const AUDIENCES = [
  { id: 'all', label: 'همه‌ی مشتریان' },
  { id: 'active', label: 'مشتریان دارای نوبت فعال' },
  { id: 'inactive', label: 'مشتریانی که بیش از ۲ ماه مراجعه نکرده‌اند' },
  { id: 'selected', label: 'انتخاب دستی' },
];

const KIND_LABELS = {
  otp: 'کد ورود',
  booked: 'تأیید رزرو',
  reminder: 'یادآوری',
  canceled: 'لغو نوبت',
  confirmed: 'تأیید نهایی',
  welcome: 'خوش‌آمدگویی',
  birthday: 'تبریک تولد',
  campaign: 'پیام گروهی',
  test: 'آزمایشی',
  general: 'عمومی',
};

const STATUS_LABELS = { sent: 'ارسال شد', failed: 'ناموفق', skipped: 'رد شد', pending: 'در صف' };

const TEMPLATES = [
  { label: 'پیشنهاد تخفیف', text: 'سلام {نام} عزیز 🌸\nاین هفته {سالن} ۲۰٪ تخفیف ویژه روی خدمات مو دارد.\nبرای رزرو نوبت همین حالا اقدام کنید.' },
  { label: 'دعوت به مراجعه', text: 'سلام {نام} عزیز\nمدتی است شما را ندیده‌ایم!\nمنتظر حضور گرم شما در {سالن} هستیم.' },
  { label: 'اطلاع‌رسانی امتیاز', text: 'سلام {نام} عزیز\nشما {امتیاز} امتیاز در باشگاه مشتریان {سالن} دارید.\nبا امتیازهایتان می‌توانید تخفیف بگیرید.' },
];

export default function Messaging() {
  const { toast, hasModule } = useApp();
  const canCampaign = hasModule('notifications');
  const [channel, setChannel] = useState('sms');
  const [audience, setAudience] = useState('all');
  const [selected, setSelected] = useState([]);
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  const [testTo, setTestTo] = useState('');
  const [testBusy, setTestBusy] = useState(false);

  const [filterChannel, setFilterChannel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: custData } = useAsync(() => api.admin.customers(), []);
  const customers = custData?.customers || [];

  const { data: msgData, loading: msgLoading, reload: reloadMessages } = useAsync(
    () => api.admin.messages({ channel: filterChannel, status: filterStatus }),
    [filterChannel, filterStatus]
  );
  const messages = msgData?.messages || [];

  const smsCount = Math.ceil((text.length || 1) / 70);

  async function send() {
    setErr('');
    setResult(null);
    if (!text.trim()) return setErr('متن پیام را بنویسید');
    if (channel === 'email' && !subject.trim()) return setErr('موضوع ایمیل را بنویسید');
    if (audience === 'selected' && !selected.length) return setErr('حداقل یک مشتری را انتخاب کنید');

    const target =
      audience === 'all' ? customers.length :
      audience === 'selected' ? selected.length : null;
    if (target !== null && !confirm(`پیام برای ${target} مشتری ارسال شود؟`)) return;

    setBusy(true);
    try {
      const res = await api.admin.sendMessage({ channel, audience, userIds: selected, text, subject });
      setResult(res);
      toast(`${toPersianDigits(res.sent)} پیام ارسال شد`);
      reloadMessages();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setErr('');
    if (!testTo.trim()) return setErr('گیرنده‌ی آزمایشی را وارد کنید');
    setTestBusy(true);
    try {
      await api.admin.testMessage({
        channel,
        to: testTo,
        text: text || 'این یک پیام آزمایشی است.',
        subject: subject || 'پیام آزمایشی',
      });
      toast('پیام آزمایشی ارسال شد');
      reloadMessages();
    } catch (e) {
      setErr(e.message);
      toast(e.message, 'error');
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <h3>ارسال پیامک و ایمیل</h3>
          <div className="seg" style={{ margin: 0, width: 220 }}>
            <button className={channel === 'sms' ? 'on' : ''} onClick={() => setChannel('sms')}>
              📱 پیامک
            </button>
            <button className={channel === 'email' ? 'on' : ''} onClick={() => setChannel('email')}>
              ✉️ ایمیل
            </button>
          </div>
        </div>

        <div className="panel-body">
          <Alert kind="error">{err}</Alert>
          {!canCampaign && (
            <Alert kind="info">
              ارسال گروهی بخشی از ماژول «اطلاع‌رسانی پیشرفته» است و روی این نسخه فعال نیست.
              ارسال آزمایشی همچنان کار می‌کند.
            </Alert>
          )}
          {result && (
            <Alert kind="ok">
              {toPersianDigits(result.sent)} ارسال موفق،&nbsp;
              {toPersianDigits(result.failed)} ناموفق،&nbsp;
              {toPersianDigits(result.skipped)} رد شده (بدون {channel === 'sms' ? 'شماره' : 'ایمیل'} معتبر)
              {result.errors?.length > 0 && <div className="small mt-8">نمونه خطا: {result.errors[0]}</div>}
            </Alert>
          )}

          <div className="form-grid">
            <Field label="گیرندگان">
              <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
                {AUDIENCES.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </Select>
            </Field>

            {channel === 'email' && (
              <Field label="موضوع ایمیل">
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="مثلاً تخفیف ویژه‌ی این هفته" />
              </Field>
            )}
          </div>

          {audience === 'selected' && (
            <Field label={`انتخاب مشتری (${toPersianDigits(selected.length)} نفر)`}>
              <div
                style={{
                  maxHeight: 190, overflowY: 'auto', border: '1.5px solid var(--line)',
                  borderRadius: 16, padding: 10,
                }}
              >
                {customers.map((c) => (
                  <label
                    key={c.id}
                    className="row"
                    style={{ gap: 9, padding: '6px 4px', cursor: 'pointer', fontSize: 13 }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={() =>
                        setSelected((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))
                      }
                    />
                    <span className="grow">{c.name || 'بدون نام'}</span>
                    <span className="muted small ltr">
                      {channel === 'sms' ? toPersianDigits(c.phone) : c.email || '— بدون ایمیل —'}
                    </span>
                  </label>
                ))}
              </div>
            </Field>
          )}

          <Field
            label="متن پیام"
            hint={
              channel === 'sms'
                ? `${toPersianDigits(text.length)} نویسه • حدود ${toPersianDigits(smsCount)} پیامک — متغیرها: {نام} {سالن} {امتیاز}`
                : 'متغیرهای قابل استفاده: {نام} {سالن} {امتیاز}'
            }
          >
            <Input
              as="textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="سلام {نام} عزیز..."
              style={{ minHeight: 120 }}
            />
          </Field>

          <div className="row wrap" style={{ gap: 7, marginBottom: 16 }}>
            <span className="small muted">قالب آماده:</span>
            {TEMPLATES.map((t) => (
              <button key={t.label} className="chip" onClick={() => setText(t.text)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="row wrap" style={{ gap: 10 }}>
            <button className="btn sm" onClick={send} disabled={busy || !canCampaign} style={{ minWidth: 150 }}>
              {busy ? <span className="spinner sm on-dark" /> : `ارسال ${channel === 'sms' ? 'پیامک' : 'ایمیل'}`}
            </button>

            <div className="row grow" style={{ gap: 8, minWidth: 260 }}>
              <Input
                ltr
                wrapClass="grow"
                placeholder={channel === 'sms' ? 'شماره آزمایشی: 09121234567' : 'ایمیل آزمایشی'}
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
              <button className="btn outline sm nowrap" onClick={sendTest} disabled={testBusy}>
                {testBusy ? <span className="spinner sm" /> : 'ارسال آزمایشی'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* تاریخچه */}
      <div className="panel">
        <div className="panel-head">
          <h3>تاریخچه‌ی پیام‌ها</h3>
          <div className="filter-row">
            <Select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)}>
              <option value="all">همه‌ی کانال‌ها</option>
              <option value="sms">پیامک</option>
              <option value="email">ایمیل</option>
            </Select>
            <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">همه‌ی وضعیت‌ها</option>
              <option value="sent">ارسال شده</option>
              <option value="failed">ناموفق</option>
              <option value="skipped">رد شده</option>
            </Select>
            <button className="btn soft sm" onClick={reloadMessages}>↻ به‌روزرسانی</button>
          </div>
        </div>

        <div className="panel-body tight">
          {msgLoading ? (
            <Spinner />
          ) : messages.length === 0 ? (
            <Empty icon="✉️" title="پیامی ارسال نشده است" />
          ) : (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>کانال</th>
                    <th>گیرنده</th>
                    <th>نوع</th>
                    <th>متن</th>
                    <th>وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((m) => (
                    <tr key={m.id}>
                      <td>{m.channel === 'sms' ? '📱 پیامک' : '✉️ ایمیل'}</td>
                      <td className="ltr nowrap">{m.channel === 'sms' ? toPersianDigits(m.to) : m.to}</td>
                      <td className="cell-sub nowrap">{KIND_LABELS[m.kind] || m.kind}</td>
                      <td style={{ maxWidth: 300 }}>
                        <div className="cell-sub" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                          {(m.subject ? m.subject + ' — ' : '') + (m.body || '').slice(0, 90)}
                        </div>
                      </td>
                      <td>
                        <span
                          className={
                            'badge ' +
                            (m.status === 'sent' ? 'confirmed' : m.status === 'failed' ? 'canceled' : 'pending')
                          }
                          title={m.error || ''}
                        >
                          {STATUS_LABELS[m.status] || m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
