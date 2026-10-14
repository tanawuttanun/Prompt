import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { Crest } from '../components/Crest';
import { SparkleField, sparkleBurst } from '../components/sparkle';
import { useAuth } from '../context/AuthContext';

const DISMISSED_KEY = 'delux_welcome_dismissed';
const SHOW_AFTER_MS = 3200; // after the entrance timeline has settled

const wasDismissed = () => {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

// A members' welcome card that springs up once per visit, with a sparkle burst.
export function WelcomePopup() {
  const { user } = useAuth();
  const [state, setState] = useState<'hidden' | 'shown' | 'leaving'>('hidden');
  const crestRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (wasDismissed()) return;
    const t = window.setTimeout(() => setState('shown'), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (state !== 'shown' || !crestRef.current) return;
    const el = crestRef.current;
    const t = window.setTimeout(() => sparkleBurst(el, 16), 450);
    return () => clearTimeout(t);
  }, [state]);

  const close = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // storage blocked: the popup simply may show again next visit
    }
    setState('leaving');
    window.setTimeout(() => setState('hidden'), 350);
  };

  if (state === 'hidden') return null;
  return (
    <aside className={`dx-popup ${state === 'leaving' ? 'leaving' : ''}`} role="dialog" aria-label="Welcome to Delux Sport Club">
      <SparkleField count={10} />
      <button className="dx-popup-close" aria-label="Close" onClick={close}>×</button>
      <div ref={crestRef} style={{ display: 'inline-block' }}>
        <Crest size={46} animated className="crest-glow" />
      </div>
      <h3 className="gold-text">{user ? `Welcome back, ${user.name.split(' ')[0]}` : 'Welcome to Delux'}</h3>
      <p>
        {user
          ? 'Your club pro shop is ready — new tennis and golf gear just landed.'
          : 'Join the club for member perks: free shipping over ฿1,500, 30-day returns and an AI concierge for your gear.'}
      </p>
      <div className="dx-popup-actions">
        <Link className="dx-btn dx-btn-gold" to={user ? '/products?category=Golf' : '/register'} onClick={close}>
          {user ? 'See golf gear' : 'Join the club'}
        </Link>
        <Link className="dx-btn" to="/products" onClick={close}>Browse the shop</Link>
      </div>
    </aside>
  );
}
