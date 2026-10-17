import { DocumentVersion } from '@type/document';

interface VersionSwitcherProps {
  currentVersion: DocumentVersion;
  onVersionChange: (version: DocumentVersion) => void;
}

const VersionSwitcher = ({ currentVersion, onVersionChange }: VersionSwitcherProps) => (
  <div className="workspace-versions" role="group" aria-label="Document section">
    {(['Draft', 'Finished', 'Snippets'] as DocumentVersion[]).map(version => (
      <button key={version} type="button" aria-label={`${version} Version`} aria-pressed={currentVersion === version}
        onClick={() => onVersionChange(version)}>{version}</button>
    ))}
  </div>
);

export default VersionSwitcher;
