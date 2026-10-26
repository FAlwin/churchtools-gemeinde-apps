import { Sheet } from '@ui/fenster/Sheet';
import { GruppenKachel } from '@ui/bedienung/GruppenKachel';
import { PersonBild } from '@ui/bedienung/PersonBild';
import { ctBasis } from '@ui/ct/basis';
import { gruppenFarbe } from '@shared/organigramm/farbe';
import { rollenRang } from '@shared/organigramm/mitglieder';
import type { PersonImBereich } from '@shared/organigramm/sichtbereich';
import type { EinsaetzeStand } from './ladeEinsaetze';
import type { MitgliederDaten } from './ladeMitglieder';
import type { Start } from './start';
import styles from './GruppenFenster.module.scss';

const datum = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '–';

interface Props {
  start: Start;
  person: PersonImBereich;
  mitglieder: MitgliederDaten | null;
  einsaetze: EinsaetzeStand;
  onGruppe: (id: number) => void;
  onSchliessen: () => void;
}

/**
 * **Das Personenfenster** (O3): Gruppen der Person (im eigenen Bereich) mit Rolle, Einsätze je Dienst in den letzten
 * 6 Monaten, der letzte Einsatz und „In ChurchTools öffnen“. Nur ansehen. Stile wie das Gruppenfenster (eine Datei).
 */
export function PersonFenster({
  start,
  person,
  mitglieder,
  einsaetze,
  onGruppe,
  onSchliessen,
}: Props) {
  const p = mitglieder?.personen.get(person.personId);
  const name = p?.name ?? `Person ${person.personId}`;
  const rang = rollenRang(start.rollen);
  const gruppen = [...person.gruppen].sort((a, b) => rang(a.rolleId) - rang(b.rolleId));
  const e =
    einsaetze.art === 'fertig' ? einsaetze.einsaetze.jePerson.get(person.personId) : undefined;
  const jeDienst = [...(e?.jeDienst ?? new Map<number, number>())].sort((a, b) => b[1] - a[1]);

  return (
    <Sheet title={name} onClose={onSchliessen} cancelLabel="Schließen" knoepfe={null}>
      <div className={styles.kopf}>
        {p && <PersonBild name={p.name} bild={p.bild} initialen={p.initialen} groesse={40} />}
        <p className={styles.meta}>
          {einsaetze.art === 'fertig'
            ? `${e?.vergangen ?? 0} Einsätze in 6 Monaten · ${e?.kommend ?? 0} eingeteilt in den nächsten 3`
            : einsaetze.art === 'laedt'
              ? 'Einsätze werden geladen …'
              : 'Einsätze gerade nicht ladbar'}
        </p>
      </div>

      <section className={styles.abschnitt} aria-label="Gruppen">
        <h3>Gruppen</h3>
        <div className={styles.gruppen}>
          {gruppen.map((g) => {
            const gr = start.gruppen.find((x) => x.id === g.gruppeId);
            if (!gr) return null;
            return (
              <button
                key={g.gruppeId}
                type="button"
                className={styles.gruppe}
                onClick={() => onGruppe(gr.id)}
              >
                <GruppenKachel
                  name={gr.name}
                  farbe={gruppenFarbe(gr, start.typFarben)}
                  groesse={20}
                />
                {gr.name}
                {g.rolleId !== null && ` · ${start.rollen.get(g.rolleId)?.name ?? ''}`}
              </button>
            );
          })}
        </div>
      </section>

      {jeDienst.length > 0 && (
        <section className={styles.abschnitt} aria-label="Einsätze je Dienst">
          <h3>Einsätze je Dienst (6 Monate)</h3>
          <ul className={styles.personen}>
            {jeDienst.map(([dienst, n]) => (
              <li key={dienst}>
                <span>{start.dienste?.get(dienst)?.name ?? `Dienst ${dienst}`}</span>
                <span className={styles.meta}>{n}×</span>
              </li>
            ))}
          </ul>
          <p className={styles.meta}>Zuletzt: {datum(e?.letzter ?? null)}</p>
        </section>
      )}

      <a
        className={styles.oeffnen}
        href={`${ctBasis()}/?q=churchdb#PersonView/searchEntry:%23${person.personId}/`}
        target="_top"
      >
        In ChurchTools öffnen
      </a>
    </Sheet>
  );
}
