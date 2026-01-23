import { Prompt } from '@type/prompt';
import { _defaultChatConfig } from './chat';

const defaultPrompts: Prompt[] = [
  {
    "id": "8d9d1f6c-0cb2-41a0-a871-aa8762bdc7e1",
    "name": "Analysis: Style, Tone, & Mood",
    "prompt": 
    [
      { content: "Analyze the style, tone, and mood in the selected text sample. Examine the author's use of language, sentence structure, and literary techniques. Identify key stylistic choices and their impact on the overall narrative:", role: "user" }
    ],
    "config": { ..._defaultChatConfig }
  }
]

export default defaultPrompts;
