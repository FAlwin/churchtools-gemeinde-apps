import { useEffect, useMemo, useRef } from 'react';
import { gemeindeZeitzone } from '@shared/ct/zeit';
import type { Seite } from '@shared/website/modell';
import { nachrichtLesen, type EditorAktion } from './nachricht';
import { vorschauHtml, VORSCHAU_SANDBOX, type VorschauStand } from './vorschauHtml';
import styles from './Vorschau.module.scss';

export type Ansicht = 'computer' | 'handy';

/**
 * **Die Vorschau** (Bauplan Website W3a-1): die Seite, wie der echte Renderer sie ausgibt, in einem abgeschotteten
 * `iframe` (`vorschauHtml.ts` erklärt Sandbox und Adressen). Umschalter „Computer | Handy“ = ganze Breite oder ein Rahmen von
 * 390 px.
 *
 * **Mit `bearbeiten` (W3a-2) ist es die Bearbeiten-Ebene:** Das iframe bekommt Leisten und Knöpfe (`ebene.ts`) und meldet,
 * was angeklickt wurde. Hier – und nur hier – kommen diese Nachrichten an: **nur aus diesem iframe** (`event.source`), in der
 * Form von `nachricht.ts`, mit Stellen, die es auf der Seite gibt. Alles andere wird ignoriert; der Grund steht in
 * `nachricht.ts` (der Baustein „Eigenes HTML“ läuft im selben iframe und könnte Nachrichten fälschen).
 *
 * Die Scrollposition der Vorschau bleibt beim Neuzeichnen: Das iframe meldet sie, die nächste Fassung stellt sie wieder ein.
 */
export function Vorschau({
  seite,
  stand,
  gemeinde,
  ansicht,
  bearbeiten,
}: {
  seite: Seite;
  stand: VorschauStand;
  gemeinde: string | null;
  ansicht: Ansicht;
  /** Mit der Bearbeiten-Ebene; `onAktion` bekommt, was angeklickt wurde. */
  bearbeiten?: { onAktion: (aktion: EditorAktion) => void };
}) {
  const rahmen = useRef<HTMLIFrameElement>(null);
  const scroll = useRef(0);
  const aktuell = useRef({ seite, onAktion: bearbeiten?.onAktion });
  aktuell.current = { seite, onAktion: bearbeiten?.onAktion };
  const mitEbene = bearbeiten !== undefined;

  // Eine andere Seite beginnt oben – schon beim ersten Zeichnen, nicht erst nach einem Effekt (der käme nach dem `srcdoc`).
  const letzteSeite = useRef(seite.id);
  if (letzteSeite.current !== seite.id) {
    letzteSeite.current = seite.id;
    scroll.current = 0;
  }

  const html = useMemo(
    () =>
      vorschauHtml(
        seite,
        stand,
        gemeinde,
        gemeindeZeitzone(),
        mitEbene ? { scroll: scroll.current } : undefined,
      ),
    [seite, stand, gemeinde, mitEbene],
  );

  useEffect(() => {
    if (!mitEbene) return;
    const an = (e: MessageEvent) => {
      // 1. Nur dieses iframe. (Jedes andere Fenster – oder ein anderes iframe der Seite – darf nichts auslösen.)
      if (!rahmen.current || e.source !== rahmen.current.contentWindow) return;
      // 2. + 3. Form und Stellen.
      const m = nachrichtLesen(e.data, aktuell.current.seite);
      if (!m) return;
      if (m.was === 'scroll') scroll.current = m.y;
      else aktuell.current.onAktion?.(m);
    };
    window.addEventListener('message', an);
    return () => window.removeEventListener('message', an);
  }, [mitEbene]);

  return (
    <div className={`${styles.buehne}${ansicht === 'handy' ? ' ' + styles.handy : ''}`}>
      <iframe
        ref={rahmen}
        className={styles.rahmen}
        title={`Vorschau: ${seite.titel}`}
        sandbox={VORSCHAU_SANDBOX}
        srcDoc={html}
      />
    </div>
  );
}
