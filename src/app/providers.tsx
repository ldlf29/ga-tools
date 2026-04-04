'use client';
import { useState, useEffect } from 'react';
import { getDefaultConfig, TantoProvider } from '@sky-mavis/tanto-widget';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { ronin } from 'viem/chains';
import { LazyMotion, domAnimation } from 'framer-motion';

const CLIENT_ID = process.env.NEXT_PUBLIC_WAYPOINT_CLIENT_ID || '';

// Hack: Tanto Widget's internal dependencies (like WalletConnect) blindly access
// indexedDB during configuration. Since this file is evaluated in Node during Next.js build,
// we mock indexedDB globally so the build doesn't crash with "ReferenceError: indexedDB is not defined".
if (typeof window === 'undefined') {
  (globalThis as any).indexedDB = {
    open: () => ({
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  };
}

const config = getDefaultConfig({
  appMetadata: {
    appName: 'Grand Arena Tools',
    appDescription: 'AI-powered lineup predictions for Grand Arena',
    appUrl: 'https://ga-tools.vercel.app',
  },
  keylessWalletConfig: {
    chainId: 2020,
    clientId: CLIENT_ID || 'dummy-build-id',
    enable: !!CLIENT_ID,
  },
  walletConnectConfig: {
    enable: true,
  },
  chains: [ronin],
});

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  // TantoProvider uses Emotion CSS-in-JS which causes SSR hydration mismatch in Next.js App Router.
  // We only mount it client-side. WagmiProvider + QueryClientProvider are safe for SSR.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <LazyMotion features={domAnimation}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          {mounted ? (
            <TantoProvider theme="dark">
              {children}
            </TantoProvider>
          ) : (
            <>{children}</>
          )}
        </QueryClientProvider>
      </WagmiProvider>
    </LazyMotion>
  );
}
