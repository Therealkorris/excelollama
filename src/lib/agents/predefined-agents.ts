import { Agent, ChatMode, Message, StructuredOutputFormat } from './types';
import { createExcelTools, createGeneralTools } from '../tools/langchain-tools';
import { OllamaAgent, OllamaAgentOptions } from './ollama-agent';

// Agent factory function
function createAgent(
  id: string,
  name: string,
  description: string,
  initialTools: any[],
  model: string,
  supportedModes: ChatMode[]
): Agent {
  const agentOptions: OllamaAgentOptions = {
    model,
    tools: initialTools,
    supportedModes
  };

  const agent = new OllamaAgent(agentOptions);
  return {
    id,
    name,
    description,
    tools: initialTools,
    model,
    supportedModes,
    chat: (messages: Message[], format?: StructuredOutputFormat) => agent.chat(messages, format),
    setMode: (mode: ChatMode) => agent.setMode(mode)
  };
}

// Create predefined agents
export const predefinedAgents: Agent[] = [
  createAgent(
    'data-analyst',
    'Data Analyst',
    'An agent specialized in analyzing data from Excel files.',
    [], // Tools will be initialized when a file is loaded
    'llama3.1',
    [ChatMode.NORMAL, ChatMode.STRUCTURED, ChatMode.TOOL_BASED]
  ),
  createAgent(
    'general-assistant',
    'General Assistant',
    'A general-purpose assistant for everyday tasks.',
    createGeneralTools(),
    'llama3.1',
    [ChatMode.NORMAL, ChatMode.STRUCTURED]
  ),
];

// Function to update Data Analyst tools when a file is loaded
export function updateDataAnalystTools(filePath: string) {
  const dataAnalyst = predefinedAgents.find(agent => agent.id === 'data-analyst');
  if (dataAnalyst) {
    const tools = createExcelTools(filePath);
    dataAnalyst.tools = tools;
    
    // Update the underlying OllamaAgent
    const agentOptions: OllamaAgentOptions = {
      model: dataAnalyst.model,
      tools,
      supportedModes: dataAnalyst.supportedModes
    };
    const newAgent = new OllamaAgent(agentOptions);
    
    // Update the chat method to use the new agent
    dataAnalyst.chat = (messages: Message[], format?: StructuredOutputFormat) => 
      newAgent.chat(messages, format);
    dataAnalyst.setMode = (mode: ChatMode) => newAgent.setMode(mode);
  }
}