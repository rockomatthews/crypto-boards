'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useChatContext } from './ChatContext';

const Header = dynamic(() => import('./Header'), {
  ssr: false,
});

const ChatSidebar = dynamic(() => import('./ChatSidebar'), {
  ssr: false,
});

const FloatingChatButton = dynamic(() => import('./FloatingChatButton'), {
  ssr: false,
});

const GameChatModal = dynamic(() => import('./GameChatModal'), {
  ssr: false,
});

export default function ClientHeader() {
  const pathname = usePathname();
  const { 
    isChatVisible, 
    setIsChatVisible, 
    activeTab, 
    setActiveTab,
    showPhoneFinder,
    setShowPhoneFinder,
    isGameChatVisible,
    setIsGameChatVisible
  } = useChatContext();

  const handleChatToggle = () => {
    setIsChatVisible(!isChatVisible);
  };

  const handleGameChatToggle = () => {
    setIsGameChatVisible(!isGameChatVisible);
  };

  // Check if we're on homepage
  const isHomepage = pathname === '/';
  
  // Check if we're in a game
  const isInGame = pathname?.includes('/checkers/') || pathname?.includes('/chess/') || pathname?.includes('/stratego/') || pathname?.includes('/battleship/');

  return (
    <>
      <Header />
      
      {/* Regular chat sidebar for non-homepage pages */}
      {!isHomepage && (
        <ChatSidebar 
          isVisible={isChatVisible} 
          onClose={() => setIsChatVisible(false)}
          initialActiveTab={activeTab}
          onTabChange={setActiveTab}
          initialShowPhoneFinder={showPhoneFinder}
          onPhoneFinderChange={setShowPhoneFinder}
        />
      )}

      {/* Game chat modal for game pages */}
      {isInGame && (
        <GameChatModal
          isVisible={isGameChatVisible}
          onClose={() => setIsGameChatVisible(false)}
          gameId={pathname?.split('/').pop()} // Extract game ID from URL
        />
      )}
      
      {/* Floating chat button - only show on non-homepage */}
      {!isHomepage && (
        <FloatingChatButton
          isOpen={isInGame ? isGameChatVisible : isChatVisible}
          onClick={isInGame ? handleGameChatToggle : handleChatToggle}
          unreadCount={0} // TODO: Implement unread message count
        />
      )}
    </>
  );
} 