import { useEffect, useState } from 'react';
import { TextSelection, Checkmark } from '@carbon/icons-react';
import useStore from '@store/store';

const IncludeSelectionSend = () => {
  const currentDocumentIndex = useStore((state) => state.currentDocumentIndex);
  const documents = useStore ((state) => state.documents);
  const [selection, setSelection] = useState(false);
  const editorSettings = useStore((state) => state.editorSettings);
  const setEditorSettings = useStore((state) => state.setEditorSettings);

  useEffect(() => {
  setEditorSettings({ ...editorSettings, includeSelection: false });
  setSelection(false);
  }
  , []);

  useEffect(() => {
  setSelection(editorSettings.includeSelection);
  }, [editorSettings.includeSelection]);


  useEffect(() => {
  if(documents){
  if(editorSettings.includeSelection == true){
  setSelection(true);
  }
  else {
  setSelection(false);
  }
  }
  }, [currentDocumentIndex, editorSettings]);

  function changeSelection(e: any){

  if(documents){
  if(editorSettings.includeSelection == true)
  {
  let tempSettings = editorSettings;
  tempSettings.includeSelection = false;
  tempSettings.activeMenu = "chat";
  setEditorSettings(tempSettings);
  setSelection(false);
  return;
  }
  else 
  {
  let tempSettings = editorSettings;
  tempSettings.includeSelection = true;
  tempSettings.activeMenu = "settings";
  setEditorSettings(tempSettings);
  setSelection(true);
  return;
  }
  }
  }
 
  return (
    <div
      className={`flex w-full py-2 pr-2 pl-3 items-center gap-3 relative bg-gray-800 mb-2 text-sm hover:bg-gray-850 break-all group cursor-pointer opacity-100 border border-transparent
       ${selection ? "bg-gray-700" : "bg-gray-850"}
       ${documents && documents[currentDocumentIndex].messageCurrent.config != null ? "mr-2" : "mr-0"}
       `}
       onClick={changeSelection}
       onMouseDown={(e) => { e.preventDefault(); }}
      >
      <TextSelection size={16} className='group-hover:text-white transition-colors duration-200'/>
      <div className='flex-1 text-ellipsis max-h-5 overflow-hidden break-all relative capitalize'>Include Selection</div>
      <div className="absolute flex right-2 visible">
        <button className="p-1 w-5 h-5 border transition-opacity border-gray-600 flex justify-center items-center">
          <Checkmark size={16}
          className={selection ? "" : "opacity-0"}
          />
        </button>
    </div>
    </div>
    );

};

export default IncludeSelectionSend;