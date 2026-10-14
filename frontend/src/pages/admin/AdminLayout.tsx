import { NavLink, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div className="v-admin">
      <nav className="v-admin-nav" aria-label="Admin">
        <NavLink end to="/admin">Dashboard</NavLink>
        <NavLink to="/admin/orders">Orders</NavLink>
        <NavLink to="/admin/claims">Claims</NavLink>
        <NavLink to="/admin/products">Products</NavLink>
        <NavLink to="/admin/categories">Categories</NavLink>
        <NavLink to="/admin/users">Users</NavLink>
        <NavLink to="/admin/businesses">Stores</NavLink>
        <NavLink to="/admin/analytics">Analytics</NavLink>
      </nav>
      <div style={{ minWidth: 0 }}>
        <Outlet />
      </div>
    </div>
  );
}
