import { useEffect, useMemo, useRef, useState } from 'react';
import { gemeindeZeitzone } from '@shared/ct/zeit';
import { Segment } from '@ui/bedienung/Segment';
import { Schalter } from '@ui/bedienung/Schalter';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import {
  ANTRAG_BRIEFKOPF_MAX,
  ANTRAG_PLATZHALTER,
  ANTRAG_TEXT_MAX,
  ANTRAG_UEBERSCHRIFT_MAX,
  antragBlatt,
  antragVorschau,
  type AntragLogo,
} from '@shared/anmeldung/nachweisAntrag';
import { AntwortKnoepfe } from './AntwortKnoepfe';
import { antragBildLaden } from './antragBild';
import type { BildWahl } from './nachweisArten';
import { fehlerMeldung } from './zustand';
import f from './Formular.module.scss';
import a from './AnmeldungenReiter.module.scss';
import n from './Nachweise.module.scss';

/** Was im Fenster zum Antrag eingegeben ist – die Texte kommen in den Datenblock der Art, die Bilder nur ins HTML. */
export interface AntragFormular {
  an: boolean;
  logo: AntragLogo;
  briefkopf: string;
  ueberschrift: string;
  text: string;
  logoBild: BildWahl;
  unterschrift: BildWahl;
}

/**
 * Die Bilder, die schon in ChurchTools stehen. `undefined` = es gibt noch keinen Antrag, `'laedt'` = wird gelesen,
 * `null` = nicht lesbar (dann bleiben die Bilder beim Speichern unverändert – `antragSichern` prüft das selbst).
 */
export type BisherigeBilder =
  | { logo: string | null; unterschrift: string | null }
  | null
  | undefined
  | 'laedt';

/** A4 bei 96 dpi – die Vorschau zeichnet das Blatt in dieser Größe und verkleinert es auf die Fensterbreite. */
const A4_BREITE = 794;
const A4_HOEHE = 1123;

/** „19. November 2026“ – der Tag der Gemeinde, wie ChurchTools `currentDate` schreibt. */
const heuteText = (): string =>
  new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: gemeindeZeitzone(),
  }).format(new Date());

/**
 * **Die A4-Vorschau.** Sie zeigt das HTML des Erzeugers (`antragVorschau`), nicht eine zweite Darstellung. Das HTML ist
 * escaped (Nutzertext) und enthält nur eingebettete PNG/JPG oder die https-Adresse des Gemeindelogos.
 */
function Vorschau({ html }: { html: string }) {
  const rahmen = useRef<HTMLDivElement>(null);
  const [skala, setSkala] = useState(0.5);
  useEffect(() => {
    const el = rahmen.current;
    if (!el) return;
    const messen = () => setSkala(Math.min(1, el.clientWidth / A4_BREITE) || 0.5);
    messen();
    if (typeof ResizeObserver === 'undefined') return;
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, []);
  return (
    <div
      ref={rahmen}
      className={n.blattRahmen}
      style={{ height: A4_HOEHE * skala }}
      role="img"
      aria-label="Vorschau des Antrags auf einer A4-Seite"
    >
      {/* Nur das Erzeugnis von `antragVorschau`: Nutzertext escaped, Bilder auf PNG/JPG und https begrenzt. */}
      <div
        className={n.blatt}
        data-testid="antrag-vorschau"
        style={{ transform: `scale(${skala})` }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

/** Eine Zeile für Logo oder Unterschrift: Vorschaubild, Text, „Hochladen/Ändern“ und „Entfernen“. */
function BildZeile({
  marke,
  src,
  leerText,
  unlesbar,
  bildVorhanden,
  onNeu,
  onEntfernen,
}: {
  marke: 'Logo' | 'Unterschrift';
  /** Was die Vorschau zeigt (neu gewählt oder bisher), `null`: nichts. */
  src: string | null;
  leerText: string;
  /** Das bisherige Bild lässt sich gerade nicht anzeigen, bleibt aber, wie es ist. */
  unlesbar: boolean;
  bildVorhanden: boolean;
  onNeu: (src: string) => void;
  onEntfernen: () => void;
}) {
  const datei = useRef<HTMLInputElement>(null);
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function waehlen(d: File) {
    setArbeitet(true);
    setFehler(null);
    try {
      onNeu(await antragBildLaden(d));
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
    }
    setArbeitet(false);
  }

  return (
    <div>
      <div className={n.bild}>
        <span className={n.bildMarke}>
          {src ? <img src={src} alt={`${marke} im Antrag`} /> : null}
        </span>
        <span className={n.bildText}>
          <b>{marke}</b>
          <small className={f.hinweis}>
            {src
              ? 'Wird im Antrag gedruckt.'
              : unlesbar
                ? 'Das bisherige Bild lässt sich gerade nicht anzeigen – es bleibt beim Speichern, wie es ist.'
                : leerText}
          </small>
        </span>
        <span className={n.bildKnoepfe}>
          <FensterKnopf art="zweit" disabled={arbeitet} onClick={() => datei.current?.click()}>
            {arbeitet ? 'Lädt …' : bildVorhanden ? 'Ändern' : 'Hochladen'}
          </FensterKnopf>
          {bildVorhanden && (
            <button
              type="button"
              className={f.textKnopf}
              aria-label={`${marke} entfernen`}
              disabled={arbeitet}
              onClick={onEntfernen}
            >
              Entfernen
            </button>
          )}
        </span>
      </div>
      {fehler && (
        <p className={f.fehler} role="alert">
          {fehler}
        </p>
      )}
      <input
        ref={datei}
        type="file"
        accept="image/png,image/jpeg"
        hidden
        aria-label={`${marke} hochladen`}
        onChange={(ev) => {
          const d = ev.target.files?.[0];
          ev.target.value = '';
          if (d) void waehlen(d);
        }}
      />
    </div>
  );
}

/**
 * **„Antrag (Bescheinigung in ChurchTools)“** im Fenster „Nachweis-Art“ (N1c, Entwurf `n-nachweise-v2`, Ansicht 3, nur der
 * Baukasten): Schalter „Mit Antrag“, Logo, Briefkopf, Überschrift, Text mit Einfüge-Pillen, Unterschrift und die A4-Vorschau.
 * Die Eingaben gehören dem Fenster; hier wird nur angezeigt und geändert.
 */
export function AntragAbschnitt({
  wert,
  onAendern,
  gemeindeLogo,
  bisher,
}: {
  wert: AntragFormular;
  onAendern: (aenderung: Partial<AntragFormular>) => void;
  /** Adresse des Gemeindelogos (`undefined` = lädt, `null` = in ChurchTools keins eingestellt oder nicht lesbar). */
  gemeindeLogo: string | null | undefined;
  bisher: BisherigeBilder;
}) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const bisherige = bisher && bisher !== 'laedt' ? bisher : null;
  const unlesbar = bisher === null;

  const bildSrc = (w: BildWahl, alt: string | null | undefined) =>
    w.art === 'neu' ? w.src : w.art === 'unveraendert' ? (alt ?? null) : null;
  const logoSrc =
    wert.logo === 'ohne'
      ? null
      : wert.logo === 'gemeinde'
        ? (gemeindeLogo ?? null)
        : bildSrc(wert.logoBild, bisherige?.logo);
  const unterschriftSrc = bildSrc(wert.unterschrift, bisherige?.unterschrift);

  const html = useMemo(
    () =>
      antragVorschau(
        antragBlatt(wert, { logo: logoSrc, unterschrift: unterschriftSrc }),
        heuteText(),
      ),
    [wert, logoSrc, unterschriftSrc],
  );

  return (
    <>
      <div className={f.feld}>
        <span>Antrag (Bescheinigung in ChurchTools)</span>
        <button
          type="button"
          className={n.antragSchalter}
          aria-pressed={wert.an}
          onClick={() => onAendern({ an: !wert.an })}
        >
          Mit Antrag
          <Schalter an={wert.an} />
        </button>
        <small className={f.hinweis}>
          {wert.an
            ? 'Jede Person dieser Nachweis-Art kann in ChurchTools unter „Meine Gruppen“ → Bescheinigungen den Antrag mit ihren Daten als PDF herunterladen.'
            : 'Ohne Antrag gibt es in ChurchTools keine Bescheinigung. Eine vorhandene wird von der Gruppe abgehängt, aber nicht gelöscht.'}
        </small>
      </div>

      {wert.an && (
        <>
          <div className={f.feld} role="group" aria-label="Logo">
            <span>Logo</span>
            <Segment<AntragLogo>
              ariaLabel="Logo des Antrags"
              value={wert.logo}
              onChange={(logo) => onAendern({ logo })}
              options={[
                { value: 'gemeinde', label: 'Der Gemeinde' },
                { value: 'eigen', label: 'Eigenes Bild' },
                { value: 'ohne', label: 'Ohne Logo' },
              ]}
            />
            {wert.logo === 'gemeinde' && gemeindeLogo === null && (
              <small className={f.hinweis}>
                In ChurchTools ist kein Logo der Gemeinde eingestellt (oder es ließ sich nicht
                laden) – der Antrag hätte dann kein Logo.
              </small>
            )}
          </div>
          {wert.logo === 'eigen' && (
            <BildZeile
              marke="Logo"
              src={logoSrc}
              leerText="Noch kein Logo gewählt. PNG oder JPG, es wird im Browser verkleinert."
              unlesbar={unlesbar && wert.logoBild.art === 'unveraendert'}
              bildVorhanden={logoSrc !== null || (unlesbar && wert.logoBild.art === 'unveraendert')}
              onNeu={(src) => onAendern({ logoBild: { art: 'neu', src } })}
              onEntfernen={() => onAendern({ logoBild: { art: 'keins' } })}
            />
          )}

          <label className={f.feld}>
            <span>Briefkopf</span>
            <input
              className={f.eingabe}
              value={wert.briefkopf}
              maxLength={ANTRAG_BRIEFKOPF_MAX}
              placeholder="Name und Anschrift der Gemeinde"
              onChange={(ev) => onAendern({ briefkopf: ev.target.value })}
            />
            <small className={f.hinweis}>Eine Zeile unter dem Logo, das Datum steht rechts.</small>
          </label>

          <label className={f.feld}>
            <span>Überschrift</span>
            <input
              className={f.eingabe}
              value={wert.ueberschrift}
              maxLength={ANTRAG_UEBERSCHRIFT_MAX}
              onChange={(ev) => onAendern({ ueberschrift: ev.target.value })}
            />
          </label>

          <label className={f.feld}>
            <span>Text des Antrags</span>
            <textarea
              ref={textRef}
              className={`${f.eingabe} ${a.rundmailText}`}
              value={wert.text}
              maxLength={ANTRAG_TEXT_MAX}
              onChange={(ev) => onAendern({ text: ev.target.value })}
            />
          </label>
          <div className={f.feld}>
            <AntwortKnoepfe
              namen={ANTRAG_PLATZHALTER}
              beschriftung="Einfügen"
              wer="ChurchTools setzt die Angaben je Person ein"
              streng
              kennt="der Antrag"
              feld={textRef}
              wert={wert.text}
              onWert={(text) => onAendern({ text })}
            />
            <p className={a.leise}>Eine Leerzeile beginnt einen neuen Absatz.</p>
          </div>

          <BildZeile
            marke="Unterschrift"
            src={unterschriftSrc}
            leerText="Noch keine Unterschrift. PNG oder JPG, steht über „Unterschrift / Stempel der Gemeinde“."
            unlesbar={unlesbar && wert.unterschrift.art === 'unveraendert'}
            bildVorhanden={
              unterschriftSrc !== null || (unlesbar && wert.unterschrift.art === 'unveraendert')
            }
            onNeu={(src) => onAendern({ unterschrift: { art: 'neu', src } })}
            onEntfernen={() => onAendern({ unterschrift: { art: 'keins' } })}
          />
          <small className={f.hinweis}>
            Die Unterschrift wird nur in den Antrag eingebettet – nicht als Bild irgendwo in
            ChurchTools abgelegt.
          </small>

          <p className={n.vorschauKopf}>So sieht der Antrag aus (PDF von ChurchTools)</p>
          <Vorschau html={html} />
        </>
      )}
    </>
  );
}
