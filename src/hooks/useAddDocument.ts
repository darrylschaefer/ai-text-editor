import useStore from '@store/store';
import { generateDefaultDocument } from '@constants/chat';
import { DocumentInterface } from '@type/document';

const useAddDocument = () => {
  const setDocuments = useStore((state) => state.setDocuments);
  const setCurrentDocumentIndex = useStore((state) => state.setCurrentDocumentIndex);
  const setEditorRefresh = useStore((state) => state.setForceEditorRefresh);

  const addDocuments = (folder?:string) => {
    
     const documents = useStore.getState().documents;
    
     if (documents) {
       const updatedDocuments: DocumentInterface[] = JSON.parse(JSON.stringify(documents));
       let titleIndex = 1;
       let title = `New Document ${titleIndex}`;

       while (documents.some((document) => document.title === title)) {
         titleIndex += 1;
         title = `New Document ${titleIndex}`;
       }

       updatedDocuments.unshift(generateDefaultDocument({title, folder}));
       setDocuments(updatedDocuments);
       setCurrentDocumentIndex(0);

       setEditorRefresh(!useStore.getState().forceEditorRefresh);
     }
  };

  return addDocuments;
};

export default useAddDocument;
