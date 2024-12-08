import { Tool } from './tool';
import * as XLSX from 'xlsx';
import type { Database } from 'sql.js';
import initSqlJs from 'sql.js/dist/sql-wasm.js';

interface ExcelAnalysisResult {
  success: boolean;
  data?: any[];
  error?: string;
  query?: string;
}

interface ExcelRow {
  [key: string]: string | number | boolean | null;
}

interface SqlResult {
  columns: string[];
  values: any[][];
}

let wasmBinaryPromise: Promise<ArrayBuffer> | null = null;

async function getWasmBinary() {
  if (!wasmBinaryPromise) {
    wasmBinaryPromise = fetch('/sql.js/sql-wasm.wasm')
      .then(response => response.arrayBuffer())
      .catch(error => {
        wasmBinaryPromise = null;
        throw error;
      });
  }
  return wasmBinaryPromise;
}

export class ExcelAnalyzer {
  private db: Database | null = null;
  private columnInfo: string[] = [];
  
  async initialize(fileBuffer: ArrayBuffer) {
    try {
      // Read Excel file
      const workbook = XLSX.read(fileBuffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];
      
      if (jsonData.length === 0) {
        throw new Error('Excel file is empty');
      }
      
      // Initialize SQL.js with WebAssembly
      const wasmBinary = await getWasmBinary();
      const SQL = await initSqlJs({
        wasmBinary,
        locateFile: () => '/sql.js/sql-wasm.wasm'
      });
      
      this.db = new SQL.Database();
      
      // Get column names and types
      const firstRow = jsonData[0];
      this.columnInfo = Object.keys(firstRow).map(key => {
        const value = firstRow[key];
        const type = typeof value === 'number' ? 'NUMERIC' : 'TEXT';
        return `${key.toLowerCase().replace(/\s+/g, '_')} ${type}`;
      });
      
      if (!this.db) {
        throw new Error('Failed to initialize database');
      }
      
      // Create table
      const createTableSQL = `CREATE TABLE excel_data (${this.columnInfo.join(', ')});`;
      this.db.run(createTableSQL);
      
      // Insert data
      jsonData.forEach((row: ExcelRow) => {
        if (!this.db) return;
        
        const columns = Object.keys(row);
        const values = columns.map(col => {
          const val = row[col];
          return typeof val === 'string' ? `'${val.replace(/'/g, "''")}'` : val;
        });
        
        const insertSQL = `INSERT INTO excel_data (${columns.join(', ')}) VALUES (${values.join(', ')});`;
        this.db.run(insertSQL);
      });
      
      return {
        success: true,
        rowCount: jsonData.length,
        columns: this.columnInfo
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize database'
      };
    }
  }
  
  async query(sql: string): Promise<ExcelAnalysisResult> {
    if (!this.db) {
      return { success: false, error: 'Database not initialized' };
    }
    
    try {
      const results = this.db.exec(sql) as SqlResult[];
      if (results.length === 0) {
        return { success: true, data: [], query: sql };
      }
      
      const columns = results[0].columns;
      const rows = results[0].values.map((row: any[]) => 
        Object.fromEntries(row.map((value: any, index: number) => [columns[index], value]))
      );
      
      return {
        success: true,
        data: rows,
        query: sql
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Query execution failed',
        query: sql
      };
    }
  }
  
  getSchema(): string {
    return this.columnInfo.join(', ');
  }
}

export const createExcelTools = (analyzer: ExcelAnalyzer): Tool[] => {
  return [
    {
      name: 'analyze_excel',
      description: 'Analyze Excel data using SQL queries',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'SQL query to execute on the Excel data'
          }
        },
        required: ['query']
      },
      execute: async (args: Record<string, any>) => {
        const result = await analyzer.query(args.query);
        return JSON.stringify(result);
      }
    },
    {
      name: 'get_excel_schema',
      description: 'Get the schema of the Excel data',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      execute: async () => {
        return JSON.stringify({
          success: true,
          schema: analyzer.getSchema()
        });
      }
    }
  ];
}; 