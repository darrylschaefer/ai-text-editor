import { useState } from 'react';
import { Checkmark, SettingsCheck, Close } from '@carbon/icons-react';
import useStore from '@store/store';
import { set } from 'lodash';
import { use } from 'i18next';

const ClearPromptConfig = () => {
  const currentChatIndex = useStore((state) => state.currentDocumentIndex);
  const chats = useStore ((state) => state.documents);
  const setChats = useStore ((state) => state.setDocuments);
  const editorRefresh = useStore((state) => state.forceEditorRefresh);
  const setEditorRefresh = useStore((state) => state.setForceEditorRefresh);

  const [hovered, setHovered] = useState(false);

  const handleMouseOver = () => setHovered(true);
  const handleMouseOut = () => setHovered(false);
 

  function changeSelection(e: any){
    if(chats){
    let tempChats = chats;
    tempChats[currentChatIndex].messageCurrent.config = null;
    setChats(tempChats);
    setEditorRefresh(!editorRefresh);
    }
  }
 
  return (
    <div
      className={`flex py-2 pr-2 pl-3 w-20 items-center gap-3 relative bg-gray-800 mb-2 text-sm hover:bg-gray-850 break-all group cursor-pointer opacity-100 border border-transparent`}
       onClick={changeSelection}
       onMouseDown={(e) => { e.preventDefault(); }}
       onMouseOver={handleMouseOver}
       onMouseLeave={handleMouseOut}
      >
      <SettingsCheck size={16} className='group-hover:text-white transition-colors duration-200'/>
      <div className='flex-1 text-ellipsis max-h-5 overflow-hidden break-all relative capitalize'></div>
      <div className="absolute flex right-2 visible">
        <button className="p-1 w-5 h-5 flex border transition-opacity border-gray-600 flex justify-center items-center">
          {hovered ? <Close size={16}/> : <Checkmark size={16}/>}
        </button>
    </div>
    </div>
    );

};

export default ClearPromptConfig;