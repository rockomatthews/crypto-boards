import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "../styles/phone-input.css";
import { WalletProviders } from '../components/WalletProviders';
import ThemeRegistry from '../components/ThemeRegistry';
import ClientHeader from '../components/ClientHeader';
import { ChatProvider } from '../components/ChatContext';
import { generateWebsiteSchema, generateOrganizationSchema } from '../lib/structured-data';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crypto Boards - Bet SOL on Classic Board Games | Solana Gaming",
  description: "Bet SOL on classic board games against friends or strangers! Play Checkers, Battleship & Stratego with real crypto rewards on Solana. Fast, secure, winner-takes-all gaming.",
  keywords: ["crypto board games", "solana betting", "SOL gambling", "blockchain gaming", "play to earn", "web3 games", "crypto checkers", "solana battleship", "stratego betting", "P2P gaming", "decentralized gaming", "NFT games", "crypto esports", "solana games 2024", "board game betting", "crypto gambling", "SOL casino", "multiplayer crypto games", "real money gaming"],
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
    title: 'Crypto Boards - Bet SOL on Classic Board Games',
    description: 'Bet SOL on classic board games! Play Checkers, Battleship & Stratego against friends or strangers with real crypto rewards. Winner takes all on Solana blockchain.',
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
    title: 'Crypto Boards - Bet SOL on Classic Board Games',
    description: 'Bet SOL on Checkers, Battleship & Stratego! Play against friends or strangers with real crypto rewards. Winner takes all! 🏆💰',
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
  const websiteSchema = generateWebsiteSchema();
  const organizationSchema = generateOrganizationSchema();

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteSchema)
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema)
          }}
        />
      </head>
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
