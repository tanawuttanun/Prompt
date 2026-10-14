import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { Crest } from '../components/Crest';
import { SparkleField, sparkleBurst } from '../components/sparkle';
import { useAuth } from '../context/AuthContext';
import { WelcomePopup } from './WelcomePopup';
import { BRAND, HERO, NAV_LINKS, STORE } from './content';
import { mountLanding } from './engine';
import './landing.css';

export default function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    document.documentElement.classList.add('landing');
    const dispose = mountLanding(rootRef.current!);
    return () => {
      dispose();
      document.documentElement.classList.remove('landing');
    };
  }, []);

  return (
    <div className="stage" ref={rootRef}>
      <div className="canvas">
        <div className="bg">
          <div className="stars" id="stA" />
          <div className="stars" id="stB" />
          <SparkleField count={22} />
        </div>

        <nav className="nav" aria-label="Main">
          <Crest className="mark" size={24} animated />
          <div className="wm">
            <span className="kick">{BRAND.kicker}</span>
            <span className="name" id="wmName">{BRAND.name}</span>
          </div>

          <button className="burger" type="button" aria-label="Opens menu" aria-expanded="false" aria-controls="navmenu">
            <span />
            <span />
            <span />
          </button>
          <div className="navmenu" id="navmenu">
            <div className="links" id="links">
              {NAV_LINKS.map(link => (
                <Link key={link.label} to={link.to}>{link.label}</Link>
              ))}
            </div>
            <Link className="btn" to={user ? '/products' : '/register'} onClick={e => sparkleBurst(e.currentTarget)}><span id="ctaLabel">{HERO.navCta}</span></Link>
          </div>
        </nav>

        <div className="stack">
          <div className="badge">
            <i>
              <svg viewBox="1 1 22 22" aria-hidden="true">
                {/* the crest star */}
                <path
                  d="M12 2.2 L14.6 8.9 L21.8 9.3 L16.2 13.8 L18.1 20.8 L12 16.8 L5.9 20.8 L7.8 13.8 L2.2 9.3 L9.4 8.9 Z"
                  fill="rgba(243,223,174,.9)" stroke="rgba(255,244,214,.7)" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
            </i>
            <b id="badgeTxt">{HERO.badge}</b>
          </div>
          <h1 className="h1 l1" id="h1a">{HERO.line1}</h1>
          <div className="h1 gold-text" id="h1b" aria-hidden="true">{HERO.line2}</div>
          <p className="sub s1" id="sub1">
            <b>{HERO.subLead} <span className="nb">{HERO.subLeadNoBreak}</span></b> {HERO.subTail}
          </p>
          <p className="sub" id="sub2">{HERO.sub2}</p>
          <Link className="btn cta2" to="/products" onClick={e => sparkleBurst(e.currentTarget, 18)}><span id="vpLabel">{HERO.cta}</span></Link>
        </div>

        <div className="showcase">
          <div className="ring" />
          <div className="browser">
            <div className="bar">
              <div className="dots">
                <i style={{ background: '#ee5c62' }} />
                <i style={{ background: '#f6b719' }} />
                <i style={{ background: '#12c02f' }} />
              </div>
              <div className="omni">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.8-3.8" />
                </svg>
                <span>{STORE.address}</span>
              </div>
              <div className="tools" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                  <path d="M12 16V4m0 0L8 8m4-4 4 4" />
                  <path d="M4 15v5h16v-5" />
                </svg>
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                  <path d="M12 3 3 8l9 5 9-5-9-5Z" fill="#fff" opacity=".95" />
                  <path d="M3 13l9 5 9-5" opacity=".55" />
                </svg>
              </div>
            </div>

            <div className="page">
              <div className="ann">
                <u style={{ left: 20 }}>&#8249;</u>
                <span>{STORE.announcement}</span>
                <u style={{ right: 20 }}>&#8250;</u>
              </div>
              <div className="shoplogo">
                <em>{STORE.logo}</em>
                <i>{STORE.logoSub}</i>
              </div>
              <div className="shopicons" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.8-3.8" />
                </svg>
                <svg viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="2">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4.5 21c0-4.2 3.4-6.6 7.5-6.6s7.5 2.4 7.5 6.6" />
                </svg>
                <svg viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="2">
                  <path d="M5.5 8h13l-1.2 12H6.7L5.5 8Z" />
                  <path d="M9 8V6.2A3 3 0 0 1 15 6.2V8" />
                </svg>
              </div>

              <div className="pagebody">
                <div className="pghero">
                  <img src={STORE.banner.url} alt={STORE.banner.alt} />
                  <div className="scrim" />
                  <div className="copy">
                    <u>{STORE.banner.kicker}</u>
                    <em>
                      {STORE.banner.headline[0]}
                      <br />
                      {STORE.banner.headline[1]}
                    </em>
                    <i>{STORE.banner.cta}</i>
                  </div>
                </div>
                <div className="pgsec">
                  <b>{STORE.sectionTitle}</b>
                  <u>see more</u>
                </div>
                <div className="pggrid">
                  {STORE.products.map(p => (
                    <div className="pgcard" key={p.name}>
                      <div className="ph">
                        <img src={p.url} alt={p.alt} />
                        {p.tag && <span className="tag">{p.tag}</span>}
                      </div>
                      <b>{p.name}</b>
                      <i>{p.meta}</i>
                      <s>
                        {p.price}
                        {p.was && <span>{p.was}</span>}
                      </s>
                    </div>
                  ))}
                </div>
                <div className="pgstrip">
                  {STORE.perks.map(perk => (
                    <span key={perk}>{perk}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <WelcomePopup />

      <a className="wa" href="#" aria-label="WhatsApp">
        <svg viewBox="0 0 32 32" fill="#fff" aria-hidden="true">
          <path d="M16.02 3.2C8.96 3.2 3.22 8.93 3.22 15.99c0 2.26.59 4.47 1.71 6.42L3.12 29l6.77-1.77a12.75 12.75 0 0 0 6.13 1.56h.01c7.05 0 12.79-5.73 12.79-12.79S23.07 3.2 16.02 3.2Zm0 23.43h-.01c-1.9 0-3.77-.51-5.4-1.48l-.39-.23-4.02 1.05 1.07-3.92-.25-.4a10.6 10.6 0 0 1-1.63-5.66c0-5.87 4.78-10.64 10.65-10.64 2.84 0 5.51 1.11 7.52 3.12a10.57 10.57 0 0 1 3.11 7.53c0 5.87-4.78 10.63-10.65 10.63Zm5.84-7.97c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.72.16-.21.32-.82 1.04-1.01 1.25-.19.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.59-1.89-1.78-2.21-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.29.32-1.12 1.09-1.12 2.66s1.14 3.09 1.3 3.3c.16.21 2.25 3.43 5.44 4.81.76.33 1.35.52 1.81.67.76.24 1.45.21 2 .13.61-.09 1.89-.77 2.15-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z" />
        </svg>
      </a>
    </div>
  );
}
