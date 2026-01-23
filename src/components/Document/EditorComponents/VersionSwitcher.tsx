import { DocumentVersion } from '@type/document';

interface VersionSwitcherProps {
  currentVersion: DocumentVersion;
  onVersionChange: (version: DocumentVersion) => void;
}

const VersionSwitcher = ({ currentVersion, onVersionChange }: VersionSwitcherProps) => {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-800/30 overflow-hidden bg-white dark:bg-gray-950 p-0.5">
      <button
        onClick={() => onVersionChange('Draft')}
        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
          currentVersion === 'Draft'
            ? 'bg-gray-100 dark:bg-gray-800/70 text-gray-900 dark:text-gray-200 shadow-sm'
            : 'bg-transparent text-gray-600 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-400'
        }`}
        aria-label="Draft Version"
      >
        Draft
      </button>
      <button
        onClick={() => onVersionChange('Finished')}
        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
          currentVersion === 'Finished'
            ? 'bg-gray-100 dark:bg-gray-800/70 text-gray-900 dark:text-gray-200 shadow-sm'
            : 'bg-transparent text-gray-600 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-400'
        }`}
        aria-label="Finished Version"
      >
        Finished
      </button>
      <button
        onClick={() => onVersionChange('Snippets')}
        className={`px-3 py-1.5 text-sm font-medium transition-colors ${
          currentVersion === 'Snippets'
            ? 'bg-gray-100 dark:bg-gray-800/70 text-gray-900 dark:text-gray-200 shadow-sm'
            : 'bg-transparent text-gray-600 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-400'
        }`}
        aria-label="Snippets Version"
      >
        Snippets
      </button>
    </div>
  );
};

export default VersionSwitcher;



