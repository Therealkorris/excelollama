import { Tool } from './tool';
import * as XLSX from 'xlsx';

interface ExcelRow {
  [key: string]: string | number | null;
}

// Create Excel-specific tools
export const createExcelTools = (filePath: string): Tool[] => {
  return [
    {
      name: 'read_excel_headers',
      description: 'Get the column headers from the Excel file',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      execute: async () => {
        try {
          const workbook = XLSX.readFile(filePath);
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
          return JSON.stringify(data);
        } catch (error) {
          return `Error reading Excel headers: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }
    },
    {
      name: 'analyze_excel_data',
      description: 'Analyze data from the Excel file',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            description: 'Type of analysis (sum, average, count, min, max)',
            enum: ['sum', 'average', 'count', 'min', 'max']
          },
          column: {
            type: 'string',
            description: 'Column to analyze'
          }
        },
        required: ['operation', 'column']
      },
      execute: async (args: Record<string, any>) => {
        try {
          const workbook = XLSX.readFile(filePath);
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];
          
          const values = data
            .map(row => row[args.column])
            .filter((val): val is number => typeof val === 'number');
          
          switch (args.operation) {
            case 'sum':
              return String(values.reduce((a, b) => a + b, 0));
            case 'average':
              return String(values.reduce((a, b) => a + b, 0) / values.length);
            case 'count':
              return String(values.length);
            case 'min':
              return String(Math.min(...values));
            case 'max':
              return String(Math.max(...values));
            default:
              return 'Invalid operation';
          }
        } catch (error) {
          return `Error analyzing Excel data: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }
    }
  ];
};

// Create calculator tool
const createCalculatorTool = (): Tool => {
  return {
    name: 'calculator',
    description: 'Useful for performing mathematical calculations',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'The mathematical expression to evaluate'
        }
      },
      required: ['expression']
    },
    execute: async (args: Record<string, any>) => {
      try {
        // Simple and safe eval for basic math
        const result = Function('"use strict";return (' + args.expression + ')')();
        return String(result);
      } catch (error) {
        return `Error calculating: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
  };
};

// Create general-purpose tools
export const createGeneralTools = (): Tool[] => {
  return [createCalculatorTool()];
}; 