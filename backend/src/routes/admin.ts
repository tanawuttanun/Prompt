import { Router } from 'express';

import { badRequest } from '../errors/apiError.js';
import { currentUser, handle, requireAdmin } from '../middleware/auth.js';
import { imageUpload, storeImage } from '../middleware/upload.js';
import * as crud from '../services/adminCrudService.js';
import * as admin from '../services/adminService.js';
import * as claims from '../services/claimService.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin); // every /api/admin/* route requires the signed admin role

const id = (v: string | undefined) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw badRequest('VALIDATION_ERROR', 'Invalid id');
  return n;
};

adminRouter.get('/dashboard', handle((_req, res) => res.json({ data: admin.dashboard() })));
adminRouter.get('/analytics', handle((req, res) => res.json({ data: admin.analytics(req.query) })));

// orders
adminRouter.get('/orders', handle((req, res) => {
  const { items, pagination } = admin.adminListOrders(req.query);
  res.json({ data: items, pagination });
}));
adminRouter.get('/orders/:orderNo', handle((req, res) => res.json({ data: admin.adminGetOrder(req.params.orderNo!) })));
adminRouter.patch('/orders/:orderNo/status', handle((req, res) => {
  res.json({ data: admin.adminUpdateOrderStatus(req.params.orderNo!, req.body ?? {}) });
}));
adminRouter.put('/orders/:orderNo', handle((req, res) => res.json({ data: crud.adminUpdateOrderShipping(req.params.orderNo!, req.body ?? {}) })));
adminRouter.delete('/orders/:orderNo', handle((req, res) => {
  crud.adminDeleteOrder(req.params.orderNo!);
  res.json({ data: { deleted: true } });
}));

// claims
adminRouter.get('/claims', handle((req, res) => {
  const { items, pagination } = claims.adminListClaims(req.query);
  res.json({ data: items, pagination });
}));
adminRouter.get('/claims/stats', handle((_req, res) => res.json({ data: claims.adminClaimStats() })));
adminRouter.get('/claims/:claimNo', handle((req, res) => res.json({ data: claims.adminClaimView(claims.adminGetClaim(req.params.claimNo!)) })));
adminRouter.patch('/claims/:claimNo/status', handle((req, res) => {
  res.json({ data: claims.adminUpdateClaimStatus(currentUser(req), req.params.claimNo!, req.body ?? {}) });
}));
adminRouter.delete('/claims/:claimNo', handle((req, res) => {
  crud.adminDeleteClaim(req.params.claimNo!);
  res.json({ data: { deleted: true } });
}));

// products (the store's own catalogue)
adminRouter.get('/product-options', handle((_req, res) => res.json({ data: admin.productOptions() })));
adminRouter.get('/products', handle((_req, res) => res.json({ data: admin.adminListProducts() })));
adminRouter.post('/products/upload-image', imageUpload.single('image'), handle((req, res) => {
  if (!req.file) throw badRequest('INVALID_IMAGE', 'Choose an image to upload');
  const stored = storeImage(req.file, 'products', 'INVALID_IMAGE');
  res.status(201).json({ data: { image_url: `/api/files/${stored.name}` } });
}));
adminRouter.get('/products/:business/:id', handle((req, res) => res.json({ data: admin.adminGetProduct(req.params.business!, id(req.params.id)) })));
adminRouter.post('/products', handle((req, res) => res.status(201).json({ data: admin.adminCreateProduct(req.body ?? {}) })));
adminRouter.put('/products/:business/:id', handle((req, res) => {
  res.json({ data: admin.adminUpdateProduct(req.params.business!, id(req.params.id), req.body ?? {}) });
}));
adminRouter.delete('/products/:business/:id', handle((req, res) => {
  admin.adminDeleteProduct(req.params.business!, id(req.params.id));
  res.json({ data: { deleted: true } });
}));

// users
adminRouter.get('/users', handle((_req, res) => res.json({ data: admin.adminListUsers() })));
adminRouter.post('/users', handle(async (req, res) => res.status(201).json({ data: await admin.adminCreateUser(req.body ?? {}) })));
adminRouter.put('/users/:id', handle(async (req, res) => res.json({ data: await admin.adminUpdateUser(currentUser(req), id(req.params.id), req.body ?? {}) })));
adminRouter.delete('/users/:id', handle((req, res) => {
  admin.adminDeleteUser(currentUser(req), id(req.params.id));
  res.json({ data: { deleted: true } });
}));

// businesses
adminRouter.get('/businesses', handle((_req, res) => res.json({ data: admin.adminListBusinesses() })));
adminRouter.post('/businesses', handle((req, res) => res.status(201).json({ data: crud.adminCreateBusiness(req.body ?? {}) })));
adminRouter.put('/businesses/:id', handle((req, res) => res.json({ data: admin.adminUpdateBusiness(id(req.params.id), req.body ?? {}) })));
adminRouter.delete('/businesses/:id', handle((req, res) => {
  crud.adminDeleteBusiness(id(req.params.id));
  res.json({ data: { deleted: true } });
}));

// categories
adminRouter.get('/categories', handle((_req, res) => res.json({ data: crud.adminListCategories() })));
adminRouter.post('/categories', handle((req, res) => res.status(201).json({ data: crud.adminCreateCategory(req.body ?? {}) })));
adminRouter.put('/categories/:id', handle((req, res) => res.json({ data: crud.adminRenameCategory(id(req.params.id), req.body ?? {}) })));
adminRouter.delete('/categories/:id', handle((req, res) => {
  crud.adminDeleteCategory(id(req.params.id));
  res.json({ data: { deleted: true } });
}));
