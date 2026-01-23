import { v4 as uuidv4 } from 'uuid';
import { DocumentInterface, ProviderOptions, AvailableEndpoints, ApiEndpointOptions, ConfigInterface, LegacyConfigInterface, DocumentCurrent, MessageInterface, ModelOptions, LegacyModels } from '@type/document';
import useStore from '@store/store';

const date = new Date();
const dateString =
  date.getFullYear() +
  '-' +
  ('0' + (date.getMonth() + 1)).slice(-2) +
  '-' +
  ('0' + date.getDate()).slice(-2);

export const _defaultSystemMessage =
  import.meta.env.VITE_DEFAULT_SYSTEM_MESSAGE ??
  `Hello! How can I assist you with your writing today?`;

export const completionModels: ModelOptions[] = [
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-16k',
  'gpt-4',
  'gpt-4-32k',
  'gpt-4-turbo',
  'gpt-4o',
  'gpt-4o-mini',
  'o1',
  'o1-mini',
  'o3',
  'o3-mini'
  // 'gpt-3.5-turbo-0301',
  // 'gpt-4-0314',
  // 'gpt-4-32k-0314',
  // 'gpt-4.5-preview', // Deprecated
];

// Models specifically optimized for Responses API
export const responsesModels: ModelOptions[] = [
  'gpt-5.2',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-5',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo',
  'o1',
  'o1-mini',
  'o3',
  'o3-mini'
];

export const legacyCompletionModels: LegacyModels[] = ['davinci-002', 'curie-001'];


// These two should probably be removed at some point
export const defaultModel = 'gpt-3.5-turbo';
export const defaultResponsesModel = 'gpt-5.2'; // Default for Responses API
export const defaultLegacyModel = 'davinci-002';

  export const providerOptions: ProviderOptions[] = ['openai'];
  
  export const apiEndpointOptions: ApiEndpointOptions[] = ['completions', 'chat_completions', 'responses'];

  export const modelOptions: AvailableEndpoints[] =
  [
    {
      'provider': "openai",
      'apiEndpoint': "chat_completions",
      'models': completionModels
    },
    {
      'provider': "openai",
      'apiEndpoint': "completions",
      'models': legacyCompletionModels
    },
    {
      'provider': "openai",
      'apiEndpoint': "responses",
      'models': responsesModels
    }
  ];


      // For automatically setting an api endpoint / model after adjusting the provider setting
      export const providerDefault = 
      [
      { 'provider': "openai",
      'apiEndpoint': 'chat_completions',
      'model': 'gpt-3.5-turbo'
      },
      { 'provider': "openai",
        'apiEndpoint': 'completions',
        'model': 'davinci-002'
        },
      { 'provider': "openai",
        'apiEndpoint': 'responses',
        'model': 'gpt-5.2'
        }
      ];

      //For automatically setting a model after adjusting the api endpoint setting
      export const apiEndpointDefault = [
      { 'provider': "openai",
      'apiEndpoint': 'chat_completions',
      'model': 'gpt-3.5-turbo'
      },
      { 'provider': "openai",
        'apiEndpoint': 'completions',
        'model': 'davinci-002'
        },
      { 'provider': "openai",
        'apiEndpoint': 'responses',
        'model': 'gpt-5.2'
        }
      ];

    

export const modelMaxToken: { [key: string]: number } = {
  'gpt-3.5-turbo': 4096,
  'gpt-3.5-turbo-0301': 4096,
  'gpt-3.5-turbo-0613': 4096,
  'gpt-3.5-turbo-16k': 16384,
  'gpt-3.5-turbo-16k-0613': 16384,
  'gpt-4': 8192,
  'gpt-4-0314': 8191,
  'gpt-4-0613': 8191,
  'gpt-4-32k': 32768,
  'gpt-4-32k-0314': 32768,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4.5-preview': 16384, // Deprecated
  'gpt-5.2': 400000,
  'gpt-5-mini': 400000,
  'gpt-5-nano': 400000,
  'gpt-5': 400000,
  'o1': 200000,
  'o1-mini': 200000,
  'o3': 200000,
  'o3-mini': 200000,
  'davinci-002': 4096
};

export const modelCost = {
  'gpt-3.5-turbo': {
    prompt: { price: 0.002, unit: 1000 },
    completion: { price: 0.002, unit: 1000 },
  },
  'gpt-3.5-turbo-0301': {
    prompt: { price: 0.002, unit: 1000 },
    completion: { price: 0.002, unit: 1000 },
  },
  'gpt-4': {
    prompt: { price: 0.03, unit: 1000 },
    completion: { price: 0.06, unit: 1000 },
  },
  'gpt-4-0314': {
    prompt: { price: 0.03, unit: 1000 },
    completion: { price: 0.06, unit: 1000 },
  },
  'gpt-4-32k': {
    prompt: { price: 0.06, unit: 1000 },
    completion: { price: 0.12, unit: 1000 },
  },
  'gpt-4-32k-0314': {
    prompt: { price: 0.06, unit: 1000 },
    completion: { price: 0.12, unit: 1000 },
  },
};

export const defaultUserMaxToken = 1200;

export const _defaultChatConfig: ConfigInterface = {
  model: 'gpt-5.2', // Updated default for responses API
  max_completion_tokens: defaultUserMaxToken,
  temperature: 1,
  presence_penalty: 0,
  top_p: 1,
  frequency_penalty: 0,
  apiEndpoint: "responses",
  provider: "openai",
  notes: null,
  reasoning_effort: 'medium', // Default reasoning effort for Responses API
  verbosity: 'medium', // Default verbosity for Responses API
};

export const _defaultLegacyConfig: LegacyConfigInterface = {
  model: defaultLegacyModel,
  max_tokens: 100,
  temperature: 1,
  presence_penalty: 0,
  top_p: 1,
  frequency_penalty: 0,
  apiEndpoint: "completions",
  provider: "openai",
};

export const generateDefaultMessage = (config?: ConfigInterface, chatMessages?: MessageInterface[]): DocumentCurrent => {
  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString(); // Format the date as needed
  const timeString = currentDate.toLocaleTimeString(); // Format the time as needed

  return {
    id: uuidv4(),
    date: dateString,
    folder: "",
    title: dateString + " " + timeString, // Combine date and time
    config: config ? config : null,
    titleSet: false,
    notes: [],
    messages: chatMessages? chatMessages :
      useStore.getState().defaultSystemMessage.length > 0
        ? [{ role: 'system', content: useStore.getState().defaultSystemMessage }]
        : [],
    favorited: false,
    messageIndex: null,
    edited: false,
  };
};

export const generateWelcomeDocument = ({title, folder, prompt}: {title?: string, folder?: string, prompt?: string}): DocumentInterface => {
  const defaultEditorState = "{\"root\":{\"children\":[{\"children\":[],\"direction\":null,\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Moby Dick; or, The Whale\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"center\",\"indent\":0,\"type\":\"paragraph\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":2,\"mode\":\"normal\",\"style\":\"\",\"text\":\"by Herman Melville\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"center\",\"indent\":0,\"type\":\"paragraph\",\"version\":1},{\"children\":[],\"direction\":null,\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen, and regulating the circulation. Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; whenever I find myself involuntarily pausing before coffin warehouses, and bringing up the rear of every funeral I meet; and especially whenever my hypos get such an upper hand of me, that it requires a strong moral principle to prevent me from deliberately stepping into the street, and methodically knocking people's hats off—then, I account it high time to get to sea as soon as I can. This is my substitute for pistol and ball. With a philosophical flourish Cato throws himself upon his sword; I quietly take to the ship. There is nothing surprising in this. If they but knew it, almost all men in their degree, some time or other, cherish very nearly the same feelings towards the ocean with me.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"There now is your insular city of the Manhattoes, belted round by wharves as Indian isles by coral reefs—commerce surrounds it with her surf. Right and left, the streets take you waterward. Its extreme down-town is the battery, where that noble mole is washed by waves, and cooled by breezes, which a few hours previous were out of sight of land. Look at the crowds of water-gazers there.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Circumambulate the city of a dreamy Sabbath afternoon. Go from Corlears Hook to Coenties Slip, and from thence, by Whitehall northward. What do you see?—Posted like silent sentinels all around the town, stand thousands upon thousands of mortal men fixed in ocean reveries. Some leaning against the spiles; some seated upon the pier-heads; some looking over the bulwarks of ships from China; some high aloft in the rigging, as if striving to get a still better seaward peep. But these are all landsmen; of week days pent up in lath and plaster—tied to counters, nailed to benches, clinched to desks. How then is this? Are the green fields gone? What do they here?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"But look! here come more crowds, pacing straight for the water, and seemingly bound for a dive. Strange! Nothing will content them but the extremest limit of the land; loitering under the shady lee of yonder warehouses will not suffice. No. They must get just as nigh the water as they possibly can without falling in. And there they stand—miles of them—leagues. Inlanders all, they come from lanes and alleys, streets and avenues,—north, east, south, and west. Yet here they all unite. Tell me, does the magnetic virtue of the needles of the compasses of all those ships attract them thither?\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1},{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\"Once more. Say, you are in the country; in some high land of lakes. Take almost any path you please, and ten to one it carries you down in a dale, and leaves you there by a pool in the stream. There is magic in it. Let the most absent-minded of men be plunged in his deepest reveries—stand that man on his legs, set his feet a-going, and he will infallibly lead you to water, if water there be in all that region. Should you ever be athirst in the great American desert, try this experiment, if your caravan happen to be supplied with a metaphysical professor. Yes, as every one knows, meditation and water are wedded for ever.\",\"type\":\"text\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"paragraph\",\"version\":1}],\"direction\":\"ltr\",\"format\":\"\",\"indent\":0,\"type\":\"root\",\"version\":1}}";
  
  return {
  id: uuidv4(),
  title: title ? title : 'Moby Dick',
  folder: folder ? folder : "",
  messageHistory: [],
  edited: false,
  messageCurrent: {
  id: uuidv4(),
  date: dateString,
  edited: false,
  folder: folder ? folder : "",
  title: title ? title : 'New Chat',
  config: { ...useStore.getState().defaultChatConfig },
  titleSet: false,
  notes: [],  
  messages:
    useStore.getState().defaultSystemMessage.length > 0
      ? [{ role: 'system', content: prompt? prompt : useStore.getState().defaultSystemMessage }]
      : [],
  favorited: false,
  messageIndex: null
  },
    titleSet: false,
    editorState: defaultEditorState,
    draftEditorState: defaultEditorState,
    finishedEditorState: "",
    currentVersion: 'Draft',
    snippets: [],
  };
};

export const generateDefaultDocument = ({title, folder, prompt}: {title?: string, folder?: string, prompt?: string}): DocumentInterface => ({
  id: uuidv4(),
  title: title ? title : 'New Document',
  folder: folder ? folder : "",
  messageHistory: [],
  edited: false,
  messageCurrent: {
  id: uuidv4(),
  date: dateString,
  edited: false,
  folder: folder ? folder : "",
  title: title ? title : 'New Chat',
  config: { ...useStore.getState().defaultChatConfig },
  titleSet: false,
  notes: [],  
  messages:
    useStore.getState().defaultSystemMessage.length > 0
      ? [{ role: 'system', content: prompt? prompt : useStore.getState().defaultSystemMessage }]
      : [],
  favorited: false,
  messageIndex: null
  },
  titleSet: false,
  editorState: "",
  draftEditorState: "",
  finishedEditorState: "",
  currentVersion: 'Draft',
  snippets: [],
});

export const codeLanguageSubset = [
  'python',
  'javascript',
  'java',
  'go',
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'diff',
  'graphql',
  'json',
  'kotlin',
  'less',
  'lua',
  'makefile',
  'markdown',
  'objectivec',
  'perl',
  'php',
  'php-template',
  'plaintext',
  'python-repl',
  'r',
  'ruby',
  'rust',
  'scss',
  'shell',
  'sql',
  'swift',
  'typescript',
  'vbnet',
  'wasm',
  'xml',
  'yaml',
];
