import React, { useEffect, useState } from 'react';

export interface DebugInfo {
  currentStep: string;
  toolCalled?: string;
  toolArgs?: any;
  toolResult?: string;
  error?: string;
  timestamp?: string;
}

interface DebugPanelProps {
  debugInfo: DebugInfo;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ debugInfo }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [history, setHistory] = useState<DebugInfo[]>([]);
  const maxHistoryLength = 50; // Maximum number of history items to keep

  useEffect(() => {
    // Add timestamp to debug info
    const timestampedInfo = {
      ...debugInfo,
      timestamp: new Date().toLocaleTimeString()
    };
    
    // Add new debug info to history
    setHistory(prev => {
      const newHistory = [timestampedInfo, ...prev];
      // Keep only the last maxHistoryLength items
      return newHistory.slice(0, maxHistoryLength);
    });
  }, [debugInfo]);

  const DebugEntry = ({ info }: { info: DebugInfo }) => (
    <div className="border-b border-gray-200 last:border-0 py-2">
      <div className="flex justify-between items-start">
        <span className="font-semibold text-gray-700">{info.currentStep}</span>
        <span className="text-[10px] text-gray-500">{info.timestamp}</span>
      </div>
      {info.toolCalled && (
        <div className="mt-1">
          <span className="font-semibold">Tool:</span>
          <span className="ml-2 text-blue-600">{info.toolCalled}</span>
        </div>
      )}
      {info.toolArgs && (
        <div className="mt-1">
          <span className="font-semibold">Args:</span>
          <pre className="ml-2 whitespace-pre-wrap bg-gray-50 p-1 rounded text-gray-600 text-[10px]">
            {JSON.stringify(info.toolArgs, null, 2)}
          </pre>
        </div>
      )}
      {info.toolResult && (
        <div className="mt-1">
          <span className="font-semibold">Result:</span>
          <pre className="ml-2 whitespace-pre-wrap bg-gray-50 p-1 rounded text-gray-600 text-[10px]">
            {info.toolResult}
          </pre>
        </div>
      )}
      {info.error && (
        <div className="mt-1 text-red-600">
          <span className="font-semibold">Error:</span>
          <span className="ml-2">{info.error}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed top-2 right-2 z-50">
      {/* Collapsed view */}
      {!isExpanded && (
        <button 
          onClick={() => setIsExpanded(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-xs flex items-center gap-2"
        >
          <span>Debug</span>
          {debugInfo.error && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
        </button>
      )}

      {/* Expanded view */}
      {isExpanded && (
        <div className="bg-white border border-gray-200 rounded-md shadow-lg p-3 w-96">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold text-gray-700">Debug Panel</h3>
            <button 
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          {/* Current State */}
          <div className="mb-4 bg-blue-50 p-2 rounded-md">
            <div className="text-sm font-semibold text-blue-700 mb-1">Current State</div>
            <DebugEntry info={debugInfo} />
          </div>

          {/* History Log */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-1">History Log</div>
            <div className="max-h-[400px] overflow-y-auto">
              {history.slice(1).map((info, index) => (
                <DebugEntry key={index} info={info} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 