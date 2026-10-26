import { useState } from 'react';
import { PersonBild } from '@ui/bedienung/PersonBild';
import { personenSuchen, type Gefunden } from '@ui/ct/personen';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { rollenFuerTyp } from '@shared/organigramm/mitglieder';
import type { OrgGruppe } from '@shared/organigramm/gruppen';
import type { Start } from './start';
import styles from './GruppenFenster.module.scss';

/**
 * **Die Schritte im Gruppenfenster, die Mitglieder ändern** (Bauplan O6): Person aufnehmen, Rolle wählen. Wie die
 * Struktur-Schritte (O5) IM Fenster; Auswahl und Knöpfe hält das Gruppenfenster (E6-O F5), denn „Aufnehmen“ und
 * „Ändern“ stehen unten in seiner Fußzeile. Gesucht wird mit derselben Suche wie bei den Anmeldungen
 * (`ui/ct/personen`) – nur Personen, die es schon gibt (Alwin, 23.10.2026).
 */

const ganzerName = (p: Gefunden) => `${p.vor} ${p.nach}`.trim();

export function PersonAufnehmen({
  start,
  gruppe,
  dabei,
  gewaehlt,
  rolleId,
  onWahl,
  onRolle,
}: {
  start: Start;
  gruppe: OrgGruppe;
  /** Wer schon (aktiv) in der Gruppe ist – steht als „schon dabei“ in den Treffern. */
  dabei: ReadonlySet<number>;
  /** Die gewählte Person – dann steht statt der Suche die Wahl der Rolle da. */
  gewaehlt: Gefunden | null;
  rolleId: number | null;
  onWahl: (person: Gefunden) => void;
  onRolle: (rolleId: number) => void;
}) {
  const rollen = rollenFuerTyp(start.rollen, gruppe.typId);
  const [suche, setSuche] = useState('');
  const [treffer, setTreffer] = useState<Gefunden[] | null>(null);
  const [sucht, setSucht] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const suchen = async () => {
    setSucht(true);
    setFehler(null);
    try {
      setTreffer(await personenSuchen(suche));
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
    } finally {
      setSucht(false);
    }
  };

  return (
    <section className={styles.schritt} aria-label="Person aufnehmen">
      <h3>Person in „{gruppe.name}“ aufnehmen</h3>
      {rollen.length === 0 && (
        <p className={styles.fehler}>Für diesen Gruppentyp kennt ChurchTools keine Rollen.</p>
      )}
      {!gewaehlt && (
        <>
          <form
            className={styles.suchzeile}
            onSubmit={(ev) => {
              ev.preventDefault();
              void suchen();
            }}
          >
            <input
              className={styles.feld}
              type="search"
              aria-label="Name"
              placeholder="Name"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className={styles.zweit}
              disabled={sucht || suche.trim().length < 2}
            >
              {sucht ? 'Sucht …' : 'Suchen'}
            </button>
          </form>
          {fehler && <p className={styles.fehler}>{fehler}</p>}
          {treffer && (
            <ul className={styles.ziele} aria-label="Gefunden">
              {treffer.length === 0 && <li className={styles.leise}>Niemand gefunden.</li>}
              {treffer.map((p) => {
                const ist = dabei.has(p.personId);
                return (
                  <li key={p.personId}>
                    <button
                      type="button"
                      className={styles.ziel}
                      disabled={ist}
                      onClick={() => onWahl(p)}
                    >
                      <PersonBild
                        name={ganzerName(p)}
                        bild={null}
                        initialen={`${p.vor.charAt(0)}${p.nach.charAt(0)}`.toUpperCase()}
                        groesse={24}
                      />
                      <span>{ganzerName(p)}</span>
                      {ist && <span className={styles.marke}>schon dabei</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className={styles.leise}>
            Nur Personen, die es in ChurchTools schon gibt. Neue legt das Büro dort an.
          </p>
        </>
      )}
      {gewaehlt && (
        <>
          <p className={styles.frage}>„{ganzerName(gewaehlt)}“ aufnehmen als …</p>
          <label className={styles.beschriftung}>
            Rolle
            <select
              className={styles.feld}
              value={rolleId ?? ''}
              onChange={(e) => onRolle(Number(e.target.value))}
            >
              {rollen.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </section>
  );
}

export function RolleWaehlen({
  start,
  gruppe,
  name,
  jetzt,
  rolleId,
  onRolle,
}: {
  start: Start;
  gruppe: OrgGruppe;
  name: string;
  jetzt: number | null;
  rolleId: number | null;
  onRolle: (rolleId: number) => void;
}) {
  const rollen = rollenFuerTyp(start.rollen, gruppe.typId);
  const rolle = rollen.find((r) => r.id === rolleId);
  return (
    <section className={styles.schritt} aria-label="Rolle ändern">
      <h3>Rolle von „{name}“</h3>
      <label className={styles.beschriftung}>
        Rolle
        <select
          className={styles.feld}
          value={rolleId ?? ''}
          onChange={(e) => onRolle(Number(e.target.value))}
        >
          {rollen.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      {rolle?.leitung && rolleId !== jetzt && (
        <p className={styles.leise}>
          Als Leitung bekommt „{name}“ in ChurchTools die Rechte, die eine Leitung von „
          {gruppe.name}“ hat.
        </p>
      )}
    </section>
  );
}
