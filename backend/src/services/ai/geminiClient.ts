// The only module that knows about the AI provider; swap it to change providers.
import { config } from '../../config.js';
import { ApiError } from '../../errors/apiError.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 20_000;

export const aiConfigured = () => config.geminiApiKey.length > 0;

export function assertAiConfigured() {
  if (!aiConfigured()) throw new ApiError(503, 'AI_NOT_CONFIGURED', 'AI features are not configured on this server');
}

type Turn = { role: 'user' | 'model'; text: string };

async function generate(turns: Turn[], options: { system?: string; json?: boolean }) {
  assertAiConfigured();
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${encodeURIComponent(config.geminiModel)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': config.geminiApiKey },
      body: JSON.stringify({
        ...(options.system ? { systemInstruction: { parts: [{ text: options.system }] } } : {}),
        contents: turns.map(t => ({ role: t.role, parts: [{ text: t.text }] })),
        generationConfig: { temperature: 0.4, ...(options.json ? { responseMimeType: 'application/json' } : {}) },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(502, 'AI_UNAVAILABLE', 'The AI service could not be reached');
  }
  if (!response.ok) {
    if (response.status === 404) console.warn(`[ai] 404 MODEL_NOT_FOUND for model "${config.geminiModel}"`);
    else console.warn(`[ai] Gemini answered HTTP ${response.status}`);
    throw new ApiError(502, 'AI_UNAVAILABLE', 'The AI service returned an error');
  }
  const body = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = body.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
  if (!text) throw new ApiError(502, 'AI_UNAVAILABLE', 'The AI service returned an empty answer');
  return text;
}

export const generateText = (turns: Turn[], system?: string) => generate(turns, { system });

// Returns parsed JSON, or null when the model's answer is not valid JSON.
export async function generateJson(prompt: string, system?: string): Promise<unknown> {
  const text = await generate([{ role: 'user', text: prompt }], { system, json: true });
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return null;
  }
}
