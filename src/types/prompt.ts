import { ConfigInterface } from "./document";

export interface Prompt {
  id: string;
  name: string;
  prompt: string;
  config: ConfigInterface | null;
  includeSelection: boolean;
}

export interface PromptDropdownItem {
  name: string;
  model: string;
}
