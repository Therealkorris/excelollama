import { Tool } from '../tools/tool';

export enum ChatMode {
  NORMAL = 'normal',
  STRUCTURED = 'structured',
  TOOL_BASED = 'tool_based'
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  mode?: ChatMode;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  tools: Tool[];
  model: string;
  supportedModes: ChatMode[];
}

export interface StructuredOutputFormat {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
}