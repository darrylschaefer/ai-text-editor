import { useRef, useCallback, useEffect, useState } from 'react';
import { EditorState } from 'lexical';
import useStore from '@store/store';
import { DocumentVersion } from '@type/document';
import { updateBlockIndexForSection } from '@utils/block-index-updater';
import { normalizeBlockIds } from '@utils/block-ids';
import { withVersionState } from '@utils/document-versions';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface UseAutosaveOptions {
  documentId: string;
  section: DocumentVersion;
  debounceMs?: number;
  maxIntervalMs?: number;
}

interface UseAutosaveReturn {
  saveStatus: SaveStatus;
  triggerSave: (editorState: EditorState) => void;
  flushSave: () => Promise<void>;
  retrySave: () => Promise<void>;
}

/**
 * Autosave hook for Lexical editor with debounce and max interval flush.
 * 
 * Features:
 * - Debounced saves (default 1000ms after typing stops)
 * - Max interval flush (default 15s during continuous typing)
 * - Save sequence tracking to prevent out-of-order saves
 * - Save status tracking (idle, saving, saved, error)
 * - Flush on demand for section/document switches
 */
export function useAutosave({
  documentId,
  section,
  debounceMs = 1000,
  maxIntervalMs = 15000,
}: UseAutosaveOptions): UseAutosaveReturn {
  const setChats = useStore((state) => state.setChats);
  const chats = useStore((state) => state.chats);
  
  // Store latest editor state in ref to avoid re-renders
  const latestStateRef = useRef<string | null>(null);
  const saveSequenceRef = useRef<number>(0);
  const pendingSaveSequenceRef = useRef<number | null>(null);
  
  // Timers
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxIntervalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef<number>(Date.now());
  
  // Save status
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  
  // Track if we're currently saving
  const isSavingRef = useRef<boolean>(false);
  const saveErrorRef = useRef<unknown>(null);
  
  /**
   * Actually persist the editor state to Zustand (which triggers IndexedDB via persist middleware)
   */
  const performSave = useCallback(async (stateJson: string, sequence: number): Promise<void> => {
    // If this save is outdated, skip it
    if (sequence < saveSequenceRef.current) {
      return;
    }
    
    // Mark the sequence as pending
    pendingSaveSequenceRef.current = sequence;
    isSavingRef.current = true;
    setSaveStatus('saving');
    
    try {
      const currentChats = useStore.getState().chats;
      if (!currentChats) {
        throw new Error('No chats available');
      }
      
      const chatIndex = currentChats.findIndex((chat) => chat.id === documentId);
      if (chatIndex === -1) {
        throw new Error(`Document ${documentId} not found`);
      }
      
      const updatedChats = [...currentChats];
      const currentDoc = withVersionState(updatedChats[chatIndex], section, stateJson);
      
      updatedChats[chatIndex] = currentDoc;
      
      // Update Zustand - this triggers IndexedDB persistence via persist middleware
      setChats(updatedChats);
      
      // Update block index in background (don't await - non-blocking)
      updateBlockIndexForSection(documentId, section, stateJson).catch(error => {
        console.error('Background block index update failed:', error);
      });
      
      // Wait a tick to ensure the save completed
      await new Promise((resolve) => setTimeout(resolve, 0));
      
      // Only update status if this is still the latest save
      if (sequence === saveSequenceRef.current) {
        saveErrorRef.current = null;
        setSaveStatus('saved');
        lastSaveTimeRef.current = Date.now();
      }
    } catch (error) {
      console.error('Autosave failed:', error);
      // Only update status if this is still the latest save
      if (sequence === saveSequenceRef.current) {
        saveErrorRef.current = error;
        setSaveStatus('error');
      }
    } finally {
      if (sequence === pendingSaveSequenceRef.current) {
        isSavingRef.current = false;
        pendingSaveSequenceRef.current = null;
      }
    }
  }, [documentId, section, setChats]);
  
  /**
   * Schedule a debounced save
   */
  const scheduleSave = useCallback((stateJson: string) => {
    setSaveStatus('pending');
    // Update the latest state ref
    latestStateRef.current = stateJson;
    
    // Increment save sequence
    const sequence = ++saveSequenceRef.current;
    
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Schedule debounced save
    debounceTimerRef.current = setTimeout(() => {
      if (latestStateRef.current && sequence === saveSequenceRef.current) {
        performSave(latestStateRef.current, sequence);
      }
    }, debounceMs);
    
    // Set up max interval timer if not already running
    if (!maxIntervalTimerRef.current) {
      const timeSinceLastSave = Date.now() - lastSaveTimeRef.current;
      const remainingTime = Math.max(0, maxIntervalMs - timeSinceLastSave);
      
      maxIntervalTimerRef.current = setTimeout(() => {
        if (latestStateRef.current && !isSavingRef.current) {
          const currentSequence = saveSequenceRef.current;
          performSave(latestStateRef.current, currentSequence);
        }
        maxIntervalTimerRef.current = null;
      }, remainingTime);
    }
  }, [debounceMs, maxIntervalMs, performSave]);
  
  /**
   * Trigger a save (called from onChange)
   */
  const triggerSave = useCallback((editorState: EditorState) => {
    // Serialize editor state to JSON string
    const stateJsonObj = editorState.toJSON();
    
    // Normalize block IDs to ensure they're included in the saved state
    // This ensures block_ids are persistent across sessions
    normalizeBlockIds(stateJsonObj);
    
    const stateJson = JSON.stringify(stateJsonObj);
    scheduleSave(stateJson);
  }, [scheduleSave]);
  
  /**
   * Flush any pending save immediately (for section/doc switches, unmount, etc.)
   */
  const flushSave = useCallback(async (): Promise<void> => {
    // Clear timers
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (maxIntervalTimerRef.current) {
      clearTimeout(maxIntervalTimerRef.current);
      maxIntervalTimerRef.current = null;
    }
    
    // Wait for an in-flight save, then flush the newest writing, which may
    // have changed while that save was completing.
    while (isSavingRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (latestStateRef.current) {
      const sequence = ++saveSequenceRef.current;
      await performSave(latestStateRef.current, sequence);
    }
    if (saveErrorRef.current) throw new Error('Could not save the current writing. Retry saving before continuing.');
  }, [performSave]);
  
  /**
   * Retry a failed save
   */
  const retrySave = useCallback(async (): Promise<void> => {
    if (latestStateRef.current) {
      const sequence = ++saveSequenceRef.current;
      await performSave(latestStateRef.current, sequence);
    }
  }, [performSave]);
  
  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (maxIntervalTimerRef.current) {
        clearTimeout(maxIntervalTimerRef.current);
      }
    };
  }, []);
  
  // Reset state when document or section changes
  useEffect(() => {
    latestStateRef.current = null;
    saveSequenceRef.current = 0;
    pendingSaveSequenceRef.current = null;
    saveErrorRef.current = null;
    setSaveStatus('idle');
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (maxIntervalTimerRef.current) {
      clearTimeout(maxIntervalTimerRef.current);
      maxIntervalTimerRef.current = null;
    }
  }, [documentId, section]);
  
  return {
    saveStatus,
    triggerSave,
    flushSave,
    retrySave,
  };
}
