import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  console.log("OLLAMA_URL:", process.env.OLLAMA_URL); // Debugging line
  try {
    const response = await fetch(`${process.env.OLLAMA_URL}/api/tags`);
    if (!response.ok) {
      throw new Error('Failed to fetch models from Ollama API');
    }
    const data = await response.json();
    const modelNames = data.models.map((model: { name: string }) => model.name);
    return NextResponse.json(modelNames);
  } catch (error) {
    console.error(error);
    return new NextResponse(JSON.stringify({ error: 'Failed to fetch models' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}