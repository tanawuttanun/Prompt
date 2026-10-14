import 'dotenv/config';

export type PartnerConfig = { key: string; name: string; url: string };

// PARTNER_APIS="key|Display Name|https://host/api/products,key2|Name 2|https://..."
function parsePartners(raw: string | undefined): PartnerConfig[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .flatMap(entry => {
      const [key, name, url] = entry.split('|').map(part => part?.trim() ?? '');
      return key && name && url ? [{ key: key.toLowerCase(), name, url }] : [];
    });
}

const jwtSecret = process.env.JWT_SECRET ?? '';
if (jwtSecret.length < 16) {
  throw new Error('JWT_SECRET is missing or too short. Copy backend/.env.example to backend/.env and set it.');
}

export const config = {
  port: Number(process.env.API_PORT ?? 3000),
  isProduction: process.env.NODE_ENV === 'production',
  jwtSecret,
  claimWindowDays: Math.max(0, Number(process.env.CLAIM_WINDOW_DAYS ?? 90) || 0),
  partners: parsePartners(process.env.PARTNER_APIS),
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() ?? '',
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash',
};
