import { useState, useRef } from 'react';
import { ExcelAnalyzer, createExcelTools } from '../lib/tools/excel-tools';
import { OllamaAgent } from '../lib/agents/ollama-agent';

interface AnalysisResult {
  success: boolean;
  data?: any[];
  error?: string;
  query?: string;
}

export default function ExcelAnalyzerComponent() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; rows: number } | null>(null);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [question, setQuestion] = useState('');
  
  const analyzerRef = useRef<ExcelAnalyzer | null>(null);
  const agentRef = useRef<OllamaAgent | null>(null);
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const buffer = await file.arrayBuffer();
      
      // Initialize analyzer if not already done
      if (!analyzerRef.current) {
        analyzerRef.current = new ExcelAnalyzer();
      }
      
      const result = await analyzerRef.current.initialize(buffer);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // Initialize agent with the analyzer
      if (!agentRef.current && analyzerRef.current) {
        agentRef.current = new OllamaAgent(
          createExcelTools(analyzerRef.current),
          analyzerRef.current
        );
      }
      
      setFileInfo({
        name: file.name,
        rows: result.rowCount || 0
      });
      
      setResults(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !agentRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await agentRef.current.chat(question);
      setResults(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze data');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-8">
        <label className="block mb-2 text-sm font-medium">
          Upload Excel File
        </label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          className="block w-full text-sm border rounded-lg cursor-pointer"
          disabled={isLoading}
        />
        {fileInfo && (
          <p className="mt-2 text-sm text-gray-600">
            Loaded {fileInfo.name} with {fileInfo.rows} rows
          </p>
        )}
      </div>
      
      {fileInfo && (
        <form onSubmit={handleQuestionSubmit} className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question about your data..."
              className="flex-1 p-2 border rounded"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !question.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {isLoading ? 'Analyzing...' : 'Ask'}
            </button>
          </div>
        </form>
      )}
      
      {error && (
        <div className="p-4 mb-4 text-red-700 bg-red-100 rounded">
          {error}
        </div>
      )}
      
      {results && (
        <div className="border rounded-lg p-4">
          {results.query && (
            <div className="mb-4">
              <h3 className="font-medium mb-2">SQL Query:</h3>
              <pre className="bg-gray-100 p-2 rounded overflow-x-auto">
                {results.query}
              </pre>
            </div>
          )}
          
          {results.data && results.data.length > 0 ? (
            <div>
              <h3 className="font-medium mb-2">Results:</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(results.data[0]).map((key) => (
                        <th
                          key={key}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {results.data.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((value: any, j) => (
                          <td key={j} className="px-6 py-4 whitespace-nowrap text-sm">
                            {value?.toString() || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p>No results found</p>
          )}
        </div>
      )}
    </div>
  );
} 