import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { AiChatWidget } from './ai';
import { Crest, Wordmark } from './Crest';
import { SparkleField } from './sparkle';

export function Layout() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  const toast = useToast();

  return (
    <div className="v-app">
      <SparkleField className="v-app-sparkles" count={16} />
      <header className="v-header">
        <div className="v-header-inner">
          <Link to="/" className="v-logo" aria-label="Delux Sport Club home">
            <Crest size={36} animated className="crest-glow" />
            <Wordmark />
          </Link>
          <nav className="v-nav" aria-label="Main">
            <NavLink to="/products">Shop</NavLink>
            <NavLink to="/favorites">Favorites</NavLink>
            {user && <NavLink to="/orders">My orders</NavLink>}
            {user && <NavLink to="/claims">My claims</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
          </nav>
          <div className="v-header-actions">
            <Link to="/cart" className="v-cart-link">
              Cart{count > 0 && <b>{count}</b>}
            </Link>
            {user ? (
              <>
                <Link to="/profile" className="v-btn v-btn-sm">{user.name.split(' ')[0]}</Link>
                <button
                  className="v-btn v-btn-sm"
                  onClick={async () => {
                    await logout();
                    toast('Signed out', { detail: 'See you on court soon.', icon: '👋' });
                    navigate('/');
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/login" className="v-btn v-btn-sm v-btn-primary">Sign in</Link>
            )}
          </div>
        </div>
      </header>
      <main className="v-main">
        <Outlet />
      </main>
      <footer className="v-footer">Delux Sport Club — demo store. Data is kept in memory and resets when the server restarts.</footer>
      <AiChatWidget />
    </div>
  );
}
