'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const Header = dynamic(() => import('./Header'), {
  ssr: false,
});

const ChatSidebar = dynamic(() => import('./ChatSidebar'), {
  ssr: false,
});

export default function ClientHeader() {
  const [isChatVisible, setIsChatVisible] = useState(false);

  const handleChatToggle = () => {
    setIsChatVisible(!isChatVisible);
  };

  return (
    <>
      <Header onChatToggle={handleChatToggle} />
      <ChatSidebar 
        isVisible={isChatVisible} 
        onClose={() => setIsChatVisible(false)} 
      />
    </>
  );
} 