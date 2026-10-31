import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { useAsync, useApp } from '../../lib/store.jsx';
import { Spinner, Alert, Input, Select, Field, Toggle, Sheet } from '../../components/ui.jsx';
import JalaliCalendar from '../../components/JalaliCalendar.jsx';
import { WEEKDAYS_FA, toPersianDigits, formatJalali, todayISO } from '@shared/jalali.js';

export default function SettingsPage() {
  const { toast, hasModule } = useApp();
  const { data, loading, error, reload } = useAsync(() => api.admin.settings(), []);
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);
  const [holidayPicker, setHolidayPicker] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '' });

  useEffect(() => {
    if (data?.settings) setS(structuredClone(data.settings));
  }, [data]);

  if (loading || !s) return <Spinner />;
  if (error) return <Alert kind="error">{error}</Alert>;

  const set = (path, value) => {
    setS((prev) => {
      const next = structuredClone(prev);
      const keys = path.split('.');
      let node = next;
      for (let i = 0; i < keys.length - 1; i++) node = node[keys[i]];
      node[keys[keys.length - 1]] = value;
      return next;
    });
  };

  async function save() {
    setBusy(true);
    try {
      await api.admin.saveSettings(s);
      toast('تنظیمات ذخیره شد');
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function checkEmail() {
    toast('در حال بررسی اتصال...');
    try {
      const res = await api.admin.verifyEmail();
      if (res.ok) toast('اتصال به سرور ایمیل موفق بود');
      else toast('خطا: ' + res.error, 'error');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function changePassword() {
    if (pw.next.length < 6) return toast('رمز تازه باید حداقل ۶ نویسه باشد', 'error');
    try {
      await api.admin.changePassword(pw);
      toast('رمز عبور تغییر کرد');
      setPw({ current: '', next: '' });
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <>
      {/* اطلاعات سالن */}
      <div className="panel">
        <div className="panel-head"><h3>اطلاعات سالن</h3></div>
        <div className="panel-body">
          <div className="form-grid">
            <Field label="نام سالن">
              <Input value={s.salonName} onChange={(e) => set('salonName', e.target.value)} />
            </Field>
            <Field label="شعار">
              <Input value={s.tagline} onChange={(e) => set('tagline', e.target.value)} />
            </Field>
            <Field label="تلفن">
              <Input value={s.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="واحد پول">
              <Input value={s.currency} onChange={(e) => set('currency', e.target.value)} />
            </Field>
            <div className="full">
              <Field label="آدرس">
                <Input value={s.address} onChange={(e) => set('address', e.target.value)} />
              </Field>
            </div>
          </div>
        </div>
      </div>

      {/* قواعد رزرو */}
      <div className="panel">
        <div className="panel-head"><h3>قواعد رزرو و صورتحساب</h3></div>
        <div className="panel-body">
          <div className="form-grid">
            <Field label="مالیات (٪)">
              <Input ltr type="number" value={s.taxPercent} onChange={(e) => set('taxPercent', Number(e.target.value))} />
            </Field>
            <Field label="بیعانه (٪)" hint="درصدی از مبلغ کل برای پرداخت آنلاین">
              <Input ltr type="number" value={s.depositPercent} onChange={(e) => set('depositPercent', Number(e.target.value))} />
            </Field>
            <Field label="فاصله‌ی زمانی نوبت‌ها (دقیقه)">
              <Input ltr type="number" step="15" value={s.slotStepMinutes} onChange={(e) => set('slotStepMinutes', Number(e.target.value))} />
            </Field>
            <Field label="حداکثر روز پیش‌رزرو">
              <Input ltr type="number" value={s.maxAdvanceDays} onChange={(e) => set('maxAdvanceDays', Number(e.target.value))} />
            </Field>
            <Field label="حداقل فاصله تا نوبت (دقیقه)" hint="نوبت‌های نزدیک‌تر از این بازه قابل رزرو نیستند">
              <Input ltr type="number" value={s.minLeadMinutes} onChange={(e) => set('minLeadMinutes', Number(e.target.value))} />
            </Field>
            <Field label="مهلت لغو نوبت (ساعت)">
              <Input ltr type="number" value={s.cancelWindowHours} onChange={(e) => set('cancelWindowHours', Number(e.target.value))} />
            </Field>
            <Field label="ارسال یادآوری چند ساعت قبل">
              <Input ltr type="number" value={s.reminderHoursBefore} onChange={(e) => set('reminderHoursBefore', Number(e.target.value))} />
            </Field>
          </div>
        </div>
      </div>

      {/* ساعات کاری */}
      <div className="panel">
        <div className="panel-head">
          <h3>ساعات کاری</h3>
          <button className="btn soft sm" onClick={() => setHolidayPicker(true)}>+ افزودن تعطیلی</button>
        </div>
        <div className="panel-body">
          {WEEKDAYS_FA.map((day, i) => {
            const wh = s.workingHours[i] || { open: '09:00', close: '20:00', closed: false };
            return (
              <div className="wh-row" key={day}>
                <span className="day">{day}</span>
                <button
                  className={'chip' + (!wh.closed ? ' on' : '')}
                  onClick={() => set(`workingHours.${i}.closed`, !wh.closed)}
                >
                  {wh.closed ? 'تعطیل' : 'باز'}
                </button>
                {!wh.closed && (
                  <>
                    <Input ltr type="time" value={wh.open} onChange={(e) => set(`workingHours.${i}.open`, e.target.value)} />
                    <span className="muted small">تا</span>
                    <Input ltr type="time" value={wh.close} onChange={(e) => set(`workingHours.${i}.close`, e.target.value)} />
                  </>
                )}
              </div>
            );
          })}

          {s.holidays?.length > 0 && (
            <div className="mt-16">
              <label className="small bold">روزهای تعطیل خاص</label>
              <div className="row wrap mt-8" style={{ gap: 7 }}>
                {s.holidays.map((h) => (
                  <button
                    key={h}
                    className="chip on"
                    onClick={() => set('holidays', s.holidays.filter((x) => x !== h))}
                    title="برای حذف کلیک کنید"
                  >
                    {formatJalali(h)} ✕
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* پیامک */}
      <div className="panel">
        <div className="panel-head"><h3>سرویس پیامک</h3></div>
        <div className="panel-body">
          <Toggle on={s.sms.enabled} onChange={(v) => set('sms.enabled', v)} label="ارسال پیامک فعال باشد" />

          <div className="form-grid mt-12">
            <Field label="سرویس‌دهنده">
              <Select value={s.sms.provider} onChange={(e) => set('sms.provider', e.target.value)}>
                {(data.smsProviders || []).map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="کلید API" hint="برای حفظ کلید فعلی، این فیلد را دست نزنید">
              <Input
                ltr
                type="text"
                value={s.sms.apiKey}
                onChange={(e) => set('sms.apiKey', e.target.value)}
                placeholder="کلید پنل پیامکی"
              />
            </Field>
            <Field label="شماره فرستنده / خط">
              <Input ltr value={s.sms.sender} onChange={(e) => set('sms.sender', e.target.value)} placeholder="مثلاً 3000xxxx" />
            </Field>
          </div>

          {s.sms.provider === 'console' && (
            <Alert kind="info">
              در حالت آزمایشی پیامک‌ها واقعاً ارسال نمی‌شوند و فقط در ترمینال سرور چاپ می‌گردند.
              برای ارسال واقعی، یکی از سرویس‌دهنده‌ها را انتخاب و کلید API آن را وارد کنید.
            </Alert>
          )}
        </div>
      </div>

      {/* ایمیل */}
      <div className="panel">
        <div className="panel-head">
          <h3>سرویس ایمیل (SMTP)</h3>
          <button className="btn soft sm" onClick={checkEmail}>بررسی اتصال</button>
        </div>
        <div className="panel-body">
          <Toggle on={s.email.enabled} onChange={(v) => set('email.enabled', v)} label="ارسال ایمیل فعال باشد" />

          <div className="form-grid mt-12">
            <Field label="آدرس سرور" hint="مثلاً smtp.gmail.com">
              <Input ltr value={s.email.host} onChange={(e) => set('email.host', e.target.value)} placeholder="smtp.example.com" />
            </Field>
            <Field label="پورت">
              <Input ltr type="number" value={s.email.port} onChange={(e) => set('email.port', Number(e.target.value))} />
            </Field>
            <Field label="نام کاربری">
              <Input ltr value={s.email.user} onChange={(e) => set('email.user', e.target.value)} />
            </Field>
            <Field label="رمز عبور" hint="برای حفظ رمز فعلی، این فیلد را دست نزنید">
              <Input ltr type="password" value={s.email.pass} onChange={(e) => set('email.pass', e.target.value)} />
            </Field>
            <Field label="فرستنده" hint='مثلاً "سالن رُز" <no-reply@salon.ir>'>
              <Input ltr value={s.email.from} onChange={(e) => set('email.from', e.target.value)} />
            </Field>
          </div>

          <Toggle on={s.email.secure} onChange={(v) => set('email.secure', v)} label="اتصال امن (SSL/TLS)" desc="برای پورت ۴۶۵ فعال و برای ۵۸۷ غیرفعال باشد" />

          {!s.email.host && (
            <Alert kind="info">
              تا زمانی که سرور SMTP تنظیم نشده باشد، ایمیل‌ها فقط در ترمینال سرور چاپ می‌شوند.
            </Alert>
          )}
        </div>
      </div>

      {/* اطلاع‌رسانی خودکار */}
      <div className="panel">
        <div className="panel-head"><h3>اطلاع‌رسانی خودکار</h3></div>
        <div className="panel-body">
          <Toggle on={s.notify.channels.sms} onChange={(v) => set('notify.channels.sms', v)} label="ارسال از طریق پیامک" />
          <Toggle on={s.notify.channels.email} onChange={(v) => set('notify.channels.email', v)} label="ارسال از طریق ایمیل" />
          <Toggle on={s.notify.onBooking} onChange={(v) => set('notify.onBooking', v)} label="هنگام ثبت نوبت" desc="تأییدیه با جزئیات نوبت برای مشتری ارسال می‌شود" />
          <Toggle on={s.notify.onReminder} onChange={(v) => set('notify.onReminder', v)} label="یادآوری پیش از نوبت" desc={`${toPersianDigits(s.reminderHoursBefore)} ساعت پیش از زمان نوبت`} />
          <Toggle on={s.notify.onCancel} onChange={(v) => set('notify.onCancel', v)} label="هنگام لغو نوبت" />
          <Toggle on={s.notify.onBirthday} onChange={(v) => set('notify.onBirthday', v)} label="تبریک تولد" desc="در روز تولد مشتری همراه با کد تخفیف" />
        </div>
      </div>

      {/* باشگاه مشتریان — فقط با ماژول بازاریابی */}
      {hasModule('marketing') && (<>
      <div className="panel">
        <div className="panel-head"><h3>باشگاه مشتریان و سطح‌بندی</h3></div>
        <div className="panel-body">
          <Toggle on={s.loyalty.enabled} onChange={(v) => set('loyalty.enabled', v)} label="باشگاه مشتریان فعال باشد" />

          <div className="form-grid mt-12">
            <Field label="هر چند تومان = ۱ امتیاز">
              <Input ltr type="number" value={s.loyalty.pointsPerUnit} onChange={(e) => set('loyalty.pointsPerUnit', Number(e.target.value))} />
            </Field>
            <Field label="ارزش هر امتیاز (تومان)">
              <Input ltr type="number" value={s.loyalty.pointValue} onChange={(e) => set('loyalty.pointValue', Number(e.target.value))} />
            </Field>
            <Field label="حداقل امتیاز برای استفاده">
              <Input ltr type="number" value={s.loyalty.minPointsToRedeem} onChange={(e) => set('loyalty.minPointsToRedeem', Number(e.target.value))} />
            </Field>
          </div>

          <label className="small bold">سطح‌های باشگاه</label>
          <p className="small muted" style={{ marginBottom: 10 }}>
            سطح هر مشتری بر اساس مجموع خریدش تعیین می‌شود و تخفیف سطح، خودکار روی فاکتور اعمال می‌گردد.
          </p>

          {s.loyalty.tiers.map((t, i) => (
            <div className="tier-edit-row" key={t.id}>
              <span className="tier-edit-icon">{t.icon}</span>
              <div className="form-grid grow">
                <Field label="عنوان سطح">
                  <Input
                    value={t.title}
                    onChange={(e) => {
                      const tiers = structuredClone(s.loyalty.tiers);
                      tiers[i].title = e.target.value;
                      set('loyalty.tiers', tiers);
                    }}
                  />
                </Field>
                <Field label="حداقل خرید (تومان)">
                  <Input
                    ltr
                    type="number"
                    value={t.minSpent}
                    onChange={(e) => {
                      const tiers = structuredClone(s.loyalty.tiers);
                      tiers[i].minSpent = Number(e.target.value);
                      set('loyalty.tiers', tiers);
                    }}
                  />
                </Field>
                <Field label="تخفیف دائمی (٪)">
                  <Input
                    ltr
                    type="number"
                    value={t.discountPercent}
                    onChange={(e) => {
                      const tiers = structuredClone(s.loyalty.tiers);
                      tiers[i].discountPercent = Number(e.target.value);
                      set('loyalty.tiers', tiers);
                    }}
                  />
                </Field>
                <Field label="ضریب امتیاز">
                  <Input
                    ltr
                    type="number"
                    step="0.25"
                    value={t.pointsMultiplier}
                    onChange={(e) => {
                      const tiers = structuredClone(s.loyalty.tiers);
                      tiers[i].pointsMultiplier = Number(e.target.value);
                      set('loyalty.tiers', tiers);
                    }}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* دعوت از دوستان */}
      <div className="panel">
        <div className="panel-head"><h3>دعوت از دوستان</h3></div>
        <div className="panel-body">
          <Toggle on={s.referral.enabled} onChange={(v) => set('referral.enabled', v)} label="برنامه‌ی دعوت فعال باشد" />
          <div className="form-grid mt-12">
            <Field label="اعتبار هدیه به معرف (تومان)">
              <Input ltr type="number" value={s.referral.referrerReward} onChange={(e) => set('referral.referrerReward', Number(e.target.value))} />
            </Field>
            <Field label="اعتبار هدیه به مشتری تازه (تومان)">
              <Input ltr type="number" value={s.referral.refereeReward} onChange={(e) => set('referral.refereeReward', Number(e.target.value))} />
            </Field>
          </div>
          <Toggle
            on={s.referral.rewardOnFirstDone}
            onChange={(v) => set('referral.rewardOnFirstDone', v)}
            label="پاداش پس از اولین نوبت انجام‌شده"
            desc="جلوی سوءاستفاده از ثبت‌نام‌های تکراری را می‌گیرد"
          />
        </div>
      </div>

      {/* نظرسنجی */}
      <div className="panel">
        <div className="panel-head"><h3>نظرسنجی مشتریان</h3></div>
        <div className="panel-body">
          <Toggle on={s.reviews.enabled} onChange={(v) => set('reviews.enabled', v)} label="نظرسنجی فعال باشد" />
          <Toggle
            on={s.reviews.autoPublish}
            onChange={(v) => set('reviews.autoPublish', v)}
            label="انتشار خودکار نظرها"
            desc="در غیر این صورت هر نظر پس از تأیید شما منتشر می‌شود"
          />
          <Toggle
            on={s.notify.onReviewRequest}
            onChange={(v) => set('notify.onReviewRequest', v)}
            label="ارسال درخواست نظر پس از نوبت"
          />
          <div className="form-grid mt-12">
            <Field label="چند ساعت پس از نوبت درخواست ارسال شود">
              <Input ltr type="number" value={s.reviews.requestAfterHours} onChange={(e) => set('reviews.requestAfterHours', Number(e.target.value))} />
            </Field>
          </div>
        </div>
      </div>

      </>)}

      {/* رمز مدیر */}
      <div className="panel">
        <div className="panel-head"><h3>تغییر رمز عبور مدیر</h3></div>
        <div className="panel-body">
          <div className="form-grid">
            <Field label="رمز فعلی">
              <Input ltr type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            </Field>
            <Field label="رمز تازه">
              <Input ltr type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            </Field>
          </div>
          <button className="btn outline sm" onClick={changePassword}>تغییر رمز</button>
        </div>
      </div>

      <div
        style={{
          position: 'sticky', bottom: 16, marginTop: 20, display: 'flex',
          justifyContent: 'center', zIndex: 20,
        }}
      >
        <button className="btn" onClick={save} disabled={busy} style={{ maxWidth: 300 }}>
          {busy ? <span className="spinner sm on-dark" /> : '💾 ذخیره‌ی همه‌ی تنظیمات'}
        </button>
      </div>

      <Sheet open={holidayPicker} onClose={() => setHolidayPicker(false)} title="افزودن روز تعطیل" sub="در این روز هیچ نوبتی باز نمی‌شود">
        <JalaliCalendar
          value={todayISO()}
          maxAdvanceDays={365}
          onChange={(iso) => {
            if (!s.holidays.includes(iso)) set('holidays', [...s.holidays, iso].sort());
            setHolidayPicker(false);
          }}
        />
      </Sheet>
    </>
  );
}
