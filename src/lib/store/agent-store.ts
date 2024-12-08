'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Agent, ChatMode, Message, StructuredOutputFormat } from '../agents/types';
import { OllamaAgent } from '../agents/ollama-agent';

interface AgentState {
  agent: OllamaAgent | null;
  messages: Message[];
  isProcessing: boolean;
  availableModels: string[];
  selectedModel: string | null;
  selectedMode: ChatMode;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  initializeAgent: () => Promise<void>;
  setSelectedModel: (model: string) => void;
  setSelectedMode: (mode: ChatMode) => void;
  setAvailableModels: (models: string[]) => void;
  loadFile: (file: File) => Promise<void>;
  analyzeData: (input: string, format?: StructuredOutputFormat) => Promise<void>;
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
      addMessage: (message: Message) => set((state) => ({ messages: [...state.messages, message] })),
      setMessages: (messages: Message[]) => set({ messages }),
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
        const agent = new OllamaAgent({
          model,
          supportedModes: [ChatMode.NORMAL, ChatMode.STRUCTURED, ChatMode.TOOL_BASED]
        });
        set({ selectedModel: model, agent });
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

          set((state) => ({
            messages: [...state.messages, { role: 'system', content: `File uploaded: ${data.filename}` }],
          }));
        } catch (error) {
          console.error('Error uploading file:', error);
        }
      },
      analyzeData: async (input: string, format?: StructuredOutputFormat) => {
        const { agent, addMessage, setIsProcessing, selectedMode, messages } = get();
        if (!agent) return;

        const userMessage: Message = { 
          role: 'user', 
          content: input,
          mode: selectedMode
        };
        addMessage(userMessage);
        setIsProcessing(true);

        try {
          const response = await agent.chat([...messages, userMessage], format);
          addMessage({ 
            role: 'assistant', 
            content: response,
            mode: selectedMode
          });
        } catch (error) {
          console.error('Error analyzing data:', error);
          addMessage({ 
            role: 'assistant', 
            content: 'Sorry, I encountered an error.',
            mode: selectedMode
          });
        } finally {
          setIsProcessing(false);
        }
      },
    }),
    {
      name: 'agent-store',
    }
  )
);