import { useEffect, useState } from 'react';
import { PersonBild } from '@ui/bedienung/PersonBild';
import { PersonenSuche } from '@ui/bedienung/PersonenSuche';
import { ZeilenKnopf } from '@ui/bedienung/ZeilenKnopf';
import { personenRoh, type Gefunden } from '@ui/ct/personen';
import { Icon } from '@ui/icons/icons';
import formular from './TerminFormular.module.scss';
import styles from './TerminImAuftrag.module.scss';

const volleName = (p: { vor: string; nach: string }): string => `${p.vor} ${p.nach}`.trim();

/**
 * **„Im Auftrag von“ im Formular „In Kalender eintragen“** – wie im ChurchTools-Dialog **ein** Feld: Beim Tippen erscheinen
 * darunter Vorschläge (Bild und Name), ein Klick wählt die Person, danach steht ihr Name im Feld und lässt sich mit dem
 * Kreuz wieder leeren. Die Suche ist der Baustein `PersonenSuche` mit `beimTippen` (EINE Suche für alle Erweiterungen).
 *
 * Der Eintrag trägt nur die Nummer (`Eintrag.imAuftrag`); den Namen merkt sich dieses Feld. Kommt die Nummer aus einer
 * Termin-Vorlage, wird der Name nachgeladen (`personenRoh`) – scheitert das, steht „Person {Nummer}“ da, die Nummer
 * bleibt erhalten (vorübergehend ist nicht ungültig: nichts wird gelöscht).
 */
export function TerminImAuftrag({
  id,
  onWahl,
  deaktiviert,
}: {
  id: number | null;
  onWahl: (id: number | null) => void;
  deaktiviert: boolean;
}) {
  const [namen, setNamen] = useState<Record<number, string>>({});
  const name = id === null ? undefined : namen[id];

  useEffect(() => {
    if (id === null || name !== undefined) return;
    let abgebrochen = false;
    void personenRoh([id])
      .then((liste) => {
        const p = liste.find((x) => x.id === id);
        return p ? volleName({ vor: p.firstName ?? '', nach: p.lastName ?? '' }) : '';
      })
      .catch(() => '')
      .then((n) => {
        if (!abgebrochen) setNamen((alt) => ({ ...alt, [id]: n || `Person ${id}` }));
      });
    return () => {
      abgebrochen = true;
    };
  }, [id, name]);

  if (id !== null) {
    return (
      <div className={styles.gewaehlt}>
        <input
          className={formular.eingabe}
          aria-label="Im Auftrag von"
          readOnly
          value={name ?? '…'}
        />
        <ZeilenKnopf
          label="Im Auftrag von leeren"
          disabled={deaktiviert}
          onClick={() => onWahl(null)}
        >
          <Icon name="x" size={14} stroke={2.4} />
        </ZeilenKnopf>
      </div>
    );
  }
  const waehlen = (p: Gefunden) => {
    setNamen((alt) => ({ ...alt, [p.personId]: volleName(p) || `Person ${p.personId}` }));
    onWahl(p.personId);
  };
  return deaktiviert ? (
    <input className={formular.eingabe} aria-label="Im Auftrag von" disabled value="" readOnly />
  ) : (
    <PersonenSuche
      beimTippen
      label="Im Auftrag von"
      klassen={{
        form: styles.hulle,
        feld: formular.eingabe,
        liste: styles.liste,
        zeile: styles.vorschlag,
        aktiv: styles.aktiv,
        leer: styles.leer,
        fehler: styles.fehler,
      }}
      zeile={(p) => (
        <>
          <PersonBild
            name={volleName(p)}
            bild={null}
            initialen={`${p.vor.charAt(0)}${p.nach.charAt(0)}`.toUpperCase()}
            groesse={28}
          />
          <span>{volleName(p)}</span>
        </>
      )}
      onWahl={waehlen}
    />
  );
}
