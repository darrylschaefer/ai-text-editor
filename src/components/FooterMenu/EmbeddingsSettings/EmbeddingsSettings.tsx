import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useStore from '@store/store';

import { MachineLearning } from '@carbon/icons-react';
import EmbeddingsSettingsMenu from '@components/FooterMenu/EmbeddingsSettings/EmbeddingsSettingsMenu';

const EmbeddingsSettings = () => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isWorking, setIsWorking] = useState<boolean>(false);

  const embeddingsEnabled = useStore((state) => state.embeddingsEnabled);
  const apiKey = useStore((state) => state.apiKey);
  const apiEndpoint = useStore((state) => state.apiEndpoint);

  // Check if embeddings are working (enabled + API configured)
  useEffect(() => {
    const checkEmbeddingsStatus = async () => {
      if (!embeddingsEnabled) {
        setIsWorking(false);
        return;
      }

      // Check if API is configured (required for embeddings to work)
      if (!apiKey || !apiEndpoint) {
        setIsWorking(false);
        return;
      }

      // Check if there are any blocks with embeddings (indicates it's working)
      try {
        const { getAllBlockIndices } = await import('@store/block-index-store');
        const blocks = await getAllBlockIndices();
        const blocksWithEmbeddings = blocks.filter(b => b.embedding && b.embedding.length > 0);
        
        // Consider it working if we have API config and at least some blocks have embeddings
        // or if we have API config (it can work, just might not have generated embeddings yet)
        setIsWorking(true);
      } catch (error) {
        console.warn('[EmbeddingsSettings] Error checking embeddings status:', error);
        // Still consider it working if API is configured
        setIsWorking(!!apiKey && !!apiEndpoint);
      }
    };

    checkEmbeddingsStatus();
    // Re-check periodically
    const interval = setInterval(checkEmbeddingsStatus, 5000);
    return () => clearInterval(interval);
  }, [embeddingsEnabled, apiKey, apiEndpoint]);

  const showIndicator = embeddingsEnabled && isWorking;

  return (
    <>
      <a
        className='flex mb-1 py-2 px-2 items-center gap-3 rounded-md hover:bg-gray-500/10 dark:hover:bg-gray-500/10 transition-colors duration-200 text-gray-900 dark:text-white cursor-pointer text-sm relative'
        id='embeddings-settings-menu'
        onClick={() => setIsModalOpen(true)}
      >
        <MachineLearning className='w-4 h-4' />
        <span className='flex-1'>Embeddings Settings</span>
        {showIndicator && (
          <span 
            className='inline-block w-2 h-2 bg-green-500 rounded-full ml-auto'
            title='Embeddings enabled and working'
            style={{
              boxShadow: '0 0 4px rgba(34, 197, 94, 0.6)',
            }}
          />
        )}
      </a>
      {isModalOpen && <EmbeddingsSettingsMenu setIsModalOpen={setIsModalOpen} />}
    </>
  );
};

export default EmbeddingsSettings;
