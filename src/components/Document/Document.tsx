import { useEffect } from "react";
import useStore from '@store/store';
import { documentEditorState } from './editorState';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { ListItemNode, ListNode } from "@lexical/list";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import EditorRefresh from './EditorComponents/EditorRefresh';
import EditorSelection from './EditorComponents/EditorSelection';
import EditorToolbar from "./EditorComponents/EditorToolbar";
import AutosavePlugin from "./EditorComponents/AutosavePlugin";
import BlockIdNormalizationPlugin from "./EditorComponents/BlockIdNormalizationPlugin";
import EditorStorePlugin from "./EditorComponents/EditorStorePlugin";
import lexicalTheme from "./LexicalTheme";

const Document = () => {
  const currentChatIndex = useStore(state => state.currentChatIndex);
  const chats = useStore(state => state.chats);
  const setChats = useStore(state => state.setChats);
  const currentDoc = chats?.[currentChatIndex] || null;
  const currentVersion = currentDoc?.currentVersion || 'Draft';

  // Preserve the existing legacy-field initialization without updating the
  // store during render. Loading an empty section is a pure read.
  useEffect(() => {
    if (!currentDoc || (Object.prototype.hasOwnProperty.call(currentDoc, 'currentVersion') &&
      Object.prototype.hasOwnProperty.call(currentDoc, 'snippets'))) return;
    const latest = useStore.getState().chats;
    if (latest) setChats(latest.map(doc => doc.id === currentDoc.id ? {
      ...doc, currentVersion: doc.currentVersion || 'Draft', snippets: doc.snippets || [],
      draftEditorState: doc.draftEditorState ?? doc.editorState ?? '',
      finishedEditorState: doc.finishedEditorState ?? '',
    } : doc));
  }, [currentDoc, setChats]);

  const editorConfig = {
    namespace: 'MyEditor',
    theme: lexicalTheme,
    editorState: documentEditorState(currentDoc),
    onError(error: Error) { throw error; },
    nodes: [HeadingNode, ListNode, ListItemNode, QuoteNode, CodeNode,
      CodeHighlightNode, TableNode, TableCellNode, TableRowNode, AutoLinkNode, LinkNode],
  };

  // Workspace opens Notes and normalizes this legacy navigation value before
  // mounting a manuscript editor. Never autosave a note view as manuscript text.
  if (currentVersion === 'Snippets') return null;

  // Mount a separate editor and undo history for the selected writing version.
  return (
    <>
      <LexicalComposer key={`${currentDoc?.id || 'empty'}:${currentVersion}`} initialConfig={editorConfig}>
        <div className="workspace-document">
          <main className="workspace-document-main">
            <div className="flex w-full h-full min-h-0">
              <div className="flex-grow w-full h-full min-h-0">
                <div className='relative h-full min-h-0 flex flex-grow flex-col'>
                  <div 
                    className="editor-inner group"
                  >
                    <EditorToolbar />
                    <RichTextPlugin 
                      placeholder={<div />}
                      contentEditable={
                        <ContentEditable className="editor-input text-base focus:outline-none" ariaLabel="Document content" />
                      }
                      ErrorBoundary={LexicalErrorBoundary}
                    />
                    <EditorRefresh />
                    <BlockIdNormalizationPlugin />
                    <EditorStorePlugin />
                    {currentDoc && (
                      <AutosavePlugin 
                        documentId={currentDoc.id} 
                        section={currentVersion}
                      />
                    )}
                    <HistoryPlugin />
                    <ListPlugin />
                    <EditorSelection />
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </LexicalComposer>
    </>
  );
}

export default Document;
