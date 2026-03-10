import type { Metadata } from "next";
import { Geist, Geist_Mono, Lilita_One } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const lilitaOne = Lilita_One({
  weight: "400",
  variable: "--font-lilita",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Grand Arena Tools",
  description: "Advanced Lineup Builder Tools, Champions, Stats and Analytics for Grand Arena",
  icons: {
    icon: [
      { url: "/count.png" },
      { url: "/count.png", sizes: "32x32" },
      { url: "/count.png", sizes: "16x16" },
    ],
    apple: "/count.png",
    shortcut: "/count.png",
  },
  appleWebApp: {
    title: "Grand Arena Tools",
    statusBarStyle: "default",
    capable: true,
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${lilitaOne.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
