import type { Person } from '@shared/organigramm/mitglieder';
import type { Planung } from '@shared/protokolle/planen';
import felder from './Fensterfelder.module.scss';

/** Auswahl der Dauer (Minuten); eine abweichende Dauer (der letzten Sitzung, des Termins) kommt dazu. */
const DAUERN = [30, 45, 60, 90, 120, 150, 180, 240];
const dauerText = (min: number) =>
  min % 60 === 0
    ? `${min / 60} Stunde${min === 60 ? '' : 'n'}`
    : min > 60
      ? `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} Stunden`
      : `${min} Minuten`;

/**
 * **Titel, Datum, Uhrzeit und Dauer einer Sitzung** – die eine Stelle für „Nächste Sitzung festlegen“ (S5-2), „Neues
 * Protokoll“ (K2a, ohne Dauer) und „Sitzung bearbeiten“ (K2b).
 */
export function Planungsfelder({
  p,
  onChange,
  gesperrt,
  mitDauer = true,
  fruehestens,
}: {
  p: Planung;
  onChange: (p: Planung) => void;
  gesperrt: boolean;
  mitDauer?: boolean;
  /** Frühester wählbarer Tag (`JJJJ-MM-TT`). */
  fruehestens?: string;
}) {
  const setze = <K extends keyof Planung>(k: K, v: Planung[K]) => onChange({ ...p, [k]: v });
  const dauern = DAUERN.includes(p.dauer) ? DAUERN : [...DAUERN, p.dauer].sort((a, b) => a - b);
  return (
    <>
      <label className={felder.feld}>
        <span>Titel</span>
        <input
          className={felder.eingabe}
          value={p.titel}
          disabled={gesperrt}
          onChange={(e) => setze('titel', e.target.value)}
        />
      </label>
      <div className={felder.zeile}>
        <label className={felder.feld}>
          <span>Datum</span>
          <input
            type="date"
            className={felder.eingabe}
            value={p.tag}
            min={fruehestens}
            disabled={gesperrt}
            onChange={(e) => setze('tag', e.target.value)}
          />
        </label>
        <label className={felder.feld}>
          <span>Uhrzeit</span>
          <input
            type="time"
            className={felder.eingabe}
            value={p.uhrzeit}
            disabled={gesperrt}
            onChange={(e) => setze('uhrzeit', e.target.value)}
          />
        </label>
      </div>
      {mitDauer && (
        <label className={felder.feld}>
          <span>Dauer</span>
          <select
            className={felder.eingabe}
            value={p.dauer}
            disabled={gesperrt}
            onChange={(e) => setze('dauer', Number(e.target.value))}
          >
            {dauern.map((d) => (
              <option key={d} value={d}>
                {dauerText(d)}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}

/** **Wer eingeladen ist** – Häkchen je Mitglied (S5-2, K2b). `ich` bekommt den Zusatz „du – sagst gleich zu“. */
export function Einladeliste({
  liste,
  gewaehlt,
  onChange,
  gesperrt,
  ich,
  zusatz,
}: {
  liste: readonly Person[];
  gewaehlt: ReadonlySet<number>;
  /** Die Auswahl nach einem Tipp auf ein Häkchen. */
  onChange: (neu: ReadonlySet<number>) => void;
  gesperrt: boolean;
  ich: number;
  /** Ein kleiner Zusatz je Person (K2b: „wird eingeladen“, „wird ausgeladen“). */
  zusatz?: (id: number) => string | null;
}) {
  return (
    <ul className={felder.personen} aria-label="Einladen">
      {liste.map((x) => {
        const z = zusatz?.(x.id) ?? (x.id === ich ? 'du – sagst gleich zu' : null);
        return (
          <li key={x.id}>
            <label className={felder.person}>
              <input
                type="checkbox"
                className={felder.haken}
                checked={gewaehlt.has(x.id)}
                disabled={gesperrt}
                onChange={() => {
                  const neu = new Set(gewaehlt);
                  if (neu.has(x.id)) neu.delete(x.id);
                  else neu.add(x.id);
                  onChange(neu);
                }}
              />
              <span>{x.name}</span>
              {z && <small>{z}</small>}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
