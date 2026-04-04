import { NextResponse } from 'next/server';

// Contest schedule is public game info — no auth needed
export const dynamic = 'force-dynamic';

export async function GET() {
  const GA_API_KEY = process.env.GA_API_KEY;
  if (!GA_API_KEY) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const response = await fetch('https://api.grandarena.gg/api/v1/contests/active?page=1&limit=100', {
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${GA_API_KEY}` },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch contests' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Contests] Proxy error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
