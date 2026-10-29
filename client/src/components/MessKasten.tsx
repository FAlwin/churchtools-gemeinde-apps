import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * NUR ZUM MESSEN AUF STAGING (Zweig `messung/pwa-hoehe`, wird nie gemergt).
 *
 * Misst, ob die installierte App am iPhone unten unter den Bildschirmrand ragt: `html` ist
 * `innerHeight + safe-area-bottom` hoch (main.scss) – stimmt das noch auf aktuellem iOS?
 */
function probe(css: string): number {
  const d = document.createElement('div');
  d.style.cssText = `position:fixed;left:0;top:0;width:1px;visibility:hidden;pointer-events:none;${css}`;
  document.body.appendChild(d);
  const r = d.getBoundingClientRect();
  const cs = getComputedStyle(d);
  const wert = css.startsWith('height') ? r.height : parseFloat(cs.paddingTop) || 0;
  d.remove();
  return Math.round(wert * 10) / 10;
}

function messen(): [string, string][] {
  const html = document.documentElement.getBoundingClientRect();
  const root = document.getElementById('root')?.getBoundingClientRect();
  const nav = document.querySelector('nav[aria-label="Bereiche"]')?.getBoundingClientRect();
  const r = (n: number | undefined) => (n === undefined ? '–' : String(Math.round(n)));
  return [
    ['standalone', String(window.matchMedia('(display-mode: standalone)').matches)],
    ['innerHeight × innerWidth', `${window.innerHeight} × ${window.innerWidth}`],
    ['screen.height × width', `${screen.height} × ${screen.width}`],
    ['visualViewport.height', r(window.visualViewport?.height)],
    ['--app-h', getComputedStyle(document.documentElement).getPropertyValue('--app-h') || '–'],
    [
      '--app-zuschlag',
      getComputedStyle(document.documentElement).getPropertyValue('--app-zuschlag') || '–',
    ],
    [
      '--home-strich',
      getComputedStyle(document.documentElement).getPropertyValue('--home-strich') || '–',
    ],
    ['html Höhe', r(html.height)],
    ['#root unten', r(root?.bottom)],
    ['Reiterleiste oben / unten', `${r(nav?.top)} / ${r(nav?.bottom)}`],
    ['safe-area oben', String(probe('padding-top:env(safe-area-inset-top,0px)'))],
    ['safe-area unten', String(probe('padding-top:env(safe-area-inset-bottom,0px)'))],
    ['100vh', String(probe('height:100vh'))],
    ['100dvh', String(probe('height:100dvh'))],
    ['100svh', String(probe('height:100svh'))],
    ['100lvh', String(probe('height:100lvh'))],
    ['DPR', String(window.devicePixelRatio)],
    ['iOS', (navigator.userAgent.match(/OS (\d+[_\d]*)/) || [])[1]?.replace(/_/g, '.') ?? '–'],
  ];
}

export function MessKasten() {
  const [werte, setWerte] = useState<[string, string][]>([]);
  useEffect(() => {
    const t = window.setTimeout(() => setWerte(messen()), 600);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <>
      <div
        style={{
          margin: '16px',
          padding: '12px',
          border: '2px solid #f59e0b',
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.5,
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Messkasten (nur Staging)</div>
        {werte.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span>{k}</span>
            <b>{v}</b>
          </div>
        ))}
        <div style={{ marginTop: 6, fontWeight: 700 }}>Verlauf seit Start</div>
        {((window as unknown as { __hoehen?: string[] }).__hoehen ?? []).slice(-14).map((z, i) => (
          <div key={i}>{z}</div>
        ))}
        <button type="button" style={{ marginTop: 8 }} onClick={() => setWerte(messen())}>
          Neu messen
        </button>
      </div>
      {/* Rot: am unteren Rand des sichtbaren Fensters (fixed). Ist er nicht zu sehen, endet das Fenster unter der Kante. */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          height: 6,
          background: 'red',
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      />
      {/* Blau: Unterkante von #root (dort endet die App). Liegt sie unter der Kante, ist Blau unsichtbar. */}
      {document.getElementById('root') &&
        createPortal(
          <div
            style={{
              position: 'absolute',
              left: 0,
              width: '50%',
              bottom: 0,
              height: 12,
              background: 'blue',
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          />,
          document.getElementById('root')!,
        )}
    </>
  );
}
