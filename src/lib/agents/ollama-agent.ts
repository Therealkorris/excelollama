import { Tool } from "../tools/tool";
import { ChatMode, Message, StructuredOutputFormat } from "./types";

interface FunctionCall {
  name: string;
  arguments: string;
}

interface FunctionCallResponse {
  name: string;
  content: string;
}

interface OllamaResponseFormat {
  type: "json_object";
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message?: {
    role: string;
    content: string;
    images?: string[];
    function_call?: FunctionCall;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
  function_call_response?: FunctionCallResponse;
}

interface OllamaRequest {
  model: string;
  messages: Message[];
  stream: boolean;
  format?: "json";
  options?: Record<string, unknown>;
  template?: string;
  context?: unknown;
  response_format?: OllamaResponseFormat;
  tools?: Tool[];
}

export interface OllamaAgentOptions {
  model: string;
  tools?: Tool[];
  supportedModes?: ChatMode[];
}

export class OllamaAgent {
  private model: string;
  private tools: Tool[];
  private supportedModes: ChatMode[];
  private currentMode: ChatMode = ChatMode.NORMAL;

  constructor(options: OllamaAgentOptions) {
    this.model = options.model;
    this.tools = options.tools || [];
    this.supportedModes = options.supportedModes || [ChatMode.NORMAL];
  }

  setMode(mode: ChatMode) {
    if (!this.supportedModes.includes(mode)) {
      throw new Error(`Mode ${mode} is not supported by this agent`);
    }
    this.currentMode = mode;
  }

  async chat(messages: Message[], format?: StructuredOutputFormat): Promise<string> {
    const requestBody: OllamaRequest = {
      model: this.model,
      messages,
      stream: false,
      format: "json",
      options: {
        num_predict: 4096,
        stop: ["\n\n"],
        temperature: 0.7,
      },
    };

    // Add mode-specific configurations
    switch (this.currentMode) {
      case ChatMode.STRUCTURED:
        if (!format) {
          throw new Error('Structured output format is required for structured mode');
        }
        requestBody.response_format = {
          type: "json_object"
        };
        requestBody.format = "json";
        break;

      case ChatMode.TOOL_BASED:
        requestBody.tools = this.tools;
        break;

      case ChatMode.NORMAL:
        // No special configuration needed
        break;
    }

    try {
      const response = await fetch('/api/ollama/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Ollama API request failed with status ${response.status}`);
      }

      const data: OllamaResponse = await response.json();
      
      if (!data.message) {
        throw new Error('No message in response');
      }

      if (!data.message.content && !data.message.function_call) {
        throw new Error('No content or function call in response');
      }

      switch (this.currentMode) {
        case ChatMode.STRUCTURED:
          return data.message.content;

        case ChatMode.TOOL_BASED:
          if (data.message.function_call) {
            const { name, arguments: argsString } = data.message.function_call;
            const tool = this.tools.find(t => t.name === name);
            if (tool) {
              try {
                const args = JSON.parse(argsString);
                const result = await tool.execute(args);
                return result;
              } catch (error) {
                console.error('Error executing tool:', error);
                return `Error executing tool ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
              }
            }
            return `Tool ${name} not found`;
          }
          return data.message.content;

        case ChatMode.NORMAL:
        default:
          return data.message.content;
      }
    } catch (error) {
      console.error('Error during Ollama chat:', error);
      throw error;
    }
  }

  getTools(): Tool[] {
    return this.tools;
  }

  getSupportedModes(): ChatMode[] {
    return this.supportedModes;
  }

  getCurrentMode(): ChatMode {
    return this.currentMode;
  }
}