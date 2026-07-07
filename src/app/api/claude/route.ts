import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { messages, model = 'claude-sonnet-4-6', system, imageBase64, mediaType = 'image/jpeg' } =
      await req.json();

    if (imageBase64 && !messages?.length) {
      return NextResponse.json({ content: '', error: 'messages required' }, { status: 400 });
    }

    const processed = imageBase64
      ? [
          {
            role: 'user' as const,
            content: [
              { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: imageBase64 } },
              { type: 'text' as const, text: typeof messages[0].content === 'string' ? messages[0].content : '' },
            ],
          },
          ...messages.slice(1),
        ]
      : messages;

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      ...(system ? { system } : {}),
      messages: processed,
    });

    const content = response.content[0]?.type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json({ content: '', error: 'Claude API error' }, { status: 500 });
  }
}
