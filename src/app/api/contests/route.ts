import { NextResponse } from 'next/server';

export async function GET() {
  const GA_API_KEY = process.env.GA_API_KEY;

  if (!GA_API_KEY) {
    console.error('[API Contests] GA_API_KEY is not configured.');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch('https://api.grandarena.gg/api/v1/contests/active?page=1&limit=100', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${GA_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error(`[API Contests] Grand Arena API error: ${response.status}`);
      return NextResponse.json(
        { error: 'Failed to fetch contests from Grand Arena' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Contests] Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error during proxy' },
      { status: 500 }
    );
  }
}
