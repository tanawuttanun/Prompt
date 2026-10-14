import { Router } from 'express';

import { clearSessionCookie, currentUser, handle, requireAuth, setSessionCookie } from '../middleware/auth.js';
import { readStoredFile } from '../middleware/upload.js';
import { notFound } from '../errors/apiError.js';
import { toPublicUser } from '../types/user.js';
import * as auth from '../services/authService.js';
import * as orders from '../services/orderService.js';
import { findProduct, getAllProducts, getBestSellers, getBusinessesAvailability, getStockSummary } from '../services/productService.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ data: { status: 'ok', storage: 'memory', time: new Date().toISOString() } });
});

// ---------- catalogue ----------
apiRouter.get('/products', handle(async (_req, res) => res.json(await getAllProducts())));
apiRouter.get('/products/best-sellers', handle(async (req, res) => res.json({ data: await getBestSellers(Number(req.query.limit) || 8) })));
apiRouter.get('/products/:business/:id', handle(async (req, res) => {
  const { product, available } = await findProduct(req.params.business!, req.params.id!);
  if (!product) throw notFound('PRODUCT_NOT_FOUND', available ? 'Product not found' : 'This store is not reachable right now');
  res.json({ data: product });
}));
apiRouter.get('/businesses', handle(async (_req, res) => res.json({ data: await getBusinessesAvailability() })));
apiRouter.get('/stock/summary', handle(async (_req, res) => res.json({ data: await getStockSummary() })));

// Public uploaded images (product and profile photos). Claim evidence is never
// served here: it goes through the owner-checked claims endpoint.
apiRouter.get('/files/:folder/:name', (req, res, next) => {
  const { folder, name } = req.params;
  if (folder !== 'products' && folder !== 'profiles') return next(notFound('NOT_FOUND', 'File not found'));
  const file = readStoredFile(`${folder}/${name}`);
  if (!file) return next(notFound('NOT_FOUND', 'File not found'));
  res.setHeader('Content-Type', file.mime);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(file.buffer);
});

// ---------- auth ----------
apiRouter.post('/auth/register', handle(async (req, res) => {
  const user = await auth.register(req.body ?? {});
  setSessionCookie(res, user);
  res.status(201).json({ data: toPublicUser(user) });
}));
apiRouter.post('/auth/login', handle(async (req, res) => {
  const user = await auth.login(req.body ?? {});
  setSessionCookie(res, user);
  res.json({ data: toPublicUser(user) });
}));
apiRouter.post('/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ data: { signed_out: true } });
});
// Restores the session: the public profile, or null when signed out.
apiRouter.get('/auth/me', (req, res) => {
  res.json({ data: req.user ? toPublicUser(req.user) : null });
});

// ---------- orders ----------
apiRouter.post('/orders', requireAuth, handle(async (req, res) => {
  const order = await orders.placeOrder(currentUser(req), req.body ?? {});
  res.status(201).json({ data: orders.orderWithItems(order) });
}));
apiRouter.get('/orders', requireAuth, handle((req, res) => res.json({ data: orders.listMyOrders(currentUser(req)) })));
apiRouter.get('/orders/:orderNo', requireAuth, handle((req, res) => {
  const order = orders.getMyOrder(currentUser(req), req.params.orderNo!);
  res.json({ data: { ...orders.orderWithItems(order), claim_eligibility: orders.claimEligibility(order) } });
}));
apiRouter.get('/orders/:orderNo/warranty-document', requireAuth, handle((req, res) => {
  res.json({ data: orders.warrantyDocument(orders.getMyOrder(currentUser(req), req.params.orderNo!)) });
}));
apiRouter.get('/orders/:orderNo/claimable-items', requireAuth, handle((req, res) => {
  const order = orders.getMyOrder(currentUser(req), req.params.orderNo!);
  res.json({
    data: {
      order_no: order.order_no,
      eligibility: orders.claimEligibility(order),
      items: orders.claimableItems(order).filter(i => i.claimable_quantity > 0),
    },
  });
}));
