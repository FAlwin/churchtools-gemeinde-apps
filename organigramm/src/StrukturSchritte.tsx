import { useMemo, useState } from 'react';
import { GruppenKachel } from '@ui/bedienung/GruppenKachel';
import { gruppenFarbe } from '@shared/organigramm/farbe';
import type { OrgGruppe } from '@shared/organigramm/gruppen';
import { moeglicheObergruppen, nameFehler } from '@shared/organigramm/struktur';
import type { Start } from './start';
import styles from './GruppenFenster.module.scss';

/**
 * **Die Schritte im Gruppenfenster, die die Struktur ändern** (Bauplan O5): Ziel wählen, bestätigen, Untergruppe
 * anlegen. Sie stehen IM Fenster statt in einem zweiten darüber (Fenster sind Modale, nie gestapelt) und ersetzen
 * dessen Inhalt; ihre Knöpfe („Zurück“ zur Ansicht der Gruppe, der Hauptknopf) setzt das Gruppenfenster unten in die
 * Fußzeile (E6-O F5).
 */

export function ZielWaehlen({
  start,
  gruppe,
  titel,
  onWahl,
}: {
  start: Start;
  gruppe: OrgGruppe;
  titel: string;
  onWahl: (ziel: OrgGruppe) => void;
}) {
  const [suche, setSuche] = useState('');
  const ziele = useMemo(
    () => moeglicheObergruppen(start.gruppen, start.eltern, gruppe.id),
    [start.gruppen, start.eltern, gruppe.id],
  );
  const s = suche.trim().toLowerCase();
  const treffer = ziele.filter((z) => !s || z.pfad.join(' ').toLowerCase().includes(s));
  return (
    <section className={styles.schritt} aria-label={titel}>
      <h3>{titel}</h3>
      <input
        className={styles.feld}
        type="search"
        placeholder="Gruppe suchen …"
        aria-label="Gruppe suchen"
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        autoFocus
      />
      <ul className={styles.ziele}>
        {treffer.map((z) => (
          <li key={z.gruppe.id}>
            <button type="button" className={styles.ziel} onClick={() => onWahl(z.gruppe)}>
              <GruppenKachel
                name={z.gruppe.name}
                farbe={gruppenFarbe(z.gruppe, start.typFarben)}
                groesse={20}
              />
              <span>{z.pfad.join(' › ')}</span>
            </button>
          </li>
        ))}
      </ul>
      {treffer.length === 0 && <p className={styles.leise}>Keine passende Gruppe.</p>}
    </section>
  );
}

export function Bestaetigen({
  frage,
  folgen,
}: {
  frage: string;
  /** Was sich an den Rechten ändert – Rechte wirken in ChurchTools nach unten (O0 §5). */
  folgen: string;
}) {
  return (
    <section className={styles.schritt} aria-label="Bestätigen">
      <p className={styles.frage}>{frage}</p>
      <p className={styles.leise}>{folgen}</p>
    </section>
  );
}

export function Anlegen({
  formular,
  start,
  obergruppe,
  typen,
  onAnlegen,
}: {
  /** Die `id` des Formulars – „Anlegen“ unten in der Fußzeile schickt es ab (`form=`). */
  formular: string;
  start: Start;
  obergruppe: OrgGruppe;
  /** Die Gruppentypen, in denen man anlegen darf. */
  typen: number[];
  onAnlegen: (name: string, typId: number) => void;
}) {
  const [name, setName] = useState('');
  // Vorbelegt mit dem Typ der Obergruppe (Alwin, 23.10.2026) – wenn man in dem anlegen darf.
  const [typ, setTyp] = useState(
    obergruppe.typId !== null && typen.includes(obergruppe.typId) ? obergruppe.typId : typen[0],
  );
  const [versucht, setVersucht] = useState(false);
  const fehler = nameFehler(name);
  const absenden = () => {
    setVersucht(true);
    if (!fehler) onAnlegen(name.trim(), typ);
  };
  return (
    <form
      id={formular}
      className={styles.schritt}
      aria-label="Untergruppe anlegen"
      onSubmit={(e) => {
        e.preventDefault();
        absenden();
      }}
    >
      <h3>Neue Untergruppe in „{obergruppe.name}“</h3>
      <label className={styles.beschriftung}>
        Name
        <input
          className={styles.feld}
          value={name}
          maxLength={255}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </label>
      {versucht && fehler && <p className={styles.fehler}>{fehler}</p>}
      <label className={styles.beschriftung}>
        Gruppentyp
        <select
          className={styles.feld}
          value={typ}
          onChange={(e) => setTyp(Number(e.target.value))}
        >
          {typen.map((t) => (
            <option key={t} value={t}>
              {start.typNamen.get(t) ?? `Typ ${t}`}
            </option>
          ))}
        </select>
      </label>
      <p className={styles.leise}>
        Status „aktiv“. Leitung und Mitglieder trägst du danach in ChurchTools ein.
      </p>
    </form>
  );
}
