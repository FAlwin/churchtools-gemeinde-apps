/**
 * **Die Seite „Ablaufvorlagen“** (E10-V3a, Entwurf `e10-vorlagen.html`): Liste nach Kalender, eine Vorlage öffnen,
 * anlegen, umbenennen, löschen – alles, was Dienstplaner (jetzt) und Musik-App (V3b) gleich brauchen. Die App gibt herein,
 * **wie** gelesen und geschrieben wird (`VorlagenZugriff`), wer wo bearbeiten darf (`darfIn`), welche Vorlage offen ist
 * (`offeneId` – der Dienstplaner hält sie in der Adresse, damit Zurück und Neuladen gehen) und wie man zurückkommt.
 *
 * Der Kopf („‹ Planen“, Titel, „Neue Vorlage“) gehört zur Liste, nicht zur offenen Vorlage – die bringt ihren eigenen mit.
 */
import { useEffect, useRef, useState } from 'react';
import type { AgendaServiceOption, Kalender } from '@shared/types/index';
import { FehlerKasten } from '../erweiterung/ErweiterungsSeite';
import { Icon } from '../icons/icons';
import { useNeuAnlegen } from '../bedienung/NeuAnlegen';
import { useLaden } from '../ct/useLaden';
import { VorlageAnsicht } from './VorlageAnsicht';
import { NeueVorlageFenster } from './VorlagenFenster';
import { VorlagenListe } from './VorlagenListe';
import type { VorlagenZugriff } from './vorlagenZugriff';
import styles from './VorlagenBereich.module.scss';

export function VorlagenBereich({
  zugriff,
  darfIn,
  dienste,
  offeneId,
  onOeffnen,
  zurueck,
}: {
  /** Muss über die Lebensdauer der Seite gleich bleiben (Modul-Konstante oder `useMemo`) – sonst lädt sie ständig neu. */
  zugriff: VorlagenZugriff;
  /** Darf man in diesem Kalender Vorlagen bearbeiten (`darfVorlageBearbeiten`)? `null` = Vorlage ohne Kalender. */
  darfIn: (kalenderId: number | null) => boolean;
  dienste: AgendaServiceOption[];
  /** Die offene Vorlage – `null`: die Liste. */
  offeneId: number | null;
  /** Eine Vorlage öffnen (`id`) bzw. zurück zur Liste (`null`). */
  onOeffnen: (vorlageId: number | null) => void;
  /** „‹ Planen“ – von der Liste aus zurück, wo man herkam. */
  zurueck: { label: string; onClick: () => void };
}) {
  // Die Liste bleibt beim Neu-Lesen stehen, bis die neue da ist – nach jedem Schreiben leise frisch.
  const liste = useLaden(() => zugriff.liste(), [zugriff], { behalten: true });
  const [neuOffen, setNeuOffen] = useState(false);
  // Die eben angelegte Vorlage öffnet gleich im Bearbeiten-Modus – nur sie, nicht jede später geöffnete.
  const [neuAngelegt, setNeuAngelegt] = useState<number | null>(null);
  // … und nur so lange, bis man sie wieder verlässt (die Adresse ändert sich erst nach dem Anlegen – vorher gilt `offeneId`
  // noch nicht, darum erst „gesehen“, dann zurücksetzen).
  const gesehen = useRef(false);
  useEffect(() => {
    if (neuAngelegt === null) {
      gesehen.current = false;
    } else if (offeneId === neuAngelegt) {
      gesehen.current = true;
    } else if (gesehen.current) {
      setNeuAngelegt(null);
    }
  }, [offeneId, neuAngelegt]);

  const stand = liste.stand.art === 'fertig' ? liste.stand.daten : null;
  const erlaubteKalender: Kalender[] = (stand?.kalender ?? []).filter((k) => darfIn(k.id));
  // „Neue Vorlage“ nur, wenn man in mindestens einem Kalender darf.
  const neu = useNeuAnlegen({
    label: 'Neue Vorlage',
    onClick: () => setNeuOffen(true),
    sichtbar: stand !== null && erlaubteKalender.length > 0,
  });

  if (offeneId !== null) {
    const namen = new Map(stand?.kalender.map((k) => [k.id, k.name]));
    return (
      <VorlageAnsicht
        key={offeneId}
        vorlageId={offeneId}
        zugriff={zugriff}
        darfIn={darfIn}
        dienste={dienste}
        kalenderName={(id) => (id === null ? undefined : namen.get(id))}
        zurueck={{ label: 'Vorlagen', onClick: () => onOeffnen(null) }}
        startBearbeiten={neuAngelegt === offeneId}
        onGeaendert={liste.neu}
        onGeloescht={() => {
          liste.neu();
          onOeffnen(null);
        }}
      />
    );
  }

  return (
    <div className={styles.seite}>
      <div className={styles.kopf}>
        <button type="button" className={styles.zurueck} onClick={zurueck.onClick}>
          <Icon name="chev-left" size={16} /> {zurueck.label}
        </button>
        <h2>Ablaufvorlagen</h2>
        {neu.kopf}
      </div>
      {liste.stand.art === 'fehler' ? (
        <FehlerKasten fehler={liste.stand.fehler} onNochmal={liste.neu} />
      ) : stand === null ? (
        <p className={styles.hinweis}>Vorlagen werden geladen …</p>
      ) : (
        <>
          {liste.stand.art === 'fertig' && liste.stand.neuFehler && (
            <FehlerKasten fehler={liste.stand.neuFehler} onNochmal={liste.neu} />
          )}
          <VorlagenListe
            gruppen={stand.gruppen}
            darfIn={darfIn}
            onOeffnen={(id) => onOeffnen(id)}
          />
        </>
      )}
      {neu.schwebend}
      {neuOffen && (
        <NeueVorlageFenster
          kalender={erlaubteKalender}
          onClose={() => setNeuOffen(false)}
          onAnlegen={async (daten) => {
            const id = await zugriff.anlegen(daten);
            setNeuOffen(false);
            setNeuAngelegt(id);
            liste.neu();
            onOeffnen(id);
          }}
        />
      )}
    </div>
  );
}
