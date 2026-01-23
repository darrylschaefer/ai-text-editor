import { ConfigInterface } from "./document";

export interface Prompt {
  id: string;
  name: string;
  prompt: {content: string, role: string}[];
  config: ConfigInterface | null;
  enabledTools?: string[]; // Per-prompt tool selection (exclusive to this action)
  toolConfirmationSettings?: Record<string, boolean>; // Per-prompt tool confirmation settings
}

export interface PromptDropdownItem {
  name: string;
  model: string;
}
