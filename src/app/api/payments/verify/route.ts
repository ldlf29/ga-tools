/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ethers } from 'ethers';

const RECIPIENT = (process.env.PAYMENT_RECIPIENT || '').toLowerCase();
const USDC_CONTRACT = (process.env.USDC_CONTRACT_RONIN || '').toLowerCase();
const RONIN_RPC = process.env.RONIN_RPC_URL || 'https://api.roninchain.com/rpc';
const JWT_SECRET = new TextEncoder().encode(process.env.PREDICTIONS_JWT_SECRET!);
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

const PLAN_USD: Record<string, number> = { DAILY: 3, WEEKLY: 5, SEASON: 25 };
const PLAN_DURATIONS_MS: Record<string, number> = {
  DAILY: 72 * 3600 * 1000,
  WEEKLY: 7 * 24 * 3600 * 1000,
  SEASON: 70 * 24 * 3600 * 1000,
};

/** Direct JSON-RPC call — more reliable than ethers with Ronin's public endpoint */
async function rpcCall(method: string, params: any[]): Promise<any> {
  const res = await fetch(RONIN_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.error) throw new Error(`RPC error ${json.error.code}: ${json.error.message}`);
  return json.result;
}

async function getTransaction(txHash: string) {
  const raw = await rpcCall('eth_getTransactionByHash', [txHash]);
  if (!raw) return null;
  return raw;
}

async function getTransactionReceipt(txHash: string) {
  const raw = await rpcCall('eth_getTransactionReceipt', [txHash]);
  if (!raw) return null;
  return raw;
}

async function getRonUsdPrice(): Promise<number> {
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=ronin&vs_currencies=usd',
    { cache: 'no-store', signal: AbortSignal.timeout(5_000) }
  );
  const data = await res.json();
  return data.ronin.usd as number;
}

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // 1. Authenticate via session cookie
  let walletAddress: string;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('ga_predictions_session')?.value;
    if (!token) throw new Error('No session');
    const { payload } = await jwtVerify(token, JWT_SECRET);
    walletAddress = payload.wallet as string;
    if (!walletAddress) throw new Error('No wallet in token');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse body
  const body = await req.json().catch(() => ({}));
  const { txHash, plan, token, referralCode } = body as { txHash: string; plan: string; token: 'RON' | 'USDC'; referralCode?: string };

  const VALID_REFERRALS = ['LUNA', 'WIL', 'ZEKI', 'KENSHI', 'ANTOO'];
  const finalizedReferral = (referralCode && VALID_REFERRALS.includes(referralCode.toUpperCase())) 
    ? referralCode.toUpperCase() 
    : null;

  if (!txHash || !plan || !token) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  if (!PLAN_USD[plan]) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  if (!['RON', 'USDC'].includes(token)) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });

  // 3. Replay-attack protection
  const { data: existing } = await supabaseAdmin
    .from('predictions_subscriptions')
    .select('id')
    .eq('tx_hash', txHash)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: 'Transaction already used' }, { status: 409 });

  // 4. Verify on-chain — retry 3x with 2s delay (indexing lag)
  let tx: any = null;
  let receipt: any = null;

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 2000));
      [tx, receipt] = await Promise.all([
        getTransaction(txHash).catch(() => null),
        getTransactionReceipt(txHash).catch(() => null),
      ]);
      if (tx && receipt) break;
    }
  } catch (err: any) {
    console.error('[PaymentVerify] RPC error:', err?.message);
    const detail = process.env.NODE_ENV !== 'production' ? err?.message : undefined;
    return NextResponse.json({ error: 'RPC verification failed', detail }, { status: 500 });
  }

  if (!tx || !receipt) {
    return NextResponse.json({ error: 'Transaction not found — it may not be indexed yet. Try again in 30s.' }, { status: 404 });
  }
  if (receipt.status !== '0x1') {
    return NextResponse.json({ error: 'Transaction reverted on-chain' }, { status: 400 });
  }

  // 5. Validate sender
  if ((tx.from as string)?.toLowerCase() !== walletAddress) {
    return NextResponse.json({ error: 'Sender mismatch' }, { status: 403 });
  }

  // 6. Validate amount
  let usdValue = PLAN_USD[plan];
  if (finalizedReferral && plan === 'SEASON') {
    usdValue = usdValue * 0.9;
  }
  const withTolerance = (n: bigint) => ({
    min: (n * BigInt(85)) / BigInt(100),
    max: (n * BigInt(115)) / BigInt(100),
  });
  let amountPaid: string;

  try {
    if (token === 'RON') {
      if ((tx.to as string)?.toLowerCase() !== RECIPIENT) {
        return NextResponse.json({ error: 'Wrong recipient' }, { status: 400 });
      }
      const ronPrice = await getRonUsdPrice();
      const expectedWei = BigInt(Math.ceil((usdValue / ronPrice) * 1e18));
      const { min, max } = withTolerance(expectedWei);
      const value = BigInt(tx.value); // hex string from raw RPC
      if (value < min || value > max) {
        return NextResponse.json({ error: 'RON amount out of range' }, { status: 400 });
      }
      amountPaid = value.toString();
    } else {
      // USDC: scan Transfer logs
      const logs: any[] = receipt.logs || [];
      const log = logs.find(
        (l: any) =>
          l.address?.toLowerCase() === USDC_CONTRACT &&
          l.topics[0] === TRANSFER_TOPIC &&
          l.topics[2]?.toLowerCase().endsWith(RECIPIENT.slice(2))
      );
      if (!log) {
        return NextResponse.json({ error: 'No valid USDC Transfer found in tx logs' }, { status: 400 });
      }
      const transferred = BigInt(log.data);
      const expected = BigInt(usdValue * 1_000_000);
      const { min, max } = withTolerance(expected);
      if (transferred < min || transferred > max) {
        return NextResponse.json({ error: 'USDC amount out of range' }, { status: 400 });
      }
      amountPaid = transferred.toString();
    }
  } catch (err: any) {
    console.error('[PaymentVerify] Amount validation error:', err?.message);
    return NextResponse.json({ error: 'Amount validation failed', detail: err?.message }, { status: 400 });
  }

  // 7. Grant subscription – stack duration on top of existing active subscription
  // If the user has an active plan, start counting from where it ends (not from now)
  const { data: currentSub } = await supabaseAdmin
    .from('predictions_subscriptions')
    .select('expires_at')
    .eq('wallet_address', walletAddress)
    .eq('is_test_mode', false)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const baseTime = currentSub?.expires_at
    ? Math.max(Date.now(), new Date(currentSub.expires_at).getTime())
    : Date.now();
  let totalDurationMs = PLAN_DURATIONS_MS[plan];
  if (finalizedReferral) {
    if (plan === 'DAILY') {
      totalDurationMs += 24 * 3600 * 1000; // +1 day
    } else if (plan === 'WEEKLY') {
      totalDurationMs += 2 * 24 * 3600 * 1000; // +2 days
    }
  }
  const expiresAt = new Date(baseTime + totalDurationMs).toISOString();

  const { error: dbError } = await supabaseAdmin.from('predictions_subscriptions').insert({
    wallet_address: walletAddress,
    plan_type: plan,
    token_used: token,
    tx_hash: txHash,
    amount_paid: amountPaid,
    usd_value: usdValue,
    expires_at: expiresAt,
    is_test_mode: false,
    used_referral_code: finalizedReferral,
  });

  if (dbError) {
    console.error('[PaymentVerify] DB error:', dbError.message);
    return NextResponse.json({ error: 'Failed to record subscription' }, { status: 500 });
  }

  // 8. Record Referral Commission if applicable
  if (finalizedReferral) {
    const commission = usdValue * 0.10;
    const { error: refError } = await supabaseAdmin.from('referral_commissions').insert({
      referral_code: finalizedReferral,
      owed_usd: commission,
      source_tx: txHash
    });
    if (refError) {
      console.error('[PaymentVerify] Referral DB error (non-fatal):', refError.message);
    }
  }

  return NextResponse.json({ success: true, expiresAt, plan });
}
