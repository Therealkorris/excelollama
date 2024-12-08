import { Tool } from '../tools/tool';
import { ExcelAnalyzer } from '../tools/excel-tools';
import { ChatMode } from './types';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OllamaAgent {
  private baseUrl: string;
  private tools: Tool[];
  private excelAnalyzer: ExcelAnalyzer;
  private messages: OllamaMessage[] = [];
  private currentMode: ChatMode = ChatMode.NORMAL;
  private supportedModes: ChatMode[];

  constructor(tools: Tool[] = [], excelAnalyzer: ExcelAnalyzer) {
    this.baseUrl = process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL;
    this.tools = tools;
    this.excelAnalyzer = excelAnalyzer;
    this.supportedModes = [ChatMode.NORMAL, ChatMode.STRUCTURED, ChatMode.TOOL_BASED];
    
    // Initialize with base system prompt
    this.messages = [{
      role: 'system',
      content: this.getBaseSystemPrompt()
    }];
  }

  setMode(mode: ChatMode) {
    if (!this.supportedModes.includes(mode)) {
      throw new Error(`Mode ${mode} not supported by this agent`);
    }
    this.currentMode = mode;
    // Update system prompt when mode changes
    this.messages[0] = {
      role: 'system',
      content: this.getBaseSystemPrompt()
    };
  }

  private getBaseSystemPrompt(): string {
    const basePrompt = `You are an SQL expert. Generate ONLY the SQL query needed to answer the question.
    
    QUERY RULES:
    1. Return ONLY the SQL query, nothing else
    2. Do not include any explanations
    3. Do not use markdown formatting
    4. End the query with a semicolon
    5. Use only valid SQLite syntax
    6. String comparisons should be case insensitive (use LOWER())
    
    Example valid queries:
    SELECT item_name, npc_sell_name, npc_sell_price FROM excel_data WHERE LOWER(item_name) LIKE LOWER('%sword%');
    SELECT npc_sell_location FROM excel_data WHERE LOWER(item_name) = LOWER('stone skin amulet');`;

    if (this.currentMode === ChatMode.TOOL_BASED) {
      return `${basePrompt}\n\nAvailable tools:\n${this.tools.map(tool => 
        `${tool.name}: ${tool.description}\nParameters: ${JSON.stringify(tool.parameters, null, 2)}`
      ).join('\n\n')}`;
    }

    return basePrompt;
  }

  private updateSystemPromptWithSchema() {
    try {
      const schema = this.excelAnalyzer.getSchema();
      const systemPrompt = `You are an SQL expert. Generate ONLY the SQL query needed to answer the question.
      
      IMPORTANT DATABASE DETAILS:
      - There is only ONE table named 'excel_data'
      - The table has EXACTLY these columns (case sensitive): ${schema}
      - Column names must match EXACTLY as shown above
      - Do not reference any other tables or columns that don't exist
      - All queries must use only the 'excel_data' table
      
      QUERY RULES:
      1. Return ONLY the SQL query, nothing else
      2. Do not include any explanations
      3. Do not use markdown formatting
      4. End the query with a semicolon
      5. Use only valid SQLite syntax
      6. Only reference columns that exist in the schema above
      7. Never use JOIN since there is only one table
      8. Column names are case sensitive
      9. String comparisons should be case insensitive (use LOWER())
      
      Example valid queries:
      SELECT item_name, npc_sell_name, npc_sell_price FROM excel_data WHERE LOWER(item_name) LIKE LOWER('%sword%');
      SELECT npc_sell_location FROM excel_data WHERE LOWER(item_name) = LOWER('stone skin amulet');`;

      // Update the system message with schema information
      this.messages[0] = {
        role: 'system',
        content: this.currentMode === ChatMode.TOOL_BASED 
          ? `${systemPrompt}\n\nAvailable tools:\n${this.tools.map(tool => 
              `${tool.name}: ${tool.description}\nParameters: ${JSON.stringify(tool.parameters, null, 2)}`
            ).join('\n\n')}`
          : systemPrompt
      };
    } catch (error) {
      console.error('Error updating system prompt:', error);
      // Keep existing prompt if schema update fails
    }
  }

  async chat(message: string): Promise<{
    success: boolean;
    response?: string;
    error?: string;
    data?: any;
    query?: string;
  }> {
    try {
      // Update system prompt with current schema before processing message
      this.updateSystemPromptWithSchema();

      // Add user message
      this.messages.push({
        role: 'user',
        content: `Write a SQL query to answer: ${message}\nRemember to use ONLY the excel_data table and its exact column names.`
      });

      // Get SQL query from Ollama
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mistral',
          messages: this.messages,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Ollama');
      }

      const data = await response.json();
      const sqlQuery = data.message.content.trim();

      // Execute the SQL query
      const result = await this.excelAnalyzer.query(sqlQuery);

      // Add assistant's response to message history
      this.messages.push({
        role: 'assistant',
        content: sqlQuery
      });

      if (result.success) {
        return {
          success: true,
          response: 'Query executed successfully',
          data: result.data,
          query: sqlQuery
        };
      } else {
        return {
          success: false,
          error: result.error,
          query: sqlQuery
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  clearContext() {
    // Reset to base system prompt
    this.messages = [{
      role: 'system',
      content: this.getBaseSystemPrompt()
    }];
  }
}