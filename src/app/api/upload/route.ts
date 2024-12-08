import { writeFile } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
  const data = await request.formData();
  const file: File | null = data.get('file') as unknown as File;

  if (!file) {
    return NextResponse.json({ success: false, message: 'No file uploaded' });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Ensure the uploads directory exists
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');

  try {
    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate a unique filename
    const uniqueFilename = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadDir, uniqueFilename);

    await writeFile(filePath, buffer);

    return NextResponse.json({ success: true, filename: uniqueFilename });
  } catch (error) {
    console.error('Error writing file:', error);
    return new NextResponse(JSON.stringify({ success: false, message: 'Failed to write file' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}