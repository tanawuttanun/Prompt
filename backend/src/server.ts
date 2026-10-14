import { createApp } from './app.js';
import { config } from './config.js';
import { seed } from './store/seed.js';

seed();

createApp().listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port} (in-memory data, reset on restart)`);
  if (!config.geminiApiKey) console.log('AI features off: set GEMINI_API_KEY in backend/.env to enable them');
});
