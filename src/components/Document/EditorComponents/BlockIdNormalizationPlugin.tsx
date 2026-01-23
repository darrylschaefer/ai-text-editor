import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { normalizeBlockIds } from '@utils/block-ids';

/**
 * Plugin that normalizes block IDs in the editor state
 * Ensures all addressable blocks have block_id properties
 * Runs once on mount and when editor state is loaded to migrate old documents
 */
export default function BlockIdNormalizationPlugin() {
  const [editor] = useLexicalComposerContext();
  const hasNormalizedRef = useRef(false);

  useEffect(() => {
    // Normalize block IDs once when plugin mounts or when state changes significantly
    const normalizeOnce = () => {
      if (hasNormalizedRef.current) return;
      
      editor.getEditorState().read(() => {
        const stateJson = editor.getEditorState().toJSON();
        let needsNormalization = false;

        // Quick check if normalization is needed
        const checkNode = (node: any): boolean => {
          if (!node) return false;
          
          if (['paragraph', 'heading', 'quote', 'listitem', 'code'].includes(node.type)) {
            if (!node.block_id) {
              return true;
            }
          }
          
          if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
              if (checkNode(child)) return true;
            }
          }
          
          return false;
        };

        needsNormalization = checkNode(stateJson.root);

        if (needsNormalization) {
          normalizeBlockIds(stateJson);
          
          // Update editor state with normalized IDs
          editor.update(() => {
            const normalizedState = editor.parseEditorState(JSON.stringify(stateJson));
            editor.setEditorState(normalizedState);
          }, { discrete: true });
          
          hasNormalizedRef.current = true;
        }
      });
    };

    // Normalize on mount
    normalizeOnce();

    // Also normalize when editor state is set externally (e.g., on document load)
    const unregister = editor.registerUpdateListener(({ editorState, prevEditorState }) => {
      // Only normalize if this is a significant state change (not just typing)
      if (prevEditorState) {
        editorState.read(() => {
          const currentJson = editorState.toJSON();
          const prevJson = prevEditorState.toJSON();
          
          // If the JSON structure changed significantly (not just text content), re-check
          const currentBlocks = JSON.stringify(currentJson.root?.children?.map((c: any) => c.type));
          const prevBlocks = JSON.stringify(prevJson.root?.children?.map((c: any) => c.type));
          
          if (currentBlocks !== prevBlocks) {
            hasNormalizedRef.current = false;
            normalizeOnce();
          }
        });
      }
    });

    return () => {
      unregister();
    };
  }, [editor]);

  return null;
}
