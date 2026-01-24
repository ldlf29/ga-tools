import { NextRequest, NextResponse } from 'next/server';

const GRAPHQL_ENDPOINT = 'https://marketplace-graphql.skymavis.com/graphql';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Origin': 'https://app.roninchain.com' // Mimic valid origin
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const text = await response.text();
            return NextResponse.json({ error: `Upstream error: ${text}` }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("GraphQL Proxy Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
