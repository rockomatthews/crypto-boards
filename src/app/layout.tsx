import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "../styles/phone-input.css";
import { WalletProviders } from '../components/WalletProviders';
import ThemeRegistry from '../components/ThemeRegistry';
import ClientHeader from '../components/ClientHeader';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crypto Boards - Play & Earn",
  description: "Crypto-powered board games platform where winners take all",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeRegistry>
          <WalletProviders>
            <ClientHeader />
            {children}
          </WalletProviders>
        </ThemeRegistry>
      </body>
    </html>
  );
}
