import { NextRequest, NextResponse } from 'next/server';

interface Tag {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

interface TagsResponse {
  models: Tag[];
}

export async function GET(req: NextRequest) {
  try {
    if (!process.env.OLLAMA_URL) {
      throw new Error('OLLAMA_URL environment variable is not set');
    }

    const response = await fetch(`${process.env.OLLAMA_URL}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch tags from Ollama API: ${response.statusText}`);
    }

    const data: TagsResponse = await response.json();

    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return new NextResponse(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch tags' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 