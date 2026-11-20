import { useEffect, useMemo, useRef, useState } from 'react';
import { seitenNonce } from './ebene';
import { gemeindeZeitzone } from '@shared/ct/zeit';
import type { Seite } from '@shared/website/modell';
import { nachrichtLesen, type EditorAktion } from './nachricht';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { schriftDateien } from '@shared/website/schriften';
import { useSchriften } from './useSchriften';
import { vorschauHtml, VORSCHAU_SANDBOX, type VorschauStand } from './vorschauHtml';
import styles from './Vorschau.module.scss';

/** So lange darf die Ebene brauchen, bis sie „bereit“ meldet; danach gilt sie als blockiert. */
export const EBENE_WARTEZEIT_MS = 2000;

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
  const bereit = useRef(false);
  const [blockiert, setBlockiert] = useState(false);

  // Eine andere Seite beginnt oben – schon beim ersten Zeichnen, nicht erst nach einem Effekt (der käme nach dem `srcdoc`).
  const letzteSeite = useRef(seite.id);
  if (letzteSeite.current !== seite.id) {
    letzteSeite.current = seite.id;
    scroll.current = 0;
  }

  // Die Schriften, die diese Einstellungen brauchen – nur diese werden geladen (nie alle 14).
  const dateien = useMemo(
    () => schriftDateien(stand.einstellungen?.schriften),
    [stand.einstellungen?.schriften],
  );
  const schriften = useSchriften(dateien);

  const html = useMemo(
    () =>
      vorschauHtml(
        seite,
        stand,
        gemeinde,
        gemeindeZeitzone(),
        mitEbene ? { scroll: scroll.current, nonce: seitenNonce() } : undefined,
        schriften.adresse,
      ),
    [seite, stand, gemeinde, mitEbene, schriften.adresse],
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
      else if (m.was === 'bereit') {
        bereit.current = true;
        setBlockiert(false);
      } else aktuell.current.onAktion?.(m);
    };
    window.addEventListener('message', an);
    return () => window.removeEventListener('message', an);
  }, [mitEbene]);

  // Läuft die Ebene? Sie meldet sich nach dem Laden („bereit“). Bleibt das aus, hat ChurchTools das Skript blockiert – dann
  // soll das sichtbar sein, statt dass die Leisten still fehlen.
  useEffect(() => {
    if (!mitEbene) return;
    bereit.current = false;
    const t = setTimeout(() => {
      if (bereit.current) return;
      console.warn(
        'Website-Vorschau: Die Bearbeiten-Ebene hat sich nicht gemeldet – ChurchTools hat das Skript vermutlich blockiert (Content-Security-Policy).',
      );
      setBlockiert(true);
    }, EBENE_WARTEZEIT_MS);
    return () => clearTimeout(t);
  }, [html, mitEbene]);

  return (
    <>
      {mitEbene && blockiert && (
        <div className={styles.hinweis} role="status">
          Bearbeiten in der Vorschau ist gerade nicht möglich – ChurchTools hat das
          Bearbeiten-Skript blockiert. Bitte Seite neu laden.
        </div>
      )}
      {schriften.fehler && (
        <div className={styles.hinweis} role="status">
          Eine Schrift ließ sich gerade nicht laden – die Vorschau zeigt vorerst eine Ersatzschrift. Deine
          Einstellungen bleiben unverändert.{' '}
          <TextKnopf onClick={schriften.nochmal}>Erneut laden</TextKnopf>
        </div>
      )}
      <div className={`${styles.buehne}${ansicht === 'handy' ? ' ' + styles.handy : ''}`}>
        <iframe
          ref={rahmen}
          className={styles.rahmen}
          title={`Vorschau: ${seite.titel}`}
          sandbox={VORSCHAU_SANDBOX}
          srcDoc={html}
        />
      </div>
    </>
  );
}
