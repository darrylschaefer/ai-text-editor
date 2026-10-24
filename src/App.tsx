import React, { useEffect, useState } from 'react';
import useStore from '@store/store';
import i18n from './i18n';
import { useTranslation, Trans } from 'react-i18next';
import {
  BrowserRouter, Routes, Route,
} from "react-router-dom";
import Workspace from '@components/Workspace/Workspace';

import useInitialiseNewDocument from '@hooks/useInitialiseNewDocument';
import { DocumentInterface } from '@type/document';
import { Theme } from '@type/theme';
import ConnectionRuntime from '@components/Search/ConnectionRuntime';
import { migrateLegacyConnection, refreshConnection, useConnections } from '@store/connection-store';
import { bindWorkspaceConnection } from '@utils/provider-connections';
import Toast from '@components/Toast';
import ActionQueue from '@components/ActionQueue';
import { set } from 'lodash';
import FAQs from '@components/FAQs/FAQs';

const Home = () => {
  const actionQueue = useStore((state) => state.actionQueue);
  // Show the queue whenever it has items (pending, running, completed, or error)
  const isVisible = actionQueue.length > 0;
  
  return (
  <>
  <Workspace />
  <ConnectionRuntime />
  <Toast />
  <ActionQueue queue={actionQueue} isVisible={isVisible} />
  </>
  )
}

function App() {
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());
  const connectionStorageError = useConnections(state => state.storageError);
  useEffect(() => {
    const unsubscribe = useStore.persist.onFinishHydration(() => { useStore.getState().initializeAgentProfiles(); setHydrated(true); });
    setHydrated(useStore.persist.hasHydrated());
    return unsubscribe;
  }, []);
  const initialiseNewDocument = useInitialiseNewDocument();
  useEffect(() => {
    if (hydrated) useStore.getState().initializeAgentProfiles();
  }, [hydrated]);
  const setChats = useStore((state) => state.setChats);
  const setTheme = useStore((state) => state.setTheme);
  const setApiKey = useStore((state) => state.setApiKey);
  const setCurrentChatIndex = useStore((state) => state.setCurrentChatIndex);
  const { t } = useTranslation(['main', 'about']);

  
// a useEffect that resets the .edited variables of all items in chats to false

useEffect(() => {
  if (!hydrated) return;
  const chats = useStore.getState().chats;
  const currentDocumentIndex = useStore.getState().currentChatIndex;

  if (chats && chats.length > 0) {
    const newChats = chats.map((chat) => {
      chat.edited = false;
      return chat;
    });
    useStore.getState().setChats(newChats);
  }
}, [hydrated]);

  // useEffect(() => {
//    document.documentElement.lang = i18n.language;
  //   i18n.on('languageChanged', (lng) => {
  //     document.documentElement.lang = lng;
  //   });
  // }, []);

  useEffect(() => {
    if (!hydrated) return;
    // legacy local storage
    const oldChats = localStorage.getItem('chats');
    const apiKey = localStorage.getItem('apiKey');
    const theme = localStorage.getItem('theme');


    if (apiKey) {
      // legacy local storage
      void migrateLegacyConnection(apiKey, useStore.getState().apiEndpoint).then(id => {
        useStore.setState(state => bindWorkspaceConnection(state, id));
        localStorage.removeItem('apiKey');
        if (useConnections.getState().connections.find(connection => connection.id === id)?.provider === 'openai') void refreshConnection(id).catch(() => {});
      }).catch(() => {});
    }

    if (theme) {
      // legacy local storage
      setTheme(theme as Theme);
      localStorage.removeItem('theme');
    }

    if (oldChats) {
      // legacy local storage
      try {
        const chats: DocumentInterface[] = JSON.parse(oldChats);
        if (chats.length > 0) {
          setChats(chats);
          setCurrentChatIndex(0);
        } else {
          initialiseNewDocument();
        }
      } catch (e: unknown) {
        initialiseNewDocument();
      }
      localStorage.removeItem('chats');
    } else {
      // existing local storage
      const chats = useStore.getState().chats;
      const currentChatIndex = useStore.getState().currentChatIndex;
      if (!chats || chats.length === 0) {
        initialiseNewDocument();
      }
      if (
        chats &&
        !(currentChatIndex >= 0 && currentChatIndex < chats.length)
      ) {
        setCurrentChatIndex(0);
      }
    }
  }, [hydrated]);

  return (
    <div className='w-full h-full relative'>
        <BrowserRouter>
      <Routes>
        <Route path="/" element={hydrated ? <Home /> : <div className="p-6" role="status">
          {connectionStorageError || 'Loading your workspace…'}
          {connectionStorageError && <button type="button" className="btn btn-neutral" onClick={() => void useStore.persist.rehydrate()}>Retry loading workspace</button>}
        </div>} />
        <Route path="/faqs" element={
          <FAQs />
        } />
      </Routes>
    </BrowserRouter>
    </div>
  );
}

export default App;
