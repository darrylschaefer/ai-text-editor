import React, { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useStore from '@store/store';

import useSubmit from '@hooks/useSubmit';
import { SendFilled, StopFilledAlt } from '@carbon/icons-react';
import { DocumentInterface } from '@type/document';

import PopupModal from '@components/PopupModal';
//import TokenCount from '@components/TokenCount';
import IncludeSelectionSend from '@components/Chat/IncludeSelectionSend'
import ClearPromptConfig from '@components/Chat/ClearPromptConfig'

const EditView = ({
  content,
  setIsEdit,
  messageIndex,
  sticky,
}: {
  content: string;
  setIsEdit: React.Dispatch<React.SetStateAction<boolean>>;
  messageIndex: number;
  sticky?: boolean;
}) => {
  const inputRole = useStore((state) => state.inputRole);
  const chats = useStore((state) => state.documents);
  const setChats = useStore((state) => state.setDocuments);
  const currentChatIndex = useStore((state) => state.currentDocumentIndex);
  const [_content, _setContent] = useState<string>(content);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const textareaRef = React.createRef<HTMLTextAreaElement>();

  const { t } = useTranslation();

  const resetTextAreaHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|playbook|silk/i.test(
        navigator.userAgent
      );

    if (e.key === 'Enter' && !isMobile && !e.nativeEvent.isComposing) {
      const enterToSubmit = useStore.getState().enterToSubmit;
      if (sticky) {
        if (
          (enterToSubmit && !e.shiftKey) ||
          (!enterToSubmit && (e.ctrlKey || e.shiftKey))
        ) {
          e.preventDefault();
          handleSaveAndSubmit();
          resetTextAreaHeight();
        }
      } else {
        if (e.ctrlKey && e.shiftKey) {
          e.preventDefault();
          handleSaveAndSubmit();
          resetTextAreaHeight();
        } else if (e.ctrlKey || e.shiftKey) handleSave();
      }
    }
  };

  const handleSave = () => {
    if (sticky && (_content === '' || useStore.getState().generating)) return;
    const updatedChats: DocumentInterface[] = JSON.parse(
      JSON.stringify(useStore.getState().documents)
    );
    const updatedMessages = updatedChats[currentChatIndex].messageCurrent.messages;
    if (sticky) {
      updatedMessages.push({ role: inputRole, content: _content });
      _setContent('');
      resetTextAreaHeight();
    } else {
      updatedMessages[messageIndex].content = _content;
      setIsEdit(false);
    }
    setChats(updatedChats);
  };

  const { handleSubmit } = useSubmit();
  const handleSaveAndSubmit = () => {
    if (useStore.getState().generating) return;
    const updatedChats: DocumentInterface[] = JSON.parse(
      JSON.stringify(useStore.getState().documents)
    );

    const editorSettings = useStore.getState().editorSettings;
    const setEditorSettings = useStore.getState().setEditorSettings;
    const currentSelection = useStore.getState().currentSelection;

    const updatedMessages = updatedChats[currentChatIndex].messageCurrent.messages;
    if (sticky) {
      let tempContent = _content;
      let tempSelection = currentSelection
      if (editorSettings.includeSelection) {

      if (_content.length != 0) {
        // remove newline from start of currentSelection
        if (currentSelection[0] == '\n') {
          tempSelection = currentSelection.substring(1);
        }
        // remove newline from end of currentSelection
        if (currentSelection[currentSelection.length - 1] == '\n') {
          tempSelection = currentSelection.substring(0, currentSelection.length - 1);
        }

        tempContent = (_content  + '\n\n' + tempSelection + '\n\n');
      } else {
        tempContent = tempSelection;
      }
    }
        updatedMessages.push({ role: inputRole, content: tempContent });
      _setContent('');
      resetTextAreaHeight();
    } else {
      let tempContent = _content;
      if (editorSettings.includeSelection) {
        tempContent = (_content  + '\n\n' + "{ " + currentSelection + " }" + '\n\n');
     }
      updatedMessages[messageIndex].content = tempContent;
      updatedChats[currentChatIndex].messageCurrent.messages = updatedMessages.slice(
        0,
        messageIndex + 1
      );
      setIsEdit(false);
    }
    setEditorSettings({ ...editorSettings, includeSelection: false });
    setChats(updatedChats);
    handleSubmit();
  };


  // const updateChatMessage = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  //   if (sticky && (_content === '' || useStore.getState().generating)) return;
  //   const updatedChats: DocumentInterface[] = JSON.parse(
  //     JSON.stringify(useStore.getState().documents)
  //   );
  //   const updatedMessages = updatedChats[currentChatIndex].messageCurrent.messages;
  //   if (sticky) {
  //     updatedMessages.push({ role: inputRole, content: e.target.value });
  //     _setContent('');
  //     resetTextAreaHeight();
  //   } else {
  //      updatedMessages[messageIndex].content = e.target.value;
  //     // setIsEdit(false);
  //   }
  //   setChats(updatedChats);
  // };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [_content]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  return (
    <>
    {sticky && (
    <div className="flex w-full">
    <IncludeSelectionSend />
    {chats && chats[currentChatIndex].messageCurrent.config != null && (
    <ClearPromptConfig />
    )}
    </div>
    )}
      <div
        className={`w-full ${
          sticky
            ? 'py-2 relative pl-3 dark:text-white dark:bg-gray-850 border border-transparent'
            : ''
        }`}
      >
        <textarea
          ref={textareaRef}
          className={`m-0 text-grey-300 resize-none bg-transparent overflow-y-hidden focus:ring-0 focus-visible:ring-0 flex w-full placeholder:text-gray-300
          ${sticky ? 'pr-10 p-1' : 'text-sm'}
          `}
          onChange={(e) => {
            _setContent(e.target.value);
          }}
          value={_content}
          placeholder={t('submitPlaceholder') as string}
          onKeyDown={handleKeyDown}
          rows={1}
        ></textarea>
       {sticky && (
         <EditViewSubmitButton
        handleSaveAndSubmit={handleSaveAndSubmit}
        handleSave={handleSave}
        setIsModalOpen={setIsModalOpen}
        setIsEdit={setIsEdit}
        _setContent={_setContent}
         />
       )}
      </div>
      {sticky || (
      <EditViewButtons
        sticky={sticky}
        handleSaveAndSubmit={handleSaveAndSubmit}
        handleSave={handleSave}
        setIsModalOpen={setIsModalOpen}
        setIsEdit={setIsEdit}
        _setContent={_setContent}
      />
      )}
      {isModalOpen && (
        <PopupModal
          setIsModalOpen={setIsModalOpen}
          title={t('warning') as string}
          message={t('clearMessageWarning') as string}
          handleConfirm={handleSaveAndSubmit}
        />
      )}
    </>
  );
};


const EditViewSubmitButton = memo(
  ({
    handleSaveAndSubmit,
    handleSave,
    setIsModalOpen,
    setIsEdit,
    _setContent,
  }: {
    handleSaveAndSubmit: () => void;
    handleSave: () => void;
    setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setIsEdit: React.Dispatch<React.SetStateAction<boolean>>;
    _setContent: React.Dispatch<React.SetStateAction<string>>;
  }) => {
    const { t } = useTranslation();
    const generating = useStore.getState().generating;
    const setGenerating = useStore.getState().setGenerating;

    const handleCancel = () => {
      setGenerating(false);
    };  

    return (
      <>
      {!generating? (
      <div className="absolute right-2 bottom-2 py-2 pl-2 pr-1 cursor-pointer" onClick={handleSaveAndSubmit} onMouseDown={(e) => { e.preventDefault(); }}>
        <SendFilled size={16} />
      </div>)
      :
      (
      <div className="absolute right-2 bottom-2 py-2 pl-2 pr-1 cursor-pointer" onClick={handleCancel} onMouseDown={(e) => { e.preventDefault(); }}>
        <StopFilledAlt size={16} />
      </div>
      )}
      </>
    )
  }
);



const EditViewButtons = memo(
  ({
    sticky = false,
    handleSaveAndSubmit,
    handleSave,
    setIsModalOpen,
    setIsEdit,
    _setContent,
  }: {
    sticky?: boolean;
    handleSaveAndSubmit: () => void;
    handleSave: () => void;
    setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setIsEdit: React.Dispatch<React.SetStateAction<boolean>>;
    _setContent: React.Dispatch<React.SetStateAction<string>>;
  }) => {
    const { t } = useTranslation();
    const generating = useStore.getState().generating;

    return (
      <div className='flex'>
        <div className='flex-1 text-center mt-4 flex justify-center'>
          {sticky && (
            <button
              className={`btn relative mr-2 btn-neutral ${
                generating ? 'cursor-not-allowed opacity-40' : ''
              }`}
              onClick={handleSaveAndSubmit}
            >
              <div className='flex items-center justify-center gap-2'>
                {t('saveAndSubmit')}
              </div>
            </button>
          )}

          <button
            className={`btn relative mr-2 ${
              sticky
                ? `btn-neutral ${
                    generating ? 'cursor-not-allowed opacity-40' : ''
                  }`
                : 'btn-neutral'
            }`}
            onClick={handleSave}
          >
            <div className='flex items-center justify-center gap-2'>
              {t('save')}
            </div>
          </button>

          {sticky || (
            <button
              className='btn relative mr-2 btn-neutral'
              onClick={() => {
                !generating && setIsModalOpen(true);
              }}
            >
              <div className='flex items-center justify-center gap-2'>
                {t('saveAndSubmit')}
              </div>
            </button>
          )}

          {sticky || (
            <button
              className='btn relative btn-neutral'
              onClick={() => setIsEdit(false)}
            >
              <div className='flex items-center justify-center gap-2'>
                {t('cancel')}
              </div>
            </button>
          )}
        </div>
      </div>
    );
  }
);

export default EditView;
