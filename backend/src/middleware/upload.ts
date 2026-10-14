import { randomUUID } from 'node:crypto';

import type { ErrorRequestHandler } from 'express';
import multer from 'multer';

import { ApiError, badRequest } from '../errors/apiError.js';
import { db } from '../store/db.js';
import { ALLOWED_IMAGE_TYPES, sniffImageType } from '../utils/index.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Files are held in memory (no disk, no database) and checked before being kept.
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 5 },
});

// Translates multer's own errors into the API's error shape.
export const uploadErrors: ErrorRequestHandler = (error, _req, _res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') return next(new ApiError(413, 'EVIDENCE_TOO_LARGE', 'Each photo must be 5 MB or smaller'));
    if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') return next(badRequest('INVALID_EVIDENCE', 'Attach at most 5 photos'));
    return next(badRequest('INVALID_EVIDENCE', error.message));
  }
  next(error);
};

// Validates an uploaded image by its magic bytes and stores it under a generated
// name; the client's filename is discarded entirely.
export function storeImage(file: Express.Multer.File, prefix: string, invalidCode = 'INVALID_EVIDENCE') {
  const sniffed = sniffImageType(file.buffer);
  if (!sniffed || !ALLOWED_IMAGE_TYPES.includes(file.mimetype) || sniffed !== file.mimetype) {
    throw badRequest(invalidCode, 'Only real JPEG, PNG or WEBP images are accepted');
  }
  const ext = sniffed === 'image/jpeg' ? 'jpg' : sniffed.slice(6);
  const name = `${prefix}/${randomUUID()}.${ext}`;
  db.files.set(name, { buffer: file.buffer, mime: sniffed });
  return { name, mime: sniffed, size: file.size };
}

export const readStoredFile = (name: string) => db.files.get(name);
export const deleteStoredFile = (name: string) => db.files.delete(name);
