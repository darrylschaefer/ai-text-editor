import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useStore from '@store/store';
import PopupModal from '@components/PopupModal';

const EMBEDDING_MODELS = [
  { value: 'text-embedding-3-small', label: 'text-embedding-3-small (Default, 1536 dimensions)' },
  { value: 'text-embedding-3-large', label: 'text-embedding-3-large (3072 dimensions)' },
  { value: 'text-embedding-ada-002', label: 'text-embedding-ada-002 (Legacy, 1536 dimensions)' },
];

const EmbeddingsSettingsMenu = ({
  setIsModalOpen,
}: {
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const { t } = useTranslation(['main', 'api']);

  const embeddingsEnabled = useStore((state) => state.embeddingsEnabled);
  const embeddingModel = useStore((state) => state.embeddingModel);
  const embeddingInactivityDelayMs = useStore((state) => state.embeddingInactivityDelayMs);
  const embeddingRateLimitMs = useStore((state) => state.embeddingRateLimitMs);
  const embeddingBatchSize = useStore((state) => state.embeddingBatchSize);

  const setEmbeddingsEnabled = useStore((state) => state.setEmbeddingsEnabled);
  const setEmbeddingModel = useStore((state) => state.setEmbeddingModel);
  const setEmbeddingInactivityDelayMs = useStore((state) => state.setEmbeddingInactivityDelayMs);
  const setEmbeddingRateLimitMs = useStore((state) => state.setEmbeddingRateLimitMs);
  const setEmbeddingBatchSize = useStore((state) => state.setEmbeddingBatchSize);

  // Local state
  const [_enabled, _setEnabled] = useState<boolean>(embeddingsEnabled);
  const [_model, _setModel] = useState<string>(embeddingModel);
  const [_inactivityDelay, _setInactivityDelay] = useState<number>(embeddingInactivityDelayMs);
  const [_rateLimit, _setRateLimit] = useState<number>(embeddingRateLimitMs);
  const [_batchSize, _setBatchSize] = useState<number>(embeddingBatchSize);

  // Sync with store on mount
  useEffect(() => {
    _setEnabled(embeddingsEnabled);
    _setModel(embeddingModel);
    _setInactivityDelay(embeddingInactivityDelayMs);
    _setRateLimit(embeddingRateLimitMs);
    _setBatchSize(embeddingBatchSize);
  }, [embeddingsEnabled, embeddingModel, embeddingInactivityDelayMs, embeddingRateLimitMs, embeddingBatchSize]);

  const handleSave = () => {
    setEmbeddingsEnabled(_enabled);
    setEmbeddingModel(_model);
    setEmbeddingInactivityDelayMs(_inactivityDelay);
    setEmbeddingRateLimitMs(_rateLimit);
    setEmbeddingBatchSize(_batchSize);
    setIsModalOpen(false);
  };

  const inactivityDelaySeconds = Math.round(_inactivityDelay / 1000);

  return (
    <PopupModal
      title="Embeddings Settings"
      setIsModalOpen={setIsModalOpen}
      cancelButton={true}
      handleConfirm={handleSave}
    >
      <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)]">
        {/* Enable/Disable Toggle */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Enable Embeddings
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                When enabled, blocks are automatically indexed with embeddings for semantic search.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={_enabled}
                onChange={(e) => _setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {_enabled && (
          <>
            {/* Embedding Model Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Embedding Model
              </label>
              <select
                value={_model}
                onChange={(e) => _setModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                {EMBEDDING_MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Changing the model will require regenerating embeddings for all blocks.
              </p>
            </div>

            {/* Inactivity Delay */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Inactivity Delay: {inactivityDelaySeconds} seconds
              </label>
              <input
                type="range"
                min="5"
                max="120"
                step="5"
                value={inactivityDelaySeconds}
                onChange={(e) => _setInactivityDelay(parseInt(e.target.value) * 1000)}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>5s</span>
                <span>120s</span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Wait time after editing stops before generating embeddings. Prevents unnecessary API calls during active editing.
              </p>
            </div>

            {/* Rate Limit */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rate Limit: {_rateLimit}ms between requests
              </label>
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                value={_rateLimit}
                onChange={(e) => _setRateLimit(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>100ms</span>
                <span>5000ms</span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Minimum time between embedding API requests to avoid rate limiting.
              </p>
            </div>

            {/* Batch Size */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Batch Size: {_batchSize} blocks per batch
              </label>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={_batchSize}
                onChange={(e) => _setBatchSize(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>1</span>
                <span>20</span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Number of blocks to process in each batch. Larger batches process faster but use more memory.
              </p>
            </div>
          </>
        )}

        {!_enabled && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> When embeddings are disabled, semantic search will not be available. 
              Text search will still work normally.
            </p>
          </div>
        )}
      </div>
    </PopupModal>
  );
};

export default EmbeddingsSettingsMenu;
