/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import mokiMetadataRaw from '@/data/mokiMetadata.json';

import { waitUntil } from '@vercel/functions';

// Configuration
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Fluid Compute limit

const mokiMetadata = mokiMetadataRaw as Record<string, any>;
const CONCURRENCY_LIMIT = 20; // Parallel fetch chunk size
const DELAY_BETWEEN_BATCHES = 2000; // 2s pacing between chunks

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const mapTeamToNumber = (team: any): number => {
  if (typeof team === 'string') {
    const t = team.toLowerCase();
    if (t === 'red') return 1;
    if (t === 'blue') return 2;
  }
  return typeof team === 'number' ? team : 0;
};

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      message:
        'Endpoint disabled on Vercel. Please trigger through GitHub Actions (Option A).',
    },
    { status: 403 }
  );
}
