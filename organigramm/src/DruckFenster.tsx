import { useMemo, useRef, useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import type { Knoten } from '@shared/organigramm/gruppen';
import {
  anordnen,
  knotenAmPfad,
  sichtbarerBaum,
  spitzenWahl,
  type AnordnungsArt,
} from '@shared/organigramm/ansichten';
import { DiagrammBild } from './DiagrammBild';
import { Liste } from './Liste';
import { messung, useSchrift } from './messung';
import { drucken, druckHtml, eigeneStile, PAPIERE, schriftRegeln, type Papier } from './drucken';
import type { BaumAnsicht } from './auswahl';
import fenster from './GruppenFenster.module.scss';
import styles from './DruckFenster.module.scss';

type DruckArt = AnordnungsArt | 'liste';
const ARTEN: { wert: DruckArt; name: string }[] = [
  { wert: 'oben', name: 'Von oben' },
  { wert: 'links', name: 'Von links' },
  { wert: 'mindmap', name: 'Mindmap' },
  { wert: 'liste', name: 'Liste' },
];
/** Rand ums Diagramm in der Vorschau und auf Papier (Einheiten des Bildes). */
const BILDRAND = 16;

interface Props {
  /** Der Baum wie im Reiter (Typ-Filter, große Bereiche zuerst). */
  baum: readonly Knoten[];
  gemeinde: string;
  /** Was im Reiter aufgeklappt ist – gilt, wenn nicht „alles aufgeklappt“ gedruckt wird. */
  offen: ReadonlySet<string>;
  /** Anfangen bei – vom Reiter übernommen. */
  spitze: string | null;
  /** Ansicht des Reiters; Karten gibt es auf Papier nicht, dann von oben. */
  ansicht: BaumAnsicht;
  onSchliessen: () => void;
}

/**
 * **Drucken / als PDF speichern** (O7b-4, Entwurf `o7b-ansichten-v1.html`): Ansicht, Ausschnitt, Papier und „alles
 * aufgeklappt“, mit Vorschau. Gedruckt wird genau, was die Vorschau zeigt – in einem eigenen Druck-Dokument
 * (`drucken.ts`), damit die Leiste von ChurchTools nicht mitkommt. „Als PDF sichern“ wählt man im Druckfenster des
 * Browsers.
 */
export function DruckFenster({ baum, gemeinde, offen, spitze, ansicht, onSchliessen }: Props) {
  const [art, setArt] = useState<DruckArt>(ansicht === 'karten' ? 'oben' : ansicht);
  const [ausschnitt, setAusschnitt] = useState<string | null>(
    spitze !== null && knotenAmPfad(baum, spitze) ? spitze : null,
  );
  const [papier, setPapier] = useState<Papier>(PAPIERE[0]);
  const [alles, setAlles] = useState(true);
  const [druckt, setDruckt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const blatt = useRef<HTMLDivElement>(null);
  const schrift = useSchrift(blatt);
  const { breite, kuerzen } = useMemo(() => messung(schrift), [schrift]);

  const sicht = useMemo(
    () => sichtbarerBaum(baum, gemeinde, ausschnitt, offen, alles),
    [baum, gemeinde, ausschnitt, offen, alles],
  );
  const anordnung = useMemo(
    () => (art === 'liste' ? null : anordnen(art, sicht, breite)),
    [art, sicht, breite],
  );
  const titel = `Organigramm · ${sicht.name}`;
  const stand = `Stand ${new Date().toLocaleDateString('de-DE')}`;

  const losDrucken = async () => {
    if (!blatt.current) return;
    setDruckt(true);
    setFehler(null);
    try {
      const html = druckHtml({
        titel,
        inhalt: blatt.current.outerHTML,
        papier,
        schrift: schriftRegeln(Array.from(document.styleSheets), location.href),
        stile: eigeneStile(document, new URL(import.meta.env.BASE_URL, location.href).href),
      });
      await drucken(html);
      onSchliessen();
    } catch {
      setFehler('Das Drucken ließ sich gerade nicht starten. Bitte noch einmal versuchen.');
      setDruckt(false);
    }
  };

  const r = anordnung?.rahmen;
  return (
    <Sheet
      title="Drucken / als PDF speichern"
      onClose={onSchliessen}
      mittel
      beschaeftigt={druckt}
      knoepfe={
        <FensterKnopf disabled={druckt} onClick={() => void losDrucken()}>
          {druckt ? 'Wird vorbereitet …' : 'Drucken'}
        </FensterKnopf>
      }
    >
      <div className={styles.wahl}>
        <label className={fenster.beschriftung}>
          Ansicht
          <select
            className={fenster.feld}
            value={art}
            onChange={(e) => setArt(e.target.value as DruckArt)}
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
            onChange={(e) => setAusschnitt(e.target.value || null)}
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
            value={papier.id}
            onChange={(e) => setPapier(PAPIERE.find((p) => p.id === e.target.value) ?? PAPIERE[0])}
          >
            {PAPIERE.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={styles.haken}>
        <input type="checkbox" checked={alles} onChange={(e) => setAlles(e.target.checked)} />
        Alles aufgeklappt drucken
      </label>

      <div
        className={styles.vorschau}
        style={{ aspectRatio: `${papier.breite} / ${papier.hoehe}` }}
        aria-label="Vorschau"
        role="figure"
      >
        <div ref={blatt} className={styles.blatt}>
          <div className={styles.kopf}>
            <b>{titel}</b>
            <span>{stand}</span>
          </div>
          {anordnung && r ? (
            <svg
              className={styles.bild}
              viewBox={`${r.x - BILDRAND} ${r.y - BILDRAND} ${r.breite + 2 * BILDRAND} ${r.hoehe + 2 * BILDRAND}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={titel}
            >
              <DiagrammBild anordnung={anordnung} kuerzen={kuerzen} />
            </svg>
          ) : (
            <Liste sicht={sicht} />
          )}
        </div>
      </div>
      <p className={fenster.leise}>
        Im Druckfenster „Als PDF sichern“ wählen, um eine PDF-Datei zu bekommen.
      </p>
      {fehler && (
        <p className={fenster.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}
