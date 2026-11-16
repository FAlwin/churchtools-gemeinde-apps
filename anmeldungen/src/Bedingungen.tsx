import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Segment } from '@ui/bedienung/Segment';
import { Icon } from '@ui/icons/icons';
import type { Feld, Formular } from '@shared/anmeldung/formular';
import {
  KURZ_MAX,
  VERGLEICH_TEXT,
  bedingungSatz,
  kaputteStellen,
  kurzname,
  moeglicheQuellen,
  vergleicheFuer,
  vergleichMitWert,
  wahlAntworten,
  bedingungAufbereiten,
  gleicheBedingung,
  type AntwortBedingung,
  type Bedingung,
  type Regel,
} from '@shared/anmeldung/bedingungen';
import { antwortSatz, regelFuer, standardRegel, zielName } from './bedingungTexte';
import k from './Baukasten.module.scss';

/**
 * **Bedingungen im Baukasten** (Etappe F1c, Entwurf `f1-bedingungen-nachweise-v1` Ansicht 1, abgenommen 11.11.2026):
 * das Fenster „Nur zeigen, wenn …“ an einer Frage und „Nur wählbar, wenn …“ an einer Antwort, dazu die Hinweise am
 * Feld. Die Regeln selbst (welche Quellen, welche Vergleiche, was kaputt ist) stehen in `@shared/anmeldung/bedingungen`.
 */

/** Das Zeichen für Bedingungen – ein Pfeil, der abbiegt (wie im Entwurf). */
export function BedingungZeichen({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 2v6a3 3 0 0 0 3 3h7m-3-3 3 3-3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * **Die Hinweise unter einem Feld** – wann es erscheint, welche Antworten nur unter Bedingung wählbar sind, und rot,
 * was an einer Bedingung nicht stimmt (Entwurf: „Hinweis-Chip am Feld“).
 */
export function BedingungChips({
  formular,
  feld,
  ohneAntworten = false,
}: {
  formular: Formular;
  feld: Feld;
  /** Im Bearbeiten stehen die Antwort-Bedingungen an den Antworten selbst. */
  ohneAntworten?: boolean;
}) {
  const kaputt = kaputteStellen(formular).filter((s) => s.ziel.id === feld.id);
  const antworten = ohneAntworten ? [] : Object.entries(feld.antwortBed ?? {});
  if (!feld.bed && !antworten.length && !kaputt.length) return null;
  return (
    <div className={k.bedChips}>
      {feld.bed && (
        <span className={k.bedChip}>
          <BedingungZeichen />
          <span>Nur wenn {bedingungSatz(formular, feld.bed)}</span>
        </span>
      )}
      {antworten.map(([antwort, b]) => (
        <span key={antwort} className={k.bedChip}>
          <BedingungZeichen />
          <span>
            „{antwort}“ nur wählbar, wenn {bedingungSatz(formular, b)}
          </span>
        </span>
      ))}
      {kaputt.map((s, i) => (
        <span key={i} className={k.bedKaputt} role="alert">
          <Icon name="warnung" size={14} />
          <span>{s.text}</span>
        </span>
      ))}
    </div>
  );
}

/** Höchstzahl der Regeln je Bedingung (wie im Schema). */
const REGELN_MAX = 10;

/**
 * **Der Block „Bedingung“** – die Zeilen „wenn … oder …“, der Umschalter „eine reicht / alle müssen“ und „+ Bedingung“.
 * Derselbe im Fenster an Frage oder Antwort (F1c) und in der Regel-Liste (F1d).
 */
export function BedingungBlock({
  bed,
  quellen,
  onBed,
}: {
  bed: AntwortBedingung;
  /** Die Fragen, auf die die Bedingung schauen darf. */
  quellen: Feld[];
  onBed: (bed: AntwortBedingung) => void;
}) {
  const regelAendern = (i: number, r: Regel) =>
    onBed({ ...bed, regeln: bed.regeln.map((x, j) => (i === j ? r : x)) });
  const quelleVon = (r: Regel) => quellen.find((q) => q.id === r.feld);
  return (
    <section className={k.bedBlock} aria-label="Bedingung">
      <div className={k.bedBlockKopf}>
        <span className={k.bedBlockTitel}>Bedingung</span>
        {bed.regeln.length > 1 && (
          <Segment
            className={k.bedModus}
            ariaLabel="Verknüpfung"
            value={bed.modus}
            onChange={(modus) => onBed({ ...bed, modus })}
            options={[
              { value: 'eine', label: 'eine reicht' },
              { value: 'alle', label: 'alle müssen' },
            ]}
          />
        )}
      </div>
      {bed.regeln.map((r, i) => {
        const q = quelleVon(r);
        const ops = q ? vergleicheFuer(q) : [r.op];
        return (
          <div key={i} className={k.bedRegel}>
            <span className={k.bedWort}>
              {i === 0 ? 'wenn' : bed.modus === 'alle' ? 'und' : 'oder'}
            </span>
            <select
              aria-label={`Frage ${i + 1}`}
              value={q ? r.feld : ''}
              onChange={(e) => {
                const neu = quellen.find((x) => x.id === e.target.value);
                if (neu) regelAendern(i, regelFuer(neu));
              }}
            >
              {!q && <option value="">(Frage fehlt)</option>}
              {quellen.map((x) => (
                <option key={x.id} value={x.id}>
                  {kurzname(x)}
                </option>
              ))}
            </select>
            <select
              aria-label={`Vergleich ${i + 1}`}
              // Ohne Antwort-Spalte nimmt der Vergleich ihren Platz („ist ausgefüllt“ wurde abgeschnitten).
              className={vergleichMitWert(r.op) ? undefined : k.bedOpBreit}
              value={r.op}
              onChange={(e) => {
                const op = e.target.value as Regel['op'];
                regelAendern(i, q ? regelFuer(q, op) : { ...r, op });
              }}
            >
              {ops.map((op) => (
                <option key={op} value={op}>
                  {VERGLEICH_TEXT[op]}
                </option>
              ))}
            </select>
            {vergleichMitWert(r.op) ? (
              <select
                aria-label={`Antwort ${i + 1}`}
                value={r.wert ?? ''}
                onChange={(e) => regelAendern(i, { ...r, wert: e.target.value })}
              >
                {(q ? wahlAntworten(q) : [r.wert ?? '']).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              className={k.bedWeg}
              aria-label={`Bedingung ${i + 1} entfernen`}
              onClick={() => onBed({ ...bed, regeln: bed.regeln.filter((_, j) => j !== i) })}
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        );
      })}
      {bed.regeln.length < REGELN_MAX && quellen.length > 0 && (
        <button
          type="button"
          className={k.bedPlus}
          onClick={() => onBed({ ...bed, regeln: [...bed.regeln, standardRegel(quellen)] })}
        >
          + Bedingung
        </button>
      )}
    </section>
  );
}

/** **„Sonst ausgrauen / ausblenden“** mit Hinweis – für Bedingungen an Antworten (F1c und Regel-Liste). */
export function DarstellungWahl({
  bed,
  onBed,
}: {
  bed: AntwortBedingung;
  onBed: (bed: AntwortBedingung) => void;
}) {
  return (
    <div className={k.bedDarstellung}>
      <label>
        Sonst{' '}
        <select
          aria-label="Darstellung"
          value={bed.art}
          onChange={(e) => onBed({ ...bed, art: e.target.value as 'grau' | 'weg' })}
        >
          <option value="grau">ausgrauen</option>
          <option value="weg">ausblenden</option>
        </select>
      </label>
      {bed.art === 'grau' && (
        <label>
          mit Hinweis{' '}
          <input
            type="text"
            aria-label="Hinweis"
            value={bed.grund ?? ''}
            maxLength={KURZ_MAX}
            placeholder="z. B. nur für Getaufte"
            onChange={(e) => onBed({ ...bed, grund: e.target.value })}
          />
        </label>
      )}
    </div>
  );
}

/**
 * **Das Fenster „Nur zeigen, wenn …“** – für eine Frage (`antwort` fehlt) oder eine einzelne Antwort. Als Quelle gehen
 * nur Fragen davor (`moeglicheQuellen`), so entstehen keine Kreise. „Speichern“ ohne Regel entfernt die Bedingung.
 */
export function BedingungFenster({
  formular,
  ziel,
  antwort,
  onSpeichern,
  onClose,
}: {
  formular: Formular;
  ziel: Feld;
  /** Bei einer Antwort: ihr Text (der Schlüssel in `antwortBed`). */
  antwort?: string;
  /** `null` = Bedingung entfernen. */
  onSpeichern: (bed: Bedingung | AntwortBedingung | null) => void;
  onClose: () => void;
}) {
  const quellen = moeglicheQuellen(formular, ziel);
  const bisher = antwort === undefined ? ziel.bed : ziel.antwortBed?.[antwort];
  const [bed, setBed] = useState<AntwortBedingung>(() =>
    bisher
      ? { art: 'grau', ...structuredClone(bisher) }
      : { modus: 'eine', regeln: [standardRegel(quellen)], art: 'grau', grund: '' },
  );
  // Teilen sich andere Felder dieselbe Bedingung? Hier ändert sie sich nur für dieses (Entwurf F1, Ansicht 1).
  const andere = bisher ? gleicheBedingung(formular, { id: ziel.id, antwort }) : [];

  const name = kurzname(ziel);
  const satz = !bed.regeln.length
    ? 'Ohne Bedingung gilt nichts – „Speichern“ entfernt sie.'
    : antwort !== undefined
      ? antwortSatz(formular, antwort, bed)
      : `Die Frage erscheint nur, wenn ${bedingungSatz(formular, bed)}. Pflicht gilt nur, solange sie zu sehen ist.`;

  return (
    <Sheet
      title={antwort !== undefined ? `Antwort „${antwort}“` : `Bedingung: ${name}`}
      onClose={onClose}
      mittel
      links={
        bisher ? (
          <FensterKnopf art="loeschen" onClick={() => onSpeichern(null)}>
            Bedingung entfernen
          </FensterKnopf>
        ) : undefined
      }
      knoepfe={
        <FensterKnopf onClick={() => onSpeichern(bedingungAufbereiten(bed, antwort !== undefined))}>
          Speichern
        </FensterKnopf>
      }
    >
      <div className={k.bedFenster}>
        <BedingungBlock bed={bed} quellen={quellen} onBed={setBed} />

        <section className={k.bedBlock} aria-label="Dann">
          <span className={k.bedBlockTitel}>Dann</span>
          {antwort === undefined ? (
            <p>
              zeige: <span className={k.bedZiel}>{name}</span>
            </p>
          ) : (
            <>
              <p>
                <b>„{antwort}“</b> ist nur wählbar in: <span className={k.bedZiel}>{name}</span>
              </p>
              <DarstellungWahl bed={bed} onBed={setBed} />
            </>
          )}
        </section>

        <p className={k.bedSatz}>{satz}</p>
        {andere.length > 0 && (
          <p className={k.bedNotiz}>
            Dieselbe Bedingung haben auch:{' '}
            {andere.map((z) => `„${zielName(formular, z)}“`).join(', ')}. Hier änderst du sie nur
            für diese {antwort === undefined ? 'Frage' : 'Antwort'}; gemeinsam geht es im Reiter
            „Bedingungen“.
          </p>
        )}
      </div>
    </Sheet>
  );
}
