import { GruppenKachel } from '@ui/bedienung/GruppenKachel';
import { PersonBild } from '@ui/bedienung/PersonBild';
import { Icon } from '@ui/icons/icons';
import { gruppenFarbe } from '@shared/organigramm/farbe';
import type { Hinweis } from '@shared/organigramm/hinweise';
import type { EinsaetzeStand } from './ladeEinsaetze';
import type { MitgliederDaten } from './ladeMitglieder';
import type { Start } from './start';
import styles from './Hinweise.module.scss';

interface Props {
  start: Start;
  hinweise: Hinweis[];
  mitglieder: MitgliederDaten | null;
  einsaetze: EinsaetzeStand;
  onGruppe: (id: number) => void;
  onPerson: (id: number) => void;
  onEinsaetzeNachladen: () => void;
}

/**
 * **Hinweise** (O3) im eigenen Bereich – Karten wie „Status“ in ChurchTools, mit den betroffenen Gruppen und Personen
 * zum Anklicken. Gerechnet wird in `shared/organigramm/hinweise.ts`.
 */
export function Hinweise({
  start,
  hinweise,
  mitglieder,
  einsaetze,
  onGruppe,
  onPerson,
  onEinsaetzeNachladen,
}: Props) {
  if (!mitglieder) return <p className={styles.leise}>Hinweise werden berechnet …</p>;
  return (
    <div className={styles.liste}>
      {einsaetze.art === 'laedt' && <p className={styles.leise}>Einsätze werden geladen …</p>}
      {einsaetze.art === 'fehler' && (
        <p className={styles.leise} role="status">
          Ohne Einsätze fehlen „fast jede Woche“ und „ohne Einsatz“.{' '}
          <button type="button" className={styles.link} onClick={onEinsaetzeNachladen}>
            Erneut versuchen
          </button>
        </p>
      )}
      {hinweise.length === 0 && <p className={styles.leise}>Keine Hinweise in deinem Bereich.</p>}
      {hinweise.map((h) => (
        <section
          key={h.titel}
          className={`${styles.karte} ${h.art === 'warnung' ? styles.warnung : styles.info}`}
          aria-label={h.titel}
        >
          <span className={styles.symbol} aria-hidden="true">
            <Icon name="info" size={18} />
          </span>
          <div className={styles.inhalt}>
            <h3>{h.titel}</h3>
            <p>{h.text}</p>
            <div className={styles.verweise}>
              {h.gruppen.map((id) => {
                const g = start.gruppen.find((x) => x.id === id);
                return g ? (
                  <button
                    key={`g${id}`}
                    type="button"
                    className={styles.verweis}
                    onClick={() => onGruppe(id)}
                  >
                    <GruppenKachel
                      name={g.name}
                      farbe={gruppenFarbe(g, start.typFarben)}
                      groesse={18}
                    />
                    {g.name}
                  </button>
                ) : null;
              })}
              {h.personen.map((id) => {
                const p = mitglieder.personen.get(id);
                return (
                  <button
                    key={`p${id}`}
                    type="button"
                    className={styles.verweis}
                    onClick={() => onPerson(id)}
                  >
                    {p && (
                      <PersonBild
                        name={p.name}
                        bild={p.bild}
                        initialen={p.initialen}
                        groesse={20}
                      />
                    )}
                    {p?.name ?? `Person ${id}`}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
