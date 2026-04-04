import { NextResponse } from 'next/server';

const PLAN_USD: Record<string, number> = { DAILY: 1, WEEKLY: 5, SEASON: 20 };
const USDC_DECIMALS = 6;

let cachedPrice: number | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getRonPrice(): Promise<number> {
  if (cachedPrice && Date.now() - cacheTime < CACHE_TTL) return cachedPrice;
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=ronin&vs_currencies=usd',
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('CoinGecko unavailable');
  const data = await res.json();
  cachedPrice = data.ronin.usd as number;
  cacheTime = Date.now();
  return cachedPrice;
}

export async function GET() {
  try {
    const ronPrice = await getRonPrice();
    const plans: Record<string, object> = {};
    for (const [plan, usd] of Object.entries(PLAN_USD)) {
      const ronAmount = usd / ronPrice;
      plans[plan] = {
        usd,
        ronDisplay: ronAmount.toFixed(3),
        ronWei: BigInt(Math.ceil(ronAmount * 1e18)).toString(),
        usdcDisplay: usd.toFixed(2),
        usdcSmallest: (usd * 10 ** USDC_DECIMALS).toString(),
      };
    }
    return NextResponse.json({ ronUsdRate: ronPrice, plans, cachedAt: new Date(cacheTime).toISOString() });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch RON price' }, { status: 503 });
  }
}
