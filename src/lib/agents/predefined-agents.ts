import { Agent, ChatMode } from '../agents/types';
import { functionCallingTool } from '../tools/function-calling-tool';
import { readExcelTool, writeExcelTool, analyzeExcelTool } from '../tools/excel-tools';

export const predefinedAgents: Agent[] = [
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    description: 'An agent specialized in analyzing data from Excel files.',
    tools: [readExcelTool, writeExcelTool, analyzeExcelTool],
    model: 'llama3.1',
    supportedModes: [ChatMode.NORMAL, ChatMode.STRUCTURED, ChatMode.TOOL_BASED],
  },
  {
    id: 'general-assistant',
    name: 'General Assistant',
    description: 'A general-purpose assistant for everyday tasks.',
    tools: [functionCallingTool],
    model: 'llama3.1',
    supportedModes: [ChatMode.NORMAL, ChatMode.STRUCTURED],
  },
];