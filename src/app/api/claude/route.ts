import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { messages, model = 'claude-haiku-4-5-20251001', system, imageBase64 } =
    await req.json();

  const processed = imageBase64
    ? [{
        role: 'user' as const,
        content: [
          { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: imageBase64 } },
          { type: 'text' as const, text: messages[0].content },
        ],
      }]
    : messages;

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    ...(system ? { system } : {}),
    messages: processed,
  });

  const content = response.content[0].type === 'text' ? response.content[0].text : '';
  return NextResponse.json({ content });
}
