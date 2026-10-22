import { Sheet } from '@ui/fenster/Sheet';
import { GruppenKachel } from '@ui/bedienung/GruppenKachel';
import { PersonBild } from '@ui/bedienung/PersonBild';
import { ctBasis } from '@ui/ct/basis';
import { gruppenFarbe } from '@shared/organigramm/farbe';
import type { Knoten } from '@shared/organigramm/gruppen';
import { rollenRang } from '@shared/organigramm/mitglieder';
import { gruppenPersonen } from '@shared/organigramm/personen';
import type { MitgliederDaten } from './ladeMitglieder';
import type { Start } from './start';
import styles from './GruppenFenster.module.scss';

const anzahl = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;

interface Props {
  start: Start;
  knoten: Knoten;
  mitglieder: MitgliederDaten | null;
  onGruppe: (id: number) => void;
  onNachladen: () => void;
  onSchliessen: () => void;
}

/**
 * **Das Gruppenfenster** (O2): Mitglieder nach Rollen (Leitung zuerst, Reihenfolge wie in ChurchTools), Ober- und
 * Untergruppen zum Weiterklicken, die Dienste der Gruppe und „In ChurchTools öffnen“. Nur ansehen – ändern kommt
 * mit O5/O6. Modal in der Mitte (`Sheet`), wie alle Fenster der Gemeinde-Apps.
 */
export function GruppenFenster({
  start,
  knoten,
  mitglieder,
  onGruppe,
  onNachladen,
  onSchliessen,
}: Props) {
  const g = knoten.gruppe;
  const stand = mitglieder?.je.get(g.id);
  const rang = rollenRang(start.rollen);
  const person = (id: number) => mitglieder?.personen.get(id);
  const name = (id: number) => person(id)?.name ?? '';
  const liste = stand?.art === 'sichtbar' ? gruppenPersonen(stand.mitglieder, name, rang) : [];

  // Abschnitte je Rolle, in der Reihenfolge von ChurchTools
  const abschnitte: { rolle: string; ids: number[] }[] = [];
  for (const m of liste) {
    const rolle = (m.rolleId !== null ? start.rollen.get(m.rolleId)?.name : null) ?? 'Mitglied';
    const letzter = abschnitte[abschnitte.length - 1];
    if (letzter?.rolle === rolle) letzter.ids.push(m.personId);
    else abschnitte.push({ rolle, ids: [m.personId] });
  }

  const obergruppen = (start.eltern.get(g.id) ?? [])
    .map((id) => start.gruppen.find((x) => x.id === id))
    .filter((x) => x !== undefined);
  const dienste = start.dienste
    ? [...start.dienste.values()].filter((d) => d.gruppenIds.includes(g.id))
    : [];
  const typ = g.typId !== null ? start.typNamen.get(g.typId) : undefined;

  return (
    <Sheet title={g.name} onClose={onSchliessen} cancelLabel="Schließen">
      <div className={styles.kopf}>
        <GruppenKachel name={g.name} farbe={gruppenFarbe(g, start.typFarben)} groesse={40} />
        <p className={styles.meta}>
          {[typ, stand?.art === 'sichtbar' ? anzahl(liste.length, 'Person', 'Personen') : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      {!mitglieder && <p className={styles.leise}>Mitglieder werden geladen …</p>}
      {stand?.art === 'verborgen' && (
        <p className={styles.leise}>
          Die Mitglieder dieser Gruppe darfst du in ChurchTools nicht sehen.
        </p>
      )}
      {stand?.art === 'fehler' && (
        <p className={styles.leise}>
          Die Mitglieder ließen sich gerade nicht laden.{' '}
          <button type="button" className={styles.link} onClick={onNachladen}>
            Erneut versuchen
          </button>
        </p>
      )}
      {stand?.art === 'sichtbar' && liste.length === 0 && (
        <p className={styles.leise}>Keine Mitglieder sichtbar.</p>
      )}

      {abschnitte.map((a) => (
        <section key={a.rolle} className={styles.abschnitt} aria-label={a.rolle}>
          <h3>
            {a.rolle} · {a.ids.length}
          </h3>
          <ul className={styles.personen}>
            {a.ids.map((id) => {
              const p = person(id);
              return (
                <li key={id}>
                  {p && <PersonBild name={p.name} bild={p.bild} initialen={p.initialen} />}
                  <span>{name(id)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {(obergruppen.length > 0 || knoten.kinder.length > 0) && (
        <section className={styles.abschnitt}>
          {obergruppen.length > 0 && <h3>Gehört zu</h3>}
          <div className={styles.gruppen}>
            {obergruppen.map((o) => (
              <button
                key={o.id}
                type="button"
                className={styles.gruppe}
                onClick={() => onGruppe(o.id)}
              >
                <GruppenKachel
                  name={o.name}
                  farbe={gruppenFarbe(o, start.typFarben)}
                  groesse={20}
                />
                {o.name}
              </button>
            ))}
          </div>
          {knoten.kinder.length > 0 && <h3>Untergruppen</h3>}
          <div className={styles.gruppen}>
            {knoten.kinder.map((k) => (
              <button
                key={k.gruppe.id}
                type="button"
                className={styles.gruppe}
                onClick={() => onGruppe(k.gruppe.id)}
              >
                <GruppenKachel
                  name={k.gruppe.name}
                  farbe={gruppenFarbe(k.gruppe, start.typFarben)}
                  groesse={20}
                />
                {k.gruppe.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {dienste.length > 0 && (
        <section className={styles.abschnitt}>
          <h3>Dienste aus dieser Gruppe</h3>
          <p className={styles.dienste}>{dienste.map((d) => d.name).join(' · ')}</p>
        </section>
      )}

      <a className={styles.oeffnen} href={`${ctBasis()}/groups/${g.id}/dashboard`} target="_top">
        In ChurchTools öffnen
      </a>
    </Sheet>
  );
}
