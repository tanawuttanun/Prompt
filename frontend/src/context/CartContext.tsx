import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// The cart stores identity (business, id) and quantity only. Prices and stock are
// always re-read from live inventory, and the server re-prices at checkout.
export type CartLine = { business: string; product_id: string; quantity: number };

const STORAGE_KEY = 'delux_cart_v1';
const FAVORITES_KEY = 'delux_favorites_v1';

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage may be blocked (private mode); the cart then lives for this tab only
  }
}

const keyOf = (business: string, id: string) => `${business}:${id}`;

type CartValue = {
  lines: CartLine[];
  count: number;
  add: (business: string, productId: string, quantity?: number) => void;
  setQuantity: (business: string, productId: string, quantity: number) => void;
  remove: (business: string, productId: string) => void;
  clear: () => void;
  favorites: string[];
  isFavorite: (business: string, productId: string) => boolean;
  toggleFavorite: (business: string, productId: string) => void;
};

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => readStorage<CartLine[]>(STORAGE_KEY, []));
  const [favorites, setFavorites] = useState<string[]>(() => readStorage<string[]>(FAVORITES_KEY, []));

  useEffect(() => writeStorage(STORAGE_KEY, lines), [lines]);
  useEffect(() => writeStorage(FAVORITES_KEY, favorites), [favorites]);

  const add = useCallback((business: string, productId: string, quantity = 1) => {
    setLines(current => {
      const existing = current.find(l => l.business === business && l.product_id === productId);
      if (existing) return current.map(l => (l === existing ? { ...l, quantity: l.quantity + quantity } : l));
      return [...current, { business, product_id: productId, quantity }];
    });
  }, []);

  const setQuantity = useCallback((business: string, productId: string, quantity: number) => {
    setLines(current =>
      quantity <= 0
        ? current.filter(l => !(l.business === business && l.product_id === productId))
        : current.map(l => (l.business === business && l.product_id === productId ? { ...l, quantity } : l)),
    );
  }, []);

  const remove = useCallback((business: string, productId: string) => {
    setLines(current => current.filter(l => !(l.business === business && l.product_id === productId)));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const isFavorite = useCallback((business: string, productId: string) => favorites.includes(keyOf(business, productId)), [favorites]);
  const toggleFavorite = useCallback((business: string, productId: string) => {
    const key = keyOf(business, productId);
    setFavorites(current => (current.includes(key) ? current.filter(k => k !== key) : [...current, key]));
  }, []);

  const value = useMemo(
    () => ({ lines, count: lines.reduce((s, l) => s + l.quantity, 0), add, setQuantity, remove, clear, favorites, isFavorite, toggleFavorite }),
    [lines, add, setQuantity, remove, clear, favorites, isFavorite, toggleFavorite],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
