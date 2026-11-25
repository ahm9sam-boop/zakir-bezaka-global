import React, { useEffect, useRef, useState } from 'react';

let cfg: Promise<{ client?: string; slot?: string }> | null = null;
const getCfg = () => (cfg ||= fetch('/api/ads-config').then(r => r.json()).catch(() => ({})));

// Renders nothing until an AdSense publisher id is configured on the server (ADSENSE_CLIENT / ADSENSE_SLOT).
export const AdSlot: React.FC<{ className?: string }> = ({ className }) => {
  const [c, setC] = useState<{ client?: string; slot?: string }>({});
  const pushed = useRef(false);
  useEffect(() => { getCfg().then(setC); }, []);
  useEffect(() => {
    if (!c.client || pushed.current) return;
    if (!document.querySelector('script[data-adsbygoogle-loader]')) {
      const s = document.createElement('script'); s.async = true; s.crossOrigin = 'anonymous';
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${c.client}`; s.setAttribute('data-adsbygoogle-loader', '1'); document.head.appendChild(s);
    }
    pushed.current = true;
    setTimeout(() => { try { ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({}); } catch {} }, 300);
  }, [c]);
  if (!c.client || !c.slot) return null;
  return (
    <div className={className} aria-label="ad">
      <ins className="adsbygoogle" style={{ display: 'block' }} data-ad-client={c.client} data-ad-slot={c.slot} data-ad-format="auto" data-full-width-responsive="true" />
    </div>
  );
};
