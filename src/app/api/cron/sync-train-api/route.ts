import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import mokiMetadataRaw from '@/data/mokiMetadata.json';

import { waitUntil } from '@vercel/functions';

// Configuration
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes execution time (Fluid Compute / Pro)

const mokiMetadata = mokiMetadataRaw as Record<string, any>;
const API_BASE_URL = "https://train.grandarena.gg/api/moki/";

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
    return NextResponse.json({ 
        success: false, 
        message: "Endpoint disabled on Vercel. Please trigger through GitHub Actions (Option A)." 
    }, { status: 403 });
}
