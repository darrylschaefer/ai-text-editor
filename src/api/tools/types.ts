/**
 * Types for OpenAI function calling tools
 */

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ToolResult {
  tool_call_id: string;
  role: 'tool';
  name: string;
  content: string;
}

export type ToolImplementation = (args: any, context?: import('./context').ToolContext) => Promise<any> | any;

export interface ToolRegistry {
  [toolName: string]: {
    definition: ToolDefinition;
    implementation: ToolImplementation;
  };
}





