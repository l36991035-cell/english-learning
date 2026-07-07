const DEFAULT_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });

    try {
      const { model, system, messages, imageBase64, mediaType, max_tokens } = await request.json();

      if (!messages || messages.length === 0) return new Response(JSON.stringify({ error: 'messages required' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });

      let finalMessages = messages;
      if (imageBase64) {
        const last = messages[messages.length - 1];
        finalMessages = [
          ...messages.slice(0, -1),
          {
            role: last.role,
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType ?? 'image/jpeg', data: imageBase64 } },
              { type: 'text', text: last.content },
            ],
          },
        ];
      }

      const res = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: model ?? DEFAULT_MODEL,
          max_tokens: max_tokens ?? 2048,
          messages: finalMessages,
          ...(system ? { system } : {}),
        }),
      });

      const data = await res.json();
      const content = (data.content ?? []).filter(c => c.type === 'text').map(c => c.text).join('');

      return new Response(JSON.stringify({ content }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
