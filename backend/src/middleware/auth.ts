import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';

import { config } from '../config.js';
import { ApiError } from '../errors/apiError.js';
import { findUserById } from '../repositories/userRepository.js';
import type { Role, User } from '../types/user.js';

export const SESSION_COOKIE = 'delux_session';
const SESSION_DAYS = 7;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

type TokenPayload = { sub: string; role: Role };

export function setSessionCookie(res: Response, user: User) {
  const token = jwt.sign({ role: user.role } satisfies Omit<TokenPayload, 'sub'>, config.jwtSecret, {
    subject: String(user.id),
    expiresIn: `${SESSION_DAYS}d`,
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: SESSION_DAYS * 86_400_000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

// Attaches req.user when a valid session cookie is present; never fails the request.
// The user id always comes from the verified token, never from the request body.
export const loadSession: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token === 'string') {
    try {
      const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
      const user = findUserById(Number(payload.sub));
      if (user) req.user = user;
    } catch {
      // invalid or expired token: treated as signed out
    }
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new ApiError(401, 'UNAUTHORIZED', 'Please sign in to continue'));
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new ApiError(401, 'UNAUTHORIZED', 'Please sign in to continue'));
  if (req.user.role !== 'admin') return next(new ApiError(403, 'FORBIDDEN', 'Administrator access required'));
  next();
};

// Lets async handlers throw ApiError instead of calling next() by hand.
export const handle =
  (fn: (req: Request, res: Response) => unknown | Promise<unknown>): RequestHandler =>
  (req, res, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

export const currentUser = (req: Request): User => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in to continue');
  return req.user;
};
