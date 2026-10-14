import { Route, Routes } from 'react-router-dom';

import { AdminRoute, ProtectedRoute } from './components/guards';
import { Layout } from './components/Layout';
import Landing from './landing/Landing';
import AdminClaims, { AdminClaimDetail } from './pages/admin/AdminClaims';
import AdminLayout from './pages/admin/AdminLayout';
import { AdminBusinesses, AdminCategories, AdminProducts, AdminUsers } from './pages/admin/AdminManage';
import AdminOrders, { AdminOrderDetail } from './pages/admin/AdminOrders';
import Dashboard, { AdminAnalytics } from './pages/admin/Dashboard';
import { Login, Register } from './pages/Auth';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Claims, { ClaimDetail, ClaimForm } from './pages/Claims';
import Orders, { OrderDetail } from './pages/Orders';
import ProductDetail from './pages/ProductDetail';
import Products from './pages/Products';
import Profile, { Favorites, NotFound } from './pages/Profile';
import Warranty from './pages/Warranty';

const guard = (el: JSX.Element) => <ProtectedRoute>{el}</ProtectedRoute>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<Layout />}>
        <Route path="/products" element={<Products />} />
        <Route path="/products/:business/:id" element={<ProductDetail />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/checkout" element={guard(<Checkout />)} />
        <Route path="/orders" element={guard(<Orders />)} />
        <Route path="/orders/:orderNo" element={guard(<OrderDetail />)} />
        <Route path="/orders/:orderNo/warranty" element={guard(<Warranty />)} />
        <Route path="/orders/:orderNo/claim" element={guard(<ClaimForm />)} />
        <Route path="/claims" element={guard(<Claims />)} />
        <Route path="/claims/:claimNo" element={guard(<ClaimDetail />)} />
        <Route path="/profile" element={guard(<Profile />)} />
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:orderNo" element={<AdminOrderDetail />} />
          <Route path="claims" element={<AdminClaims />} />
          <Route path="claims/:claimNo" element={<AdminClaimDetail />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="businesses" element={<AdminBusinesses />} />
          <Route path="analytics" element={<AdminAnalytics />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
