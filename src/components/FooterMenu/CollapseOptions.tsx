import React, { useState, useRef, useEffect } from 'react';
import { Settings, TrashCan, Settings as SettingsIcon, Information, DocumentExport as ExportIcon, Password, Chat } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import useStore from '@store/store';
import useHideOnOutsideClick from '@hooks/useHideOnOutsideClick';
import Api from './Api/Api';
import AboutMenu from './AboutMenu/AboutMenu';
import ImportExportChat from './ImportExportChat/ImportExportChat';
import AgentSetup from './AgentSetup/AgentSetup';
import EmbeddingsSettings from './EmbeddingsSettings/EmbeddingsSettings';
import GoogleSync from '@components/GoogleSync';
import { TotalTokenCostDisplay } from './SettingsMenu/TotalTokenCost';
import ThemeToggle from './ThemeToggle';
import PopupModal from '@components/PopupModal';
import useInitialiseNewDocument from '@hooks/useInitialiseNewDocument';
import SettingsMenuHidden from './SettingsMenuHidden';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined;

// Simple menu items that trigger modals
const MenuItem = ({ 
  icon, 
  label, 
  onClick,
  indicator
}: { 
  icon: React.ReactNode; 
  label: string; 
  onClick: () => void;
  indicator?: React.ReactNode;
}) => {
  return (
    <a
      className='flex mb-1 py-2 px-2 items-center gap-3 rounded-md hover:bg-gray-500/10 dark:hover:bg-gray-500/10 transition-colors duration-200 text-gray-900 dark:text-white cursor-pointer text-sm relative'
      onClick={onClick}
    >
      {icon}
      <span className='flex-1'>{label}</span>
      {indicator}
    </a>
  );
};

// Direct modal components for Settings items
const ClearConversationModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { t } = useTranslation();
  const initialiseNewChat = useInitialiseNewDocument();
  const setFolders = useStore((state) => state.setFolders);

  const handleConfirm = () => {
    onClose();
    initialiseNewChat();
    setFolders({});
  };

  if (!isOpen) return null;

  return (
    <PopupModal
      setIsModalOpen={onClose}
      title={t('warning') as string}
      message={t('clearConversationWarning') as string}
      handleConfirm={handleConfirm}
    />
  );
};





const CollapseOptions = () => {
  const { t } = useTranslation();
  const [isMenuOpen, setMenuOpen, menuRef] = useHideOnOutsideClick();
  const countTotalTokens = useStore((state) => state.countTotalTokens);
  const [clearConversationOpen, setClearConversationOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [embeddingsWorking, setEmbeddingsWorking] = useState(false);
  
  const embeddingsEnabled = useStore((state) => state.embeddingsEnabled);
  const apiKey = useStore((state) => state.apiKey);
  const apiEndpoint = useStore((state) => state.apiEndpoint);
  
  // Refs to hold component instances outside the dropdown
  const aboutMenuRef = useRef<HTMLDivElement>(null);
  const importExportRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<HTMLDivElement>(null);
  const agentSetupRef = useRef<HTMLDivElement>(null);
  const embeddingsSettingsRef = useRef<HTMLDivElement>(null);

  // Trigger SettingsMenu button when showSettings is true
  useEffect(() => {
    if (showSettings && settingsMenuRef.current) {
      const button = settingsMenuRef.current.querySelector('a');
      if (button) {
        button.click();
        setShowSettings(false);
      }
    }
  }, [showSettings]);
  
  // Handlers that trigger the components' buttons
  const handleAboutClick = () => {
    setMenuOpen(false);
    setTimeout(() => {
      if (aboutMenuRef.current) {
        const link = aboutMenuRef.current.querySelector('a');
        if (link) link.click();
      }
    }, 100);
  };
  
  const handleImportExportClick = () => {
    setMenuOpen(false);
    setTimeout(() => {
      if (importExportRef.current) {
        const link = importExportRef.current.querySelector('a');
        if (link) link.click();
      }
    }, 100);
  };
  
  const handleApiClick = () => {
    setMenuOpen(false);
    setTimeout(() => {
      if (apiRef.current) {
        const link = apiRef.current.querySelector('a');
        if (link) link.click();
      }
    }, 100);
  };
  
  const handleAgentSetupClick = () => {
    setMenuOpen(false);
    setTimeout(() => {
      if (agentSetupRef.current) {
        const link = agentSetupRef.current.querySelector('a');
        if (link) link.click();
      }
    }, 100);
  };
  
  const handleEmbeddingsSettingsClick = () => {
    setMenuOpen(false);
    setTimeout(() => {
      if (embeddingsSettingsRef.current) {
        const link = embeddingsSettingsRef.current.querySelector('a');
        if (link) link.click();
      }
    }, 100);
  };

  // Check if embeddings are working
  useEffect(() => {
    const checkEmbeddingsStatus = async () => {
      if (!embeddingsEnabled) {
        setEmbeddingsWorking(false);
        return;
      }

      // Check if API is configured (required for embeddings to work)
      if (!apiKey || !apiEndpoint) {
        setEmbeddingsWorking(false);
        return;
      }

      // Check if there are any blocks with embeddings (indicates it's working)
      try {
        const { getAllBlockIndices } = await import('@store/block-index-store');
        const blocks = await getAllBlockIndices();
        const blocksWithEmbeddings = blocks.filter(b => b.embedding && b.embedding.length > 0);
        
        // Consider it working if we have API config and at least some blocks have embeddings
        // or if we have API config (it can work, just might not have generated embeddings yet)
        setEmbeddingsWorking(true);
      } catch (error) {
        console.warn('[CollapseOptions] Error checking embeddings status:', error);
        // Still consider it working if API is configured
        setEmbeddingsWorking(!!apiKey && !!apiEndpoint);
      }
    };

    checkEmbeddingsStatus();
    // Re-check periodically
    const interval = setInterval(checkEmbeddingsStatus, 5000);
    return () => clearInterval(interval);
  }, [embeddingsEnabled, apiKey, apiEndpoint]);

  return (
    <div className='relative' ref={menuRef}>
      <div className='flex gap-2 p-3 border-b border-gray-200 dark:border-gray-800/30'>
        <button
          className='flex items-center justify-center py-2 px-3 text-sm font-medium transition-colors bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md'
          onClick={() => setMenuOpen(!isMenuOpen)}
        >
          <Settings size={16} />
        </button>
      </div>
      {isMenuOpen && (
        <div
          className='absolute bottom-full left-0 w-full min-w-[200px] z-50 bg-white dark:bg-gray-800 rounded-t-md shadow-sm dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] border border-gray-200/60 dark:border-gray-800/40 border-b-0 overflow-hidden'
          style={{
            animation: 'fadeInUp 0.15s ease-out',
          }}
        >
          <div className='px-2 py-2 flex flex-col max-h-[70vh] overflow-y-auto'>
            {countTotalTokens && (
              <div className='mb-2 pb-2 border-b border-gray-200 dark:border-gray-800/30'>
                <TotalTokenCostDisplay />
              </div>
            )}
            <div className='flex flex-col gap-0.5'>
              {googleClientId && (
                <div onClick={() => setMenuOpen(false)}>
                  <GoogleSync clientId={googleClientId} />
                </div>
              )}
              <div onClick={() => setMenuOpen(false)}>
                <ThemeToggle />
              </div>
              <MenuItem
                icon={<Information className='w-4 h-4' />}
                label="More Information"
                onClick={handleAboutClick}
              />
              <MenuItem
                icon={<ExportIcon className='w-4 h-4' />}
                label={`${t('import')} / ${t('export')}`}
                onClick={handleImportExportClick}
              />
              <MenuItem
                icon={<Password className='w-4 h-4' />}
                label={t('api')}
                onClick={handleApiClick}
                indicator={
                  <span 
                    className={`inline-block w-2 h-2 rounded-full ml-auto ${
                      apiKey && apiKey.trim().length > 0 
                        ? 'bg-green-500' 
                        : 'bg-red-500'
                    }`}
                    title={
                      apiKey && apiKey.trim().length > 0 
                        ? 'API key is set' 
                        : 'No API key set'
                    }
                    style={{
                      boxShadow: apiKey && apiKey.trim().length > 0 
                        ? '0 0 4px rgba(34, 197, 94, 0.6)' 
                        : '0 0 4px rgba(239, 68, 68, 0.6)',
                    }}
                  />
                }
              />
              <MenuItem
                icon={<Chat className='w-4 h-4' />}
                label="Agent Setup"
                onClick={handleAgentSetupClick}
              />
              <MenuItem
                icon={<SettingsIcon className='w-4 h-4' />}
                label="Embeddings Settings"
                onClick={handleEmbeddingsSettingsClick}
                indicator={
                  embeddingsEnabled && embeddingsWorking ? (
                    <span 
                      className='inline-block w-2 h-2 bg-green-500 rounded-full ml-auto'
                      title='Embeddings enabled and working'
                      style={{
                        boxShadow: '0 0 4px rgba(34, 197, 94, 0.6)',
                      }}
                    />
                  ) : undefined
                }
              />
              <div className='mt-1 pt-1 border-t border-gray-200 dark:border-gray-800/30'>
                <MenuItem
                  icon={<TrashCan className='w-4 h-4' />}
                  label={t('clearConversation')}
                  onClick={() => {
                    setMenuOpen(false);
                    setClearConversationOpen(true);
                  }}
                />
                <MenuItem
                  icon={<SettingsIcon className='w-4 h-4' />}
                  label={t('setting') as string}
                  onClick={() => {
                    setMenuOpen(false);
                    setShowSettings(true);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      <ClearConversationModal
        isOpen={clearConversationOpen}
        onClose={() => setClearConversationOpen(false)}
      />
      {/* Hidden SettingsMenu that we trigger programmatically */}
      <div ref={settingsMenuRef} style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
        <SettingsMenuHidden />
      </div>
      {/* Render components outside dropdown so they persist when menu closes */}
      <div ref={aboutMenuRef} style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
        <AboutMenu />
      </div>
      <div ref={importExportRef} style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
        <ImportExportChat />
      </div>
      <div ref={apiRef} style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
        <Api />
      </div>
      <div ref={agentSetupRef} style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
        <AgentSetup />
      </div>
      <div ref={embeddingsSettingsRef} style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
        <EmbeddingsSettings />
      </div>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(2px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default CollapseOptions;
