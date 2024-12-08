import { NextRequest, NextResponse } from 'next/server';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OllamaRequest {
  model: string;
  messages: Message[];
  stream: boolean;
  format?: "json";
  options?: Record<string, unknown>;
  template?: string;
  context?: unknown;
  response_format?: {
    type: "json_object";
  };
}

export async function POST(req: NextRequest) {
  const requestBody: OllamaRequest = await req.json();
  const { model, messages, stream, format, options, template, context, response_format } = requestBody;

  try {
    const response = await fetch(`${process.env.OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream,
        format,
        options,
        template,
        context,
        response_format
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API request failed with status ${response.status}`);
    }

    const data = await response.json();

    console.log("Ollama response data:", data); // Log the raw response data

    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error during Ollama chat:', error);
    return new NextResponse(JSON.stringify({ error: 'Failed to process Ollama chat' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}