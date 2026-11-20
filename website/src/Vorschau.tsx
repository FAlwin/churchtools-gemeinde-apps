import { useEffect, useMemo, useRef, useState } from 'react';
import { seitenNonce, type WeiterStelle } from './ebene';
import { gemeindeZeitzone } from '@shared/ct/zeit';
import type { Seite } from '@shared/website/modell';
import { istLinkAdresse } from '@shared/website/markdown';
import { gleicheTippStelle, nachrichtLesen, type EditorAktion, type TippStelle } from './nachricht';
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
 *
 * **Text direkt tippen (W3c-1):** Solange im iframe getippt wird (`tippen` … `tippen-ende`), wird er **nicht neu gezeichnet** – auch
 * dann nicht, wenn sich die Seite inzwischen ändert (der Stand wird danach nachgezogen). Der Text selbst kommt nur an, wenn
 * dasselbe Feld vorher als „wird getippt“ gemeldet wurde (`nachricht.ts`, Punkt 5), und die Adresse eines Links prüft **dieser
 * Rahmen** (`istLinkAdresse`, die echte Regel) und antwortet dem iframe.
 */
export function Vorschau({
  seite,
  stand,
  gemeinde,
  ansicht,
  bearbeiten,
  version = 0,
}: {
  seite: Seite;
  stand: VorschauStand;
  gemeinde: string | null;
  ansicht: Ansicht;
  /** Mit der Bearbeiten-Ebene; `onAktion` bekommt, was angeklickt wurde. */
  bearbeiten?: {
    onAktion: (aktion: EditorAktion) => void;
    /** Es wird in einem Textfeld getippt (der Aufrufer nimmt zum Beispiel die Sperre). */
    onTippen?: () => void;
    /** Darf „Eigenes HTML“ geändert werden? Sonst gibt es dafür keine Leiste. */
    darfHtml?: boolean;
  };
  /** Zählt hoch, wenn die Vorschau neu gezeichnet werden soll, obwohl sich die Seite nicht geändert hat (getippter Text abgelehnt). */
  version?: number;
}) {
  const rahmen = useRef<HTMLIFrameElement>(null);
  const scroll = useRef(0);
  const aktuell = useRef({
    seite,
    onAktion: bearbeiten?.onAktion,
    onTippen: bearbeiten?.onTippen,
  });
  aktuell.current = {
    seite,
    onAktion: bearbeiten?.onAktion,
    onTippen: bearbeiten?.onTippen,
  };
  const mitEbene = bearbeiten !== undefined;
  const darfHtml = bearbeiten?.darfHtml === true;
  const bereit = useRef(false);
  const [blockiert, setBlockiert] = useState(false);
  /** Das Feld, das gerade getippt wird und dessen Text einmal ankommen darf. */
  const tippStelle = useRef<TippStelle | null>(null);
  /** Wird gerade getippt? Dann bleibt das iframe, wie es ist. */
  const tippt = useRef(false);
  const [, nachziehen] = useState(0);
  /** Wo nach einem Klick in ein anderes Textfeld gleich weitergetippt wird. */
  const weiter = useRef<WeiterStelle | null>(null);

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
        mitEbene
          ? {
              scroll: scroll.current,
              nonce: seitenNonce(),
              modus: ansicht,
              darfHtml,
              weiter: weiter.current,
            }
          : undefined,
        schriften.adresse,
      ),
    // `version` kommt im Rumpf nicht vor, soll aber eine neue Fassung erzwingen – sie trägt dann die aktuelle Scrollstelle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seite, stand, gemeinde, mitEbene, schriften.adresse, ansicht, darfHtml, version],
  );
  // Beim Tippen bleibt das iframe, wie es ist (sonst ginge der Cursor verloren); danach kommt der neueste Stand.
  const gezeigt = useRef(html);
  if (!tippt.current || !mitEbene) gezeigt.current = html;
  const angezeigt = gezeigt.current;

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
        weiter.current = null;
        tippStelle.current = null;
        tippt.current = false;
        setBlockiert(false);
      } else if (m.was === 'link-pruefen') {
        // Die echte Regel entscheidet, nicht eine Kopie in der Ebene; geantwortet wird nur diesem iframe.
        rahmen.current.contentWindow?.postMessage(
          { websiteParent: true, was: 'link-ergebnis', id: m.id, ok: istLinkAdresse(m.url) },
          '*',
        );
      } else if (m.was === 'tippen') {
        tippStelle.current = m;
        tippt.current = true;
        aktuell.current.onTippen?.();
      } else if (m.was === 'tippen-ende') {
        tippStelle.current = null;
        tippt.current = false;
        nachziehen((n) => n + 1);
      } else if (m.was === 'text') {
        // Nur das Feld, das als „wird getippt“ gemeldet wurde – und nur einmal.
        if (!tippStelle.current || !gleicheTippStelle(tippStelle.current, m)) return;
        tippStelle.current = null;
        // Der Text ist abgegeben: Ab hier darf das iframe wieder neu gezeichnet werden (auch wenn „fertig“ nie käme).
        tippt.current = false;
        weiter.current = m.weiter ?? null;
        aktuell.current.onAktion?.(m);
      } else aktuell.current.onAktion?.(m);
    };
    window.addEventListener('message', an);
    return () => window.removeEventListener('message', an);
  }, [mitEbene]);

  // Fällt die Bearbeiten-Ebene weg (die Seite wurde gesperrt), gilt nichts mehr als „wird getippt“.
  useEffect(() => {
    if (mitEbene) return;
    tippStelle.current = null;
    tippt.current = false;
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
  }, [angezeigt, mitEbene]);

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
          Eine Schrift ließ sich gerade nicht laden – die Vorschau zeigt vorerst eine Ersatzschrift.
          Deine Einstellungen bleiben unverändert.{' '}
          <TextKnopf onClick={schriften.nochmal}>Erneut laden</TextKnopf>
        </div>
      )}
      {mitEbene && ansicht === 'handy' && (
        <div className={styles.hinweis} role="status">
          Am Handy bearbeitest du über die Fenster – Tippen auf einen Abschnitt oder Baustein öffnet
          sie. Text direkt tippen und die Leisten gibt es nur am Computer.
        </div>
      )}
      <div className={`${styles.buehne}${ansicht === 'handy' ? ' ' + styles.handy : ''}`}>
        <iframe
          key={version}
          ref={rahmen}
          className={styles.rahmen}
          title={`Vorschau: ${seite.titel}`}
          sandbox={VORSCHAU_SANDBOX}
          srcDoc={angezeigt}
        />
      </div>
    </>
  );
}
