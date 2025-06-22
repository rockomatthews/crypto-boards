'use client';

import dynamic from 'next/dynamic';
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

export default function ClientHeader() {
  const { 
    isChatVisible, 
    setIsChatVisible, 
    activeTab, 
    setActiveTab,
    showPhoneFinder,
    setShowPhoneFinder 
  } = useChatContext();

  const handleChatToggle = () => {
    setIsChatVisible(!isChatVisible);
  };

  return (
    <>
      <Header />
      <ChatSidebar 
        isVisible={isChatVisible} 
        onClose={() => setIsChatVisible(false)}
        initialActiveTab={activeTab}
        onTabChange={setActiveTab}
        initialShowPhoneFinder={showPhoneFinder}
        onPhoneFinderChange={setShowPhoneFinder}
      />
      <FloatingChatButton
        isOpen={isChatVisible}
        onClick={handleChatToggle}
        unreadCount={0} // TODO: Implement unread message count
      />
    </>
  );
} 