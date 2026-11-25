import { useMemo, useState } from 'react';
import { kandidatenFiltern, type Kandidat } from '@shared/protokolle/besprechungsanfrage';
import { Schalter } from '@ui/bedienung/Schalter';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import type { Fehlermeldung } from '@ui/ct/fehlerMeldung';
import formular from './TerminFormular.module.scss';
import felder from './Fensterfelder.module.scss';
import styles from './TerminAnfragen.module.scss';

interface Props {
  kalenderName: string;
  kandidaten: readonly Kandidat[];
  laedt: boolean;
  fehler: Fehlermeldung | null;
  onNeu: () => void;
  /** „Besprechungsanfrage erstellen“ – aus ist die Vorgabe. */
  an: boolean;
  onAn: (an: boolean) => void;
  /** Die Gewählten (ohne mich – ich bin immer dabei, sobald der Schalter an ist). */
  gewaehlt: ReadonlySet<number>;
  onGewaehlt: (neu: ReadonlySet<number>) => void;
  ich: number;
  deaktiviert: boolean;
}

/**
 * **Der Reiter „Besprechungsanfragen“ des ChurchTools-Dialogs „Termin erstellen“** (W15-4, nur bei Gruppenkalendern): ein
 * Schalter „Besprechungsanfrage erstellen“ (aus = Vorgabe), darunter – wenn er an ist – das Suchfeld und die Tabelle
 * **Name (mit Gruppe) | Status** mit Haken je Person und „alle“ oben. **Ich** bin vorgewählt und nicht abwählbar (ich sage
 * mit dem Anlegen sofort zu und bekomme keine Mail). Die Regeln stehen in `@shared/protokolle/besprechungsanfrage`, die
 * Mail-Zählung in `einladungsmail`; die Warnung „geht sofort per Mail“ steht im Fuß des Fensters (`EinladungHinweis`).
 */
export function TerminAnfragen(p: Props) {
  const [suche, setSuche] = useState('');
  const sichtbar = useMemo(() => kandidatenFiltern(p.kandidaten, suche), [p.kandidaten, suche]);
  const gewaehltOderIch = (id: number) => id === p.ich || p.gewaehlt.has(id);
  const alleGewaehlt = sichtbar.length > 0 && sichtbar.every((k) => gewaehltOderIch(k.id));
  const aus = p.deaktiviert;

  const setzen = (id: number, ja: boolean) => {
    const neu = new Set(p.gewaehlt);
    if (ja) neu.add(id);
    else neu.delete(id);
    p.onGewaehlt(neu);
  };
  const alle = (ja: boolean) => {
    const neu = new Set(p.gewaehlt);
    for (const k of sichtbar)
      if (ja) neu.add(k.id);
      else neu.delete(k.id);
    p.onGewaehlt(neu);
  };

  return (
    <div className={styles.anfragen}>
      <label className={styles.schalter}>
        <input
          type="checkbox"
          role="switch"
          className={styles.versteckt}
          checked={p.an}
          disabled={aus}
          onChange={(ev) => p.onAn(ev.target.checked)}
        />
        <Schalter an={p.an} />
        <span>Besprechungsanfrage erstellen</span>
      </label>
      <p className={styles.leise}>
        Es können alle Personen angefragt werden, die berechtigt sind, den Gruppenkalender „
        {p.kalenderName}“ zu sehen.
      </p>
      {p.an && (
        <>
          <p className={styles.leise}>
            Bei Wiederholungsterminen wird die gesamte Serie angefragt.
          </p>
          {p.fehler && (
            <p className={styles.leise} role="alert">
              {p.fehler.text} <TextKnopf onClick={p.onNeu}>Noch einmal versuchen</TextKnopf>
            </p>
          )}
          <input
            type="search"
            className={`${formular.eingabe} ${styles.suche}`}
            aria-label="Nach Name oder Gruppe suchen"
            placeholder="Nach Name oder Gruppe suchen …"
            value={suche}
            disabled={aus}
            onChange={(ev) => setSuche(ev.target.value)}
          />
          {p.laedt && <p className={styles.leise}>Personen werden geladen …</p>}
          {!p.laedt && !p.fehler && !p.kandidaten.length && (
            <p className={styles.leise}>Es gibt niemanden, der angefragt werden kann.</p>
          )}
          {sichtbar.length > 0 && (
            <table className={styles.tabelle}>
              <thead>
                <tr>
                  <th scope="col" className={styles.haken}>
                    <input
                      type="checkbox"
                      className={felder.haken}
                      aria-label="Alle angezeigten Personen anfragen"
                      checked={alleGewaehlt}
                      disabled={aus}
                      onChange={(ev) => alle(ev.target.checked)}
                    />
                  </th>
                  <th scope="col">Name</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {sichtbar.map((k) => {
                  const ja = gewaehltOderIch(k.id);
                  return (
                    <tr key={k.id}>
                      <td className={styles.haken}>
                        <input
                          type="checkbox"
                          id={`anfrage-${k.id}`}
                          className={felder.haken}
                          checked={ja}
                          // Ich bin immer angefragt (ich sage mit dem Anlegen zu) – wie in ChurchTools nicht abwählbar.
                          disabled={aus || k.id === p.ich}
                          onChange={(ev) => setzen(k.id, ev.target.checked)}
                        />
                      </td>
                      <td className={styles.name}>
                        <label htmlFor={`anfrage-${k.id}`}>
                          <span>{k.name}</span>
                          {k.gruppe && <small>{k.gruppe}</small>}
                        </label>
                      </td>
                      <td className={styles.status}>
                        {ja ? 'Wird angefragt …' : 'Nicht angefragt'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!p.laedt && p.kandidaten.length > 0 && !sichtbar.length && (
            <p className={styles.leise}>Niemand gefunden.</p>
          )}
        </>
      )}
    </div>
  );
}
