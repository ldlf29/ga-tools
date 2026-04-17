'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useDisconnect, useSignMessage, useSendTransaction, useWriteContract, useWaitForTransactionReceipt, useConnect } from 'wagmi';

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
interface PriceData { ronUsdRate: number; plans: Record<Plan, PlanInfo>; discountedPlans?: Record<Plan, PlanInfo>; }

const PLAN_LABELS: Record<Plan, { title: string; duration: string; badge?: string }> = {
  DAILY: { title: '3-DAYS', duration: '72 hours' },
  WEEKLY: { title: 'WEEKLY', duration: '7 days', badge: 'POPULAR' },
  SEASON: { title: 'SEASON', duration: '5 WEEKS', badge: 'BEST VALUE' },
};
const PLAN_USD: Record<Plan, number> = { DAILY: 3, WEEKLY: 5, SEASON: 25 };

interface Props {
  children: React.ReactNode;
  hasUserCards?: boolean;
  onLoadCards?: () => void;
  onManageWallets?: () => void;
}

export default function PredictionsGate({ children, hasUserCards, onLoadCards, onManageWallets }: Props) {
  const { address, isConnected, status: accountStatus } = useAccount();
  // Suppress 'Connector not connected' wagmi error globally — our logout doesn't require
  // the connector to be in a connected state; session clearing is server-side
  const { disconnect } = useDisconnect({ mutation: { onError: () => { } } });
  const { signMessageAsync } = useSignMessage();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { connect, connectors } = useConnect();
  // Prevent concurrent SIWE auth attempts
  const authInProgress = React.useRef(false);
  // Track if the wallet actively connected (went through 'connecting') vs was already connected on load
  // We use this to avoid auto-triggering SIWE on page refresh without user action
  const walletActivelyConnected = React.useRef(false);


  const [gateState, setGateState] = useState<GateState>('loading');
  const [isTestMode, setIsTestMode] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan>('WEEKLY');
  const [selectedToken, setSelectedToken] = useState<Token>('USDC');
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();
  const [referralInputText, setReferralInputText] = useState('');
  const [appliedReferral, setAppliedReferral] = useState('');
  const [referralError, setReferralError] = useState(false);
  // Track if SIWE was already completed in this session (wallet connected + signed)
  const [siweCompleted, setSiweCompleted] = useState(false);
  // Wallet address from server session (persists even if wagmi wallet disconnects)
  const [sessionWallet, setSessionWallet] = useState<string | null>(null);
  // Active plan type (used to disable EXTEND for SEASON)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  // Track if we came to the payment screen via the EXTEND button
  const [isExtending, setIsExtending] = useState(false);

  const { isSuccess: txConfirmed, isError: txError } = useWaitForTransactionReceipt({ hash: pendingTxHash });

  // On mount: check existing paid session and recover any pending transactions
  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(d => {
        if (d.hasAccess) {
          // Active subscription → show content directly
          setIsTestMode(d.isTestMode);
          setExpiresAt(d.expiresAt);
          if (d.walletAddress) setSessionWallet(d.walletAddress);
          if (d.planType) setCurrentPlan(d.planType);
          setGateState('active');
          // If they have access, clear any stale pending tx
          localStorage.removeItem('ga_pending_tx');
        } else if (d.isSigned && d.walletAddress) {
          // Valid JWT but no subscription → already signed, go to payment
          setSiweCompleted(true);
          setSessionWallet(d.walletAddress);
          
          // RECOVERY LOGIC
          const savedTx = localStorage.getItem('ga_pending_tx');
          if (savedTx) {
            setPendingTxHash(savedTx as `0x${string}`);
            const savedPlan = localStorage.getItem('ga_pending_plan') as Plan;
            const savedToken = localStorage.getItem('ga_pending_token') as Token;
            const savedRef = localStorage.getItem('ga_pending_ref');
            if (savedPlan) setSelectedPlan(savedPlan);
            if (savedToken) setSelectedToken(savedToken);
            if (savedRef) setAppliedReferral(savedRef);
            setGateState('verifying');
            setStatusMsg('Recovering pending payment…');
          } else {
            setGateState('no-access');
          }
        } else {
          setGateState('unauthenticated');
        }
      })
      .catch(() => setGateState('unauthenticated'));
  }, []);

  // Handle blockchain transaction failure/drop
  useEffect(() => {
    if (txError) {
      localStorage.removeItem('ga_pending_tx');
      localStorage.removeItem('ga_pending_plan');
      localStorage.removeItem('ga_pending_token');
      localStorage.removeItem('ga_pending_ref');
      setPendingTxHash(undefined);
      setGateState('no-access');
      setError('Transaction failed on the network. Please try again.');
    }
  }, [txError]);

  // Track when user actively initiated a wallet connection (went through 'connecting' state)
  useEffect(() => {
    if (accountStatus === 'connecting') {
      walletActivelyConnected.current = true;
    }
  }, [accountStatus]);

  // When wallet ADDRESS changes (user switched wallets) → reset auth state so the new wallet is checked fresh
  const prevAddressRef = React.useRef<string | undefined>(undefined);
  useEffect(() => {
    if (address && prevAddressRef.current && address !== prevAddressRef.current) {
      setSiweCompleted(false);
      setSessionWallet(null);
      setError('');
      setGateState('unauthenticated');
    }
    prevAddressRef.current = address;
  }, [address]);

  // Try to reconnect a previously-verified wallet WITHOUT asking for a signature.
  // Falls back to full SIWE only if the wallet has never signed before (first time).
  const performWalletAuth = useCallback(async (walletAddress: string) => {
    if (authInProgress.current) return;
    authInProgress.current = true;
    setError('');
    setGateState('signing');
    setStatusMsg('Checking wallet…');
    try {
      // Step 1: try reconnect (no signature needed for known wallets)
      const reconnectRes = await fetch('/api/auth/wallet-reconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });
      const reconnectData = await reconnectRes.json();

      if (reconnectData.known) {
        // Wallet was previously verified — session issued, no signature needed
        setIsTestMode(reconnectData.isTestMode);
        setExpiresAt(reconnectData.expiresAt);
        setSessionWallet(reconnectData.walletAddress);
        if (reconnectData.planType) setCurrentPlan(reconnectData.planType);
        setSiweCompleted(true);
        setGateState(reconnectData.hasAccess ? 'active' : 'no-access');
        setStatusMsg('');
        authInProgress.current = false;
        
        // Recover pending tx if any
        if (!reconnectData.hasAccess) {
          const savedTx = localStorage.getItem('ga_pending_tx');
          if (savedTx) {
            setPendingTxHash(savedTx as `0x${string}`);
            const savedPlan = localStorage.getItem('ga_pending_plan') as Plan;
            const savedToken = localStorage.getItem('ga_pending_token') as Token;
            const savedRef = localStorage.getItem('ga_pending_ref');
            if (savedPlan) setSelectedPlan(savedPlan);
            if (savedToken) setSelectedToken(savedToken);
            if (savedRef) setAppliedReferral(savedRef);
            setGateState('verifying');
            setStatusMsg('Recovering pending payment…');
          }
        }
        return;
      }

      // Step 2: Unknown wallet → require SIWE (first time proving ownership)
      setStatusMsg('First time — please sign to verify wallet ownership…');
      authInProgress.current = false; // release so performSiweAuth can acquire it
      await performSiweAuth(walletAddress);
    } catch {
      setError('Connection failed. Please try again.');
      setGateState('unauthenticated');
      setStatusMsg('');
      authInProgress.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-trigger wallet auth when user actively connects a wallet in this session
  useEffect(() => {
    if (
      walletActivelyConnected.current &&
      accountStatus === 'connected' &&
      address &&
      gateState === 'unauthenticated' &&
      !siweCompleted &&
      !authInProgress.current
    ) {
      performWalletAuth(address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountStatus, address, gateState]);

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
      fetch('/api/payments/ron-price').then(r => r.json()).then(setPriceData).catch(() => { });
    }
  }, [gateState]);

  // ── TEST MODE: no wallet, no SIWE, no server call ─────────────────
  const handleTestMode = useCallback(() => {
    setIsTestMode(true);
    setGateState('active');
  }, []);

  // ── SIWE sign-in flow (for paid plans) ────────────────────────────
  const performSiweAuth = useCallback(async (walletAddress: string) => {
    if (authInProgress.current) return; // prevent concurrent calls
    authInProgress.current = true;
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
      if (data.walletAddress) setSessionWallet(data.walletAddress);
      setSiweCompleted(true);
      setGateState(data.hasAccess ? 'active' : 'no-access');
      setStatusMsg('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      setError(message);
      setStatusMsg('');
      setGateState('unauthenticated');
      // Only disconnect if this was a user-rejected or auth error, not a 'connector not connected' hydration issue
      if (!message.toLowerCase().includes('connector not connected')) {
        disconnect();
      }
    } finally {
      authInProgress.current = false;
    }
  }, [signMessageAsync, disconnect]);

  // ── Logout ────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/session', { method: 'DELETE' });
    setIsTestMode(false);
    setExpiresAt(null);
    setSessionWallet(null);
    setSiweCompleted(false);
    // Reset so SIWE doesn't auto-trigger again after logout (would need user to actively reconnect)
    walletActivelyConnected.current = false;
    setGateState('unauthenticated');
    // Disconnect wagmi — error is silenced via mutation.onError: () => {} in useDisconnect
    disconnect();
  }, [disconnect]);

  // ── Payment ───────────────────────────────────────────────────────
  const handlePay = useCallback(async () => {
    if (!priceData || !address) return;
    setError('');
    setGateState('paying');
    const useDiscount = appliedReferral && selectedPlan === 'SEASON';
    const planInfo = useDiscount && priceData.discountedPlans ? priceData.discountedPlans[selectedPlan] : priceData.plans[selectedPlan];
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

      // Save to localStorage for recovery if page is refreshed
      localStorage.setItem('ga_pending_tx', txHash);
      localStorage.setItem('ga_pending_plan', selectedPlan);
      localStorage.setItem('ga_pending_token', selectedToken);
      if (appliedReferral) {
        localStorage.setItem('ga_pending_ref', appliedReferral);
      } else {
        localStorage.removeItem('ga_pending_ref');
      }

    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : '';
      // Detect user rejection (viem surfaces this as a verbose message)
      const isRejected = raw.toLowerCase().includes('user rejected') || raw.toLowerCase().includes('rejected the request');
      setError(isRejected ? 'Payment cancelled.' : 'Payment failed. Please try again.');
      setGateState('no-access');
      setStatusMsg('');
    }
  }, [priceData, address, selectedPlan, selectedToken, appliedReferral, sendTransactionAsync, writeContractAsync]);

  const isVerifying = React.useRef(false);

  const verifyPayment = useCallback(async (txHash: string) => {
    if (isVerifying.current) return;
    isVerifying.current = true;
    setStatusMsg('Verifying payment on-chain…');
    try {
      const res = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash, plan: selectedPlan, token: selectedToken, referralCode: appliedReferral, walletAddress: address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      
      // Cleanup localStorage on success
      localStorage.removeItem('ga_pending_tx');
      localStorage.removeItem('ga_pending_plan');
      localStorage.removeItem('ga_pending_token');
      localStorage.removeItem('ga_pending_ref');
      
      setExpiresAt(data.expiresAt);
      if (data.plan) setCurrentPlan(data.plan);
      setIsTestMode(false);
      setIsExtending(false);
      setGateState('active');
      setStatusMsg('');
      setPendingTxHash(undefined);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : '';
      const isRejected = raw.toLowerCase().includes('user rejected') || raw.toLowerCase().includes('rejected the request');
      setError(isRejected ? 'Payment cancelled.' : (raw || 'Verification failed. Please try again.'));
      setGateState('no-access');
      setStatusMsg('');
      
      // We don't remove from localStorage here unless we know it's a hard rejection/failure,
      // so that they can refresh and try again. 
      // But if it's user rejected, we clear it.
      if (isRejected) {
        localStorage.removeItem('ga_pending_tx');
        setPendingTxHash(undefined);
      }
    } finally {
      isVerifying.current = false;
    }
  }, [selectedPlan, selectedToken, appliedReferral, address]);

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
            <button className={styles.upgradeBannerBtn} onClick={() => { setIsTestMode(false); setGateState(sessionWallet ? 'no-access' : 'unauthenticated'); }}>
              UPGRADE TO REAL DATA
            </button>
          </div>
        )}
        {!isTestMode && sessionWallet && (
          <div className={styles.sessionBar}>
            <span className={styles.walletBadge}>
              <span className={styles.greenDot} />
              {sessionWallet.slice(0, 6)}…{sessionWallet.slice(-4)}
            </span>
            {expiresAt && (
              <span className={styles.expiryLabel}>
                Access until <strong>{
                  new Date(expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                }</strong>
              </span>
            )}
            <button
              className={styles.extendBtn}
              disabled={currentPlan === 'SEASON'}
              title={currentPlan === 'SEASON' ? 'Season plan cannot be extended further' : 'Extend your access'}
              onClick={() => {
                if (currentPlan !== 'SEASON') {
                  setIsExtending(true);
                  setGateState('no-access');
                }
              }}
              style={currentPlan === 'SEASON' ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              EXTEND
            </button>
            <div className={styles.sessionButtonGroup}>
              <button
                className={styles.actionBtn}
                onClick={() => {
                  if (hasUserCards) {
                    onManageWallets?.();
                  } else {
                    onLoadCards?.();
                  }
                }}
              >
                LOAD CARDS
              </button>
              <button className={styles.logoutBtn} onClick={handleLogout}>LOG OUT</button>
            </div>
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
        {gateState === 'verifying' && pendingTxHash && (
          <button 
            className={styles.backBtn} 
            style={{ marginTop: '20px', backgroundColor: 'transparent', color: '#888', border: '1px solid #555', padding: '8px 16px', borderRadius: '4px' }}
            onClick={() => verifyPayment(pendingTxHash)}
          >
            Click here if taking too long
          </button>
        )}
      </div>
    );
  }

  if (gateState === 'no-access') {
    const useDiscount = appliedReferral && selectedPlan === 'SEASON';
    const planInfo = useDiscount && priceData?.discountedPlans ? priceData.discountedPlans[selectedPlan] : priceData?.plans[selectedPlan];
    return (
      <div className={styles.gate}>
        <div className={styles.gateCard} style={{ position: 'relative' }}>
          <button className={styles.backBtn} onClick={() => {
            setError('');
            if (isExtending) {
              setIsExtending(false);
              setGateState('active');
            } else {
              setGateState('unauthenticated');
            }
          }}>GO BACK</button>
          <div className={styles.walletConnectedRow}>
            <span className={styles.greenDot} />
            <span className={styles.walletSmall}>{address?.slice(0, 8)}…{address?.slice(-4)}</span>
            <button className={styles.logoutLink} onClick={handleLogout}>Log out</button>
          </div>
          <h2 className={styles.gateTitle}>CHOOSE YOUR PLAN</h2>
          <p className={styles.gateSubtitle}>Unlock AI-powered Score Prediction and Auto Meta-Lineup Builder for any Contest.</p>
          <div className={styles.planGrid}>
            {(Object.keys(PLAN_LABELS) as Plan[]).map(plan => {
              let title = PLAN_LABELS[plan].title;
              let duration = PLAN_LABELS[plan].duration;
              let priceStr = `$${PLAN_USD[plan]}`;
              
              if (appliedReferral) {
                if (plan === 'DAILY') {
                  title = '4-DAYS';
                  duration = '96 hours';
                } else if (plan === 'WEEKLY') {
                  title = 'WEEKLY (+2)';
                  duration = '9 days';
                } else if (plan === 'SEASON') {
                  priceStr = '$22.50';
                }
              }

              return (
                <button key={plan} className={`${styles.planCard} ${selectedPlan === plan ? styles.planCardActive : ''}`} onClick={() => setSelectedPlan(plan)}>
                  {PLAN_LABELS[plan].badge && <span className={styles.planBadge}>{PLAN_LABELS[plan].badge}</span>}
                  <span className={styles.planTitle}>{title}</span>
                  <span className={styles.planDuration}>{duration}</span>
                  <span className={styles.planPrice}>
                    {appliedReferral && plan === 'SEASON' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', lineHeight: '1' }}>
                        <span style={{ textDecoration: 'line-through', opacity: 0.5, fontSize: '0.7em' }}>${PLAN_USD[plan]}</span>
                        <span>{priceStr}</span>
                      </div>
                    ) : (
                      priceStr
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <div className={styles.tokenToggle}>
            <button className={`${styles.tokenBtn} ${selectedToken === 'USDC' ? styles.tokenActive : ''}`} onClick={() => setSelectedToken('USDC')}>USDC</button>
            <button className={`${styles.tokenBtn} ${selectedToken === 'RON' ? styles.tokenActive : ''}`} onClick={() => setSelectedToken('RON')}>RON</button>
          </div>
          <div className={styles.referralContainer}>
            {appliedReferral ? (
              <div className={styles.referralBadge}>
                Code applied: <strong>{appliedReferral}</strong>
                <button
                  className={styles.referralRemoveBtn}
                  onClick={() => {
                    setAppliedReferral('');
                    setReferralError(false);
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <div className={styles.referralInputGroup}>
                  <input
                    type="text"
                    placeholder="Referral Code (Optional)"
                    className={`${styles.referralInput} ${referralError ? styles.referralInputError : ''}`}
                    value={referralInputText}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                      setReferralInputText(val);
                      setReferralError(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const VALID_REFERRALS = ['LUNA', 'WIL', 'ZEKI', 'KENSHI', 'ANTOO'];
                        if (VALID_REFERRALS.includes(referralInputText)) setAppliedReferral(referralInputText);
                        else setReferralError(true);
                      }
                    }}
                  />
                  <button
                    className={styles.referralAddBtn}
                    onClick={() => {
                      if (!referralInputText) return;
                      const VALID_REFERRALS = ['LUNA', 'WIL', 'ZEKI', 'KENSHI', 'ANTOO'];
                      if (VALID_REFERRALS.includes(referralInputText)) {
                        setAppliedReferral(referralInputText);
                        setReferralInputText('');
                        setReferralError(false);
                      } else {
                        setReferralError(true);
                      }
                    }}
                  >
                    ADD
                  </button>
                </div>
                {referralError && <span className={styles.referralErrorMsg}>Invalid code</span>}
              </>
            )}
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
          
          {/* Recovery button if the user previously paid but it didn't verify */}
          {pendingTxHash && (
            <button 
              className={styles.testModeBtn} 
              style={{ marginTop: '15px' }}
              onClick={() => {
                setGateState('verifying');
                verifyPayment(pendingTxHash);
              }}
            >
              Verify Pending Transaction
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Unauthenticated: lock screen ──────────────────────────────────
  return (
    <div className={styles.gate}>
      <div className={styles.gateCard}>
        <div className={styles.lockIcon}>
          <img
            src="/images/moki-praying.png"
            alt="Moki Praying"
            className={styles.mokiPrayingImg}
          />
        </div>
        <h2 className={styles.gateTitle}>PREDICTIONS</h2>
        <p className={styles.gateSubtitle}>
          AI-powered Moki Champion Score Prediction and Auto Meta-Lineup Builder for any Contest.
        </p>
        {error && <p className={styles.errorMsg}>⚠️ {error}</p>}
        <div className={styles.connectBtnWrapper}>
          {accountStatus === 'connected' && address ? (
            // Wallet already connected: show clear action button instead of Ronin SVG
            // This handles both: GO BACK state (siweCompleted=true) and F5 (wallet pre-connected)
            <button
              className={styles.continuePayBtn}
              onClick={() => {
                if (siweCompleted) {
                  // Already signed this session → go straight to plan selection
                  setGateState('no-access');
                } else {
                  // Try reconnect first (no sign for known wallets), SIWE only for new wallets
                  performWalletAuth(address);
                }
              }}
            >
              CONTINUE
            </button>
          ) : (
            // No wallet connected → show Ronin sign-in SVG button
            <button
              className={styles.roninSignInBtn}
              onClick={() => {
                const roninConnector = connectors.find(c => c.id === 'roninWallet' || c.name?.toLowerCase().includes('ronin'));
                if (roninConnector) connect({ connector: roninConnector });
                else connect({ connector: connectors[0] });
              }}
            >
              <img
                src="/icons/basic-button-light-e78eacb75cafb49bc7c5a9268252865d.svg"
                alt="Sign in with Ronin"
                className={styles.roninSignInImg}
              />
            </button>
          )}
        </div>
        <div className={styles.divider}><span>or</span></div>
        <button className={styles.testModeBtn} onClick={handleTestMode}>
          Try TEST MODE <span className={styles.freeTag}>FREE</span>
        </button>
        <p className={styles.testModeHint}>Simulated data for testing functions, no payment required.</p>
      </div>
    </div>
  );
}
