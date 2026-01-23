import { useRef, useState, useEffect } from "react";
import useStore from '@store/store';
import MobileBar from '../MobileBar';
import { InitialEditorStateType } from '@lexical/react/LexicalComposer';
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
import SnippetsView from './SnippetsComponents/SnippetsView';

const Document = () => {
  const hideSideMenu = useStore((state) => state.hideSideMenu);
  const hideSideAIMenu = useStore((state) => state.hideSideAIMenu);
  const editRef = useRef(null);
  const currentChatIndex = useStore((state) => state.currentChatIndex);
  const chats = useStore((state) => state.chats);
  const setChats = useStore((state) => state.setChats);

  let editorState: InitialEditorStateType | undefined | null = null;

  if (chats && chats[currentChatIndex]) {
    const currentDoc = chats[currentChatIndex];
    const currentVersion = currentDoc.currentVersion || 'Draft';
    
    // Load the appropriate version's editor state
    if (currentVersion === 'Draft') {
      editorState = currentDoc.draftEditorState || currentDoc.editorState;
    } else {
      editorState = currentDoc.finishedEditorState || currentDoc.editorState;
    }
  } else {
  }


  const editorRef = useRef(null);

  let loadEditorState = () => {
    // check if the editor state of the current chat index is empty, if not, use a placeholder
    const value = '{"root":{"children":[{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"type":"root","version":1}}';

    // Migrate legacy documents that don't have version fields
    if (chats && chats[currentChatIndex]) {
      const doc = chats[currentChatIndex];
      if (!doc.hasOwnProperty('currentVersion') || !doc.hasOwnProperty('snippets')) {
        // Migrate legacy document
        const temp = [...chats];
        temp[currentChatIndex] = {
          ...doc,
          currentVersion: doc.currentVersion || 'Draft',
          draftEditorState: doc.draftEditorState || doc.editorState || '',
          finishedEditorState: doc.finishedEditorState || '',
          snippets: doc.snippets || [],
        };
        setChats(temp);
      }
    }

     if (editorState === undefined || editorState === null || editorState === ""){
      let temp = chats;
      if(temp){
        const currentDoc = temp[currentChatIndex];
        const currentVersion = currentDoc.currentVersion || 'Draft';
        
        // Initialize both version states if needed
        if (!currentDoc.draftEditorState) {
          currentDoc.draftEditorState = value;
        }
        if (!currentDoc.finishedEditorState) {
          currentDoc.finishedEditorState = '';
        }
        
        currentDoc.editorState = value;
        if (currentVersion === 'Draft') {
          currentDoc.draftEditorState = value;
        }
        
        setChats(temp);
        return value;
      }
     } else {
      return editorState as InitialEditorStateType;
     }
  }

const editorConfig = {
  // The editor theme
  namespace: 'MyEditor',
   theme: lexicalTheme,
   editorState: loadEditorState(),
  //  editorState: editorState,
  // Handling of errors during update
  onError(error: any) {
    throw error;
  },
  // Any custom nodes go here
  nodes: [
    HeadingNode,
    ListNode,
    ListItemNode,
    QuoteNode,
    CodeNode,
    CodeHighlightNode,
    TableNode,
    TableCellNode,
    TableRowNode,
    AutoLinkNode,
    LinkNode
  ],
  };

  const [refresh, setRefresh] = useState(false);

  useEffect(() => {
    // This code will run whenever currentChatIndex changes
    // You can perform any necessary actions or updates here
    // For example, you can force a refresh of the component by updating the refresh state variable
    setRefresh(!refresh);
  }, [currentChatIndex]);

  // Also refresh when version changes
  useEffect(() => {
    if (chats && chats[currentChatIndex]) {
      setRefresh(!refresh);
    }
  }, [chats?.[currentChatIndex]?.currentVersion]);

  // Get current document and version
  const currentDoc = chats && chats[currentChatIndex] ? chats[currentChatIndex] : null;
  const currentVersion = currentDoc?.currentVersion || 'Draft';
  const isSnippetsView = currentVersion === 'Snippets';

  // Render Snippets view if version is 'Snippets'
  if (isSnippetsView && currentDoc) {
    return (
      <div
        className={`flex flex-col h-full flex-1 ${
          hideSideMenu ? 'md:pl-0' : 'md:pl-[260px]'
        } ${
          hideSideAIMenu ? 'md:pr-0' : 'md:pr-[365px]'
        } transition-all ease-in-out duration-200`}
      >
        <MobileBar />
        <main className='relative h-full w-full transition-width flex flex-col overflow-hidden items-stretch flex-1'>
          <SnippetsView documentId={currentDoc.id} />
        </main>
      </div>
    );
  }

  // Render regular editor for Draft/Finished
  return (
    <>
      <LexicalComposer initialConfig={editorConfig}>
        <div
          className={`flex flex-col h-full flex-1 ${
            hideSideMenu ? 'md:pl-0' : 'md:pl-[260px]'
          } ${
            hideSideAIMenu ? 'md:pr-0' : 'md:pr-[365px]'
          } transition-all ease-in-out duration-200`}
        >
          <MobileBar />
          <main className='relative h-full w-full transition-width flex flex-col overflow-hidden items-stretch flex-1'>
            <div className="flex w-full h-full">
              <div className="flex-grow w-full h-full">
                <div className='relative h-full flex flex-grow flex-col'>
                  <div 
                    ref={editorRef} 
                    className="editor-inner flex flex-col flex-grow w-full h-full border-b border-gray-200 dark:border-gray-800/30 text-gray-800 dark:text-gray-100 group bg-gray-100 dark:bg-gray-950"
                  >
                    <EditorToolbar />
                    <RichTextPlugin 
                      placeholder={<div />}
                      contentEditable={
                        <ContentEditable className="editor-input overflow-auto w-full text-base px-4 py-6 md:px-6 md:py-8 md:mx-auto transition-all ease-in-out md:max-w-3xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none" />
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
                    <EditorSelection editorRef={editorRef} />
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