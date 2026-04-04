/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { AlchemyService } from '@/services/AlchemyService';

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

  const CONTRACT_ADDRESS = '0x9e8ed4ff354bd11602255b3d8e1ed13a1bb26b4b';

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
