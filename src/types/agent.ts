import type { ConfigInterface } from './document';

export interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  config?: ConfigInterface;
  instructions?: string;
  enabledTools?: string[];
  toolConfirmationSettings?: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

// Copied into a conversation when it starts. Editing/deleting the source
// profile must not change the behavior of an existing conversation.
export interface AgentSnapshot {
  id?: string;
  name: string;
  description: string;
  instructions: string;
  enabledTools: string[];
  toolConfirmationSettings: Record<string, boolean>;
  updatedAt: string;
}
