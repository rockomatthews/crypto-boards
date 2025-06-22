'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

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
  const [isChatVisible, setIsChatVisible] = useState(false);

  const handleChatToggle = () => {
    setIsChatVisible(!isChatVisible);
  };

  return (
    <>
      <Header />
      <ChatSidebar 
        isVisible={isChatVisible} 
        onClose={() => setIsChatVisible(false)} 
      />
      <FloatingChatButton
        isOpen={isChatVisible}
        onClick={handleChatToggle}
        unreadCount={0} // TODO: Implement unread message count
      />
    </>
  );
} 