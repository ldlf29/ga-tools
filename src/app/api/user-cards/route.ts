
import { NextRequest, NextResponse } from 'next/server';
import { AlchemyService } from '@/services/AlchemyService';

const CONTRACT_ADDRESS = '0x9e8ed4ff354bd11602255b3d8e1ed13a1bb26b4b';

// In-memory single-region limits.
// ⚠️ LIMITATION: These reset on Vercel cold starts and don't share across regions.
// TODO: For stronger protection, migrate to Vercel KV or Upstash Redis.
const ipRateLimitMap = new Map<string, { wallets: Set<string>; resetAt: number }>();
const walletRefreshCooldowns = new Map<string, number>();

// Validate Ronin/Ethereum hex address format
const isValidAddress = (addr: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(addr);

export async function GET(request: NextRequest) {
    const address = request.nextUrl.searchParams.get('address');

    if (!address) {
        return NextResponse.json({ error: 'Missing Wallet Address' }, { status: 400 });
    }

    if (!isValidAddress(address)) {
        return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('client-ip') || 'unknown';
    const now = Date.now();

    // 1. IP Rate Limiting (Max 2 wallets per IP per 24 hours)
    if (ip !== 'unknown') {
        if (!ipRateLimitMap.has(ip)) {
            ipRateLimitMap.set(ip, { wallets: new Set(), resetAt: now + 24 * 60 * 60 * 1000 });
        }

        const ipData = ipRateLimitMap.get(ip)!;

        // Reset if 24 hours passed
        if (now > ipData.resetAt) {
            ipData.wallets.clear();
            ipData.resetAt = now + 24 * 60 * 60 * 1000;
        }

        // Add wallet if not there, check limit
        ipData.wallets.add(address.toLowerCase());
        if (ipData.wallets.size > 2) {
            ipData.wallets.delete(address.toLowerCase()); // Don't count the failed attempt towards the 2 wallet cap
            return NextResponse.json({ error: 'Rate Limit: You can only query up to 2 unique wallets per 24 hours from your IP.' }, { status: 429 });
        }
    }

    // 2. Wallet Refresh Cooldown (6 hours per wallet)
    const lastRefresh = walletRefreshCooldowns.get(address.toLowerCase());
    const forceRefresh = request.nextUrl.searchParams.get('force') === 'true';
    const isInitialAdd = request.nextUrl.searchParams.get('initial') === 'true';

    if (isInitialAdd) {
        // Initial add always bypasses cooldown — record timestamp so future refreshes are governed
        walletRefreshCooldowns.set(address.toLowerCase(), now);
    } else if (forceRefresh) {
        if (lastRefresh && (now - lastRefresh < 6 * 60 * 60 * 1000)) {
            const remainingHours = ((6 * 60 * 60 * 1000 - (now - lastRefresh)) / (1000 * 60 * 60)).toFixed(1);
            return NextResponse.json({ error: `Please wait ${remainingHours} hours before forcing a refresh on this wallet.` }, { status: 429 });
        }
        walletRefreshCooldowns.set(address.toLowerCase(), now);
    } else {
        // Even if not forced, if we fetch, we log the first time as the refresh time so the cooldown begins.
        if (!lastRefresh) {
            walletRefreshCooldowns.set(address.toLowerCase(), now);
        }
    }

    console.log(`[API] Fetching cards for wallet ${address.substring(0, 6)}...${address.slice(-4)}`);

    try {
        const alchemy = AlchemyService.getInstance();

        // 1. Fetch RAW data from Alchemy
        const rawNfts = await alchemy.getWalletNFTs(address, CONTRACT_ADDRESS);

        if (rawNfts.length === 0) {
            return NextResponse.json({
                data: [],
                total: 0,
                message: 'No NFTs found for this address in the specified collection.',
                source: 'API (Alchemy - Empty)'
            });
        }

        // 2. Parse and format for the frontend
        const finalCards = alchemy.parseAlchemyNFTs(rawNfts);

        console.log(`[API] FINAL: ${finalCards.length} Cards Delivered via Alchemy Native.`);

        return NextResponse.json({
            data: finalCards,
            total: finalCards.length,
            message: 'Successfully retrieved NFTs from Alchemy.',
            source: 'API (Alchemy Native)'
        });

    } catch (error: any) {
        console.error('[API] Error:', error);
        return NextResponse.json({
            error: 'Failed to retrieve card data'
        }, { status: 500 });
    }
}
