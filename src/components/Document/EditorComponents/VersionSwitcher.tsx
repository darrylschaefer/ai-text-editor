import { useEffect, useId, useRef, useState } from 'react';
import { Add, Checkmark, Copy, Edit } from '@carbon/icons-react';
import useStore from '@store/store';
import PopupModal from '@components/PopupModal';
import { getDocumentVersions, getVersionName } from '@utils/document-versions';
import { DocumentVersion } from '@type/document';

interface VersionSwitcherProps {
  currentVersion: DocumentVersion;
  onVersionChange: (version: DocumentVersion) => void | Promise<void>;
}
type VersionAction = 'copy' | 'blank' | 'rename';

export default function VersionSwitcher({ currentVersion, onVersionChange }: VersionSwitcherProps) {
  const doc = useStore(state => state.chats?.[state.currentChatIndex]);
  const generating = useStore(state => state.generating);
  const createVersion = useStore(state => state.createDocumentVersion);
  const renameVersion = useStore(state => state.renameDocumentVersion);
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<VersionAction | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [position, setPosition] = useState({ left: 12, top: 50, width: 296 });
  const trigger = useRef<HTMLButtonElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const pending = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const menuId = useId();

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; pending.current?.abort(); }; }, []);
  useEffect(() => {
    setOpen(false); setDialog(null); setError(''); pending.current?.abort();
  }, [doc?.id, currentVersion]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnResize = () => setOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault(); setOpen(false); trigger.current?.focus();
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnResize);
    return () => { document.removeEventListener('mousedown', closeOutside); document.removeEventListener('keydown', closeOnEscape); window.removeEventListener('resize', closeOnResize); };
  }, [open]);

  if (!doc) return null;
  const currentName = getVersionName(doc, currentVersion);
  const versions = getDocumentVersions(doc);
  const closeDialog = () => { pending.current?.abort(); setDialog(null); setError(''); };
  const startAction = (action: VersionAction) => {
    setOpen(false); setError(''); setName(action === 'rename' ? currentName : action === 'copy' ? `${currentName} copy` : '');
    trigger.current?.focus(); setDialog(action);
  };
  const choose = async (id: string) => {
    try { setError(''); await onVersionChange(id); setOpen(false); trigger.current?.focus(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not switch versions.'); }
  };
  const submit = async () => {
    if (pending.current || !dialog || !name.trim()) return;
    const request = new AbortController(); pending.current = request; setBusy(true); setError('');
    try {
      if (dialog === 'rename') renameVersion(doc.id, currentVersion, name);
      else await createVersion(doc.id, name, dialog === 'copy' ? currentVersion : undefined, request.signal);
      if (mounted.current && !request.signal.aborted) setDialog(null);
    } catch (failure) {
      if (mounted.current && !request.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not save this version.');
    } finally {
      pending.current = null; if (mounted.current) setBusy(false);
    }
  };

  return <div className="workspace-versions" role="group" aria-label="Document section" ref={wrapper}>
    <button ref={trigger} type="button" className="workspace-version-trigger" aria-label="Choose document version" title={currentName}
      disabled={generating || busy} aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => {
        const bounds = trigger.current!.getBoundingClientRect(); const width = Math.min(296, window.innerWidth - 24);
        setPosition({ width, top: bounds.bottom + 6, left: Math.max(12, Math.min(bounds.right - width, window.innerWidth - width - 12)) });
        setOpen(value => !value); setError('');
      }}>
      <span>{currentName}</span>
    </button>
    <div id={menuId} className="workspace-version-menu" hidden={!open} style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 16}px)` }}>
      <h2>Versions</h2>
      <div role="group" aria-label="Document versions" className="workspace-version-list">
        {versions.map(version => <button type="button" key={version.id} aria-label={`${version.name} Version`} aria-pressed={currentVersion === version.id}
          onClick={() => void choose(version.id)}><span>{version.name}</span>{currentVersion === version.id && <Checkmark size={16} aria-hidden="true" />}</button>)}
      </div>
      <div className="workspace-version-actions">
        <button type="button" onClick={() => startAction('copy')}><Copy size={16} aria-hidden="true" />Make a copy</button>
        <button type="button" onClick={() => startAction('blank')}><Add size={16} aria-hidden="true" />New blank version</button>
        <button type="button" onClick={() => startAction('rename')}><Edit size={16} aria-hidden="true" />Rename this version</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
    {dialog && <PopupModal title={dialog === 'rename' ? 'Rename version' : dialog === 'copy' ? 'Make a copy' : 'New blank version'}
      cancelButton={false} initialFocus='[aria-label="Version name"]' setIsModalOpen={closeDialog}>
      <div className="workspace-version-dialog">
        <label htmlFor={`${menuId}-name`}>Version name</label>
        <input id={`${menuId}-name`} aria-label="Version name" value={name} maxLength={60} autoFocus onChange={event => setName(event.target.value)}
          placeholder="e.g. A different opening" onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void submit(); } }} />
        <p>{dialog === 'rename' ? 'The writing in this version stays the same.' : dialog === 'copy'
          ? `Start with a copy of “${currentName}”. The original stays intact.` : 'Start with an empty page. Your other versions stay intact.'}</p>
        {error && <p role="alert">{error}</p>}
        <div className="workspace-version-dialog-actions"><button type="button" onClick={closeDialog}>Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={busy || !name.trim()}>{busy ? 'Saving…' : dialog === 'rename' ? 'Save name' : 'Create version'}</button></div>
      </div>
    </PopupModal>}
  </div>;
}
