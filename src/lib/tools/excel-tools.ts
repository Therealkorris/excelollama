import { Tool } from './tool';
import * as XLSX from 'xlsx';
import path from 'path';

interface ExcelRow {
  [key: string]: any;
}

export const readExcelTool: Tool = {
  name: 'read_excel',
  description: 'Read data from an Excel file',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the Excel file'
      },
      sheet: {
        type: 'string',
        description: 'Sheet name (optional)'
      }
    },
    required: ['filePath']
  },
  execute: async (args: Record<string, any>) => {
    try {
      const workbook = XLSX.readFile(args.filePath);
      const sheetName = args.sheet || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);
      return JSON.stringify(data);
    } catch (error) {
      return `Error reading Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

export const writeExcelTool: Tool = {
  name: 'write_excel',
  description: 'Write data to an Excel file',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to save the Excel file'
      },
      data: {
        type: 'array',
        items: {
          type: 'object'
        },
        description: 'Array of objects to write to Excel'
      },
      sheet: {
        type: 'string',
        description: 'Sheet name (optional)'
      }
    },
    required: ['filePath', 'data']
  },
  execute: async (args: Record<string, any>) => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(args.data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, args.sheet || 'Sheet1');
      XLSX.writeFile(workbook, args.filePath);
      return `Successfully wrote data to ${args.filePath}`;
    } catch (error) {
      return `Error writing Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
};

export const analyzeExcelTool: Tool = {
  name: 'analyze_excel',
  description: 'Analyze data from an Excel file and return insights',
  parameters: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Path to the Excel file'
      },
      analysis: {
        type: 'string',
        enum: ['summary', 'statistics', 'full'],
        description: 'Type of analysis to perform'
      }
    },
    required: ['filePath', 'analysis']
  },
  execute: async (args: Record<string, any>) => {
    try {
      const workbook = XLSX.readFile(args.filePath);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet) as ExcelRow[];

      switch (args.analysis) {
        case 'summary':
          return JSON.stringify({
            rowCount: data.length,
            columns: Object.keys(data[0] || {}),
            sampleData: data.slice(0, 5)
          });

        case 'statistics':
          const stats: Record<string, any> = {};
          Object.keys(data[0] || {}).forEach(col => {
            if (typeof data[0][col] === 'number') {
              const values = data.map(row => row[col]).filter(v => typeof v === 'number');
              stats[col] = {
                min: Math.min(...values),
                max: Math.max(...values),
                avg: values.reduce((a, b) => a + b, 0) / values.length
              };
            }
          });
          return JSON.stringify(stats);

        case 'full':
          return JSON.stringify({
            rowCount: data.length,
            columns: Object.keys(data[0] || {}),
            sampleData: data.slice(0, 5),
            statistics: Object.keys(data[0] || {}).reduce((acc, col) => {
              if (typeof data[0][col] === 'number') {
                const values = data.map(row => row[col]).filter(v => typeof v === 'number');
                acc[col] = {
                  min: Math.min(...values),
                  max: Math.max(...values),
                  avg: values.reduce((a, b) => a + b, 0) / values.length
                };
              }
              return acc;
            }, {} as Record<string, any>)
          });

        default:
          return 'Invalid analysis type';
      }
    } catch (error) {
      return `Error analyzing Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}; 