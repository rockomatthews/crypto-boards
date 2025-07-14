'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ChatContextType {
  isChatVisible: boolean;
  setIsChatVisible: (visible: boolean) => void;
  activeTab: number;
  setActiveTab: (tab: number) => void;
  showPhoneFinder: boolean;
  setShowPhoneFinder: (show: boolean) => void;
  openChatToUsersTab: () => void;
  openFindAllFriends: () => void;
  isGameChatVisible: boolean;
  setIsGameChatVisible: (visible: boolean) => void;
  unreadGameMessages: number;
  setUnreadGameMessages: (count: number) => void;
  markGameMessagesAsRead: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [showPhoneFinder, setShowPhoneFinder] = useState(false);
  const [isGameChatVisible, setIsGameChatVisible] = useState(false);
  const [unreadGameMessages, setUnreadGameMessages] = useState(0);

  const openChatToUsersTab = () => {
    setActiveTab(1); // Users tab
    setIsChatVisible(true);
  };

  const openFindAllFriends = () => {
    setActiveTab(1); // Users tab
    setIsChatVisible(true);
    // Small delay to ensure chat is open before showing phone finder
    setTimeout(() => {
      setShowPhoneFinder(true);
    }, 100);
  };

  const markGameMessagesAsRead = () => {
    setUnreadGameMessages(0);
  };

  const value: ChatContextType = {
    isChatVisible,
    setIsChatVisible,
    activeTab,
    setActiveTab,
    showPhoneFinder,
    setShowPhoneFinder,
    openChatToUsersTab,
    openFindAllFriends,
    isGameChatVisible,
    setIsGameChatVisible,
    unreadGameMessages,
    setUnreadGameMessages,
    markGameMessagesAsRead,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}; 