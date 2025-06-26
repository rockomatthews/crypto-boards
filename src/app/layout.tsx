import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "../styles/phone-input.css";
import { WalletProviders } from '../components/WalletProviders';
import ThemeRegistry from '../components/ThemeRegistry';
import ClientHeader from '../components/ClientHeader';
import { ChatProvider } from '../components/ChatContext';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crypto Boards - Play & Earn SOL",
  description: "The ultimate crypto-powered board games platform. Play checkers, chess, and more with SOL betting. Winners take all in real-time multiplayer games on Solana.",
  keywords: ["crypto games", "solana", "SOL", "board games", "checkers", "chess", "multiplayer", "web3", "betting", "esports"],
  authors: [{ name: "Crypto Boards" }],
  creator: "Crypto Boards",
  publisher: "Crypto Boards",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://crypto-boards.vercel.app'),
  
  // Open Graph tags for rich link previews
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'Crypto Boards',
    title: 'Crypto Boards - Play & Earn SOL',
    description: 'The ultimate crypto-powered board games platform. Play checkers, chess, and more with SOL betting. Winners take all in real-time multiplayer games on Solana.',
    images: [
      {
        url: '/images/checkers.png',
        width: 1200,
        height: 630,
        alt: 'Crypto Boards - Play checkers and earn SOL',
        type: 'image/png',
      },
      {
        url: '/logo.png',
        width: 400,
        height: 400,
        alt: 'Crypto Boards Logo',
        type: 'image/png',
      }
    ],
  },
  
  // Twitter Card tags
  twitter: {
    card: 'summary_large_image',
    site: '@CryptoBoards',
    creator: '@CryptoBoards',
    title: 'Crypto Boards - Play & Earn SOL',
    description: 'Play checkers, chess & more with SOL betting. Winners take all! 🏆',
    images: ['/images/checkers.png'],
  },
  
  // Additional meta tags
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  
  // App-specific meta tags
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Crypto Boards',
  },
  
  // Verification and other meta tags
  other: {
    'theme-color': '#8B4513',
    'msapplication-TileColor': '#8B4513',
    'msapplication-config': '/browserconfig.xml',
  },
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
            <ChatProvider>
              <ClientHeader />
              {children}
            </ChatProvider>
          </WalletProviders>
        </ThemeRegistry>
      </body>
    </html>
  );
}
