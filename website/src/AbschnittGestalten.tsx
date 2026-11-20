import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Segment } from '@ui/bedienung/Segment';
import {
  AUFTEILUNGEN,
  type Abschnitt,
  type Aufteilung,
  type Einstellungen,
  type Gestaltung,
  type Hintergrund,
} from '@shared/website/modell';
import { aufteilungAendern } from '@shared/website/bearbeiten';
import { wirksameFarben } from '@shared/website/theme';
import { PLATZHALTER_BILD } from '@shared/website/vorlagen';
import { Feld, Gruppe } from './Felder';
import { PLATZHALTER_ADRESSE } from './vorschauHtml';
import { neueId } from './ids';
import { ankerMeldung } from './regeln';
import styles from './Fenster.module.scss';

const aufteilungName = (a: Aufteilung) => (a === '1' ? 'Eine' : a.replace(/-/g, ' : '));

/**
 * **Fenster „Abschnitt gestalten“** (W3a-2, Entwurf w3-v1): Hintergrund, Spalten, Abstand, Breite, Höhe, Ausrichtung,
 * Textfarbe, Sprungmarke. **Jede Änderung geht sofort an den Editor** (`onAendern`) und ist in der Vorschau zu sehen – der
 * Abschnitt kommt von dort wieder herein (das Fenster hält ihn nicht selbst). „Abbrechen“ stellt der Editor aus seiner
 * Sicherung wieder her („Rückgängig im offenen Fenster“), „Fertig“ prüft und speichert.
 *
 * Weniger Spalten: Die Inhalte der wegfallenden rutschen in die letzte, nichts geht verloren (`aufteilungAendern`).
 */
export function AbschnittGestalten({
  abschnitt,
  andereAnker,
  einstellungen,
  meldungen,
  onAendern,
  onFertig,
  onAbbrechen,
}: {
  abschnitt: Abschnitt;
  /** Die Sprungmarken der anderen Abschnitte dieser Seite. */
  andereAnker: readonly string[];
  einstellungen: Einstellungen | null;
  /** Was beim Prüfen vor dem Speichern nicht passte. */
  meldungen: readonly string[];
  onAendern: (a: Abschnitt) => void;
  onFertig: () => void;
  onAbbrechen: () => void;
}) {
  const g = abschnitt.gestaltung;
  const farben = wirksameFarben(
    einstellungen ?? { name: '', fusszeile: [], noindex: true, sprache: 'de' },
  );
  const [ankerText, setAnkerText] = useState(g.anker ?? '');
  const ankerProblem = ankerMeldung(ankerText, andereAnker);

  const aendere = (teil: Partial<Gestaltung>) =>
    onAendern({ ...abschnitt, gestaltung: { ...g, ...teil } });
  const hintergrund = (h: Hintergrund) => aendere({ hintergrund: h });

  const farbKachel = (art: 'grund' | 'sanft' | 'haupt' | 'akzent', titel: string, wert: string) => (
    <button
      key={art}
      type="button"
      className={styles.kachel}
      aria-pressed={g.hintergrund.art === art}
      onClick={() => hintergrund({ art })}
    >
      <span className={styles.farbe} style={{ background: wert }} />
      {titel}
    </button>
  );

  return (
    <Sheet
      title="Abschnitt gestalten"
      onClose={onAbbrechen}
      onHintergrund={() => {}}
      knoepfe={
        <FensterKnopf disabled={ankerProblem !== ''} onClick={onFertig}>
          Fertig
        </FensterKnopf>
      }
      onAbbrechen={onAbbrechen}
      mittel
    >
      <Gruppe label="Hintergrund">
        <div className={styles.kacheln}>
          {farbKachel('grund', 'Hell', farben.grund)}
          {farbKachel('sanft', 'Sanft', farben.sanft)}
          {farbKachel('haupt', 'Hauptfarbe', farben.haupt)}
          {farbKachel('akzent', 'Akzent', farben.akzent)}
          <button
            type="button"
            className={styles.kachel}
            aria-pressed={g.hintergrund.art === 'farbe'}
            onClick={() =>
              hintergrund({
                art: 'farbe',
                farbe: g.hintergrund.art === 'farbe' ? g.hintergrund.farbe : farben.haupt,
              })
            }
          >
            <span
              className={styles.farbe}
              style={{
                background: g.hintergrund.art === 'farbe' ? g.hintergrund.farbe : farben.haupt,
              }}
            />
            Eigene Farbe
          </button>
          <button
            type="button"
            className={styles.kachel}
            aria-pressed={g.hintergrund.art === 'bild'}
            onClick={() =>
              hintergrund(
                g.hintergrund.art === 'bild'
                  ? g.hintergrund
                  : { art: 'bild', bild: PLATZHALTER_BILD, abdunkeln: 50 },
              )
            }
          >
            <span
              className={styles.farbe}
              style={{ background: `center / cover url("${PLATZHALTER_ADRESSE}")` }}
            />
            Foto
          </button>
        </div>
        {g.hintergrund.art === 'farbe' && (
          <Feld label="Farbe">
            {(id) => (
              <input
                id={id}
                type="color"
                value={g.hintergrund.art === 'farbe' ? g.hintergrund.farbe : farben.haupt}
                onChange={(e) => hintergrund({ art: 'farbe', farbe: e.target.value })}
              />
            )}
          </Feld>
        )}
        {g.hintergrund.art === 'bild' && (
          <FotoWahl
            abdunkeln={g.hintergrund.abdunkeln}
            onAbdunkeln={(n) =>
              g.hintergrund.art === 'bild' && hintergrund({ ...g.hintergrund, abdunkeln: n })
            }
          />
        )}
      </Gruppe>

      <Gruppe
        label="Spalten"
        hilfe="Am Handy stehen die Spalten untereinander. Weniger Spalten: Die Inhalte rutschen in die letzte Spalte, nichts geht verloren."
      >
        <div className={styles.kacheln}>
          {AUFTEILUNGEN.map((a) => (
            <button
              key={a}
              type="button"
              className={styles.kachel}
              aria-pressed={abschnitt.aufteilung === a}
              onClick={() => onAendern(aufteilungAendern(abschnitt, a, neueId))}
            >
              <span className={styles.muster}>
                {a.split('-').map((n, i) => (
                  <i key={i} style={{ flex: Number(n) }} />
                ))}
              </span>
              {aufteilungName(a)}
            </button>
          ))}
        </div>
      </Gruppe>

      <Gruppe label="Abstand oben und unten">
        <Segment
          verbunden
          ariaLabel="Abstand oben und unten"
          value={g.abstand}
          onChange={(v) => aendere({ abstand: v })}
          options={[
            { value: 'kein', label: 'Kein' },
            { value: 'klein', label: 'Klein' },
            { value: 'normal', label: 'Normal' },
            { value: 'gross', label: 'Groß' },
          ]}
        />
      </Gruppe>
      <Gruppe label="Breite">
        <Segment
          verbunden
          ariaLabel="Breite"
          value={g.breite}
          onChange={(v) => aendere({ breite: v })}
          options={[
            { value: 'schmal', label: 'Schmal' },
            { value: 'normal', label: 'Normal' },
            { value: 'breit', label: 'Breit' },
            { value: 'voll', label: 'Ganze Breite' },
          ]}
        />
      </Gruppe>
      <Gruppe label="Höhe">
        <Segment
          verbunden
          ariaLabel="Höhe"
          value={g.hoehe}
          onChange={(v) => aendere({ hoehe: v })}
          options={[
            { value: 'auto', label: 'Nach Inhalt' },
            { value: 'halb', label: 'Halber Bildschirm' },
            { value: 'voll', label: 'Ganzer Bildschirm' },
          ]}
        />
      </Gruppe>
      <Gruppe label="Ausrichtung">
        <Segment
          verbunden
          ariaLabel="Ausrichtung"
          value={g.ausrichtung}
          onChange={(v) => aendere({ ausrichtung: v })}
          options={[
            { value: 'links', label: 'Links' },
            { value: 'mitte', label: 'Mittig' },
          ]}
        />
      </Gruppe>
      <Gruppe label="Senkrecht (Spalten nebeneinander)">
        <Segment
          verbunden
          ariaLabel="Senkrechte Ausrichtung"
          value={g.senkrecht}
          onChange={(v) => aendere({ senkrecht: v })}
          options={[
            { value: 'oben', label: 'Oben' },
            { value: 'mitte', label: 'Mittig' },
          ]}
        />
      </Gruppe>
      <Gruppe label="Textfarbe">
        <Segment
          verbunden
          ariaLabel="Textfarbe"
          value={g.text}
          onChange={(v) => aendere({ text: v })}
          options={[
            { value: 'auto', label: 'Automatisch' },
            { value: 'dunkel', label: 'Dunkel' },
            { value: 'hell', label: 'Hell' },
          ]}
        />
      </Gruppe>

      <Feld
        label="Sprungmarke (optional)"
        hilfe={
          ankerProblem ? (
            <span role="alert" className={styles.fehler}>
              {ankerProblem}
            </span>
          ) : (
            'Damit kann ein Knopf direkt zu diesem Abschnitt springen.'
          )
        }
      >
        {(id) => (
          <input
            id={id}
            className={styles.eingabe}
            value={ankerText}
            placeholder="z. B. gottesdienst"
            onChange={(e) => {
              const v = e.target.value.trim();
              setAnkerText(v);
              if (ankerMeldung(v, andereAnker) !== '') return;
              if (v === '') {
                const ohne = { ...g };
                delete ohne.anker;
                onAendern({ ...abschnitt, gestaltung: ohne });
              } else aendere({ anker: v });
            }}
          />
        )}
      </Feld>

      {meldungen.length > 0 && (
        <ul className={styles.meldungen} role="alert">
          {meldungen.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      <p className={styles.unterText}>Änderungen siehst du sofort in der Vorschau.</p>
    </Sheet>
  );
}

/** Das Foto eines Abschnitts: vorerst nur das Platzhalter-Bild – echte Bilder kommen mit W4 (Bilder-Ablage). */
function FotoWahl({
  abdunkeln,
  onAbdunkeln,
}: {
  abdunkeln: number;
  onAbdunkeln: (n: number) => void;
}) {
  return (
    <>
      <div className={styles.fotoPlatz}>
        <img src={PLATZHALTER_ADRESSE} alt="" />
        <p>
          Hier steht vorerst ein Platzhalter-Bild. Eigene Bilder hochladen und auswählen kommt in
          einem der nächsten Schritte.
        </p>
      </div>
      <Feld label={`Abdunkeln: ${abdunkeln} %`} hilfe="Damit der Text auf dem Foto lesbar bleibt.">
        {(id) => (
          <input
            id={id}
            type="range"
            min={0}
            max={90}
            step={5}
            value={abdunkeln}
            onChange={(e) => onAbdunkeln(Number(e.target.value))}
          />
        )}
      </Feld>
    </>
  );
}
