'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useDisconnect, useSignMessage, useSendTransaction, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, parseUnits, type Address } from 'viem';
import { TantoConnectButton } from '@sky-mavis/tanto-widget';
import { SiweMessage } from 'siwe';
import styles from './PredictionsGate.module.css';

const USDC_CONTRACT = (process.env.NEXT_PUBLIC_USDC_CONTRACT_RONIN || '0x0b7007c13325c48911f73a2dad5fa5dcbf808adc') as Address;
const PAYMENT_RECIPIENT = (process.env.NEXT_PUBLIC_PAYMENT_RECIPIENT || '') as Address;
const USDC_ABI = [{ name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }] as const;

type Plan = 'DAILY' | 'WEEKLY' | 'SEASON';
type Token = 'RON' | 'USDC';
type GateState = 'loading' | 'unauthenticated' | 'signing' | 'no-access' | 'paying' | 'verifying' | 'active';

interface PlanInfo { usd: number; ronDisplay: string; ronWei: string; usdcDisplay: string; usdcSmallest: string; }
interface PriceData { ronUsdRate: number; plans: Record<Plan, PlanInfo>; }

const PLAN_LABELS: Record<Plan, { title: string; duration: string; badge?: string }> = {
  DAILY:  { title: 'DAILY',  duration: '24 hours' },
  WEEKLY: { title: 'WEEKLY', duration: '7 days', badge: 'POPULAR' },
  SEASON: { title: 'SEASON', duration: '90 days', badge: 'BEST VALUE' },
};
const PLAN_USD: Record<Plan, number> = { DAILY: 1, WEEKLY: 5, SEASON: 20 };

interface Props { children: React.ReactNode; }

export default function PredictionsGate({ children }: Props) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const [gateState, setGateState] = useState<GateState>('loading');
  const [isTestMode, setIsTestMode] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan>('WEEKLY');
  const [selectedToken, setSelectedToken] = useState<Token>('USDC');
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();

  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: pendingTxHash });

  // On mount: check existing paid session
  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(d => {
        if (d.hasAccess) {
          setIsTestMode(d.isTestMode);
          setExpiresAt(d.expiresAt);
          setGateState('active');
        } else {
          setGateState('unauthenticated');
        }
      })
      .catch(() => setGateState('unauthenticated'));
  }, []);

  // When wallet connects and we're at login screen → auto trigger SIWE
  useEffect(() => {
    if (isConnected && address && gateState === 'unauthenticated') {
      performSiweAuth(address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  // When on-chain tx confirms → verify server-side
  useEffect(() => {
    if (txConfirmed && pendingTxHash) {
      verifyPayment(pendingTxHash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txConfirmed, pendingTxHash]);

  // Load prices when user needs to pay
  useEffect(() => {
    if (gateState === 'no-access') {
      fetch('/api/payments/ron-price').then(r => r.json()).then(setPriceData).catch(() => {});
    }
  }, [gateState]);

  // ── TEST MODE: no wallet, no SIWE, no server call ─────────────────
  const handleTestMode = useCallback(() => {
    setIsTestMode(true);
    setGateState('active');
  }, []);

  // ── SIWE sign-in flow (for paid plans) ────────────────────────────
  const performSiweAuth = useCallback(async (walletAddress: string) => {
    setError('');
    setGateState('signing');
    setStatusMsg('Generating sign-in message…');
    try {
      const { nonce } = await fetch('/api/auth/nonce').then(r => r.json());
      const siweMessage = new SiweMessage({
        domain: window.location.hostname,
        address: walletAddress,
        uri: window.location.origin,
        version: '1',
        chainId: 2020,
        nonce,
        statement: 'Sign in to Grand Arena Tools Predictions',
        expirationTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      setStatusMsg('Please sign the message in your wallet…');
      const signature = await signMessageAsync({ message: siweMessage.prepareMessage() });
      setStatusMsg('Verifying identity…');
      const res = await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: siweMessage, signature, walletAddress, requestTestMode: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auth failed');
      setIsTestMode(data.isTestMode);
      setExpiresAt(data.expiresAt);
      setGateState(data.hasAccess ? 'active' : 'no-access');
      setStatusMsg('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setGateState('unauthenticated');
      setStatusMsg('');
      disconnect();
    }
  }, [signMessageAsync, disconnect]);

  // ── Logout ────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/session', { method: 'DELETE' });
    setIsTestMode(false);
    setExpiresAt(null);
    setGateState('unauthenticated');
    disconnect();
  }, [disconnect]);

  // ── Payment ───────────────────────────────────────────────────────
  const handlePay = useCallback(async () => {
    if (!priceData || !address) return;
    setError('');
    setGateState('paying');
    const planInfo = priceData.plans[selectedPlan];
    try {
      let txHash: `0x${string}`;
      if (selectedToken === 'RON') {
        setStatusMsg(`Sending ${planInfo.ronDisplay} RON…`);
        txHash = await sendTransactionAsync({ to: PAYMENT_RECIPIENT, value: parseEther(planInfo.ronDisplay) });
      } else {
        setStatusMsg(`Sending ${planInfo.usdcDisplay} USDC…`);
        txHash = await writeContractAsync({ address: USDC_CONTRACT, abi: USDC_ABI, functionName: 'transfer', args: [PAYMENT_RECIPIENT, parseUnits(planInfo.usdcDisplay, 6)] });
      }
      setGateState('verifying');
      setStatusMsg('Waiting for confirmation…');
      setPendingTxHash(txHash);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setGateState('no-access');
      setStatusMsg('');
    }
  }, [priceData, address, selectedPlan, selectedToken, sendTransactionAsync, writeContractAsync]);

  const verifyPayment = useCallback(async (txHash: string) => {
    setStatusMsg('Verifying payment on-chain…');
    try {
      const res = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash, plan: selectedPlan, token: selectedToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setExpiresAt(data.expiresAt);
      setIsTestMode(false);
      setGateState('active');
      setStatusMsg('');
      setPendingTxHash(undefined);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setGateState('no-access');
      setStatusMsg('');
      setPendingTxHash(undefined);
    }
  }, [selectedPlan, selectedToken]);

  // Inject isTestMode into children (→ PredictionsTab) via cloneElement
  const childrenWithProps = React.Children.map(children, child =>
    React.isValidElement(child)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? React.cloneElement(child as React.ReactElement<any>, { isTestMode })
      : child
  );

  // ── Render ────────────────────────────────────────────────────────

  if (gateState === 'loading' || gateState === 'signing') {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.spinner} />
        {statusMsg && <p className={styles.statusMsg}>{statusMsg}</p>}
      </div>
    );
  }

  if (gateState === 'active') {
    return (
      <div className={styles.activeWrapper}>
        {isTestMode && (
          <div className={styles.testBanner}>
            ⚠️ TEST MODE — Scores &amp; rankings are simulated &nbsp;
            <button className={styles.upgradeBannerBtn} onClick={() => { setIsTestMode(false); setGateState('unauthenticated'); }}>
              UPGRADE TO REAL DATA
            </button>
          </div>
        )}
        {!isTestMode && address && (
          <div className={styles.sessionBar}>
            <span className={styles.walletBadge}>
              <span className={styles.greenDot} />
              {address.slice(0, 6)}…{address.slice(-4)}
            </span>
            {expiresAt && <span className={styles.expiryLabel}>Access until {new Date(expiresAt).toLocaleDateString()}</span>}
            <button className={styles.logoutBtn} onClick={handleLogout}>LOG OUT</button>
          </div>
        )}
        {childrenWithProps}
      </div>
    );
  }

  if (gateState === 'paying' || gateState === 'verifying') {
    return (
      <div className={styles.loadingWrapper}>
        <div className={styles.spinner} />
        <p className={styles.statusMsg}>{statusMsg}</p>
        <p className={styles.statusSubMsg}>Do not close this window</p>
      </div>
    );
  }

  if (gateState === 'no-access') {
    const planInfo = priceData?.plans[selectedPlan];
    return (
      <div className={styles.gate}>
        <div className={styles.gateCard}>
          <div className={styles.walletConnectedRow}>
            <span className={styles.greenDot} />
            <span className={styles.walletSmall}>{address?.slice(0, 8)}…{address?.slice(-4)}</span>
            <button className={styles.logoutLink} onClick={handleLogout}>Log out</button>
          </div>
          <h2 className={styles.gateTitle}>CHOOSE YOUR PLAN</h2>
          <p className={styles.gateSubtitle}>Unlock AI-powered lineup predictions</p>
          <div className={styles.planGrid}>
            {(Object.keys(PLAN_LABELS) as Plan[]).map(plan => (
              <button key={plan} className={`${styles.planCard} ${selectedPlan === plan ? styles.planCardActive : ''}`} onClick={() => setSelectedPlan(plan)}>
                {PLAN_LABELS[plan].badge && <span className={styles.planBadge}>{PLAN_LABELS[plan].badge}</span>}
                <span className={styles.planTitle}>{PLAN_LABELS[plan].title}</span>
                <span className={styles.planDuration}>{PLAN_LABELS[plan].duration}</span>
                <span className={styles.planPrice}>${PLAN_USD[plan]}</span>
              </button>
            ))}
          </div>
          <div className={styles.tokenToggle}>
            <button className={`${styles.tokenBtn} ${selectedToken === 'USDC' ? styles.tokenActive : ''}`} onClick={() => setSelectedToken('USDC')}>USDC</button>
            <button className={`${styles.tokenBtn} ${selectedToken === 'RON' ? styles.tokenActive : ''}`} onClick={() => setSelectedToken('RON')}>RON</button>
          </div>
          {planInfo && (
            <div className={styles.priceDisplay}>
              {selectedToken === 'USDC'
                ? <span>{planInfo.usdcDisplay} USDC</span>
                : <span>≈ {planInfo.ronDisplay} RON <small>at current rate</small></span>}
            </div>
          )}
          {error && <p className={styles.errorMsg}>⚠️ {error}</p>}
          <button className={styles.payBtn} onClick={handlePay} disabled={!priceData}>PAY WITH {selectedToken}</button>
          <p className={styles.disclaimer}>
            Payment sent to {PAYMENT_RECIPIENT.slice(0, 6)}…{PAYMENT_RECIPIENT.slice(-4)} on Ronin Network
          </p>
        </div>
      </div>
    );
  }

  // ── Unauthenticated: lock screen ──────────────────────────────────
  return (
    <div className={styles.gate}>
      <div className={styles.gateCard}>
        <div className={styles.lockIcon}>🔐</div>
        <h2 className={styles.gateTitle}>PREDICTIONS</h2>
        <p className={styles.gateSubtitle}>
          AI-powered lineup predictions &amp; ranking for Grand Arena competitive play.
        </p>
        {error && <p className={styles.errorMsg}>⚠️ {error}</p>}
        <div className={styles.connectBtnWrapper}>
          <TantoConnectButton />
        </div>
        <div className={styles.divider}><span>or</span></div>
        <button className={styles.testModeBtn} onClick={handleTestMode}>
          Try TEST MODE <span className={styles.freeTag}>FREE</span>
        </button>
        <p className={styles.testModeHint}>Simulated data — no payment or wallet required</p>
      </div>
    </div>
  );
}
