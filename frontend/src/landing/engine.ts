import { SHOTS, type Shot } from './content';

// Design canvas: the desktop composition is authored at 1172 x 657 design px.
const CW = 1172;
const CH = 657;
const TAB_MAX = 1080;
const TAB_MIN = 701;
const DW_MIN = 920;

// Ring geometry: the camera sits at the cylinder's centre (perspective === R),
// so every card is tangent to the cylinder and faces the camera exactly.
const R = 891;
const N = 37;
const STEP = 360 / N; // 9.7297 deg between cards
const CULL = 42; // cards beyond +/-42 deg are behind the visible arc
const SPEED = 1.9; // deg/s

const BIAS = 1.1; // the reference sits button labels ~0.6px below true centre

let introStarted = false;

export function mountLanding(root: HTMLElement): () => void {
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const canvas = $('.canvas');
  const nav = $('.nav');
  const burger = $<HTMLButtonElement>('.burger');
  const ring = $('.ring');
  const links = $('#links');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const measure = document.createElement('canvas').getContext('2d')!;

  let k = 1;
  let mobile = false;
  let tablet = false;
  let tboost = 1;
  let disposed = false;

  // ---------- starfield: two 1px divs whose stars are one giant box-shadow ----------
  const starLayer = (count: number, blur: number, lo: number, hi: number) =>
    Array.from({ length: count }, () => {
      const a = (lo + Math.random() * (hi - lo)).toFixed(2);
      return `${(Math.random() * 100).toFixed(2)}vw ${(Math.random() * 100).toFixed(2)}vh ${blur}px 0 rgba(255,255,255,${a})`;
    }).join(',');
  $('#stA').style.boxShadow = starLayer(150, 0, 0.05, 0.3);
  $('#stB').style.boxShadow = starLayer(18, 1.2, 0.35, 0.7);

  // ---------- carousel cards ----------
  const cards: HTMLDivElement[] = [];
  for (let i = 0; i < N; i++) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = creative(SHOTS[i % SHOTS.length]!) + '<div class="edge"></div>';
    card.querySelectorAll('img').forEach(img =>
      img.addEventListener('error', () => card.classList.add('broken')),
    );
    ring.appendChild(card);
    cards.push(card);
  }

  let phase = -2;
  const placeCards = () => {
    cards.forEach((el, i) => {
      // signed angle of this card, -180..180
      const a = ((((i * STEP + phase) % 360) + 540) % 360) - 180;
      if (Math.abs(a) > CULL) {
        el.style.visibility = 'hidden';
        return;
      }
      el.style.visibility = 'visible';
      const r = (a * Math.PI) / 180;
      const c = Math.cos(r);
      el.style.transform = `translate3d(${R * Math.sin(r)}px,0,${R * (1 - c)}px) rotateY(${-a}deg)`;
      // edges dim, front bright
      el.style.filter = `brightness(${0.84 + 0.5 * (1 / c - 1)})`;
    });
  };

  let last = 0;
  let raf = 0;
  const tick = (t: number) => {
    if (disposed) return;
    if (!last) last = t;
    const dt = Math.min((t - last) / 1000, 0.1);
    last = t;
    if (!reduced.matches) phase -= SPEED * dt; // continuous, never resets
    placeCards();
    raf = requestAnimationFrame(tick);
  };
  const onVisibility = () => {
    last = 0; // a backgrounded tab must not jump when it returns
  };

  // ---------- type fitter: exact ink width + cap height + baseline ----------
  const fontOf = (el: HTMLElement) => {
    const cs = getComputedStyle(el);
    return { css: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, size: parseFloat(cs.fontSize) };
  };
  const inkWidth = (el: HTMLElement) => el.getBoundingClientRect().width / (mobile ? 1 : k);
  const capRatio = (el: HTMLElement) => {
    const cs = getComputedStyle(el);
    measure.font = `${cs.fontStyle} ${cs.fontWeight} 100px ${cs.fontFamily}`;
    return (measure.measureText('H').actualBoundingBoxAscent || 70) / 100;
  };
  const fitBox = (el: HTMLElement, tw: number, tc: number, pre = '') => {
    el.style.transform = pre;
    el.style.fontSize = `${tc / capRatio(el)}px`;
    el.style.transform = `${pre} scaleX(${tw / inkWidth(el)})`.trim();
  };
  const baseline = (el: HTMLElement, y: number) => {
    const { css, size } = fontOf(el);
    measure.font = css;
    const m = measure.measureText('H');
    const A = m.fontBoundingBoxAscent || size * 0.8;
    const D = m.fontBoundingBoxDescent || size * 0.2;
    // with line-height:1 the content area (A+D) is centred in a line box of `size`
    el.style.top = `${y - ((size - (A + D)) / 2 + A)}px`;
  };
  const centreLabel = (btn: HTMLElement, el: HTMLElement, capPx: number) => {
    el.style.top = '0px';
    const probe = document.createElement('i');
    probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    el.appendChild(probe);
    const base = (probe.getBoundingClientRect().top - btn.getBoundingClientRect().top) / (mobile ? 1 : k);
    probe.remove();
    el.style.top = `${btn.offsetHeight / 2 - (base - capPx / 2) + BIAS}px`;
  };

  const fitted = ['#h1a', '#h1b', '#sub1', '#sub2', '#badgeTxt', '#wmName', '#ctaLabel', '#vpLabel'].map(s => $(s));

  const layout = () => {
    if (disposed) return;
    const linkEls = Array.from(links.children) as HTMLElement[];
    if (mobile) {
      // hand back every inline style the fitter wrote, or the headline drifts off-screen
      fitted.forEach(el => {
        el.style.fontSize = '';
        el.style.top = '';
        el.style.transform = '';
      });
      links.style.fontSize = '';
      links.style.transform = '';
      linkEls.forEach(a => (a.style.fontSize = ''));
      placeCards();
      return;
    }
    const T = tablet ? tboost : 1;
    const [h1a, h1b, sub1, sub2, badgeTxt, wmName, ctaLabel, vpLabel] = fitted as [
      HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement, HTMLElement,
    ];
    fitBox(h1a, 563.5 * T, 37.2 * T, 'translateX(-50%)');
    baseline(h1a, 204.5);
    fitBox(h1b, 197.5 * T, 37.2 * T, 'translateX(-50%)');
    baseline(h1b, 258.5);
    fitBox(sub1, 389 * T, 8.4 * T, 'translateX(-50%)');
    baseline(sub1, 300.5);
    fitBox(sub2, 311 * T, 8.4 * T, 'translateX(-50%)');
    baseline(sub2, 316.5);
    fitBox(badgeTxt, 184 * T, 9.4 * T, 'translate(2px,-1px)');
    fitBox(wmName, 51 * T, 11.4 * T);
    baseline(wmName, 38.5);
    fitBox(ctaLabel, 87 * T, 8.9 * T);
    centreLabel(ctaLabel.parentElement!, ctaLabel, 8.9 * T);
    fitBox(vpLabel, 76 * T, 9.5 * T);
    centreLabel(vpLabel.parentElement!, vpLabel, 9.5 * T);

    links.style.transform = '';
    if (tablet) {
      linkEls.forEach(a => (a.style.fontSize = ''));
    } else {
      const fs = 7.9 / capRatio(linkEls[0]!); // one shared size for all five links
      linkEls.forEach(a => (a.style.fontSize = `${fs}px`));
      links.style.transform = `scaleX(${317 / inkWidth(links)})`; // squeeze the row to 317
    }
    placeCards();
  };

  // ---------- scale law ----------
  const resize = () => {
    const vw = window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    mobile = vw <= 700;
    tablet = !mobile && vw <= TAB_MAX;
    if (mobile) {
      k = 1;
      ['--k', '--fill', '--stshift', '--sshift', '--rs'].forEach(p => canvas.style.removeProperty(p));
      if (nav.classList.contains('open')) closeMenu(false);
      layout();
      return;
    }
    let W = CW;
    if (tablet) {
      // the design window narrows so type stops shrinking; k stays continuous at 1080
      W = DW_MIN + ((vw - TAB_MIN) * (CW - DW_MIN)) / (TAB_MAX - TAB_MIN);
      if (vh > vw * 1.15) W = Math.min(W, 900); // portrait tablet: read larger
    } else if (nav.classList.contains('open')) {
      closeMenu(false); // the burger panel only exists below 1080
    }
    // 560, not 657: fill the width and let the browser mock bleed off the bottom
    k = Math.min(vw / W, vh / 560);
    let fill = Math.max(0, vh / k - CH);
    let ss = 0;
    let rs = 1;
    let st = 0;
    tboost = 1;
    if (tablet) {
      const ramp = Math.min(1, (TAB_MAX - vw) / 120); // ease the change in over 120px
      tboost = 1 + 0.14 * ramp;
      if (fill > 0) {
        // share surplus height three ways: wheel+mock travel down, wheel grows, hero recentres
        ss = Math.min(fill * 0.55, 420) * ramp;
        rs = 1 + Math.min(fill / 1100, 0.75) * ramp;
        const slack = 219.5 - 125 * rs + ss;
        st = Math.max(0, slack / 2 - 28) * ramp;
        fill -= ss;
      }
    }
    canvas.style.setProperty('--k', String(k));
    canvas.style.setProperty('--fill', `${fill}px`);
    canvas.style.setProperty('--stshift', `${st}px`);
    canvas.style.setProperty('--sshift', `${ss}px`);
    canvas.style.setProperty('--rs', String(rs));
    layout();
  };

  // ---------- burger menu ----------
  const openMenu = () => {
    nav.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
  };
  function closeMenu(returnFocus: boolean) {
    nav.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    if (returnFocus) burger.focus();
  }
  const onBurger = (e: Event) => {
    e.stopPropagation();
    if (nav.classList.contains('open')) closeMenu(false);
    else openMenu();
  };
  const onDocClick = (e: MouseEvent) => {
    if (nav.classList.contains('open') && !nav.contains(e.target as Node)) closeMenu(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) closeMenu(true);
  };
  const onMenuClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a') && nav.classList.contains('open')) closeMenu(false);
  };
  burger.addEventListener('click', onBurger);
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKey);
  $('#navmenu').addEventListener('click', onMenuClick);

  // ---------- wiring ----------
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  resize();
  document.fonts.ready.then(layout);
  const t1 = window.setTimeout(layout, 400);
  const t2 = window.setTimeout(layout, 1400);
  raf = requestAnimationFrame(tick);

  if (!introStarted) {
    introStarted = true;
    runIntro(root, layout);
  }

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    clearTimeout(t1);
    clearTimeout(t2);
    window.removeEventListener('resize', resize);
    window.visualViewport?.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    burger.removeEventListener('click', onBurger);
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKey);
    $('#navmenu').removeEventListener('click', onMenuClick);
    cards.forEach(c => c.remove());
  };
}

// ---------- 12. master entrance timeline: runs once, then the page is still ----------
function runIntro(root: HTMLElement, relayout: () => void) {
  const html = document.documentElement;
  const settle = () => {
    document.getAnimations().forEach(a => {
      if (a.id.startsWith('intro:')) a.cancel();
    });
    html.classList.remove('intro');
    relayout(); // re-measure without any entrance scale still applied
  };
  if (!html.classList.contains('intro') || matchMedia('(prefers-reduced-motion: reduce)').matches || !Element.prototype.animate) {
    settle();
    return;
  }

  const D = window.innerWidth <= 700 ? 0.66 : 1; // phones travel shorter distances
  const EXPO = 'cubic-bezier(.16,1,.3,1)';
  const SOFT = 'cubic-bezier(.22,.61,.36,1)';
  const Y = (px: number) => `0 ${px * D}px`;
  let n = 0;
  let lastAnim: Animation | null = null;
  let lastEnd = 0;

  const play = (el: Element | null, from: Keyframe, dur: number, delay: number, easing: string) => {
    if (!el) return;
    const to: Keyframe = { opacity: 1 };
    if ('translate' in from) to.translate = '0 0';
    if ('scale' in from) to.scale = '1';
    if ('clipPath' in from) to.clipPath = 'inset(-30% 0 -30% 0)';
    const a = el.animate([from, to], { duration: dur, delay, easing, fill: 'both' });
    a.id = `intro:${n++}`;
    if (delay + dur >= lastEnd) {
      lastEnd = delay + dur;
      lastAnim = a;
    }
  };
  const q = (s: string) => root.querySelector(s);

  // the frame settles
  play(q('.nav'), { opacity: 0, translate: Y(-9) }, 620, 60, EXPO);
  play(q('.mark'), { opacity: 0, translate: Y(6) }, 520, 150, SOFT);
  play(q('.wm'), { opacity: 0, translate: Y(6) }, 520, 185, SOFT);
  root.querySelectorAll('.links a').forEach((a, i) => play(a, { opacity: 0, translate: Y(6) }, 460, 215 + i * 45, SOFT));
  play(q('.burger'), { opacity: 0, translate: Y(6) }, 460, 300, SOFT);
  play(q('.nav .btn'), { opacity: 0, translate: Y(6) }, 500, 400, SOFT);
  // context, then the message
  play(q('.badge'), { opacity: 0, translate: Y(11), scale: '.985' }, 560, 270, EXPO);
  play(q('#h1a'), { opacity: 0, translate: Y(15), clipPath: 'inset(100% 0 -30% 0)' }, 900, 380, EXPO);
  play(q('#h1b'), { opacity: 0, translate: Y(15), clipPath: 'inset(100% 0 -30% 0)' }, 900, 470, EXPO);
  play(q('#sub1'), { opacity: 0, translate: Y(10) }, 620, 690, EXPO);
  play(q('#sub2'), { opacity: 0, translate: Y(10) }, 620, 745, EXPO);
  play(q('.cta2'), { opacity: 0, translate: Y(13), scale: '.985' }, 620, 830, EXPO);
  // the payoff: the wheel rises into depth, the mock lands in FRONT of it last
  play(q('.ring'), { opacity: 0, translate: Y(18), scale: '.99' }, 950, 700, EXPO);
  play(q('.browser'), { opacity: 0, translate: Y(26) }, 900, 900, EXPO);
  play(q('.wa'), { opacity: 0, scale: '.88' }, 500, 1260, EXPO);

  const finalAnim = lastAnim as Animation | null;
  if (finalAnim) finalAnim.finished.then(settle).catch(settle);
  else settle();
}

// ---------- 7. the ten card creatives ----------
function creative(d: Shot): string {
  const im = `<img alt="" src="${d.url}">`;
  switch (d.v) {
    case 'pay':
      return `<div class="fill" style="background:#efedea"></div>
<div class="ph" style="top:112px;bottom:0">${im}</div>
<svg class="ph" style="top:118px;bottom:0;background:none" viewBox="0 0 130 182" preserveAspectRatio="none">
  <g stroke="#e5202f" stroke-width="8" fill="none" opacity=".92" stroke-linecap="square">
    <path d="M2 42h30M14 30v96M4 100l26-16"/>
    <path d="M96 34v58M120 34v58M96 92q12 15 24 0"/>
    <path d="M92 108l14 34M126 108l-12 34"/></g></svg>
<div class="cv" style="top:20px;text-align:right;font-size:3.4px;letter-spacing:.15em;color:#8d9298">PAYMENT METHODS</div>
<div class="cv t-big" style="top:32px;font-size:14px;color:#16171b">Checkout</div>
<div class="cv t-big" style="top:47px;font-size:14px;color:#e5202f">Quick n simple</div>
<div class="cv" style="top:76px;font-size:5.2px;font-weight:700;color:#16171b;line-height:1.7">
  <div><b class="dot"></b>PAY VIA <b>PROMPTPAY</b></div>
  <div style="margin-top:8px"><b class="dot sq"></b>OR UP TO <b>10X</b><br><span style="margin-left:11px">0% ON CREDIT</span></div>
</div>`;
    case 'launch':
      return `<div class="fill" style="background:linear-gradient(168deg,#ffe3cf,#ffc8a3 55%,#ffa676)"></div>
<div class="ph" style="top:100px;bottom:0">${im}<div class="fill" style="background:linear-gradient(180deg,rgba(255,227,207,.97),rgba(255,227,207,0) 30%)"></div></div>
<div class="cv t-serif" style="top:36px;font-size:17px;color:#b4400f">NEW SEASON</div>
<div class="cv t-serif" style="top:55px;font-size:17px;color:#b4400f">COLLECTION</div>`;
    case 'shop':
      return `<div class="fill" style="background:#fff"></div>
<div class="ph" style="top:0;height:148px">${im}</div>
<div class="cv" style="top:158px;font-size:5.4px;font-weight:700;letter-spacing:.09em;color:#16171b">MORNING TRAINING</div>
<div class="cv" style="top:168px;font-size:4.2px;color:#7b8087">Warm-up · Lift · Recover</div>
<div style="position:absolute;left:10px;top:180px;padding:4px 11px;border-radius:20px;background:#16171b;font-size:4.6px;font-weight:600;color:#fff;letter-spacing:.05em">Shop today</div>`;
    case 'brand':
      return `<div class="fill" style="background:linear-gradient(180deg,#0a2a4a,#0d3a63 50%,#08192b)"></div>
<div class="ph" style="top:92px;bottom:0">${im}<div class="fill" style="background:linear-gradient(180deg,rgba(10,42,74,.98),rgba(10,42,74,0) 36%)"></div></div>
<div class="cv" style="top:16px;font-size:4.2px;line-height:1.7;color:rgba(255,255,255,.82);width:74px">Swim gear tested in competition pools, chlorine-resistant n built for every lap — from the first stroke.</div>
<div style="position:absolute;right:10px;top:16px;font-size:5.4px;font-weight:600;color:#fff;opacity:.92">✳ Delux</div>`;
    case 'frete':
      return `<div class="fill" style="background:linear-gradient(158deg,#4a0c80 0%,#7a16a6 40%,#a81fc6 66%,#5c0e90 100%)"></div>
<div class="ph" style="top:140px;bottom:0;opacity:.45;mix-blend-mode:screen">${im}</div>
<div class="fill" style="background:radial-gradient(44% 16% at 50% 62%,rgba(255,255,255,.92),rgba(255,255,255,0) 72%)"></div>
<div style="position:absolute;left:-6px;right:-6px;top:44px;height:13px;background:#ff2d8a;transform:rotate(-2.6deg);box-shadow:0 4px 12px rgba(255,45,138,.5)"></div>
<div style="position:absolute;left:0;right:0;top:45.5px;transform:rotate(-2.6deg);text-align:center;font-size:5.6px;font-weight:700;letter-spacing:.05em;color:#fff">DELIVERED TO YOUR DOOR</div>
<div class="cv t-big" style="top:64px;font-size:24px;color:#fff;text-shadow:0 3px 0 rgba(84,9,124,.6)">Ships</div>
<div class="cv t-big" style="top:87px;font-size:24px;color:#fff;text-shadow:0 3px 0 rgba(84,9,124,.6)">Free</div>
<div class="cv t-big" style="top:113px;font-size:19px;color:#fff">+</div>`;
    case 'power':
      return `<div class="ph phf">${im}</div>
<div class="fill" style="background:linear-gradient(180deg,rgba(6,5,10,0) 34%,rgba(6,5,10,.55) 52%,rgba(6,5,10,.92) 72%)"></div>
<div class="cv t-serif" style="top:132px;font-size:16px;color:#fff">THE POWER</div>
<div class="cv t-serif" style="top:150px;font-size:16px;color:#fff">WITHIN</div>
<div class="cv" style="top:171px;font-size:4.4px;letter-spacing:.07em;color:rgba(255,255,255,.85)">is built in every rep you take</div>`;
    case 'off':
      return `<div class="ph phf">${im}</div>
<div class="fill" style="background:linear-gradient(180deg,rgba(3,9,20,0) 30%,rgba(3,9,20,.6) 48%,rgba(3,9,20,.95) 70%)"></div>
<div class="cv t-big" style="top:126px;font-size:10px;color:#fff;opacity:.9">On sale · til</div>
<div class="cv t-big" style="top:139px;font-size:22px;color:#f3d18a;text-shadow:0 0 16px rgba(243,209,138,.55)">50% off</div>`;
    default:
      return `<div class="ph phf">${im}</div>
<div class="fill" style="background:linear-gradient(180deg,rgba(4,8,16,0) 38%,rgba(4,8,16,.85) 68%)"></div>
<div class="cv" style="top:150px;font-size:5.4px;font-weight:600;letter-spacing:.2em;color:#fff">${d.t ?? ''}</div>`;
  }
}
