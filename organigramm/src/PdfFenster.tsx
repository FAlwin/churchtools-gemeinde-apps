import { useEffect, useMemo, useRef, useState } from 'react';
import type { jsPDF } from 'jspdf';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { ZeilenKnopf } from '@ui/bedienung/ZeilenKnopf';
import { Icon } from '@ui/icons/icons';
import { svgSeitenPdf } from '@ui/teilen/svgSeitenPdf';
import { downloadPdf, oeffnePdf } from '@ui/teilen/sharePdf';
import { ladeGemeindeLogo } from '@ui/ct/logo';
import type { Knoten } from '@shared/organigramm/gruppen';
import type { Rolle } from '@shared/organigramm/mitglieder';
import type { PersonenWahl } from '@shared/organigramm/personen';
import {
  anordnen,
  knotenAmPfad,
  sichtbarerBaum,
  spitzenWahl,
  type AnordnungsArt,
} from '@shared/organigramm/ansichten';
import { DiagrammBild } from './DiagrammBild';
import { BlattSeite, ListenInhalt, type BlattKopf } from './BlattSeite';
import { messung, useSchrift } from './messung';
import { pdfPersonenWahl, personenInhalt } from './kastenPersonen';
import type { MitgliederDaten } from './ladeMitglieder';
import { textBreite } from './textBreite';
import {
  einpassen,
  KLEINSTE_PT,
  listenSeiten,
  PAPIERE,
  papierFuer,
  pdfDateiname,
  schriftPt,
  type PapierWahl,
} from './blatt';
import { ANSICHT_NAMEN, type BaumAnsicht } from './auswahl';
import fenster from './GruppenFenster.module.scss';
import styles from './PdfFenster.module.scss';

type PdfArt = AnordnungsArt | 'liste';
const ARTEN = (['oben', 'links', 'mindmap', 'liste'] as const).map((a: PdfArt) => ({
  wert: a,
  name: ANSICHT_NAMEN[a],
}));

interface Props {
  /** Der Baum wie im Reiter (Typ-Filter, große Bereiche zuerst). */
  baum: readonly Knoten[];
  gemeinde: string;
  /** Was im Reiter aufgeklappt ist – gilt, wenn nicht „alles aufgeklappt“ gewählt ist. */
  offen: ReadonlySet<string>;
  /** Anfangen bei – vom Reiter übernommen. */
  spitze: string | null;
  /** Ansicht des Reiters; Karten gibt es auf Papier nicht, dann von oben. */
  ansicht: BaumAnsicht;
  /**
   * Personen (O7b-6b): das Häkchen ist an, wenn der Reiter Personen zeigt, und zeigt dessen Stufe – bei „Aus“ im Reiter
   * die Rollen (Alwin, 29.10.2026).
   */
  personen: {
    wahl: PersonenWahl;
    mitglieder: MitgliederDaten | null;
    rollen: ReadonlyMap<number, Rolle>;
  };
  onSchliessen: () => void;
  /** Für Tests: das Datum auf dem Blatt. */
  heute?: Date;
}

/**
 * **Organigramm als PDF** (O7b-4, Entwurf `o7b-4-pdf-v1.html`, abgenommen 28.10.2026): Ansicht, Ausschnitt, Papier,
 * „Alles aufgeklappt“ und das Logo der Gemeinde, mit Vorschau. Die Vorschau IST das Blatt – dieselben Seiten werden zur
 * PDF (`svgSeitenPdf`). Gedruckt wird aus der geöffneten PDF: So bleibt quer auch in Safari quer, und am Rand steht
 * keine Adresse des Browsers.
 *
 * Die PDF entsteht, sobald sich etwas ändert, nicht erst beim Antippen: Safari öffnet ein neues Fenster nur direkt im
 * Klick (wie die Druckliste der Anmeldungen und das Teilen-Fenster der Musik-App).
 */
export function PdfFenster({
  baum,
  gemeinde,
  offen,
  spitze,
  ansicht,
  personen,
  onSchliessen,
  heute,
}: Props) {
  const [art, setArt] = useState<PdfArt>(ansicht === 'karten' ? 'oben' : ansicht);
  const [ausschnitt, setAusschnitt] = useState<string | null>(
    spitze !== null && knotenAmPfad(baum, spitze) ? spitze : null,
  );
  const [papierWahl, setPapierWahl] = useState<PapierWahl>('passend');
  const [alles, setAlles] = useState(true);
  const [logo, setLogo] = useState<string | null>(null);
  const [mitLogo, setMitLogo] = useState(true);
  const [mitPersonen, setMitPersonen] = useState(personen.wahl !== 'aus');
  const [blatt, setBlatt] = useState(0);
  const [pdf, setPdf] = useState<jsPDF | null>(null);
  const [fehler, setFehler] = useState(false);
  const [versuch, setVersuch] = useState(0);
  const [datum] = useState(() => heute ?? new Date());

  const messRef = useRef<HTMLDivElement>(null);
  const schrift = useSchrift(messRef);
  const { mitglieder, rollen, wahl } = personen;
  const inhalt = useMemo(
    () => (mitPersonen ? personenInhalt(mitglieder, rollen, pdfPersonenWahl(wahl)) : undefined),
    [mitPersonen, mitglieder, rollen, wahl],
  );
  const { breite, hoehe, kasten, kuerzen } = useMemo(
    () => messung(schrift, inhalt),
    [schrift, inhalt],
  );
  const seitenRef = useRef<(SVGSVGElement | null)[]>([]);

  // Das Logo ist Beiwerk: Lädt es nicht, steht das Blatt ohne da.
  useEffect(() => {
    let aktuell = true;
    ladeGemeindeLogo().then(
      (l) => aktuell && setLogo(l),
      () => undefined,
    );
    return () => {
      aktuell = false;
    };
  }, []);

  const sicht = useMemo(
    () => sichtbarerBaum(baum, gemeinde, ausschnitt, offen, alles),
    [baum, gemeinde, ausschnitt, offen, alles],
  );
  const anordnung = useMemo(
    () => (art === 'liste' ? null : anordnen(art, sicht, breite, hoehe)),
    [art, sicht, breite, hoehe],
  );
  const papier = papierFuer(papierWahl, anordnung?.rahmen ?? null);
  const lage = anordnung ? einpassen(anordnung.rahmen, papier) : null;
  const listen = useMemo(
    () =>
      anordnung
        ? null
        : listenSeiten(
            sicht,
            papier,
            inhalt && {
              inhalt,
              mass: (t, f, groesse) => textBreite(t, f, schrift.name, groesse),
            },
          ),
    [anordnung, sicht, papier, inhalt, schrift.name],
  );
  const seitenZahl = listen ? listen.length : 1;
  const gezeigt = Math.min(blatt, seitenZahl - 1);

  const stand = `Stand ${datum.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  const kopf = useMemo<BlattKopf>(
    () => ({
      titel: 'Organigramm',
      unter: ausschnitt === null ? gemeinde : `${gemeinde} · ${sicht.name}`,
      stand,
      logo: mitLogo ? logo : null,
      fuss: `${gemeinde} · Organigramm aus ChurchTools`,
    }),
    [ausschnitt, gemeinde, sicht.name, stand, mitLogo, logo],
  );

  // Nach jedem Zeichnen die PDF zu genau diesen Seiten. Wer während des Bauens umschaltet, bekommt die PDF zur NEUEN
  // Wahl – die alte wird verworfen.
  useEffect(() => {
    let aktuell = true;
    setPdf(null);
    setFehler(false);
    const seiten = seitenRef.current
      .slice(0, seitenZahl)
      .filter((s): s is SVGSVGElement => s !== null)
      .map((svg) => ({ svg, breite: papier.breite, hoehe: papier.hoehe }));
    svgSeitenPdf(seiten, { titel: `Organigramm – ${sicht.name}`, thema: stand }).then(
      (doc) => aktuell && setPdf(doc),
      () => aktuell && setFehler(true),
    );
    return () => {
      aktuell = false;
    };
  }, [anordnung, listen, papier, kopf, kuerzen, sicht.name, stand, seitenZahl, versuch]);

  const pt = lage ? schriftPt(lage.massstab) : null;
  const hinweis = listen
    ? listen.length > 1
      ? `Die Liste läuft über ${listen.length} Seiten.`
      : ''
    : pt !== null && pt < KLEINSTE_PT
      ? `Die Schrift wird sehr klein (etwa ${pt.toFixed(1).replace('.', ',')} pt). Besser A3 wählen, einen Ausschnitt nehmen oder „Alles aufgeklappt“ ausschalten.`
      : `${papierWahl === 'passend' ? `Passend gewählt: ${papier.label}. ` : ''}Schrift im Diagramm etwa ${Math.round(pt ?? 0)} pt.`;
  const datei = pdfDateiname(sicht.name, datum);

  return (
    <Sheet
      title="Organigramm als PDF"
      onClose={onSchliessen}
      mittel
      knoepfe={
        <>
          <FensterKnopf art="hell" disabled={!pdf} onClick={() => pdf && downloadPdf(pdf, datei)}>
            Herunterladen
          </FensterKnopf>
          <FensterKnopf disabled={!pdf} onClick={() => pdf && oeffnePdf(pdf, datei)}>
            {pdf || fehler ? 'PDF öffnen' : 'PDF wird erstellt …'}
          </FensterKnopf>
        </>
      }
    >
      <div ref={messRef} className={styles.wahl}>
        <label className={fenster.beschriftung}>
          Ansicht
          <select
            className={fenster.feld}
            value={art}
            onChange={(e) => setArt(e.target.value as PdfArt)}
          >
            {ARTEN.map((a) => (
              <option key={a.wert} value={a.wert}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fenster.beschriftung}>
          Ausschnitt
          <select
            className={fenster.feld}
            value={ausschnitt ?? ''}
            onChange={(e) => {
              setAusschnitt(e.target.value || null);
              setBlatt(0);
            }}
          >
            {spitzenWahl(baum, ausschnitt).map((w) => (
              <option key={w.wert} value={w.wert}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fenster.beschriftung}>
          Papier
          <select
            className={fenster.feld}
            value={papierWahl}
            onChange={(e) => setPapierWahl(e.target.value as PapierWahl)}
          >
            <option value="passend">Passend</option>
            {PAPIERE.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.haken}>
        <label>
          <input type="checkbox" checked={alles} onChange={(e) => setAlles(e.target.checked)} />
          Alles aufgeklappt
        </label>
        <label>
          <input
            type="checkbox"
            checked={mitPersonen}
            onChange={(e) => setMitPersonen(e.target.checked)}
          />
          Personen
        </label>
        {logo && (
          <label>
            <input
              type="checkbox"
              checked={mitLogo}
              onChange={(e) => setMitLogo(e.target.checked)}
            />
            Logo der Gemeinde
          </label>
        )}
      </div>

      <div className={styles.vorschau} role="figure" aria-label="Vorschau">
        {Array.from({ length: seitenZahl }, (_, i) => (
          <BlattSeite
            key={i}
            svgRef={(el) => {
              seitenRef.current[i] = el;
            }}
            papier={papier}
            kopf={kopf}
            nr={i + 1}
            von={seitenZahl}
            verborgen={i !== gezeigt}
          >
            {anordnung && lage ? (
              <g transform={`translate(${lage.x} ${lage.y}) scale(${lage.massstab})`}>
                <DiagrammBild
                  anordnung={anordnung}
                  kuerzen={kuerzen}
                  zeilen={(k) => kasten(k).zeilen}
                />
              </g>
            ) : (
              <ListenInhalt papier={papier} zeilen={listen?.[i] ?? []} />
            )}
          </BlattSeite>
        ))}
      </div>
      {seitenZahl > 1 && (
        <div className={styles.blaettern}>
          <ZeilenKnopf
            label="Vorige Seite"
            disabled={gezeigt === 0}
            onClick={() => setBlatt(gezeigt - 1)}
          >
            <Icon name="chev-left" size={16} />
          </ZeilenKnopf>
          Seite {gezeigt + 1} von {seitenZahl}
          <ZeilenKnopf
            label="Nächste Seite"
            disabled={gezeigt >= seitenZahl - 1}
            onClick={() => setBlatt(gezeigt + 1)}
          >
            <Icon name="chev-right" size={16} />
          </ZeilenKnopf>
        </div>
      )}
      {hinweis && (
        <p className={pt !== null && pt < KLEINSTE_PT ? fenster.fehler : fenster.leise}>
          {hinweis}
        </p>
      )}
      <p className={fenster.leise}>Zum Drucken die PDF öffnen und dort drucken.</p>
      {fehler && (
        <p className={fenster.fehler} role="alert">
          Die PDF ließ sich gerade nicht erstellen.{' '}
          <button type="button" className={fenster.link} onClick={() => setVersuch((v) => v + 1)}>
            Noch einmal versuchen
          </button>
        </p>
      )}
    </Sheet>
  );
}
