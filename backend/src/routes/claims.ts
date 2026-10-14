import { Router } from 'express';

import { currentUser, handle, requireAuth } from '../middleware/auth.js';
import { imageUpload, readStoredFile } from '../middleware/upload.js';
import { notFound } from '../errors/apiError.js';
import * as claims from '../services/claimService.js';

export const claimsRouter = Router();
claimsRouter.use(requireAuth);

claimsRouter.post('/', imageUpload.array('evidence', 5), handle((req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  res.status(201).json({ data: claims.submitClaim(currentUser(req), req.body ?? {}, files) });
}));

claimsRouter.get('/', handle((req, res) => {
  const { items, pagination } = claims.listMyClaims(currentUser(req), req.query);
  res.json({ data: items, pagination });
}));

claimsRouter.get('/:claimNo', handle((req, res) => res.json({ data: claims.getMyClaim(currentUser(req), req.params.claimNo!) })));

claimsRouter.post('/:claimNo/cancel', handle((req, res) => {
  res.json({ data: claims.cancelMyClaim(currentUser(req), req.params.claimNo!, req.body?.note) });
}));

claimsRouter.get('/:claimNo/evidence/:evidenceId', handle((req, res) => {
  const name = claims.evidenceFile(currentUser(req), req.params.claimNo!, Number(req.params.evidenceId));
  const file = readStoredFile(name);
  if (!file) throw notFound('EVIDENCE_NOT_FOUND', 'Evidence not found');
  res.setHeader('Content-Type', file.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(file.buffer);
}));
