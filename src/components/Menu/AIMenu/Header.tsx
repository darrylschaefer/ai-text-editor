import { lazy, Suspense, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Add, Chat, Checkmark, ChevronDown, Document, MagicWand, Notebook, Time, Tools } from '@carbon/icons-react';
import useStore from '@store/store';
import ModelLogo from '@components/Common/ModelLogo';
import useAnchoredMenu from '@hooks/useAnchoredMenu';
import type { ModelSettingsTab } from '../DocumentMenu/ConversationModelSettings';
import '../DocumentMenu/conversation-identity.css';

const ConversationModelSettings = lazy(() => import('../DocumentMenu/ConversationModelSettings'));
const sections = [
  { value: 'chat', name: 'Chat', icon: Chat }, { value: 'notes', name: 'Notes', icon: Notebook },
  { value: 'history', name: 'History', icon: Time }, { value: 'tools', name: 'Tools', icon: Tools },
  { value: 'meta', name: 'Meta', icon: Document }, { value: 'actions', name: 'Macros', icon: MagicWand },
];

export default function Header({ activeMenu, setActiveMenu, enabled = true }: {
  activeMenu: string; setActiveMenu: Dispatch<SetStateAction<string>>; enabled?: boolean;
}) {
  const conversation = useStore(state => state.getActiveConversation());
  const generating = useStore(state => state.generating);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<ModelSettingsTab | null>(null);
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), modelTrigger = useRef<HTMLButtonElement>(null);
  const position = useAnchoredMenu(trigger, 180, sectionOpen && enabled, 'start');
  const label = sections.find(section => activeMenu === section.value)?.name || 'Chat';
  const model = conversation?.config?.model;
  useEffect(() => { setSettingsTab(null); setSectionOpen(false); }, [conversation?.id, activeMenu, enabled]);
  useEffect(() => {
    if (!enabled) return;
    const open = (event: Event) => {
      if (activeMenu === 'chat' && conversation && !generating) {
        setSectionOpen(false); setSettingsTab((event as CustomEvent<ModelSettingsTab>).detail || 'setup');
      }
    };
    window.addEventListener('fthr-open-model-settings', open);
    return () => window.removeEventListener('fthr-open-model-settings', open);
  }, [enabled, activeMenu, conversation?.id, generating]);
  useEffect(() => {
    if (!sectionOpen) return;
    menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setSectionOpen(false);
    };
    window.addEventListener('pointerdown', dismiss);
    return () => window.removeEventListener('pointerdown', dismiss);
  }, [sectionOpen]);
  return <div className="workspace-assistant-tabs conversation-header" aria-label="Assistant view">
    <button type="button" ref={trigger} className="conversation-header-picker" aria-label={`Assistant section: ${label}`}
      aria-haspopup="menu" aria-expanded={sectionOpen} onClick={() => setSectionOpen(value => !value)}
      onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setSectionOpen(true); } }}>
      <span>{label}</span><ChevronDown size={13} />
    </button>
    <div ref={menu} role="menu" aria-label="Assistant sections" className="conversation-section-menu" hidden={!sectionOpen} style={position}
      onKeyDown={event => {
        const items = [...menu.current!.querySelectorAll<HTMLButtonElement>('button')];
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setSectionOpen(false); trigger.current?.focus(); }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 :
            (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
        }
        if (event.key === 'Tab') setSectionOpen(false);
      }}>
      {sections.map(({ value, name, icon: Icon }) => <button key={value} type="button" role="menuitemradio" aria-checked={activeMenu === value}
        aria-pressed={activeMenu === value} onClick={() => { setActiveMenu(value); setSectionOpen(false); trigger.current?.focus(); }}>
        <Icon size={16} aria-hidden="true" /><span>{name}</span>{activeMenu === value && <Checkmark size={13} aria-hidden="true" />}
      </button>)}
    </div>
    {activeMenu === 'chat' && <button type="button" ref={modelTrigger} className="conversation-header-picker conversation-header-model"
      aria-label={model ? `Model settings: ${model}` : 'New chat'} aria-haspopup="dialog" aria-expanded={settingsTab !== null}
      title={model || 'New chat (Ctrl+M)'} disabled={generating} onClick={() => {
        setSectionOpen(false);
        if (model && conversation) setSettingsTab('setup'); else window.dispatchEvent(new Event('fthr-open-chat-picker'));
      }}>{model && <ModelLogo model={model} />}<span>{model || 'New chat'}</span>{model ? <ChevronDown size={13} /> : <Add size={14} />}</button>}
    {enabled && settingsTab && conversation && <Suspense fallback={null}><ConversationModelSettings key={conversation.id} conversation={conversation}
      anchorRef={modelTrigger} initialTab={settingsTab} close={() => setSettingsTab(null)} /></Suspense>}
  </div>;
}
