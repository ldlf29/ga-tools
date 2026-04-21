/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { AlchemyService } from '@/services/AlchemyService';

// Validate Ronin/Ethereum hex address format
const isValidAddress = (addr: string): boolean =>
  /^0x[a-fA-F0-9]{40}$/.test(addr);

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');

  const pageKey = request.nextUrl.searchParams.get('pageKey') || undefined;

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

  const CONTRACT_ADDRESS = '0x9e8ed4ff354bd11602255b3d8e1ed13a1bb26b4b';

  try {
    const alchemy = AlchemyService.getInstance();

    // 1. Fetch exactly ONE RAW page data from Alchemy
    const { nfts: rawNfts, nextPageKey } = await alchemy.getWalletNFTsPage(address, CONTRACT_ADDRESS, pageKey);

    if (rawNfts.length === 0) {
      return NextResponse.json({
        data: [],
        total: 0,
        nextPageKey,
        message: 'No NFTs found in this page.',
        source: 'API (Alchemy - Empty)',
      });
    }

    // 2. Parse and format for the frontend
    const finalCards = alchemy.parseAlchemyNFTs(rawNfts);

    return NextResponse.json({
      data: finalCards,
      total: finalCards.length,
      nextPageKey,
      message: 'Successfully retrieved NFTs page from Alchemy.',
      source: 'API (Alchemy Native Page)',
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
