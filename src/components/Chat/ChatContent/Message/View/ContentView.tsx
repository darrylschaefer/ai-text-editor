import React, {
  DetailedHTMLProps,
  HTMLAttributes,
  memo,
  useState,
} from 'react';

import ReactMarkdown from 'react-markdown';
import { CodeProps, ReactMarkdownProps } from 'react-markdown/lib/ast-to-react';

import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import useStore from '@store/store';

import { Checkmark, Close } from '@carbon/icons-react';

import useSubmit from '@hooks/useSubmit';

import { DocumentInterface } from '@type/document';

import { codeLanguageSubset } from '@constants/chat';

import RefreshButton from './Button/RefreshButton';
import UpButton from './Button/UpButton';
import DownButton from './Button/DownButton';
import CopyButton from './Button/CopyButton';
import EditButton from './Button/EditButton';
import DeleteButton from './Button/DeleteButton';
// import MarkdownModeButton from './Button/MarkdownModeButton';

import CodeBlock from '../CodeBlock';
import HighlightedText from '@components/Common/HighlightedText';
import TypingIndicator from '@components/Common/TypingIndicator';
import { Hourglass } from '@carbon/icons-react';
import { set } from 'lodash';

const ContentView = memo(
  ({
    role,
    content,
    setIsEdit,
    messageIndex,
  }: {
    role: string;
    content: string;
    setIsEdit: React.Dispatch<React.SetStateAction<boolean>>;
    messageIndex: number;
  }) => {
    const { handleFunction } = useSubmit();

    const [isDelete, setIsDelete] = useState<boolean>(false);

    

    const setChats = useStore((state) => state.setChats);
    const getActiveConversation = useStore((state) => state.getActiveConversation);
    const activeConversation = getActiveConversation();
    // Support both old system (chats) and new unified system (conversations)
    const chats = useStore.getState().chats;
    const currentChatIdx = useStore.getState().currentChatIndex;
    const lastMessageIndex = activeConversation 
      ? activeConversation.messages.length - 1
      : (chats && currentChatIdx >= 0 && chats[currentChatIdx])
        ? (chats[currentChatIdx]!.messageCurrent?.messages?.length - 1 || 0)
        : 0;
    const inlineLatex = useStore((state) => state.inlineLatex);
    const markdownMode = useStore((state) => state.markdownMode);
    const generating = useStore((state) => state.generating);
    const actionQueue = useStore((state) => state.actionQueue);
    const isExecutingActions = actionQueue.length > 0 && actionQueue.some(item => item.status === 'running' || item.status === 'pending');
    const isLastMessage = messageIndex === lastMessageIndex;
    const showLoadingSpinner = isLastMessage && role === 'assistant' && !content && isExecutingActions;
    const showTypingIndicator = isLastMessage && generating && role === 'assistant' && !content && !isExecutingActions;

    const handleDelete = () => {
      const updatedChats: DocumentInterface[] = JSON.parse(
        JSON.stringify(useStore.getState().chats)
      );
      updatedChats[currentChatIdx].messageCurrent.messages.splice(messageIndex, 1);
      setChats(updatedChats);
    };

    const handleMove = (direction: 'up' | 'down') => {
      const updatedChats: DocumentInterface[] = JSON.parse(
        JSON.stringify(useStore.getState().chats)
      );
      const updatedMessages = updatedChats[currentChatIdx].messageCurrent.messages;
      const temp = updatedMessages[messageIndex];
      if (direction === 'up') {
        updatedMessages[messageIndex] = updatedMessages[messageIndex - 1];
        updatedMessages[messageIndex - 1] = temp;
      } else {
        updatedMessages[messageIndex] = updatedMessages[messageIndex + 1];
        updatedMessages[messageIndex + 1] = temp;
      }
      setChats(updatedChats);
    };

    const handleMoveUp = () => {
      handleMove('up');
    };

    const handleMoveDown = () => {
      handleMove('down');
    };

    const handleRefresh = () => {
      const updatedChats: DocumentInterface[] = JSON.parse(
        JSON.stringify(useStore.getState().chats)
      );
      const updatedMessages = updatedChats[currentChatIdx].messageCurrent.messages;
      updatedMessages.splice(updatedMessages.length - 1, 1);
      setChats(updatedChats);
      handleFunction();
    };

    const handleCopy = () => {
      navigator.clipboard.writeText(content);
    };

    return (
      <>
        <div className='markdown prose w-full md:max-w-full break-words dark:prose-invert dark share-gpt-message'>
          {showLoadingSpinner ? (
            <div className="flex items-center">
              <Hourglass className="animate-spin opacity-60" size={14} />
            </div>
          ) : showTypingIndicator ? (
            <TypingIndicator />
          ) : markdownMode ? (
            <ReactMarkdown
              remarkPlugins={[
                remarkGfm,
                [remarkMath, { singleDollarTextMath: inlineLatex }],
              ]}
              rehypePlugins={[
                rehypeKatex,
                [
                  rehypeHighlight,
                  {
                    detect: true,
                    ignoreMissing: true,
                    subset: codeLanguageSubset,
                  },
                ],
              ]}
              linkTarget='_new'
              components={{
                code,
                p,
              }}
            >
              {content}
            </ReactMarkdown>
          ) : (
            <HighlightedText text={content} className='whitespace-pre-wrap' />
          )}
        </div>
        <div className='flex justify-end gap-2 w-full mt-2'>
          {isDelete || (
            <>
              {!useStore.getState().generating &&
                role === 'assistant' &&
                messageIndex === lastMessageIndex && (
                  <RefreshButton onClick={handleRefresh} />
                )}
              {messageIndex !== 0 && <UpButton onClick={handleMoveUp} />}
              {messageIndex !== lastMessageIndex && (
                <DownButton onClick={handleMoveDown} />
              )}

              {/* <MarkdownModeButton /> */}
              <CopyButton onClick={handleCopy} />
              <EditButton setIsEdit={setIsEdit} />
              <DeleteButton setIsDelete={setIsDelete} />
            </>
          )}
          {isDelete && (
            <>
              <button
                className='p-1 hover:text-white'
                onClick={() => setIsDelete(false)}
              >
                <Close />
              </button>
              <button className='p-1 hover:text-white' onClick={handleDelete}>
                <Checkmark />
              </button>
            </>
          )}
        </div>
      </>
    );
  }
);

const code = memo((props: CodeProps) => {
  const { inline, className, children } = props;
  const match = /language-(\w+)/.exec(className || '');
  const lang = match && match[1];

  if (inline) {
    return <code className={className}>{children}</code>;
  } else {
    return <CodeBlock lang={lang || 'text'} codeChildren={children} />;
  }
});

const p = memo(
  (
    props?: Omit<
      DetailedHTMLProps<
        HTMLAttributes<HTMLParagraphElement>,
        HTMLParagraphElement
      >,
      'ref'
    > &
      ReactMarkdownProps
  ) => {
    return <p className='whitespace-pre-wrap text-sm'>
      {props?.children}</p>;
  }
);

export default ContentView;
