import { useEffect, useState } from 'react';

/**
 * NUR ZUM MESSEN AUF STAGING (Zweig `messung/fenster-weg`, wird nie gemergt).
 *
 * Alwin am iPhone (29.10.2026): Nach dem Editor öffnet das Lied-Menü nur noch die Unschärfe, das Fenster selbst ist
 * nicht zu sehen; der Editor sitzt zu hoch und bleibt nach dem Scrollen oben hängen. Der Kasten zeigt laufend, wo das
 * Fenster wirklich liegt und ob iOS die Seite oder einen Vorfahren verschoben hat. Er lässt jeden Tipp durch.
 */
const r = (n: number | undefined) => (n === undefined ? '–' : String(Math.round(n)));
const verlauf: string[] = [];

function merken(anlass: string) {
  const vv = window.visualViewport;
  const z = `${new Date().toLocaleTimeString('de-DE')} ${anlass} iH${window.innerHeight} vv${r(vv?.height)}/${r(vv?.offsetTop)} sY${r(window.scrollY)}`;
  if (verlauf[verlauf.length - 1]?.slice(9) !== z.slice(9)) verlauf.push(z);
  if (verlauf.length > 8) verlauf.shift();
}

function messen(): string[] {
  const vv = window.visualViewport;
  const wurzel = getComputedStyle(document.documentElement);
  const zeilen = [
    `iH ${window.innerHeight} · vv ${r(vv?.height)} / oben ${r(vv?.offsetTop)} · sY ${r(window.scrollY)}`,
    `app-h ${wurzel.getPropertyValue('--app-h') || '–'} · voll ${wurzel.getPropertyValue('--app-voll') || '–'} · html ${r(document.documentElement.getBoundingClientRect().height)}`,
    `Fokus ${document.activeElement?.tagName ?? '–'}`,
  ];
  // Jedes offene Fenster: wo liegt der Hintergrund, wo das Fenster, wie sichtbar?
  document.querySelectorAll<HTMLElement>('[role="dialog"]').forEach((d, i) => {
    const o = d.parentElement;
    const rd = d.getBoundingClientRect();
    const ro = o?.getBoundingClientRect();
    const cs = getComputedStyle(d);
    zeilen.push(
      `F${i} oben ${r(rd.top)} h ${r(rd.height)} op ${cs.opacity}/${o ? getComputedStyle(o).opacity : '–'} vis ${cs.visibility}`,
      `   Hgr oben ${r(ro?.top)} h ${r(ro?.height)} kb ${o?.style.getPropertyValue('--kb') || '–'} pb ${o ? getComputedStyle(o).paddingBottom : '–'}`,
    );
  });
  // Alles, was fest über allem liegt (Editor, Fenster) – Lage und Deckkraft.
  document.querySelectorAll<HTMLElement>('body *').forEach((e) => {
    const cs = getComputedStyle(e);
    if (cs.position !== 'fixed' || Number(cs.zIndex) < 100 || e.closest('[data-messkasten]'))
      return;
    const b = e.getBoundingClientRect();
    zeilen.push(
      `fix z${cs.zIndex} ${String(e.className).slice(0, 18)} oben ${r(b.top)} h ${r(b.height)} op ${cs.opacity}`,
    );
  });
  // Vorfahren, die iOS verschoben hat (Scroll) oder die eine Verschiebung tragen.
  document.querySelectorAll<HTMLElement>('#root, #root *').forEach((e) => {
    if (e.scrollTop > 0 && getComputedStyle(e).overflowY === 'hidden')
      zeilen.push(`geclippt verschoben: ${String(e.className).slice(0, 22)} ${e.scrollTop}`);
    const t = e.style.transform;
    if (t && t !== 'none' && t !== 'translateX(0)')
      zeilen.push(`transform: ${String(e.className).slice(0, 18)} ${t}`);
  });
  return [...zeilen, '— Verlauf —', ...verlauf];
}

export function MessKasten() {
  const [werte, setWerte] = useState<string[]>([]);
  useEffect(() => {
    const vv = window.visualViewport;
    const vvR = () => merken('vvR');
    const vvS = () => merken('vvS');
    const wS = () => merken('wS');
    vv?.addEventListener('resize', vvR);
    vv?.addEventListener('scroll', vvS);
    window.addEventListener('scroll', wS);
    const t = window.setInterval(() => setWerte(messen()), 300);
    return () => {
      window.clearInterval(t);
      vv?.removeEventListener('resize', vvR);
      vv?.removeEventListener('scroll', vvS);
      window.removeEventListener('scroll', wS);
    };
  }, []);
  return (
    <div
      data-messkasten
      style={{
        position: 'fixed',
        left: 4,
        bottom: 4,
        maxWidth: '70%',
        zIndex: 99999,
        pointerEvents: 'none',
        padding: '4px 6px',
        background: 'rgba(255, 237, 160, 0.92)',
        border: '1px solid #f59e0b',
        borderRadius: 4,
        fontSize: 9,
        lineHeight: 1.3,
        fontFamily: 'ui-monospace, monospace',
        color: '#000',
        whiteSpace: 'pre',
        overflow: 'hidden',
      }}
    >
      {werte.join('\n')}
    </div>
  );
}
