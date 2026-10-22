import { useMemo, useState } from 'react';
import { GruppenKachel } from '@ui/bedienung/GruppenKachel';
import { PersonBild } from '@ui/bedienung/PersonBild';
import { gruppenFarbe } from '@shared/organigramm/farbe';
import { istLeitung, rollenRang, type Mitglied } from '@shared/organigramm/mitglieder';
import { personenImBereich, type Sichtbereich } from '@shared/organigramm/sichtbereich';
import { dienstGruppen, dienstTeamOhneEinsatz, fastJedeWoche } from '@shared/organigramm/hinweise';
import type { Einsaetze } from '@shared/organigramm/einsaetze';
import type { MitgliederDaten } from './ladeMitglieder';
import type { EinsaetzeStand } from './ladeEinsaetze';
import type { Start } from './start';
import styles from './Personen.module.scss';

type Filter = 'alle' | 'viel' | 'mehrere' | 'still' | 'leitung';
const FILTER: { id: Filter; label: string; braucht?: 'einsaetze' }[] = [
  { id: 'alle', label: 'Alle' },
  { id: 'viel', label: 'Fast jede Woche', braucht: 'einsaetze' },
  { id: 'mehrere', label: 'In 3+ Gruppen' },
  { id: 'still', label: 'Ohne Einsatz', braucht: 'einsaetze' },
  { id: 'leitung', label: 'Leitung' },
];

interface Props {
  start: Start;
  mitglieder: MitgliederDaten | null;
  einsaetze: EinsaetzeStand;
  bereich: Sichtbereich;
  onPerson: (id: number) => void;
  onEinsaetzeNachladen: () => void;
}

/**
 * **Personen** (O3): alle Personen im eigenen Bereich (geleitete Gruppen samt Untergruppen, Admins: alle) mit ihren
 * Gruppen, Einsätzen der letzten 6 Monate und Einteilungen der nächsten 3. Filter und Hinweise rechnen mit
 * DENSELBEN Regeln (`fastJedeWoche`, `dienstTeamOhneEinsatz`).
 */
export function Personen({
  start,
  mitglieder,
  einsaetze,
  bereich,
  onPerson,
  onEinsaetzeNachladen,
}: Props) {
  const [filter, setFilter] = useState<Filter>('alle');
  const [suche, setSuche] = useState('');
  const rang = useMemo(() => rollenRang(start.rollen), [start.rollen]);
  const e: Einsaetze | null = einsaetze.art === 'fertig' ? einsaetze.einsaetze : null;

  const personen = useMemo(() => {
    const m = new Map<number, Mitglied[]>();
    for (const [id, s] of mitglieder?.je ?? []) if (s.art === 'sichtbar') m.set(id, s.mitglieder);
    return [...personenImBereich(m, bereich).values()];
  }, [mitglieder, bereich]);
  const teams = useMemo(() => dienstGruppen(start.dienste), [start.dienste]);
  const name = (id: number) => mitglieder?.personen.get(id)?.name ?? `Person ${id}`;
  const gruppe = (id: number) => start.gruppen.find((g) => g.id === id);

  const passt: Record<Filter, (p: (typeof personen)[number]) => boolean> = {
    alle: () => true,
    viel: (p) => !!e && fastJedeWoche(e, p.personId),
    mehrere: (p) => p.gruppen.length >= 3,
    still: (p) => !!e && dienstTeamOhneEinsatz(p, teams, e),
    leitung: (p) => p.gruppen.some((g) => istLeitung(start.rollen, g.rolleId)),
  };
  const s = suche.trim().toLowerCase();
  const liste = personen
    .filter(passt[filter])
    .filter((p) => !s || name(p.personId).toLowerCase().includes(s))
    .sort(
      (a, b) =>
        (e?.jePerson.get(b.personId)?.vergangen ?? 0) -
          (e?.jePerson.get(a.personId)?.vergangen ?? 0) ||
        name(a.personId).localeCompare(name(b.personId), 'de'),
    );
  const max = Math.max(1, ...personen.map((p) => e?.jePerson.get(p.personId)?.vergangen ?? 0));

  if (!mitglieder) return <p className={styles.leise}>Personen werden geladen …</p>;

  return (
    <div className={styles.seite}>
      <div className={styles.filter} role="group" aria-label="Filter">
        {FILTER.filter((f) => !f.braucht || e).map((f) => (
          <button
            key={f.id}
            type="button"
            className={styles.kasten}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            <b>{personen.filter(passt[f.id]).length}</b>
            <span>{f.label}</span>
          </button>
        ))}
      </div>
      <input
        className={styles.suche}
        type="search"
        placeholder="Person suchen …"
        aria-label="Person suchen"
        value={suche}
        onChange={(ev) => setSuche(ev.target.value)}
      />
      {einsaetze.art === 'laedt' && <p className={styles.leise}>Einsätze werden geladen …</p>}
      {einsaetze.art === 'fehler' && (
        <p className={styles.hinweis} role="status">
          Die Einsätze ließen sich gerade nicht laden.{' '}
          <button type="button" className={styles.link} onClick={onEinsaetzeNachladen}>
            Erneut versuchen
          </button>
        </p>
      )}
      <div className={styles.karte}>
        <table className={styles.tabelle}>
          <thead>
            <tr>
              <th>Name</th>
              <th className={styles.spalteGruppen}>Gruppen</th>
              <th>Einsätze (6 Monate)</th>
              <th className={styles.spalteKommend}>Eingeteilt (3 Monate)</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((p) => {
              const x = mitglieder.personen.get(p.personId);
              const n = e?.jePerson.get(p.personId)?.vergangen ?? 0;
              const gruppen = [...p.gruppen].sort((a, b) => rang(a.rolleId) - rang(b.rolleId));
              return (
                <tr key={p.personId} onClick={() => onPerson(p.personId)}>
                  <td>
                    <button
                      type="button"
                      className={styles.person}
                      onClick={() => onPerson(p.personId)}
                    >
                      {x && <PersonBild name={x.name} bild={x.bild} initialen={x.initialen} />}
                      {name(p.personId)}
                    </button>
                  </td>
                  <td className={styles.spalteGruppen}>
                    <span className={styles.gruppen}>
                      {gruppen.map((g) => {
                        const gr = gruppe(g.gruppeId);
                        if (!gr) return null;
                        const l = istLeitung(start.rollen, g.rolleId);
                        return (
                          <span
                            key={g.gruppeId}
                            className={l ? styles.gruppeLeitung : styles.gruppe}
                          >
                            <GruppenKachel
                              name={gr.name}
                              farbe={gruppenFarbe(gr, start.typFarben)}
                              groesse={16}
                            />
                            {gr.name}
                            {l && ` · ${start.rollen.get(g.rolleId!)?.name ?? 'Leitung'}`}
                          </span>
                        );
                      })}
                    </span>
                  </td>
                  <td>
                    {e ? (
                      <span
                        className={fastJedeWoche(e, p.personId) ? styles.zahlViel : styles.zahl}
                      >
                        <b>{n}</b>
                        <span className={styles.balken}>
                          <i style={{ width: `${(n / max) * 100}%` }} />
                        </span>
                      </span>
                    ) : (
                      <span className={styles.leise}>–</span>
                    )}
                  </td>
                  <td className={styles.spalteKommend}>
                    {e ? (e.jePerson.get(p.personId)?.kommend ?? 0) : '–'}
                  </td>
                </tr>
              );
            })}
            {liste.length === 0 && (
              <tr>
                <td colSpan={4} className={styles.leise}>
                  Niemand gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className={styles.fuss}>
        Einsätze, soweit ChurchTools sie dir zeigt – letzte 6 und nächste 3 Monate, zugesagt oder
        angefragt.
      </p>
    </div>
  );
}
