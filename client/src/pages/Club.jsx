import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp, useAsync } from '../lib/store.jsx';
import { TopBar, Spinner, Alert, Price, Empty, Input, Sheet } from '../components/ui.jsx';
import { toPersianDigits, formatJalali } from '@shared/jalali.js';

const LEDGER_LABELS = { points: 'امتیاز', credit: 'اعتبار' };

export default function Club() {
  const nav = useNavigate();
  const { toast, user, setUser } = useApp();
  const [copied, setCopied] = useState('');
  const [showLedger, setShowLedger] = useState(false);
  const [refInput, setRefInput] = useState('');
  const [refBusy, setRefBusy] = useState(false);
  const [refError, setRefError] = useState('');

  const { data, loading, error, reload } = useAsync(() => api.club(), []);
  const { data: ledgerData } = useAsync(() => api.clubLedger(), [showLedger]);
  const club = data?.club;

  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      toast('کپی شد');
      setTimeout(() => setCopied(''), 1800);
    } catch {
      toast('مرورگر اجازه‌ی کپی نداد', 'error');
    }
  }

  async function share() {
    const text = `سلام! با کد معرف من «${club.referral.code}» در سالن زیبایی ثبت‌نام کن و هدیه بگیر 🌸`;
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch { /* کاربر لغو کرد */ }
    }
    copy(text, 'share');
  }

  async function submitReferral() {
    setRefError('');
    if (!refInput.trim()) return;
    setRefBusy(true);
    try {
      const res = await api.applyReferral(refInput.trim().toUpperCase());
      setUser(res.user);
      toast(`کد معرف ${res.referrerName} ثبت شد 🎉`);
      setRefInput('');
      reload();
    } catch (err) {
      setRefError(err.message);
    } finally {
      setRefBusy(false);
    }
  }

  if (loading) return <div className="screen"><Spinner /></div>;
  if (error || !club) {
    return (
      <div className="screen">
        <TopBar title="باشگاه مشتریان" />
        <div className="screen-body"><Alert kind="error">{error}</Alert></div>
      </div>
    );
  }

  return (
    <div className="screen">
      <TopBar title="باشگاه مشتریان" sub="امتیاز، اعتبار و دعوت از دوستان" />

      <div className="screen-body">
        {/* کارت سطح */}
        <div className="tier-card">
          <div className="tier-top">
            <div>
              <div className="tier-label">سطح شما</div>
              <div className="tier-name">
                {club.tier?.icon} {club.tier?.title}
              </div>
            </div>
            {club.tier?.discountPercent > 0 && (
              <div className="tier-off">
                <div className="v">{toPersianDigits(club.tier.discountPercent)}٪</div>
                <div className="k">تخفیف دائمی</div>
              </div>
            )}
          </div>

          {club.nextTier ? (
            <>
              <div className="tier-bar">
                <div className="fill" style={{ width: club.tierPercent + '%' }} />
              </div>
              <div className="tier-hint">
                <Price amount={club.remainingToNext} /> خرید دیگر تا سطح{' '}
                <b>{club.nextTier.icon} {club.nextTier.title}</b>
                {club.nextTier.discountPercent > 0 && (
                  <> (با {toPersianDigits(club.nextTier.discountPercent)}٪ تخفیف دائمی)</>
                )}
              </div>
            </>
          ) : (
            <div className="tier-hint">شما در بالاترین سطح باشگاه هستید 🎉</div>
          )}
        </div>

        {/* امتیاز و اعتبار */}
        <div className="stat-row mt-16">
          <div className="stat-box">
            <div className="v">{toPersianDigits(club.points)}</div>
            <div className="k">امتیاز</div>
          </div>
          <div className="stat-box">
            <div className="v" style={{ fontSize: 13 }}><Price amount={club.redeemableValue} /></div>
            <div className="k">ارزش امتیاز</div>
          </div>
          <div className="stat-box">
            <div className="v" style={{ fontSize: 13 }}><Price amount={club.credit} /></div>
            <div className="k">اعتبار حساب</div>
          </div>
        </div>

        {club.points > 0 && club.redeemableValue === 0 && (
          <Alert kind="info">
            برای استفاده از امتیازها حداقل {toPersianDigits(club.minPointsToRedeem)} امتیاز لازم است.
          </Alert>
        )}

        <button className="btn soft mt-12" onClick={() => setShowLedger(true)}>
          📜 گردش امتیاز و اعتبار
        </button>

        {/* دعوت از دوستان */}
        {club.referral.enabled && (
          <div className="section">
            <div className="section-head"><h2>دعوت از دوستان</h2></div>

            <div className="referral-card">
              <div className="ref-title">کد معرف شما</div>
              <button className="ref-code" onClick={() => copy(club.referral.code, 'code')}>
                {club.referral.code}
                <span className="copy-hint">{copied === 'code' ? '✓ کپی شد' : 'کپی'}</span>
              </button>

              <p className="ref-desc">
                دوستتان با این کد ثبت‌نام می‌کند و <b><Price amount={club.referral.refereeReward} /></b> هدیه
                می‌گیرد. پس از اولین نوبتش، <b><Price amount={club.referral.referrerReward} /></b> اعتبار هم به
                شما تعلق می‌گیرد.
              </p>

              <button className="btn" onClick={share}>📤 ارسال دعوت‌نامه</button>

              <div className="ref-stats">
                <div>
                  <div className="v">{toPersianDigits(club.referral.invitedCount)}</div>
                  <div className="k">دعوت‌شده</div>
                </div>
                <div>
                  <div className="v">{toPersianDigits(club.referral.rewardedCount)}</div>
                  <div className="k">پاداش گرفته</div>
                </div>
                <div>
                  <div className="v" style={{ fontSize: 13 }}>
                    <Price amount={club.referral.rewardedCount * club.referral.referrerReward} />
                  </div>
                  <div className="k">مجموع پاداش</div>
                </div>
              </div>
            </div>

            {/* ثبت کد معرف برای کسانی که هنوز ثبت نکرده‌اند */}
            {!user?.referredBy && (
              <div className="card mt-12">
                <div className="bold small" style={{ marginBottom: 8 }}>کد معرف دارید؟</div>
                <Alert kind="error">{refError}</Alert>
                <div className="row" style={{ gap: 8 }}>
                  <Input
                    wrapClass="grow"
                    ltr
                    placeholder="کد معرف دوستتان"
                    value={refInput}
                    onChange={(e) => setRefInput(e.target.value.toUpperCase())}
                  />
                  <button className="btn sm" onClick={submitReferral} disabled={refBusy || !refInput.trim()}>
                    {refBusy ? <span className="spinner sm on-dark" /> : 'ثبت'}
                  </button>
                </div>
                <p className="small muted mt-8">
                  با ثبت کد، <Price amount={club.referral.refereeReward} /> اعتبار هدیه می‌گیرید.
                </p>
              </div>
            )}
          </div>
        )}

        <button className="btn soft mt-20" onClick={() => nav('/explore')}>
          رزرو نوبت و کسب امتیاز
        </button>
      </div>

      {/* گردش حساب */}
      <Sheet
        open={showLedger}
        onClose={() => setShowLedger(false)}
        title="گردش امتیاز و اعتبار"
        sub="آخرین تغییرات حساب شما"
      >
        {!ledgerData?.entries?.length ? (
          <Empty icon="📜" title="هنوز گردشی ثبت نشده" text="با اولین نوبت، امتیاز می‌گیرید" />
        ) : (
          ledgerData.entries.map((e) => {
            const amount = e.points || e.credit;
            const positive = amount > 0;
            return (
              <div key={e.id} className="ledger-row">
                <span className={'ledger-sign ' + (positive ? 'plus' : 'minus')}>
                  {positive ? '+' : '−'}
                </span>
                <div className="grow">
                  <div className="small bold">{e.note || LEDGER_LABELS[e.kind]}</div>
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
        <button className="btn soft mt-16" onClick={() => setShowLedger(false)}>بستن</button>
      </Sheet>
    </div>
  );
}
