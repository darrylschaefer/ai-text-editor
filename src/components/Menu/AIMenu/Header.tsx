import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useStore from '@store/store';
import { Idea, RecentlyViewed, TrashCan, Chat } from '@carbon/icons-react';
import useClearChat from '@hooks/useClearChat';
import { _defaultChatConfig } from '@constants/chat';
import defaultStyles from '@components/style';

const Header = React.memo(({setActiveMenu, activeMenu}: {
  setActiveMenu: React.Dispatch<React.SetStateAction<string>>;
  activeMenu: string;
}) => {
  const { t } = useTranslation();
  const [_content, _setContent] = useState<string>('');
  const clearChat = useClearChat();
  const generating = useStore.getState().generating;
  const setGenerating = useStore.getState().setGenerating;

  const [chatCleared, setChatCleared] = useState(false);

  const handleReturnChatClick = () => {
    setActiveMenu("chat");
  };

 const handleClearChatClick = () => {
  setGenerating(false);
    setChatCleared(true);
};

  useEffect(() => {
    if (chatCleared) {
      setTimeout(clearChat, 100);
      setActiveMenu("chat");
      setChatCleared(false);
    }
  }, [generating, chatCleared]);

  return (
    <div className="flex w-full justify-between">
    <div>
    {activeMenu == "chat" ? (
      <div className={
        defaultStyles.buttonStyle
        } onClick={handleClearChatClick}>
        <TrashCan size={16} />
        </div> ) : (
          <div className={
            defaultStyles.buttonStyle + " bg-gray-800"
            } onClick={handleReturnChatClick}>
              <Chat size={16} />
          </div>
        )}
    </div>
    <div className="flex">
        <div onClick={() => { 
          activeMenu == "history" ? (setActiveMenu("chat")): setActiveMenu("history"); }
        }
      className={defaultStyles.buttonStyle}
      title="Chat History"
      >
        <RecentlyViewed size={16} />
      </div>
      
      <div 
      onClick={() => { activeMenu == "settings" ? (setActiveMenu("chat")): setActiveMenu("settings");  }} 
      className={defaultStyles.buttonStyle}
      title="Change Prompt"
      >
        <Idea size={16} />
      </div>
      </div>
    </div>
  );
}
);

export default Header;
