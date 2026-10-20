import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { LexicalEditor } from 'lexical';
import type { RhythmSentence } from '@utils/prose-rhythm-lexical';
import { hasRhythmHighlights } from '@utils/prose-rhythm-highlight';

export type RhythmSnapshot = { editor: LexicalEditor; documentId: string; version: string;
  session: object; generation: number; sentences: RhythmSentence[]; navigate(id: string): void };
type RhythmContext = { active: boolean; enabled: boolean; setEnabled: Dispatch<SetStateAction<boolean>>;
  colors: boolean; setColors: Dispatch<SetStateAction<boolean>>;
  activeSentence: string | null; setActiveSentence: Dispatch<SetStateAction<string | null>>;
  snapshot: RhythmSnapshot | null; setSnapshot: Dispatch<SetStateAction<RhythmSnapshot | null>>; highlightsAvailable: boolean };
const Context = createContext<RhythmContext | null>(null);
export function useProseRhythm() { return useContext(Context); }

/** Temporary view state, intentionally separate from persisted documents. */
export function ProseRhythmProvider({ active, children }: { active: boolean; children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [colors, setColors] = useState(true);
  const [activeSentence, setActiveSentence] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RhythmSnapshot | null>(null);
  return <Context.Provider value={{ active: active && enabled, enabled, setEnabled, colors, setColors, activeSentence, setActiveSentence,
    snapshot, setSnapshot, highlightsAvailable: hasRhythmHighlights() }}>{children}</Context.Provider>;
}
