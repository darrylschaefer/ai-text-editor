import { useEffect, useRef } from 'react';
import useStore from '@store/store';

const useSaveToLocalStorage = () => {
  const chatsRef = useRef(useStore.getState().documents);

  useEffect(() => {
    const unsubscribe = useStore.subscribe((state) => {
      if (chatsRef && chatsRef.current !== state.documents) {
        chatsRef.current = state.documents;
        localStorage.setItem('chats', JSON.stringify(state.documents));
      }
    });

    return unsubscribe;
  }, []);
};

export default useSaveToLocalStorage;
