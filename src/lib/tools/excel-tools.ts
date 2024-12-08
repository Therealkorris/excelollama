import { Tool } from './tool';
import * as XLSX from 'xlsx';
import path from 'path';

interface ExcelRow {
  [key: string]: string | number | boolean | null;
}

interface Summary {
  count: number;
  uniqueValues: number;
  hasNulls: boolean;
}

interface AggregateResult {
  [key: string]: number;
}

export const readExcelTool: Tool = {
  name: 'read_excel',
  description: 'Read data from an Excel or CSV file',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the Excel or CSV file relative to the workspace',
      },
      sheet: {
        type: 'string',
        description: 'Sheet name (optional, defaults to first sheet)',
      },
    },
    required: ['filePath'],
  },
  execute: async (args: Record<string, any>) => {
    try {
      const filePath = path.join(process.cwd(), 'public', 'uploads', args.filePath);
      const workbook = XLSX.readFile(filePath);
      const sheetName = args.sheet || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);
      return JSON.stringify(data);
    } catch (error) {
      console.error('Error reading Excel file:', error);
      throw new Error(`Failed to read Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};

export const writeExcelTool: Tool = {
  name: 'write_excel',
  description: 'Write data to an Excel file',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path where to save the Excel file relative to the workspace',
      },
      data: {
        type: 'string',
        description: 'JSON string of data to write to Excel',
      },
      sheet: {
        type: 'string',
        description: 'Sheet name (optional, defaults to "Sheet1")',
      },
    },
    required: ['filePath', 'data'],
  },
  execute: async (args: Record<string, any>) => {
    try {
      const data = JSON.parse(args.data) as ExcelRow[];
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, args.sheet || 'Sheet1');
      
      const filePath = path.join(process.cwd(), 'public', 'uploads', args.filePath);
      XLSX.writeFile(workbook, filePath);
      
      return `Successfully wrote data to ${args.filePath}`;
    } catch (error) {
      console.error('Error writing Excel file:', error);
      throw new Error(`Failed to write Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
};

export const analyzeExcelTool: Tool = {
  name: 'analyze_excel',
  description: 'Analyze data from an Excel or CSV file',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the Excel or CSV file relative to the workspace',
      },
      operation: {
        type: 'string',
        description: 'Type of analysis to perform (summary, filter, sort, aggregate)',
      },
      column: {
        type: 'string',
        description: 'Column name to analyze',
      },
      criteria: {
        type: 'string',
        description: 'Criteria for filtering or aggregation (optional)',
      },
    },
    required: ['filePath', 'operation', 'column'],
  },
  execute: async (args: Record<string, any>) => {
    try {
      const filePath = path.join(process.cwd(), 'public', 'uploads', args.filePath);
      const workbook = XLSX.readFile(filePath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

      switch (args.operation.toLowerCase()) {
        case 'summary': {
          const summary: Summary = {
            count: data.length,
            uniqueValues: new Set(data.map(row => row[args.column])).size,
            hasNulls: data.some(row => row[args.column] == null),
          };
          return JSON.stringify(summary);
        }

        case 'filter': {
          if (!args.criteria) throw new Error('Criteria required for filtering');
          const filtered = data.filter(row => {
            const value = row[args.column];
            return value != null && String(value).toLowerCase().includes(args.criteria.toLowerCase());
          });
          return JSON.stringify(filtered);
        }

        case 'sort': {
          const sorted = [...data].sort((a, b) => {
            const valueA = a[args.column];
            const valueB = b[args.column];
            
            if (valueA == null) return 1;
            if (valueB == null) return -1;
            
            if (typeof valueA === 'number' && typeof valueB === 'number') {
              return valueA - valueB;
            }
            
            return String(valueA).localeCompare(String(valueB));
          });
          return JSON.stringify(sorted);
        }

        case 'aggregate': {
          if (!args.criteria) throw new Error('Criteria required for aggregation');
          const aggregated = data.reduce<AggregateResult>((acc, row) => {
            const key = String(row[args.column] ?? 'Unknown');
            const value = Number(row[args.criteria]) || 0;
            acc[key] = (acc[key] || 0) + value;
            return acc;
          }, {});
          return JSON.stringify(aggregated);
        }

        default:
          throw new Error(`Unsupported operation: ${args.operation}`);
      }
    } catch (error) {
      console.error('Error analyzing Excel file:', error);
      throw new Error(`Failed to analyze Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
}; 