const AI_URL = process.env.NEXT_PUBLIC_AI_WORKER_URL ?? '/api/claude';

interface AIRequest {
  model?: string;
  system?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  imageBase64?: string;
  mediaType?: string;
}

export async function callAI(req: AIRequest): Promise<string> {
  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const data = await res.json();
  return data.content as string;
}
