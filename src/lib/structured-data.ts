export const generateWebsiteSchema = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Crypto Boards",
  "alternateName": "Crypto Board Games",
  "url": "https://crypto-boards.vercel.app",
  "description": "Bet SOL on classic board games against friends or strangers! Play Checkers, Battleship & Stratego with real crypto rewards on Solana.",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://crypto-boards.vercel.app/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
});

export const generateGameSchema = (gameType: string, gameId: string) => ({
  "@context": "https://schema.org",
  "@type": "Game",
  "name": `${gameType} - Crypto Boards`,
  "description": `Play ${gameType} with SOL betting on Solana blockchain. Strategic gameplay with real crypto rewards.`,
  "url": `https://crypto-boards.vercel.app/${gameType.toLowerCase()}/${gameId}`,
  "gameLocation": "Online",
  "numberOfPlayers": "2",
  "genre": ["Strategy", "Board Game", "Cryptocurrency"],
  "gamePlatform": ["Web Browser", "Solana Blockchain"],
  "operatingSystem": ["Windows", "macOS", "Linux", "iOS", "Android"],
  "applicationCategory": "Game",
  "offers": {
    "@type": "Offer",
    "price": "Variable",
    "priceCurrency": "SOL",
    "availability": "https://schema.org/InStock"
  }
});

export const generateOrganizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Crypto Boards",
  "url": "https://crypto-boards.vercel.app",
  "logo": "https://crypto-boards.vercel.app/logo.png",
  "description": "Leading platform for crypto-powered board games with SOL betting on Solana blockchain.",
  "foundingDate": "2024",
  "sameAs": [
    "https://twitter.com/CryptoBoards"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "availableLanguage": "English"
  }
});

export const generateBreadcrumbSchema = (items: Array<{name: string, url: string}>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": items.map((item, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": item.name,
    "item": item.url
  }))
});

export const generateFAQSchema = () => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is Crypto Boards?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Crypto Boards is a platform where you can play classic board games like Checkers, Battleship, and Stratego with SOL cryptocurrency betting on the Solana blockchain."
      }
    },
    {
      "@type": "Question", 
      "name": "How do I bet SOL on games?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Connect your Solana wallet, choose a game lobby with your desired entry fee, and the winner takes all the SOL from both players."
      }
    },
    {
      "@type": "Question",
      "name": "What games can I play?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You can play Checkers, Battleship, and Stratego with real SOL betting against other players."
      }
    },
    {
      "@type": "Question",
      "name": "Is it safe to bet SOL?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, all transactions are secured by the Solana blockchain and smart contracts handle the escrow and payouts automatically."
      }
    }
  ]
});