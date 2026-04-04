import type { Metadata } from 'next';
import { Geist, Geist_Mono, Lilita_One } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import Providers from './providers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const lilitaOne = Lilita_One({
  weight: '400',
  variable: '--font-lilita',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.grandarena.tools'),
  title: {
    default: 'Grand Arena Tools | Auto Lineup Builder & Moki Meta',
    template: '%s | Grand Arena Tools',
  },
  description:
    'The ultimate Grand Arena tools. Discover the best striker Moki teams, auto lineup builder, synergy calculators, and Grand Arena tier list to increase your win rate.',
  keywords: [
    'Grand Arena auto lineup builder',
    'Grand Arena synergy calculator',
    'Moki stats tracker',
    'Best striker Moki team',
    'Grand Arena tier list',
    'How to increase win rate Grand Arena',
    'Best comps Grand Arena Web3',
  ],
  openGraph: {
    title: 'Grand Arena Tools | Auto Lineup Builder & Moki Meta',
    description:
      'The ultimate Grand Arena tools. Discover the best striker Moki teams, auto lineup builder, synergy calculators, and Grand Arena tier list to increase your win rate.',
    url: 'https://www.grandarena.tools',
    siteName: 'Grand Arena Tools',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Grand Arena Tools | Auto Lineup Builder & Moki Meta',
    description:
      'The ultimate Grand Arena tools. Discover the best striker Moki teams, auto lineup builder, synergy calculators, and Grand Arena tier list to increase your win rate.',
  },
  icons: {
    icon: '/icons/logo-ga-tools-2.png',
    apple: '/icons/logo-ga-tools-2.png',
    shortcut: '/icons/logo-ga-tools-2.png',
  },
  appleWebApp: {
    title: 'Grand Arena Tools',
    statusBarStyle: 'default',
    capable: true,
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${lilitaOne.variable}`}
      >
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
