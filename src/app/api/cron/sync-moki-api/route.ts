/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import mokiMetadataRaw from '@/data/mokiMetadata.json';

// Get target IDs from our static database
const mokiMetadata = mokiMetadataRaw as Record<string, any>;
const BATCH_SIZE = 90;

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
