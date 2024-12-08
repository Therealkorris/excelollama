import { z } from 'zod';
import { Tool } from '../tool';

export interface BaseTool<T extends z.ZodObject<any> = z.ZodObject<any>> {
  name: string;
  description: string;
  schema: T;
  execute: (args: Record<string, any>) => Promise<string>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

// Common schema types
export const StringSchema = z.string();
export const NumberSchema = z.number();
export const BooleanSchema = z.boolean();
export const ArraySchema = z.array;
export const ObjectSchema = z.object;

// Shared schemas for common tool parameters
export const FilePathSchema = z.object({
  filePath: z.string().describe('Path to the file')
});

export const SheetNameSchema = z.object({
  sheetName: z.string().optional().describe('Name of the worksheet (optional)')
});

export const ColumnSchema = z.object({
  column: z.string().describe('Name of the column to analyze')
});

export const OperationSchema = z.object({
  operation: z.enum(['sum', 'average', 'count', 'min', 'max'])
    .describe('Type of analysis operation to perform')
});

// Helper function to create a tool result
export function createToolResult(success: boolean, data?: any, error?: string): string {
  const result: ToolResult = {
    success,
    ...(data && { data }),
    ...(error && { error })
  };
  return JSON.stringify(result);
}

// Helper function to safely parse JSON
export function safeJsonParse(json: string): { success: boolean; data?: any; error?: string } {
  try {
    return { success: true, data: JSON.parse(json) };
  } catch (error) {
    return { 
      success: false, 
      error: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Helper function to validate tool arguments
export async function validateToolArgs<T extends z.ZodObject<any>>(
  schema: T,
  args: Record<string, any>
): Promise<{ success: boolean; data?: z.infer<T>; error?: string }> {
  try {
    const validatedArgs = await schema.parseAsync(args);
    return { success: true, data: validatedArgs };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      };
    }
    return { 
      success: false, 
      error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Adapter function to convert BaseTool to Tool
export function baseToolToTool(baseTool: BaseTool): Tool {
  return {
    name: baseTool.name,
    description: baseTool.description,
    parameters: {
      type: "object",
      properties: baseTool.schema.shape,
      required: Object.keys(baseTool.schema.shape)
    },
    execute: baseTool.execute
  };
} 