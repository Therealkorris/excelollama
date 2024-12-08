import { Agent, ChatMode, Message, StructuredOutputFormat } from './types';
import { Tool } from '../tools/tool';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export interface OllamaAgentOptions {
  model: string;
  tools?: Tool[];
  structuredOutputFormat?: StructuredOutputFormat;
  baseUrl?: string;
}

export class OllamaAgent implements Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  tools: Tool[];
  supportedModes: ChatMode[];
  structuredOutputFormat?: StructuredOutputFormat;
  private baseUrl: string;

  constructor(options: OllamaAgentOptions) {
    this.id = `ollama-${options.model}`;
    this.name = `Ollama ${options.model}`;
    this.description = `An agent powered by the ${options.model} model`;
    this.model = options.model;
    this.tools = options.tools || [];
    this.supportedModes = [ChatMode.NORMAL, ChatMode.STRUCTURED, ChatMode.TOOL_BASED];
    this.structuredOutputFormat = options.structuredOutputFormat;
    
    // Use provided baseUrl, environment variable, or default
    const envUrl = typeof window !== 'undefined' ? window.__NEXT_DATA__?.props?.env?.OLLAMA_URL : process.env.OLLAMA_URL;
    this.baseUrl = options.baseUrl || envUrl || DEFAULT_OLLAMA_URL;
  }

  async chat(messages: Message[]): Promise<string> {
    const payload: any = {
      model: this.model,
      messages: messages,
      stream: false,
    };

    // Add tools if available
    if (this.tools.length > 0) {
      payload.tools = this.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));
    }

    // Add structured output format if available
    if (this.structuredOutputFormat) {
      payload.format = this.structuredOutputFormat;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to chat with Ollama: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Handle tool calls if present
      if (data.message?.tool_calls) {
        for (const toolCall of data.message.tool_calls) {
          const tool = this.tools.find(t => t.name === toolCall.function.name);
          if (tool) {
            const result = await tool.execute(toolCall.function.arguments);
            messages.push({
              role: 'tool',
              content: result,
              tool_call_id: toolCall.id
            });
          }
        }
        // Make another request with tool results
        return this.chat(messages);
      }

      return data.message.content;
    } catch (error) {
      console.error('Error in Ollama chat:', error);
      throw error;
    }
  }
}