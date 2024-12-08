'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Agent, ChatMode, Message, StructuredOutputFormat } from '../agents/types';
import { OllamaAgent } from '../agents/ollama-agent';
import { DebugInfo } from '../../components/DebugPanel';
import { createExcelTools } from '../tools/langchain-tools';
import path from 'path';

interface AgentState {
  agent: OllamaAgent | null;
  messages: Message[];
  isProcessing: boolean;
  availableModels: string[];
  selectedModel: string | null;
  selectedMode: ChatMode;
  currentFilePath: string | null;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  clearMessages: () => void;
  setIsProcessing: (isProcessing: boolean) => void;
  initializeAgent: () => Promise<void>;
  setSelectedModel: (model: string) => void;
  setSelectedMode: (mode: ChatMode) => void;
  setAvailableModels: (models: string[]) => void;
  loadFile: (file: File) => Promise<void>;
  analyzeData: (input: string, format?: StructuredOutputFormat, onDebug?: (info: DebugInfo) => void) => Promise<void>;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      agent: null,
      messages: [],
      isProcessing: false,
      availableModels: [],
      selectedModel: null,
      selectedMode: ChatMode.NORMAL,
      currentFilePath: null,
      addMessage: (message: Message) => set((state) => ({ messages: [...state.messages, message] })),
      setMessages: (messages: Message[]) => set({ messages }),
      clearMessages: () => set({ messages: [] }),
      setIsProcessing: (isProcessing: boolean) => set({ isProcessing }),
      setSelectedMode: (mode: ChatMode) => {
        const { agent } = get();
        if (agent) {
          agent.setMode(mode);
        }
        set({ selectedMode: mode });
      },
      initializeAgent: async () => {
        try {
          const response = await fetch('/api/tags');
          if (!response.ok) {
            throw new Error('Failed to fetch available models');
          }
          const data = await response.json();
          const modelNames = data.models.map((model: { name: string }) => model.name);
          set({ availableModels: modelNames });
          
          if (modelNames.length > 0) {
            const selectedModel = modelNames[0];
            const agent = new OllamaAgent({
              model: selectedModel,
              supportedModes: [ChatMode.NORMAL, ChatMode.STRUCTURED, ChatMode.TOOL_BASED]
            });
            set({ 
              selectedModel,
              agent,
              selectedMode: ChatMode.NORMAL
            });
          }
        } catch (error) {
          console.error(error);
        }
      },
      setSelectedModel: (model: string) => {
        const { currentFilePath } = get();
        const agent = new OllamaAgent({
          model,
          supportedModes: [ChatMode.NORMAL, ChatMode.STRUCTURED, ChatMode.TOOL_BASED]
        });
        set({ selectedModel: model, agent });
        
        // Re-initialize tools if there's a file loaded
        if (currentFilePath) {
          const tools = createExcelTools(currentFilePath);
          if (agent) {
            agent.tools = tools;
            agent.setMode(ChatMode.TOOL_BASED);
          }
        }
      },
      setAvailableModels: (models: string[]) => set({ availableModels: models }),
      loadFile: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);

        try {
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('File upload failed');
          }

          const data = await response.json();
          const filePath = path.join(process.cwd(), 'public', 'uploads', data.filename);
          
          // Initialize Excel tools with the new file
          const tools = createExcelTools(filePath);
          const { agent } = get();
          
          if (agent) {
            // Update agent with new tools and switch to tool-based mode
            agent.tools = tools;
            agent.setMode(ChatMode.TOOL_BASED);
            
            // Add system message about file upload
            const systemMessage: Message = { 
              role: 'system', 
              content: `File uploaded: ${data.filename}`,
              mode: ChatMode.TOOL_BASED
            };
            
            set((state) => ({
              messages: [...state.messages, systemMessage],
              currentFilePath: filePath,
              selectedMode: ChatMode.TOOL_BASED
            }));
          }
        } catch (error) {
          console.error('Error uploading file:', error);
        }
      },
      analyzeData: async (input: string, format?: StructuredOutputFormat, onDebug?: (info: DebugInfo) => void) => {
        const { agent, addMessage, setIsProcessing, messages, selectedMode } = get();
        if (!agent) {
          onDebug?.({ currentStep: 'Error', error: 'No agent initialized' });
          return;
        }

        onDebug?.({ currentStep: 'Starting chat' });
        
        // Use normal mode for regular chat, tool-based mode for analysis
        const mode = input.toLowerCase().startsWith('hi') || input.toLowerCase().startsWith('hello') 
          ? ChatMode.NORMAL 
          : ChatMode.TOOL_BASED;
        
        agent.setMode(mode);
        
        const userMessage: Message = { 
          role: 'user', 
          content: input,
          mode: mode
        };
        addMessage(userMessage);
        setIsProcessing(true);

        try {
          onDebug?.({ currentStep: 'Processing with agent' });
          const response = await agent.chat([...messages, userMessage], format);
          onDebug?.({ 
            currentStep: 'Received response', 
            toolResult: response,
            toolCalled: mode === ChatMode.TOOL_BASED ? 'Excel Analysis' : undefined
          });
          
          addMessage({ 
            role: 'assistant', 
            content: response,
            mode: mode
          });
        } catch (error) {
          console.error('Error in chat:', error);
          onDebug?.({ 
            currentStep: 'Error in chat', 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          
          addMessage({ 
            role: 'assistant', 
            content: 'Sorry, I encountered an error.',
            mode: mode
          });
        } finally {
          setIsProcessing(false);
          onDebug?.({ currentStep: 'Chat complete' });
        }
      },
    }),
    {
      name: 'agent-store',
    }
  )
);