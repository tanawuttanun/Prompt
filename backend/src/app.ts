import cookieParser from 'cookie-parser';
import express, { type ErrorRequestHandler } from 'express';

import { ApiError } from './errors/apiError.js';
import { loadSession } from './middleware/auth.js';
import { uploadErrors } from './middleware/upload.js';
import { adminRouter } from './routes/admin.js';
import { aiRouter } from './routes/ai.js';
import { claimsRouter } from './routes/claims.js';
import { apiRouter } from './routes/index.js';
import { profileRouter } from './routes/profile.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(loadSession);

  app.use('/api/claims', claimsRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api', apiRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  app.use(uploadErrors);
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
      return;
    }
    if (error?.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON' } });
      return;
    }
    console.error(error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }); // never leak stack traces
  };
  app.use(errorHandler);
  return app;
}
