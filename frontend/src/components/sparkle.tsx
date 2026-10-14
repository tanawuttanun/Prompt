// Gold sparkle effects. Everything here is decorative (aria-hidden) and switches
// itself off under prefers-reduced-motion.
import { useMemo } from 'react';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const STAR_PATH = 'M12 0 C12.9 7.5 16.5 11.1 24 12 C16.5 12.9 12.9 16.5 12 24 C11.1 16.5 7.5 12.9 0 12 C7.5 11.1 11.1 7.5 12 0 Z';

// A field of four-point stars that twinkle at random positions and rhythms.
export function SparkleField({ count = 18, className = '' }: { count?: number; className?: string }) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 6 + Math.random() * 12,
        delay: Math.random() * 6,
        duration: 2.6 + Math.random() * 3.4,
      })),
    [count],
  );
  return (
    <div className={`sparkle-field ${className}`} aria-hidden="true">
      {stars.map((s, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s` }}
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </div>
  );
}

// A burst of gold stars flying out of a point (e.g. the button that was pressed).
export function sparkleBurst(origin: { x: number; y: number } | Element, count = 14) {
  if (reducedMotion() || typeof document === 'undefined') return;
  let x: number;
  let y: number;
  if (origin instanceof Element) {
    const r = origin.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  } else {
    ({ x, y } = origin);
  }
  for (let i = 0; i < count; i++) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('aria-hidden', 'true');
    el.classList.add('sparkle-particle');
    const size = 6 + Math.random() * 10;
    el.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px`;
    el.innerHTML = `<path d="${STAR_PATH}"/>`;
    document.body.appendChild(el);
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 30 + Math.random() * 50;
    el.animate(
      [
        { transform: 'translate(0,0) scale(.2) rotate(0deg)', opacity: 1 },
        { transform: `translate(${Math.cos(angle) * dist}px,${Math.sin(angle) * dist - 10}px) scale(1) rotate(${90 + Math.random() * 180}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${Math.cos(angle) * dist * 1.25}px,${Math.sin(angle) * dist + 18}px) scale(.3) rotate(240deg)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.16,1,.3,1)' },
    ).finished.finally(() => el.remove());
  }
}
