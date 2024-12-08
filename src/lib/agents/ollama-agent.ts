import { Agent, ChatMode, Message, StructuredOutputFormat } from './types';
import { Tool } from '../tools/tool';
import { DebugInfo } from '../../components/DebugPanel';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export interface OllamaAgentOptions {
  model: string;
  tools?: Tool[];
  structuredOutputFormat?: StructuredOutputFormat;
  baseUrl?: string;
  onDebug?: (info: DebugInfo) => void;
  supportedModes?: ChatMode[];
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
  private onDebug?: (info: DebugInfo) => void;
  private currentMode: ChatMode = ChatMode.NORMAL;

  constructor(options: OllamaAgentOptions) {
    this.id = `ollama-${options.model}`;
    this.name = `Ollama ${options.model}`;
    this.description = `An agent powered by the ${options.model} model`;
    this.model = options.model;
    this.tools = options.tools || [];
    this.supportedModes = options.supportedModes || [ChatMode.NORMAL, ChatMode.STRUCTURED, ChatMode.TOOL_BASED];
    this.structuredOutputFormat = options.structuredOutputFormat;
    this.onDebug = options.onDebug;
    
    // Use provided baseUrl, environment variable, or default
    const envUrl = typeof window !== 'undefined' ? window.__NEXT_DATA__?.props?.env?.OLLAMA_URL : process.env.OLLAMA_URL;
    this.baseUrl = options.baseUrl || envUrl || DEFAULT_OLLAMA_URL;
  }

  setMode(mode: ChatMode) {
    if (!this.supportedModes.includes(mode)) {
      throw new Error(`Mode ${mode} is not supported by this agent`);
    }
    this.currentMode = mode;
  }

  private debug(info: DebugInfo) {
    if (this.onDebug) {
      this.onDebug(info);
    }
  }

  async chat(messages: Message[], format?: StructuredOutputFormat): Promise<string> {
    this.debug({ currentStep: 'Starting chat request' });

    const payload: any = {
      model: this.model,
      messages: messages.map(msg => ({
        ...msg,
        mode: msg.mode || this.currentMode
      })),
      stream: false,
    };

    // Add tools if available and in tool-based mode
    if (this.tools.length > 0 && this.currentMode === ChatMode.TOOL_BASED) {
      this.debug({ 
        currentStep: 'Adding tools to request',
        toolCalled: 'multiple',
        toolArgs: this.tools.map(t => t.name)
      });

      payload.tools = this.tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));
    }

    // Add structured output format if available and in structured mode
    if ((format || this.structuredOutputFormat) && this.currentMode === ChatMode.STRUCTURED) {
      const outputFormat = format || this.structuredOutputFormat;
      this.debug({ 
        currentStep: 'Adding structured output format',
        toolArgs: outputFormat
      });
      payload.format = outputFormat;
    }

    try {
      this.debug({ currentStep: 'Sending request to Ollama' });
      
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = `Failed to chat with Ollama: ${response.statusText}`;
        this.debug({ 
          currentStep: 'Request failed',
          error
        });
        throw new Error(error);
      }

      const data = await response.json();
      
      // Handle tool calls if present and in tool-based mode
      if (data.message?.tool_calls && this.currentMode === ChatMode.TOOL_BASED) {
        for (const toolCall of data.message.tool_calls) {
          const tool = this.tools.find(t => t.name === toolCall.function.name);
          if (tool) {
            this.debug({ 
              currentStep: 'Executing tool',
              toolCalled: tool.name,
              toolArgs: JSON.stringify(toolCall.function.arguments)
            });

            try {
              const result = await tool.execute(JSON.parse(toolCall.function.arguments));
              this.debug({ 
                currentStep: 'Tool execution completed',
                toolCalled: tool.name,
                toolResult: result
              });

              messages.push({
                role: 'tool',
                content: result,
                tool_call_id: toolCall.id,
                mode: this.currentMode
              });
            } catch (error) {
              this.debug({ 
                currentStep: 'Tool execution failed',
                toolCalled: tool.name,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
              throw error;
            }
          } else {
            this.debug({ 
              currentStep: 'Tool not found',
              toolCalled: toolCall.function.name,
              error: 'Tool not available'
            });
          }
        }
        // Make another request with tool results
        return this.chat(messages);
      }

      this.debug({ 
        currentStep: 'Chat completed',
        toolResult: data.message.content
      });

      return data.message.content;
    } catch (error) {
      this.debug({ 
        currentStep: 'Error in chat',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.error('Error in Ollama chat:', error);
      throw error;
    }
  }
}