'use client';

import { useEffect, useState, useCallback } from 'react';
import { Resizable } from 're-resizable';
import { ProcessManager } from '../components/ProcessManager';
import { predefinedAgents } from '../lib/agents/predefined-agents';
import { Agent, ChatMode } from '../lib/agents/types';
import { useAgentStore } from '../lib/store/agent-store';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { Tool } from '../lib/tools/tool';
import { FunctionCallingTool } from '../lib/tools/function-calling-tool';
import { OllamaAgent } from '../lib/agents/ollama-agent';
import { DebugPanel, DebugInfo } from '../components/DebugPanel';
import { ClearChatButton } from '../components/ClearChatButton';
import { ExcelAnalyzer, createExcelTools } from '../lib/tools/excel-tools';
import { ExcelPreview } from '../components/ExcelPreview';

interface ExcelRow {
  [key: string]: string | number | boolean | null;
}

export default function Home() {
  const [panelWidth, setPanelWidth] = useState('50%');
  const [currentWorkbook, setCurrentWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [status, setStatus] = useState<'running' | 'stopped' | 'starting' | 'error'>('stopped');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({ currentStep: 'Initializing' });
  const [excelAnalyzer] = useState(() => new ExcelAnalyzer());
  const [showUpload, setShowUpload] = useState(true);

  const handleDebug = useCallback((info: DebugInfo) => {
    console.log('Debug info:', info);
    setDebugInfo(info);
  }, []);

  const {
    messages,
    isProcessing,
    availableModels,
    selectedModel,
    addMessage,
    clearMessages,
    setIsProcessing,
    setSelectedModel,
    loadFile,
    analyzeData,
    setAvailableModels,
  } = useAgentStore();

  // Initialize agent when component mounts
  useEffect(() => {
    const initAgent = async () => {
      try {
        handleDebug({ currentStep: 'Fetching available models' });
        const response = await fetch('/api/tags');
        if (!response.ok) {
          throw new Error('Failed to fetch available models');
        }
        const data = await response.json();
        const modelNames = data.models.map((model: { name: string }) => model.name);
        setAvailableModels(modelNames);
        
        if (modelNames.length > 0) {
          const firstModel = modelNames[0];
          handleDebug({ currentStep: `Initializing agent with model ${firstModel}` });
          
          // Initialize with Data Analyst agent
          const dataAnalystAgent = predefinedAgents.find(a => a.id === 'data-analyst');
          if (dataAnalystAgent) {
            const excelTools = createExcelTools(excelAnalyzer);
            const agent = new OllamaAgent(
              [...dataAnalystAgent.tools, ...excelTools],
              excelAnalyzer
            );
            setSelectedAgent(dataAnalystAgent);
            setSelectedModel(firstModel);
            handleDebug({ currentStep: 'Agent initialized successfully' });
          }
        }
      } catch (error) {
        console.error('Error initializing agent:', error);
        handleDebug({ 
          currentStep: 'Initialization failed', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    };

    initAgent();
  }, [handleDebug, setAvailableModels, setSelectedModel, excelAnalyzer]);

  // Update agent when model changes
  useEffect(() => {
    if (selectedModel && selectedAgent) {
      handleDebug({ currentStep: `Updating agent to use model ${selectedModel}` });
      const dataAnalystAgent = predefinedAgents.find(a => a.id === 'data-analyst');
      if (dataAnalystAgent) {
        const excelTools = createExcelTools(excelAnalyzer);
        const agent = new OllamaAgent(
          [...dataAnalystAgent.tools, ...excelTools],
          excelAnalyzer
        );
        setSelectedAgent(dataAnalystAgent);
        handleDebug({ currentStep: 'Agent updated successfully' });
      }
    }
  }, [selectedModel, handleDebug, excelAnalyzer]);

  const handleStatusChange = useCallback((newStatus: 'running' | 'stopped' | 'starting' | 'error') => {
    setStatus(newStatus);
    if (newStatus !== 'running') {
      setIsProcessing(false);
    }
  }, [setIsProcessing]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles?.length > 0) {
      const file = acceptedFiles[0];
      try {
        handleDebug({ currentStep: `Processing file: ${file.name}` });
        
        // Read the file for preview and SQL database
        const reader = new FileReader();
        reader.onload = async (e) => {
          handleDebug({ currentStep: 'Loading file preview' });
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          setCurrentWorkbook(workbook);
          setShowUpload(false);
          
          // Initialize SQL database
          const result = await excelAnalyzer.initialize(e.target?.result as ArrayBuffer);
          if (!result.success) {
            throw new Error(result.error);
          }
          
          handleDebug({ currentStep: 'File preview and SQL database initialized' });
        };
        reader.readAsArrayBuffer(file);

        // Send to backend for persistence
        handleDebug({ currentStep: 'Uploading file to server' });
        await loadFile(file);
        
        handleDebug({ currentStep: 'File uploaded successfully' });
      } catch (error) {
        console.error('Error loading file:', error);
        handleDebug({ 
          currentStep: 'File processing failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }, [loadFile, handleDebug, excelAnalyzer]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    }
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <DebugPanel debugInfo={debugInfo} />
      <main className="flex min-h-screen relative">
        {/* Left Sidebar */}
        <div className="w-64 bg-white shadow-sm overflow-y-auto border-r border-gray-200 relative z-30">
          {/* Backend Status Section */}
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Backend Status</h2>
            <ProcessManager onStatusChange={handleStatusChange} />
          </div>

          {/* Model Selection */}
          <div className="p-4 border-b">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Model Selection</h2>
            <select 
              value={selectedModel || ''}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full p-2 border rounded-md bg-white text-gray-700 text-sm"
            >
              <option value="">Select a model</option>
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          {/* Agents List */}
          <div className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Available Agents</h2>
            <div className="space-y-2">
              {predefinedAgents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedAgent?.id === agent.id
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-white border border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <h3 className="font-medium text-gray-800">{agent.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{agent.description}</p>
                  
                  {/* Tools */}
                  <div className="mt-2 space-y-1">
                    {agent.tools.map((tool, idx) => (
                      <div key={idx} className="text-xs text-gray-600 bg-gray-50 p-1.5 rounded">
                        {tool.name}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col relative">
          {/* File Upload Area - Only show when no file is loaded */}
          {showUpload && (
            <div className="absolute inset-0 flex items-center justify-center p-4 bg-gray-100">
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors bg-white max-w-2xl w-full ${
                  isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <input {...getInputProps()} />
                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-gray-600">Upload a file or drag and drop</p>
                <p className="text-sm text-gray-500 mt-1">Support for Excel files (.xlsx, .xls, .csv)</p>
              </div>
            </div>
          )}

          {/* Split View - Only show when file is loaded */}
          {!showUpload && (
            <div className="flex-1 flex p-4">
              {/* Excel Preview */}
              <Resizable
                size={{ width: panelWidth, height: '100%' }}
                onResizeStop={(e, direction, ref, d) => {
                  const newWidth = parseInt(panelWidth) + d.width;
                  const containerWidth = ref.parentElement?.clientWidth || 0;
                  const minWidth = containerWidth * 0.3;
                  const maxWidth = containerWidth * 0.7;
                  setPanelWidth(`${Math.min(Math.max(newWidth, minWidth), maxWidth)}px`);
                }}
                enable={{ right: true }}
                handleClasses={{ right: 'resize-handle' }}
                className="bg-white rounded-lg shadow-sm"
              >
                <style jsx global>{`
                  .resize-handle {
                    width: 4px !important;
                    right: 0;
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    background-color: #e5e7eb;
                    cursor: col-resize;
                    transition: background-color 0.2s;
                    z-index: 10;
                  }
                  .resize-handle:hover {
                    background-color: #93c5fd;
                  }
                `}</style>
                <div className="h-full flex flex-col">
                  <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                    <h3 className="text-lg font-medium text-gray-800">Excel Preview</h3>
                    <ClearChatButton onClick={() => {
                      clearMessages();
                      setShowUpload(true);
                      setCurrentWorkbook(null);
                    }} />
                  </div>
                  <div className="flex-1 overflow-auto relative">
                    <div className="absolute inset-0">
                      <ExcelPreview workbook={currentWorkbook} />
                    </div>
                  </div>
                </div>
              </Resizable>

              {/* Chat Interface */}
              <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm ml-4">
                <div className="flex-1 overflow-y-auto p-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`mb-4 ${
                        message.role === 'user' ? 'text-right' : 'text-left'
                      }`}
                    >
                      <div
                        className={`inline-block p-3 rounded-lg max-w-[80%] ${
                          message.role === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <span className="whitespace-pre-wrap">{message.content}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t p-4 bg-gray-50">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      id="chat-input"
                      placeholder="Ask a question about your data..."
                      className="flex-1 p-2 border rounded-lg text-gray-800 placeholder-gray-500 bg-white"
                      disabled={!selectedModel}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !isProcessing) {
                          const input = e.target as HTMLInputElement;
                          if (input.value.trim()) {
                            analyzeData(input.value, undefined, handleDebug);
                            input.value = '';
                          }
                        }
                      }}
                    />
                    <button 
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                      disabled={!selectedModel || isProcessing}
                      onClick={() => {
                        const input = document.querySelector('#chat-input') as HTMLInputElement;
                        if (input?.value.trim()) {
                          analyzeData(input.value, undefined, handleDebug);
                          input.value = '';
                        }
                      }}
                    >
                      {isProcessing ? 'Processing...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}