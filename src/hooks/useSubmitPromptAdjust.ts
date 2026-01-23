import useStore from '@store/store';
import { useTranslation } from 'react-i18next';
import { DocumentInterface, ConfigInterface, MessageInterface } from '@type/document';
import { getChatCompletion, getChatCompletionStream, getLegacyCompletion, getLegacyCompletionStream, getResponseStream, getResponse } from '@api/api';
import { parseEventSource } from '@api/helper';
import { limitMessageTokens, updateTotalTokenUsed } from '@utils/messageUtils';
import { _defaultChatConfig, _defaultLegacyConfig } from '@constants/chat';
import { officialAPIEndpoint } from '@constants/auth';
import { generateDefaultMessage } from '@constants/chat';
import { LegacyModels } from '@type/document';
import { legacyCompletionModels } from '@constants/chat';
import { constructEndpointUrl, removeProviderAndApiEndpoint } from '@utils/api';
import { extractMacroReferences, replaceMacroReferences, executeMacroQueue, replaceSpecialCommands } from '@utils/actionRunner';

const useSubmitPromptAdjust = () => {  

  const { t, i18n } = useTranslation('api');
  const error = useStore((state) => state.error);
  const setError = useStore((state) => state.setError);
  const apiEndpoint = useStore((state) => state.apiEndpoint);
  const apiKey = useStore((state) => state.apiKey);
  const setGenerating = useStore((state) => state.setGenerating);
  const generating = useStore((state) => state.generating);
  const currentChatIndex = useStore((state) => state.currentChatIndex);
  const setChats = useStore((state) => state.setChats);

    const documentCurrent = useStore((state) => state.documentCurrent);
    const model = documentCurrent.config?.model; // might be string
    const isLegacy = legacyCompletionModels.includes(model as LegacyModels);

//   const chatMessages: MessageInterface[] = [
//     {
//         role: 'system',
//         content: prompt,
//     },
// ];

  const generateTitle = async (
    message: MessageInterface[]
  ): Promise<string> => {
    let data;
    if (!apiKey || apiKey.length === 0) {
      // official endpoint
      if (apiEndpoint === officialAPIEndpoint) {
        throw new Error(t('noApiKeyWarning') as string);
      }

      // other endpoints
      data = await getChatCompletion(
        useStore.getState().apiEndpoint,
        message,
        _defaultChatConfig
      );
    } else if (apiKey) {
      // own apikey
      data = await getChatCompletion(
        useStore.getState().apiEndpoint,
        message,
        _defaultChatConfig,
        apiKey
      );
    }
    return data.choices[0].message.content;
  };

  const handleSubmit = async ({prompt, modifiedConfig}:{prompt: any, modifiedConfig?: ConfigInterface}) => {
    const chats = useStore.getState().chats;
    const currentSelection = useStore.getState().currentSelection;
    const defaultChatConfig = useStore.getState().defaultChatConfig;
    const prompts = useStore.getState().prompts;
    const setActionQueue = useStore.getState().setActionQueue;
    const clearActionQueue = useStore.getState().clearActionQueue;

    if(modifiedConfig == null || modifiedConfig == undefined){
      modifiedConfig = { ...defaultChatConfig };
    }
    // Use the API endpoint from config, or default to responses
    const apiEndpointType = modifiedConfig.apiEndpoint || defaultChatConfig.apiEndpoint || 'responses';

    // Convert prompt to string if it's an array
    let promptContent = '';
    if (Array.isArray(prompt)) {
      // Handle array of {content, role} objects or array of strings
      promptContent = prompt.map((msg: any) => {
        if (typeof msg === 'string') {
          return msg;
        } else if (msg && typeof msg === 'object' && 'content' in msg) {
          return msg.content || '';
        }
        return '';
      }).join('\n');
    } else {
      promptContent = typeof prompt === 'string' ? prompt : '';
    }

    // Check if ${includeSelection} was used in the prompt BEFORE replacement
    const hasIncludeSelectionCommand = promptContent.includes('${includeSelection}');

    // Extract and execute action references
    const macroNames = extractMacroReferences(promptContent);
    const setToastShow = useStore.getState().setToastShow;
    const setToastMessage = useStore.getState().setToastMessage;
    const setToastStatus = useStore.getState().setToastStatus;
    
    if (actionNames.length > 0) {
      const macroResults = await executeMacroQueue(
        macroNames,
        prompts,
        currentSelection,
        useStore.getState().apiEndpoint,
        apiKey,
        (queue) => setActionQueue(queue),
        (message, type = 'info') => {
          setToastMessage(message);
          setToastStatus(type === 'error' ? 'error' : type === 'success' ? 'success' : 'warning');
          setToastShow(true);
        }
      );
      promptContent = replaceMacroReferences(promptContent, macroResults);
    } else {
      // Even if no action references, still need to replace custom commands
      promptContent = replaceMacroReferences(promptContent, new Map());
    }
    
    // Replace special commands like ${includeSelection}
    // Note: Missing clips and meta are automatically added to action queue by replaceSpecialCommands
    const specialCommandsResult = replaceSpecialCommands(promptContent, currentSelection);
    promptContent = specialCommandsResult.result;
    
    // Remove the old includeSelection toggle logic - no longer needed
    if (false && includeSelection && !hasIncludeSelectionCommand){
      let tempSelection = currentSelection;
      // clear newLine from the beginning of the selection
      if (currentSelection.startsWith('\n')){
        tempSelection = currentSelection.substring(1);
      }

      // clear newLine from the end of the selection

      if (currentSelection.endsWith('\n')){
        tempSelection = currentSelection.substring(0, currentSelection.length - 1);
      }
      
      promptContent = promptContent + '\n\n' + tempSelection + '\n\n'
    }

    // Clear action queue after execution
    clearActionQueue();

    const chatMessages: MessageInterface[] = [
      promptContent
    ];

    console.log(chatMessages,"chatm");

    let resetChats = useStore.getState().chats;
    if(resetChats){
      resetChats[currentChatIndex].messageCurrent = generateDefaultMessage(modifiedConfig, chatMessages);
      setChats(resetChats);
    }

    if (generating || !chats) return;

    const updatedChats: DocumentInterface[] = JSON.parse(JSON.stringify(chats));
    

    updatedChats[currentChatIndex].messageCurrent.messages.push({
      role: 'assistant',
      content: '',
    });

    setChats(updatedChats);
    setGenerating(true);

    try {
      let stream;
      if (chats[currentChatIndex].messageCurrent.messages.length === 0)
        throw new Error('No messages submitted!');
        chats[0].messageCurrent.messages[0].content = prompt;


      const messages = limitMessageTokens(
        chats[currentChatIndex].messageCurrent.messages,
        modifiedConfig.max_completion_tokens ? modifiedConfig.max_completion_tokens : defaultChatConfig.max_completion_tokens,
        modifiedConfig.model ? modifiedConfig.model : defaultChatConfig.model
      );
      if (messages.length === 0) throw new Error('Message exceed max token!');

      // Use the API endpoint from config
      const endpoint = constructEndpointUrl(useStore.getState().apiEndpoint, apiEndpointType);

      // no api key (free)
      if (!apiKey || apiKey.length === 0) {
        // official endpoint
        if (apiEndpoint === officialAPIEndpoint) {
          throw new Error(t('noApiKeyWarning') as string);
        }

        // Handle different API types
        if (apiEndpointType === 'completions') {
          // Legacy completions API - convert messages to prompt string
          const defaultLegacyConfig = useStore.getState().defaultLegacyConfig;
          const promptText = messages.map(m => m.content).join('\n');
          const legacyConfig = removeProviderAndApiEndpoint({
            ...defaultLegacyConfig,
            ...modifiedConfig,
            apiEndpoint: 'completions',
            model: modifiedConfig.model || defaultLegacyConfig.model,
            max_tokens: modifiedConfig.max_completion_tokens || defaultLegacyConfig.max_tokens,
          });
          stream = await getLegacyCompletionStream(
            endpoint,
            promptText,
            legacyConfig
          );
        } else if (apiEndpointType === 'chat_completions') {
          stream = await getChatCompletionStream(
            endpoint,
            messages,
            modifiedConfig
          );
        } else {
          // responses API
          stream = await getResponseStream(
            endpoint,
            messages,
            modifiedConfig
          );
        }
      } else if (apiKey) {
        // own apikey

        if(modifiedConfig.model == null) {
          modifiedConfig.model = defaultChatConfig.model;
        }

        // Handle different API types
        if (apiEndpointType === 'completions') {
          // Legacy completions API - convert messages to prompt string
          const defaultLegacyConfig = useStore.getState().defaultLegacyConfig;
          const promptText = messages.map(m => m.content).join('\n');
          const legacyConfig = removeProviderAndApiEndpoint({
            ...defaultLegacyConfig,
            ...modifiedConfig,
            apiEndpoint: 'completions',
            model: modifiedConfig.model || defaultLegacyConfig.model,
            max_tokens: modifiedConfig.max_completion_tokens || defaultLegacyConfig.max_tokens,
          });
          stream = await getLegacyCompletionStream(
            endpoint,
            promptText,
            legacyConfig,
            apiKey
          );
        } else if (apiEndpointType === 'chat_completions') {
          stream = await getChatCompletionStream(
            endpoint,
            messages,
            modifiedConfig,
            apiKey
          );
        } else {
          // responses API
          stream = await getResponseStream(
            endpoint,
            messages,
            modifiedConfig,
            apiKey
          );
        }
      }

      if (stream) {
        if (stream.locked)
          throw new Error(
            'Oops, the stream is locked right now. Please try again'
          );
        const reader = stream.getReader();
        let reading = true;
        let partial = '';
        while (reading && useStore.getState().generating) {
          const { done, value } = await reader.read();
          const result = parseEventSource(
            partial + new TextDecoder().decode(value)
          );
          partial = '';

          if (result === '[DONE]' || done) {
            reading = false;
          } else {
            const resultString = result.reduce((output: string, curr) => {
              if (typeof curr === 'string') {
                partial += curr;
              } else {
                const content = curr.choices[0].delta.content;
                if (content) output += content;
              }
              return output;
            }, '');

            const updatedChats: DocumentInterface[] = JSON.parse(
              JSON.stringify(useStore.getState().chats)
            );

            const updatedMessages = updatedChats[currentChatIndex].messageCurrent.messages;
            updatedMessages[updatedMessages.length - 1].content += resultString;

            updatedChats[currentChatIndex].messageCurrent.messages = updatedMessages;
            let matchFound = false;
           let messageHistory = updatedChats[currentChatIndex].messageHistory;


           for(let i = 0; i < messageHistory.length; i++) {
             if (messageHistory[i].id == updatedChats[currentChatIndex].messageCurrent.id) {
               messageHistory[i] = updatedChats[currentChatIndex].messageCurrent;
               matchFound = true;
             }
           }

           if (!matchFound) {
             messageHistory.push(updatedChats[currentChatIndex].messageCurrent);
           }
          
           updatedChats[currentChatIndex].messageHistory = messageHistory;
            
            setChats(updatedChats);
          }
        }
        if (useStore.getState().generating) {
          reader.cancel('Cancelled by user');
        } else {
          reader.cancel('Generation completed');
        }
        reader.releaseLock();
        stream.cancel();
      }

      // update tokens used in chatting
      const currChats = useStore.getState().chats;
      const countTotalTokens = useStore.getState().countTotalTokens;

      if (currChats && countTotalTokens) {
        const model = modifiedConfig.model;
        const messages = currChats[currentChatIndex].messageCurrent.messages;
        updateTotalTokenUsed(
          model,
          messages.slice(0, -1),
          messages[messages.length - 1]
        );
      }

      // generate title for new chats
      if (
        useStore.getState().autoTitle &&
        currChats &&
        !currChats[currentChatIndex]?.titleSet
      ) {
        const messages_length = currChats[currentChatIndex].messageCurrent.messages.length;
        const assistant_message =
          currChats[currentChatIndex].messageCurrent.messages[messages_length - 1].content;
        const user_message =
          currChats[currentChatIndex].messageCurrent.messages[messages_length - 2].content;

        const message: MessageInterface = {
          role: 'user',
          content: `Generate a title in less than 6 words for the following message (language: ${i18n.language}):\n"""\nUser: ${user_message}\nAssistant: ${assistant_message}\n"""`,
        };

        let title = (await generateTitle([message])).trim();
        if (title.startsWith('"') && title.endsWith('"')) {
          title = title.slice(1, -1);
        }
        const updatedChats: DocumentInterface[] = JSON.parse(
          JSON.stringify(useStore.getState().chats)
        );
        updatedChats[currentChatIndex].title = title;
        updatedChats[currentChatIndex].titleSet = true;
        setChats(updatedChats);

        // update tokens used for generating title
        if (countTotalTokens) {
          const model = modifiedConfig.model;
          updateTotalTokenUsed(model, [message], {
            role: 'assistant',
            content: title,
          });
        }
      }
    } catch (e: unknown) {
      const err = (e as Error).message;
      console.log(err);
      setError(err);
    }
    setGenerating(false);
  };


  //  const handleLegacy = async ({prompt, includeSelection, modifiedConfig}:{prompt: string, includeSelection: boolean, modifiedConfig?: ConfigInterface}) => {
  //     const chats = useStore.getState().chats;
  //     if (generating || !chats) return;
  
  //     const updatedChats: DocumentInterface[] = JSON.parse(JSON.stringify(chats));
  //     const defaultChatConfig = useStore.getState().defaultChatConfig;
  //     const defaultLegacyConfig = useStore.getState().defaultLegacyConfig;
  
  //     const config = modifiedConfig ? modifiedConfig : defaultLegacyConfig;
  

  //     // Reset messages[1], which stores the output.
  //     //const updatedChats = prompt;
  //     // updatedChats[currentChatIndex].messageCurrent.messages =
  //     // prompt;
  
  //     // setChats(updatedChats);

  //     console.log(updatedChats, "updated chats")
  //     setGenerating(true);
  
  //     try {
  //       let stream;
  //       if (chats[currentChatIndex].messageCurrent.messages.length === 0)
  //         throw new Error('No messages submitted!');
  
  //       const messages = prompt;
  
  //       if (messages.length === 0) throw new Error('Message exceed max token!');
  
     
  //       // no api key (free)
  //       if (!apiKey || apiKey.length === 0) {
  //         // official endpoint
  //         if (apiEndpoint === officialAPIEndpoint) {
  //           throw new Error(t('noApiKeyWarning') as string);
  //         }
  
         
  //       } else if (apiKey) {
  //         // own apikey
  //         stream = await getLegacyCompletionStream(
  //           "https://api.openai.com/v1/completions",
  //           messages[0].content,
  //           config ? config : defaultLegacyConfig,
  //           apiKey
  //         );
  //       }
  
  //       if (stream) {
  //         if (stream.locked)
  //           throw new Error(
  //             'Oops, the stream is locked right now. Please try again'
  //           );
  //         const reader = stream.getReader();
  //         let reading = true;
  //         let partial = '';
  //         while (reading && useStore.getState().generating) {
  //           const { done, value } = await reader.read();
  //           const result = parseEventSource(
  //             partial + new TextDecoder().decode(value)
  //           );
  //           partial = '';
  
  //           if (result === '[DONE]' || done) {
  //             reading = false;
  //           } else {
  //             const resultString = result.reduce((output: string, curr) => {
  //               if (typeof curr === 'string') {
  //                 partial += curr;
  //               } else {
  //                 const content = curr.choices[0].text;
  //                 if (content) output += content;
  //               }
  //               return output;
  //             }, '');
  
  //             // const updatedChats: DocumentInterface[] = JSON.parse(
  //             //   JSON.stringify(useStore.getState().chats)
  //             // );
  
  //              const updatedMessages = updatedChats[currentChatIndex].messageCurrent.messages;
  //              updatedMessages[updatedMessages.length - 1].content += resultString;
  //              updatedChats[currentChatIndex].messageCurrent.messages = updatedMessages;
  
  
  //             //  let matchFound = false;
  //             let messageHistory = updatedChats[currentChatIndex].messageHistory;
  
  
  //             // for(let i = 0; i < messageHistory.length; i++) {
  //             //   if (messageHistory[i].id == updatedChats[currentChatIndex].messageCurrent.id) {
  //             //     messageHistory[i] = updatedChats[currentChatIndex].messageCurrent;
  //             //     matchFound = true;
  //             //   }
  //             // }
  
  //             // if (!matchFound) {
  //             //   messageHistory.push(updatedChats[currentChatIndex].messageCurrent);
  //             // }
  
  //             console.log(messageHistory)
  //               updatedChats[currentChatIndex].messageHistory = messageHistory;
  //               setChats(updatedChats);
  //           }
  //         }
  //         if (useStore.getState().generating) {
  //           reader.cancel('Cancelled by user');
  //         } else {
  //           reader.cancel('Generation completed');
  //         }
  //         reader.releaseLock();
  //         stream.cancel();
  //       }
        
  //     } catch (e: unknown) {
  //       const err = (e as Error).message;
  //       console.log(err);
  //       setError(err);
  //     }
  //     setGenerating(false);
  //   };




  // const handleLegacy = async ({prompt, includeSelection, modifiedConfig}:{prompt: any, includeSelection: boolean, modifiedConfig?: ConfigInterface}) => {

  
  //   const chats = useStore.getState().chats;
  //   const currentSelection = useStore.getState().currentSelection;
  //   const defaultChatConfig = useStore.getState().defaultChatConfig;
  //   if(modifiedConfig == null || modifiedConfig == undefined){
  //     modifiedConfig = defaultChatConfig;
  //   }


  //   let systemPrompt = prompt[0].prompt;

  //   console.log("prompt", prompt)
  //   console.log(systemPrompt, "system")

  //   if (includeSelection){
  //     let tempSelection = currentSelection;
  //     // clear newLine from the beginning of the selection
  //     if (currentSelection.startsWith('\n')){
  //       tempSelection = currentSelection.substring(1);
  //     }

  //     // clear newLine from the end of the selection

  //     if (currentSelection.endsWith('\n')){
  //       tempSelection = currentSelection.substring(0, currentSelection.length - 1);
  //     }
      
  //     systemPrompt = prompt[0].prompt + '\n\n' + tempSelection + '\n\n'
  //   }


  //   const chatMessages: MessageInterface[] = [
  //     ...systemPrompt
  //   ];

  //   console.log(chatMessages,"2chatm")

  //   let resetChats = useStore.getState().chats;
  //   if(resetChats){
  //     resetChats[currentChatIndex].messageCurrent = generateDefaultMessage(modifiedConfig, chatMessages);
  //     setChats(resetChats);
  //   }

  //   if (generating || !chats) return;

  //   const updatedChats: DocumentInterface[] = JSON.parse(JSON.stringify(chats));

  //   updatedChats[currentChatIndex].messageCurrent.messages.push({
  //     role: 'assistant',
  //     content: '',
  //   });

  //   setChats(updatedChats);
  //   setGenerating(true);

  //   try {
  //     let stream;
  //     if (chats[currentChatIndex].messageCurrent.messages.length === 0)
  //       throw new Error('No messages submitted!');
  //       chats[0].messageCurrent.messages[0].content = prompt;


  //     const messages = limitMessageTokens(
  //       chats[currentChatIndex].messageCurrent.messages,
  //       modifiedConfig.max_completion_tokens ? modifiedConfig.max_completion_tokens : defaultChatConfig.max_completion_tokens,
  //       modifiedConfig.model ? modifiedConfig.model : defaultChatConfig.model
  //     );
  //     if (messages.length === 0) throw new Error('Message exceed max token!');

  //     // no api key (free)
  //     if (!apiKey || apiKey.length === 0) {
  //       // official endpoint
  //       if (apiEndpoint === officialAPIEndpoint) {
  //         throw new Error(t('noApiKeyWarning') as string);
  //       }

  //       // other endpoints

  //       stream = await getChatCompletionStream(
  //         useStore.getState().apiEndpoint,
  //         messages,
  //         modifiedConfig
  //       );
  //     } else if (apiKey) {
  //       // own apikey

  //       if(modifiedConfig.model == null) {
  //         modifiedConfig.model = defaultChatConfig.model;
  //       }

  //       stream = await getChatCompletionStream(
  //         useStore.getState().apiEndpoint,
  //         messages,
  //         modifiedConfig,
  //         apiKey
  //       );
  //     }

  //     if (stream) {
  //       if (stream.locked)
  //         throw new Error(
  //           'Oops, the stream is locked right now. Please try again'
  //         );
  //       const reader = stream.getReader();
  //       let reading = true;
  //       let partial = '';
  //       while (reading && useStore.getState().generating) {
  //         const { done, value } = await reader.read();
  //         const result = parseEventSource(
  //           partial + new TextDecoder().decode(value)
  //         );
  //         partial = '';

  //         if (result === '[DONE]' || done) {
  //           reading = false;
  //         } else {
  //           const resultString = result.reduce((output: string, curr) => {
  //             if (typeof curr === 'string') {
  //               partial += curr;
  //             } else {
  //               const content = curr.choices[0].delta.content;
  //               if (content) output += content;
  //             }
  //             return output;
  //           }, '');

  //           const updatedChats: DocumentInterface[] = JSON.parse(
  //             JSON.stringify(useStore.getState().chats)
  //           );

  //           const updatedMessages = updatedChats[currentChatIndex].messageCurrent.messages;
  //           updatedMessages[updatedMessages.length - 1].content += resultString;

  //           updatedChats[currentChatIndex].messageCurrent.messages = updatedMessages;
  //           let matchFound = false;
  //          let messageHistory = updatedChats[currentChatIndex].messageHistory;


  //          for(let i = 0; i < messageHistory.length; i++) {
  //            if (messageHistory[i].id == updatedChats[currentChatIndex].messageCurrent.id) {
  //              messageHistory[i] = updatedChats[currentChatIndex].messageCurrent;
  //              matchFound = true;
  //            }
  //          }

  //          if (!matchFound) {
  //            messageHistory.push(updatedChats[currentChatIndex].messageCurrent);
  //          }
          
  //          updatedChats[currentChatIndex].messageHistory = messageHistory;
            
  //           setChats(updatedChats);
  //         }
  //       }
  //       if (useStore.getState().generating) {
  //         reader.cancel('Cancelled by user');
  //       } else {
  //         reader.cancel('Generation completed');
  //       }
  //       reader.releaseLock();
  //       stream.cancel();
  //     }

  //     // update tokens used in chatting
  //     const currChats = useStore.getState().chats;
  //     const countTotalTokens = useStore.getState().countTotalTokens;

  //     if (currChats && countTotalTokens) {
  //       const model = modifiedConfig.model;
  //       const messages = currChats[currentChatIndex].messageCurrent.messages;
  //       updateTotalTokenUsed(
  //         model,
  //         messages.slice(0, -1),
  //         messages[messages.length - 1]
  //       );
  //     }

  //     // generate title for new chats
  //     if (
  //       useStore.getState().autoTitle &&
  //       currChats &&
  //       !currChats[currentChatIndex]?.titleSet
  //     ) {
  //       const messages_length = currChats[currentChatIndex].messageCurrent.messages.length;
  //       const assistant_message =
  //         currChats[currentChatIndex].messageCurrent.messages[messages_length - 1].content;
  //       const user_message =
  //         currChats[currentChatIndex].messageCurrent.messages[messages_length - 2].content;

  //       const message: MessageInterface = {
  //         role: 'user',
  //         content: `Generate a title in less than 6 words for the following message (language: ${i18n.language}):\n"""\nUser: ${user_message}\nAssistant: ${assistant_message}\n"""`,
  //       };

  //       let title = (await generateTitle([message])).trim();
  //       if (title.startsWith('"') && title.endsWith('"')) {
  //         title = title.slice(1, -1);
  //       }
  //       const updatedChats: DocumentInterface[] = JSON.parse(
  //         JSON.stringify(useStore.getState().chats)
  //       );
  //       updatedChats[currentChatIndex].title = title;
  //       updatedChats[currentChatIndex].titleSet = true;
  //       setChats(updatedChats);

  //       // update tokens used for generating title
  //       if (countTotalTokens) {
  //         const model = modifiedConfig.model;
  //         updateTotalTokenUsed(model, [message], {
  //           role: 'assistant',
  //           content: title,
  //         });
  //       }
  //     }
  //   } catch (e: unknown) {
  //     const err = (e as Error).message;
  //     console.log(err);
  //     setError(err);
  //   }
  //   setGenerating(false);
  // };
  
  interface PromptMessage {
    content: string;
    role: string;
  }
  
  interface ConfigInterface {
    // ... fill in as needed
  }
  
  const handleLegacy = async ({
    prompt,
    modifiedConfig
  }: {
    prompt: PromptMessage[]; // EXPLICITLY expects an array
    modifiedConfig?: ConfigInterface;
  }) => {
    const chats = useStore.getState().chats;
    const currentChatIndex = useStore.getState().currentChatIndex;
    const apiKey = useStore.getState().apiKey;
    const setChats = useStore.getState().setChats;
    const setGenerating = useStore.getState().setGenerating;
    const setError = useStore.getState().setError;
    const apiEndpoint = useStore.getState().apiEndpoint;
    const officialAPIEndpoint = useStore.getState().officialAPIEndpoint;
    const t = useStore.getState().t;
    const generating = useStore.getState().generating;
  
    if (generating || !chats) return;
  
    // Deep clone for state safety
    const updatedChats: DocumentInterface[] = JSON.parse(JSON.stringify(chats));
    const defaultLegacyConfig = useStore.getState().defaultLegacyConfig;
    const config = modifiedConfig ? modifiedConfig : defaultLegacyConfig;
  
    // -- MAIN FIX: Setup/clear messages in the chat before streaming --
    const outputRole = "assistant"; // or match your output role
  
    // Make sure message array structure is correct for legacy:
    // - The last message must be the assistant output slot, with content cleared
    let inputMessages: PromptMessage[];
    if (
      Array.isArray(prompt) &&
      prompt.length > 0 &&
      prompt[prompt.length - 1].role === outputRole
    ) {
      // Valid, ensure last is blank
      inputMessages = prompt.map((msg, idx) =>
        idx === prompt.length - 1
          ? { ...msg, content: "" }
          : { ...msg }
      );
    } else {
      // Probably no output slot, just append one
      inputMessages = [
        ...prompt.map(msg => ({ ...msg })),
        { role: outputRole, content: "" }
      ];
    }
  
    updatedChats[currentChatIndex].messageCurrent.messages = inputMessages;
    setChats(updatedChats);
  
    setGenerating(true);
  
    try {
      if (!updatedChats[currentChatIndex]) throw new Error("No chat selected");
      if (!Array.isArray(inputMessages) || inputMessages.length < 2)
        throw new Error('Not enough prompt/messages provided!');
  
      // Concatenate input message contents (excluding output slot) for legacy completion
      const promptContents = inputMessages
        .slice(0, -1)
        .map(m => m.content)
        .join('\n');
  
      if (!promptContents || promptContents.length === 0)
        throw new Error('Message content empty or exceeds max token!');
  
      let stream;
      if (!apiKey || apiKey.length === 0) {
        if (apiEndpoint === officialAPIEndpoint) {
          throw new Error(t('noApiKeyWarning') as string);
        }
        // (Handle any special free endpoint logic here)
      } else {
        // Use your own API key
        const baseEndpoint = useStore.getState().apiEndpoint;
        const apiEndpointType = config?.apiEndpoint || defaultLegacyConfig.apiEndpoint;
        const endpoint = constructEndpointUrl(baseEndpoint, apiEndpointType);
        
        const legacyConfig = removeProviderAndApiEndpoint(config ? { ...config } : { ...defaultLegacyConfig });
        stream = await getLegacyCompletionStream(
          endpoint,
          promptContents,
          legacyConfig,
          apiKey
        );
      }
  
      if (stream) {
        if (stream.locked)
          throw new Error(
            'Oops, the stream is locked right now. Please try again'
          );
        const reader = stream.getReader();
        let reading = true;
        let partial = '';
  
        while (reading && useStore.getState().generating) {
          const { done, value } = await reader.read();
          const result = parseEventSource(
            partial + new TextDecoder().decode(value)
          );
          partial = '';
  
          if (result === '[DONE]' || done) {
            reading = false;
          } else {
            const resultString = result.reduce((output: string, curr) => {
              if (typeof curr === 'string') {
                partial += curr;
              } else if (curr.choices && curr.choices[0].text) {
                const content = curr.choices[0].text;
                if (content) output += content;
              }
              return output;
            }, '');
  
            // MAIN FIX: Always append streaming result to cleared output message only
            const updatedMessages = updatedChats[currentChatIndex].messageCurrent.messages;
            if (Array.isArray(updatedMessages) && updatedMessages.length > 0) {
              const outputIdx = updatedMessages.findIndex(m => m.role === outputRole);
              if (outputIdx >= 0) {
                updatedMessages[outputIdx] = {
                  ...updatedMessages[outputIdx],
                  content: updatedMessages[outputIdx].content + resultString
                };
                updatedChats[currentChatIndex].messageCurrent.messages = updatedMessages;
              }
            }
  
            // Optionally, update messageHistory as you had before
            // (assume update is correct)
            updatedChats[currentChatIndex].messageHistory = updatedChats[currentChatIndex].messageHistory;
            setChats(updatedChats);
          }
        }
        if (useStore.getState().generating) {
          reader.cancel('Cancelled by user');
        } else {
          reader.cancel('Generation completed');
        }
        reader.releaseLock();
        stream.cancel();
      }
    } catch (e: any) {
      const err = e?.message || String(e);
      console.error(err);
      setError(err);
    }
    setGenerating(false);
  };
  
  const handleFunction = isLegacy? handleLegacy : handleSubmit;
  

  return { handleFunction, error };
};

export default useSubmitPromptAdjust;
