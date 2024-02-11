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
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import EditorRefresh from './EditorComponents/EditorRefresh';
import EditorSelection from './EditorComponents/EditorSelection';
import EditorToolbar from "./EditorComponents/EditorToolbar";
import lexicalTheme from "./LexicalTheme";

import {
  $getSelection,
  $getRoot,
} from "lexical";

const Document = () => {
  const hideSideMenu = useStore((state) => state.hideSideMenu);
  const hideSideAIMenu = useStore((state) => state.hideSideAIMenu);
  const editRef = useRef(null);
  const currentChatIndex = useStore((state) => state.currentDocumentIndex);
  const chats = useStore((state) => state.documents);
  const setChats = useStore((state) => state.setDocuments);

  let editorState: InitialEditorStateType | undefined | null = null;

  if (chats && chats[currentChatIndex]) {
    editorState = chats[currentChatIndex].editorState;
  } else {
  }


  const editorRef = useRef(null);

  let loadEditorState = () => {
    // check if the editor state of the current chat index is empty, if not, use a placeholder
    const value = '{"root":{"children":[{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"type":"root","version":1}}';

     if (editorState === undefined || editorState === null || editorState === ""){
      let temp = chats;
      if(temp){
      temp[currentChatIndex].editorState = value;
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

  function onChange(change: any) {
     if(chats){
       let temp = chats;
       if(temp[currentChatIndex].editorState != JSON.stringify(change)){
        chats[currentChatIndex].edited = true;
        }
       chats[currentChatIndex].editorState = JSON.stringify(change); 
       setChats(temp);
     }
    change.read(() => {
      // Read the contents of the EditorState here.
      const root = $getRoot();
      const selection = $getSelection();
  
      if(chats){
      let temp = chats;
      if(temp[currentChatIndex].editorState != JSON.stringify(change)){
       chats[currentChatIndex].edited = true;
        }
        chats[currentChatIndex].editorState = JSON.stringify(change);
      setChats(temp);
    }
  }
    );
  }

return (
  <>
    <LexicalComposer initialConfig={editorConfig}>
    <div
        className={`flex flex-col h-full flex-1 ${
          hideSideMenu ? 'md:pl-0' : 'md:pl-[260px]'
        } ${
          hideSideAIMenu ? 'md:pr-0' : 'md:pr-[365px]'
        }
   transition-all ease-in-out 
        `}
      >
      <MobileBar />
      <main className='relative h-full w-full transition-width flex flex-col overflow-hidden items-stretch flex-1'>
        <div className="flex w-full">
          <div className="flex-grow w-full">
            <div className='relative h-full flex flex-grow flex-col gap-2 md:gap-3'>
              <div ref={editorRef} className="editor-inner line-height-1.5 flex flex-col flex-grow w-full h-screen border-b border-black/10 dark:border-gray-900/50 text-gray-800 dark:text-gray-100 group dark:bg-gray-900">
                <EditorToolbar />
                <RichTextPlugin placeholder={<div />}
                  contentEditable={<ContentEditable className="editor-input bg-white border border-gray-900/10 overflow-scroll w-full text-white text-base p-6 gap-4 md:gap-6 md:m-auto transition-all ease-in-out md:max-w-3xl dark:bg-gray-850" />}
                  ErrorBoundary={LexicalErrorBoundary}
                />
                <EditorRefresh />
                <OnChangePlugin onChange={onChange} />
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