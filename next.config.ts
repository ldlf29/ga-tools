import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  // Turbopack (dev) — resolve WalletConnect optional deps to empty
  turbopack: {
    resolveAlias: {
      'pino-pretty': '',
      lokijs: '',
      encoding: '',
    },
  },
  // Webpack (production build) — same fix via externals
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh1.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh2.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh4.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh5.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh6.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh7.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'moku-nft-nextjs-s3.s3.us-east-2.amazonaws.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data: https://*.public.blob.vercel-storage.com https://lh1.googleusercontent.com https://lh2.googleusercontent.com https://lh3.googleusercontent.com https://lh4.googleusercontent.com https://lh5.googleusercontent.com https://lh6.googleusercontent.com https://lh7.googleusercontent.com https://drive.google.com https://moku-nft-nextjs-s3.s3.us-east-2.amazonaws.com",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co https://vercel.live https://vitals.vercel-insights.com https://va.vercel-scripts.com https://waypoint.roninchain.com https://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.com wss://*.walletconnect.org https://api.coingecko.com https://api.roninchain.com",
              "worker-src 'self' blob:",
              "frame-src 'self' https://vercel.live https://waypoint.roninchain.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
