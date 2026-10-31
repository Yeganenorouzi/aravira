import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { TopBar, Spinner, Alert, Art, Price, Duration, Input } from '../components/ui.jsx';
import { formatJalali, formatTime, toPersianDigits } from '@shared/jalali.js';

const PAY_METHODS = [
  { id: 'cash', ico: '💵', name: 'پرداخت در محل', desc: 'هنگام مراجعه به سالن پرداخت می‌کنید' },
  { id: 'card', ico: '🏦', name: 'کارت به کارت', desc: 'شماره کارت پس از ثبت نوبت ارسال می‌شود' },
];

export default function Summary() {
  const nav = useNavigate();
  const { booking, clearBooking, user, toast, settings, hasModule } = useApp();
  const marketing = hasModule('marketing');

  const [pay, setPay] = useState(booking.paymentMethod || 'cash');
  const [note, setNote] = useState(booking.note || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // تخفیف‌ها
  const [promoInput, setPromoInput] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [giftInput, setGiftInput] = useState('');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [usePoints, setUsePoints] = useState(false);
  const [useCredit, setUseCredit] = useState(false);

  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [club, setClub] = useState(null);
  const [discountError, setDiscountError] = useState('');

  useEffect(() => {
    if (!booking.serviceId || !booking.staffId || !booking.date || !booking.time) {
      nav('/explore', { replace: true });
    }
  }, [booking, nav]);

  useEffect(() => {
    if (!marketing) return;
    api.club().then((r) => setClub(r.club)).catch(() => {});
  }, [marketing]);

  /* محاسبه‌ی فاکتور با هر تغییر در تخفیف‌ها */
  const refreshQuote = useCallback(async () => {
    if (!booking.serviceId) return;
    setQuoteLoading(true);
    try {
      const res = await api.quote({
        serviceId: booking.serviceId,
        promoCode,
        giftCardCode,
        usePoints,
        useCredit,
      });
      setQuote(res);
      setDiscountError(res.errors?.[0] || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setQuoteLoading(false);
    }
  }, [booking.serviceId, promoCode, giftCardCode, usePoints, useCredit]);

  useEffect(() => { refreshQuote(); }, [refreshQuote]);

  async function applyPromo() {
    setDiscountError('');
    const code = promoInput.trim();
    if (!code) return;
    try {
      const res = await api.checkPromo(code, booking.serviceId);
      setPromoCode(res.code);
      toast(`کد «${res.code}» اعمال شد`);
    } catch (err) {
      setDiscountError(err.message);
      setPromoCode('');
    }
  }

  async function applyGift() {
    setDiscountError('');
    const code = giftInput.trim();
    if (!code) return;
    try {
      const res = await api.checkGiftCard(code);
      setGiftCardCode(res.code);
      toast('کارت هدیه اعمال شد');
    } catch (err) {
      setDiscountError(err.message);
      setGiftCardCode('');
    }
  }

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const res = await api.book({
        serviceId: booking.serviceId,
        staffId: booking.staffId,
        date: booking.date,
        time: booking.time,
        paymentMethod: pay,
        note,
        promoCode,
        giftCardCode,
        usePoints,
        useCredit,
      });
      toast('نوبت شما ثبت شد 🌸');
      clearBooking();
      nav('/book/success/' + res.appointment.id, { replace: true });
    } catch (err) {
      setError(err.message);
      if (err.status === 409) setTimeout(() => nav('/book/time'), 2200);
    } finally {
      setBusy(false);
    }
  }

  if (quoteLoading && !quote) return <div className="screen"><Spinner /></div>;
  const price = quote?.price;
  if (!price) return <div className="screen"><Spinner /></div>;

  const canUsePoints = club && club.redeemableValue > 0;
  const canUseCredit = club && club.credit > 0;

  return (
    <div className="screen has-cta">
      <TopBar title="خلاصه‌ی رزرو" sub="جزئیات نوبت خود را بررسی کنید" />

      <div className="screen-body">
        <Alert kind="error">{error}</Alert>

        {/* خدمت انتخابی */}
        <div className="card">
          <div className="summary-item">
            <Art item={booking.service} />
            <div className="grow">
              <div className="bold">{booking.service?.title}</div>
              <div className="small muted">با {booking.staff?.name}</div>
            </div>
            {price.tierTitle && club?.tier && (
              <span className="badge rose nowrap">
                {club.tier.icon} {price.tierTitle}
              </span>
            )}
          </div>

          <div className="detail-line">
            <span className="ico">📅</span>
            <span className="txt">
              <span className="k">تاریخ</span>
              <div className="v">{formatJalali(booking.date, { withWeekday: true })}</div>
            </span>
          </div>
          <div className="detail-line">
            <span className="ico">⏰</span>
            <span className="txt">
              <span className="k">ساعت</span>
              <div className="v">
                <bdi>{formatTime(booking.time)}</bdi> • <bdi><Duration minutes={booking.service?.duration} /></bdi>
              </div>
            </span>
          </div>
          <div className="detail-line">
            <span className="ico">📍</span>
            <span className="txt">
              <span className="k">آدرس</span>
              <div className="v" style={{ fontSize: 12.5 }}>{settings?.address}</div>
            </span>
          </div>
        </div>

        {/* تخفیف‌ها — بخشی از ماژول بازاریابی */}
        {marketing && (
        <div className="section">
          <div className="section-head">
            <h2>تخفیف و اعتبار</h2>
            {price.totalSaved > 0 && (
              <span className="badge confirmed">
                <Price amount={price.totalSaved} /> صرفه‌جویی
              </span>
            )}
          </div>

          <Alert kind="error">{discountError}</Alert>

          <div className="card">
            {/* کد تخفیف */}
            <div className="redeem-row">
              <span className="ico">🏷️</span>
              <div className="grow">
                {promoCode ? (
                  <div className="row between">
                    <div>
                      <div className="bold small">کد {promoCode}</div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        <Price amount={price.promoDiscount} /> تخفیف
                      </div>
                    </div>
                    <button
                      className="btn xs outline"
                      onClick={() => { setPromoCode(''); setPromoInput(''); }}
                    >
                      حذف
                    </button>
                  </div>
                ) : (
                  <div className="row" style={{ gap: 8 }}>
                    <Input
                      wrapClass="grow"
                      ltr
                      placeholder="کد تخفیف"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                    />
                    <button className="btn sm" onClick={applyPromo} disabled={!promoInput.trim()}>
                      اعمال
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* کارت هدیه */}
            <div className="redeem-row">
              <span className="ico">🎁</span>
              <div className="grow">
                {giftCardCode ? (
                  <div className="row between">
                    <div>
                      <div className="bold small">کارت {giftCardCode}</div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        <Price amount={price.giftCardUsed} /> استفاده شد
                      </div>
                    </div>
                    <button
                      className="btn xs outline"
                      onClick={() => { setGiftCardCode(''); setGiftInput(''); }}
                    >
                      حذف
                    </button>
                  </div>
                ) : (
                  <div className="row" style={{ gap: 8 }}>
                    <Input
                      wrapClass="grow"
                      ltr
                      placeholder="کد کارت هدیه"
                      value={giftInput}
                      onChange={(e) => setGiftInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && applyGift()}
                    />
                    <button className="btn sm" onClick={applyGift} disabled={!giftInput.trim()}>
                      اعمال
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* امتیاز باشگاه */}
            {canUsePoints && (
              <label className="redeem-row clickable">
                <span className="ico">⭐</span>
                <div className="grow">
                  <div className="bold small">استفاده از امتیاز باشگاه</div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    <bdi>{toPersianDigits(club.points)} امتیاز</bdi> • معادل <bdi><Price amount={club.redeemableValue} /></bdi>
                  </div>
                </div>
                <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} />
              </label>
            )}

            {/* اعتبار حساب */}
            {canUseCredit && (
              <label className="redeem-row clickable">
                <span className="ico">💰</span>
                <div className="grow">
                  <div className="bold small">استفاده از اعتبار حساب</div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    موجودی: <Price amount={club.credit} />
                  </div>
                </div>
                <input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} />
              </label>
            )}

            {!canUsePoints && !canUseCredit && club && (
              <p className="small muted center" style={{ paddingTop: 8 }}>
                با هر خرید امتیاز می‌گیرید و در نوبت‌های بعدی می‌توانید خرجش کنید.
              </p>
            )}
          </div>
        </div>
        )}

        {/* یادداشت */}
        <div className="section">
          <div className="section-head"><h2>یادداشت (اختیاری)</h2></div>
          <div className="input-wrap">
            <textarea
              placeholder="اگر نکته‌ای هست بنویسید، مثلاً حساسیت پوستی یا درخواست خاص..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
            />
          </div>
        </div>

        {/* فاکتور */}
        <div className="section">
          <div className="section-head">
            <h2>صورتحساب</h2>
            {quoteLoading && <span className="spinner sm" />}
          </div>
          <div className="card">
            <div className="price-line">
              <span>مبلغ خدمت</span>
              <span className="num"><Price amount={price.subtotal} /></span>
            </div>
            {price.serviceDiscount > 0 && (
              <div className="price-line off">
                <span>تخفیف خدمت ({toPersianDigits(price.serviceDiscountPercent)}٪)</span>
                <span className="num">−<Price amount={price.serviceDiscount} /></span>
              </div>
            )}
            {price.tierDiscount > 0 && (
              <div className="price-line off">
                <span>تخفیف سطح {price.tierTitle} ({toPersianDigits(price.tierDiscountPercent)}٪)</span>
                <span className="num">−<Price amount={price.tierDiscount} /></span>
              </div>
            )}
            {price.promoDiscount > 0 && (
              <div className="price-line off">
                <span>کد تخفیف {price.promoCode}</span>
                <span className="num">−<Price amount={price.promoDiscount} /></span>
              </div>
            )}
            <div className="price-line">
              <span>مالیات بر ارزش افزوده ({toPersianDigits(price.taxPercent)}٪)</span>
              <span className="num"><Price amount={price.tax} /></span>
            </div>
            <div className="price-line" style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 6 }}>
              <span className="bold">جمع کل</span>
              <span className="num bold"><Price amount={price.total} /></span>
            </div>

            {price.pointsValue > 0 && (
              <div className="price-line off">
                <span>امتیاز باشگاه ({toPersianDigits(price.pointsUsed)} امتیاز)</span>
                <span className="num">−<Price amount={price.pointsValue} /></span>
              </div>
            )}
            {price.giftCardUsed > 0 && (
              <div className="price-line off">
                <span>کارت هدیه</span>
                <span className="num">−<Price amount={price.giftCardUsed} /></span>
              </div>
            )}
            {price.creditUsed > 0 && (
              <div className="price-line off">
                <span>اعتبار حساب</span>
                <span className="num">−<Price amount={price.creditUsed} /></span>
              </div>
            )}

            <div className="price-line total">
              <span>مبلغ قابل پرداخت</span>
              <span className="num"><Price amount={price.payable} /></span>
            </div>

            {price.payable === 0 && (
              <Alert kind="ok">این نوبت کاملاً با اعتبار و هدیه‌ی شما تسویه شد 🎉</Alert>
            )}
          </div>
        </div>

        {/* روش پرداخت */}
        {price.payable > 0 && (
          <div className="section">
            <div className="section-head"><h2>روش پرداخت</h2></div>
            {PAY_METHODS.map((m) => (
              <button
                key={m.id}
                className={'pay-option' + (pay === m.id ? ' on' : '')}
                onClick={() => setPay(m.id)}
              >
                <span className="ico">{m.ico}</span>
                <span className="grow">
                  <span className="name" style={{ display: 'block' }}>{m.name}</span>
                  <span className="desc">{m.desc}</span>
                </span>
                <span className="radio-mark">✓</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="cta-bar">
        <button className="btn" onClick={submit} disabled={busy || quoteLoading}>
          {busy ? <span className="spinner sm on-dark" /> : 'تأیید و ثبت نوبت'}
        </button>
        <div className="hint">🔒 اطلاعات شما نزد ما محفوظ است</div>
      </div>
    </div>
  );
}
