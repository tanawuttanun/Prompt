import { Router } from 'express';

import { badRequest } from '../errors/apiError.js';
import { currentUser, handle, requireAuth } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';
import * as profile from '../services/profileService.js';

export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.get('/', handle((req, res) => res.json({ data: profile.getProfile(currentUser(req)) })));
profileRouter.put('/', handle((req, res) => res.json({ data: profile.updateProfile(currentUser(req), req.body ?? {}) })));
profileRouter.post('/image', imageUpload.single('image'), handle((req, res) => {
  if (!req.file) throw badRequest('INVALID_IMAGE', 'Choose an image to upload');
  res.json({ data: profile.setProfileImage(currentUser(req), req.file) });
}));
profileRouter.delete('/image', handle((req, res) => res.json({ data: profile.removeProfileImage(currentUser(req)) })));
