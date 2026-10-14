import { Router } from 'express';

import { handle } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import * as ai from '../services/ai/aiService.js';
import { aiConfigured } from '../services/ai/geminiClient.js';

export const aiRouter = Router();
// lets the storefront hide AI components up front instead of probing with a failing call
aiRouter.get('/status', (_req, res) => res.json({ data: { configured: aiConfigured() } }));
aiRouter.use(rateLimit(20, 60_000)); // protects the API quota: 20 requests/minute per IP

aiRouter.post('/search', handle(async (req, res) => res.json({ data: await ai.aiSearch(req.body ?? {}) })));
// req.user comes only from the verified session cookie
aiRouter.post('/chat', handle(async (req, res) => res.json({ data: await ai.aiChat(req.body ?? {}, req.user) })));
aiRouter.get('/recommend/:productId', handle(async (req, res) => res.json({ data: await ai.aiRecommend(req.params.productId!, req.query.business) })));
aiRouter.post('/describe', handle(async (req, res) => res.json({ data: await ai.aiDescribe(req.body ?? {}) })));
