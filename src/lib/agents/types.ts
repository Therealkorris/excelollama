import { Tool } from '../tools/tool';

export enum ChatMode {
  NORMAL = 'normal',
  STRUCTURED = 'structured',
  TOOL_BASED = 'tool_based'
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
}

export interface StructuredOutputFormat {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  tools: Tool[];
  model: string;
  supportedModes: ChatMode[];
  structuredOutputFormat?: StructuredOutputFormat;
  chat(messages: Message[]): Promise<string>;
}