/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { AlchemyService } from '@/services/AlchemyService';
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const CONTRACT_ADDRESS = '0x9e8ed4ff354bd11602255b3d8e1ed13a1bb26b4b';

// ─── UPSTASH REDIS CONFIG ───────────────────────────────────────────────────
// These are loaded from .env.local / Vercel Environment Variables
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Ratelimiter for the 6h wallet refresh cooldown
// (1 request allowed per 6 hours per identifier)
const walletRefreshRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(1, '6 h'),
  analytics: true,
  prefix: 'ratelimit:wallet_refresh',
});

// Validate Ronin/Ethereum hex address format
const isValidAddress = (addr: string): boolean =>
  /^0x[a-fA-F0-9]{40}$/.test(addr);

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');

  if (!address) {
    return NextResponse.json(
      { error: 'Missing Wallet Address' },
      { status: 400 }
    );
  }

  const normalizedAddress = address.toLowerCase();

  if (!isValidAddress(normalizedAddress)) {
    return NextResponse.json(
      { error: 'Invalid wallet address format' },
      { status: 400 }
    );
  }

  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : (request.headers.get('x-real-ip') || 'unknown');

  // 1. IP Rate Limiting (Max 2 unique wallets per IP per 24 hours)
  if (ip !== 'unknown') {
    try {
      const ipKey = `ratelimit:ip_wallets:${ip}`;
      
      const isAlreadyTracked = await redis.sismember(ipKey, normalizedAddress);

      if (!isAlreadyTracked) {
        const currentCount = await redis.scard(ipKey);
        if (currentCount >= 2) {
          return NextResponse.json(
            {
              error:
                'Rate Limit: You can only query up to 2 unique wallets per 24 hours from your IP.',
            },
            { status: 429 }
          );
        }
        
        await redis.sadd(ipKey, normalizedAddress);
        // Only set expiration if it's the first wallet to keep the 24h window fixed
        if (currentCount === 0) {
          await redis.expire(ipKey, 24 * 60 * 60);
        }
      }
    } catch (redisError) {
      console.error('[API] Redis IP Rate Limit Error:', redisError);
    }
  }

  // 2. Wallet Refresh Cooldown (6 hours per wallet)
  const forceRefresh = request.nextUrl.searchParams.get('force') === 'true';
  const isInitialAdd = request.nextUrl.searchParams.get('initial') === 'true';

  if (!isInitialAdd) {
    // Only apply rate limit if it's NOT the initial card add
    if (forceRefresh) {
      try {
        const { success, reset } = await walletRefreshRateLimit.limit(normalizedAddress);
        if (!success) {
          const now = Date.now();
          const remainingMs = Math.max(0, reset - now);
          const remainingHours = (remainingMs / (1000 * 60 * 60)).toFixed(1);
          
          return NextResponse.json(
            {
              error: `Please wait ${remainingHours} hours before forcing a refresh on this wallet.`,
            },
            { status: 429 }
          );
        }
      } catch (redisError) {
        console.error('[API] Redis Wallet Cooldown Error:', redisError);
      }
    }
  }

  console.log(
    `[API] Fetching cards for wallet ${address.substring(0, 6)}...${address.slice(-4)}`
  );

  try {
    const alchemy = AlchemyService.getInstance();

    // 1. Fetch RAW data from Alchemy
    const rawNfts = await alchemy.getWalletNFTs(address, CONTRACT_ADDRESS);

    if (rawNfts.length === 0) {
      return NextResponse.json({
        data: [],
        total: 0,
        message: 'No NFTs found for this address in the specified collection.',
        source: 'API (Alchemy - Empty)',
      });
    }

    // 2. Parse and format for the frontend
    const finalCards = alchemy.parseAlchemyNFTs(rawNfts);

    console.log(
      `[API] FINAL: ${finalCards.length} Cards Delivered via Alchemy Native.`
    );

    return NextResponse.json({
      data: finalCards,
      total: finalCards.length,
      message: 'Successfully retrieved NFTs from Alchemy.',
      source: 'API (Alchemy Native)',
    });
  } catch (error: any) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve card data',
      },
      { status: 500 }
    );
  }
}
