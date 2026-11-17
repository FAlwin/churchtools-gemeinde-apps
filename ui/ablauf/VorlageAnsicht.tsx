/**
 * **Eine Ablaufvorlage öffnen** (E10-V3a, Entwurf `e10-vorlagen.html` Abschnitt 2): Kopf „‹ Vorlagen“, Name und
 * „Ablaufvorlage · Kalender X“, darunter der Ablauf – dieselbe Liste wie am Termin (`AblaufListe`, Bearbeiten über
 * `useAblaufBearbeiten`), nur im Vorlagen-Modus: ohne Uhrzeiten, Personen, Live, Spalten und Auge; Platzhalter wie
 * „[Moderation]“ neutral. „Bearbeiten“ nur mit dem Recht (`darfIn`); im Bearbeiten-Modus stehen „Umbenennen …“ und
 * „Löschen …“ rechts in der Hinweiszeile.
 *
 * Gelesen wird **frisch** (`zugriff.vorlage`), nach jedem Schreiben noch einmal – die Zeilen sind immer der Stand von
 * ChurchTools, nie das, was die Liste für geschrieben hält. Scheitert nur das Neu-Lesen, war das Schreiben trotzdem
 * gelungen: Der Stand bleibt stehen, oben steht ein Hinweis (vorübergehend ist nicht ungültig).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VORLAGE_GESPERRT } from '@shared/ct/schreibKern';
import { vorlageZeilenAus } from '@shared/ct/ablaufVorlagenListe';
import type { AgendaServiceOption } from '@shared/types/index';
import { FehlerKasten } from '../erweiterung/ErweiterungsSeite';
import { KopfKnopf } from '../bedienung/KopfKnopf';
import { useLaden } from '../ct/useLaden';
import { Icon } from '../icons/icons';
import { AblaufListe } from './AblaufListe';
import { useAblaufBearbeiten, verlangtNeuLaden, type HinweisLink } from './useAblaufBearbeiten';
import { VorlageLoeschenFenster, VorlageUmbenennenFenster } from './VorlagenFenster';
import type { VorlagenZugriff } from './vorlagenZugriff';
import styles from './VorlageAnsicht.module.scss';

export function VorlageAnsicht({
  vorlageId,
  zugriff,
  darfIn,
  dienste,
  kalenderName,
  zurueck,
  startBearbeiten = false,
  onGeaendert,
  onGeloescht,
}: {
  vorlageId: number;
  zugriff: VorlagenZugriff;
  /** Darf man in diesem Kalender Vorlagen bearbeiten (`darfVorlageBearbeiten`)? */
  darfIn: (kalenderId: number | null) => boolean;
  /** Die ChurchTools-Dienste für den Zuständig-Editor im Punkt-Fenster. */
  dienste: AgendaServiceOption[];
  /** Der Name des Kalenders der Vorlage – fehlt er (Liste noch nicht da), steht nur „Ablaufvorlage“. */
  kalenderName?: (kalenderId: number | null) => string | undefined;
  /** „‹ Vorlagen“ – zurück zur Liste. */
  zurueck: { label: string; onClick: () => void };
  /** Gleich im Bearbeiten-Modus öffnen (eben angelegte Vorlage). */
  startBearbeiten?: boolean;
  /** Name oder Inhalt haben sich geändert – die Liste (Punktzahl, „geändert“) neu lesen. */
  onGeaendert: () => void;
  /** Die Vorlage ist gelöscht – zurück zur Liste. */
  onGeloescht: () => void;
}) {
  // Beim Neu-Lesen bleibt der alte Stand stehen, bis der neue da ist (`behalten`) – nichts springt weg.
  const geladen = useLaden(() => zugriff.vorlage(vorlageId), [vorlageId, zugriff], {
    behalten: true,
  });
  const v = geladen.stand.art === 'fertig' ? geladen.stand.daten : null;
  const [bearbeiten, setBearbeiten] = useState(startBearbeiten);
  const [umbenennen, setUmbenennen] = useState(false);
  const [loeschen, setLoeschen] = useState(false);

  const zeilen = useMemo(() => (v ? vorlageZeilenAus(v) : []), [v]);
  const kalenderId = v?.calendarId ?? null;
  const darf = v !== null && darfIn(kalenderId);
  const aktiv = bearbeiten && darf;
  const name = v?.name?.trim() || `Vorlage ${vorlageId}`;

  // Nach jedem gelungenen Schreiben: frisch lesen, und die Liste mit. `onGeaendert` über einen Merker, damit die Aktionen
  // nicht bei jedem Zeichnen des Aufrufers neu entstehen.
  const { neu: neuLaden } = geladen;
  const geaendert = useRef(onGeaendert);
  useEffect(() => {
    geaendert.current = onGeaendert;
  });
  const neuLesen = useCallback(() => {
    neuLaden();
    geaendert.current();
  }, [neuLaden]);
  const aktionen = useMemo(
    () => zugriff.aktionen(vorlageId, neuLesen),
    [zugriff, vorlageId, neuLesen],
  );

  const links: HinweisLink[] = [
    { label: 'Umbenennen …', icon: 'pencil', onClick: () => setUmbenennen(true) },
    { label: 'Löschen …', icon: 'trash', onClick: () => setLoeschen(true), gefahr: true },
  ];

  const liste = useAblaufBearbeiten({
    vorlage: true,
    aktiv,
    bereit: v !== null,
    items: zeilen,
    abgeschlossen: v?.isLocked === true,
    sperrHinweis: VORLAGE_GESPERRT,
    aktionen,
    dienste,
    hinweisLinks: links,
    // Vorlage inzwischen anders (404/409/412/423): frisch lesen. Einen Knopf „neu laden“ gibt es hier nicht.
    beiFehler: (e) => {
      if (verlangtNeuLaden(e)) geladen.neu();
    },
    plusImKopf: true,
    plusName: `Eintrag hinzufügen – ${name}`,
  });

  const neuFehler = geladen.stand.art === 'fertig' ? geladen.stand.neuFehler : undefined;

  const zurueckKnopf = (
    <button type="button" className={styles.zurueck} onClick={zurueck.onClick}>
      <Icon name="chev-left" size={16} /> {zurueck.label}
    </button>
  );

  if (v === null) {
    return (
      <div className={styles.seite}>
        <div className={styles.kopf}>{zurueckKnopf}</div>
        {geladen.stand.art === 'fehler' ? (
          <FehlerKasten fehler={geladen.stand.fehler} onNochmal={geladen.neu} />
        ) : (
          <p className={styles.hinweis}>Vorlage wird geladen …</p>
        )}
      </div>
    );
  }

  const kalender = kalenderName?.(kalenderId);

  return (
    <div className={styles.seite}>
      <div className={styles.kopf}>
        {zurueckKnopf}
        <div className={styles.titel}>
          <h2>{name}</h2>
          <p>Ablaufvorlage{kalender ? ` · Kalender ${kalender}` : ''}</p>
        </div>
      </div>

      <section className={styles.karte} aria-label="Ablauf">
        <div className={styles.kartenKopf}>
          <h3>Ablauf</h3>
          <span className={styles.kopfKnoepfe}>
            {liste.kopfKnopf}
            {darf && (
              <KopfKnopf
                onClick={() => {
                  liste.fehlerLoeschen();
                  setBearbeiten((b) => !b);
                }}
                label={bearbeiten ? 'Fertig' : 'Bearbeiten'}
                title={bearbeiten ? 'Fertig' : 'Vorlage bearbeiten'}
                haupt={bearbeiten}
                symbol={<Icon name={bearbeiten ? 'check' : 'pencil'} size={16} stroke={2.2} />}
              />
            )}
          </span>
        </div>
        {neuFehler && (
          <p className={styles.fehler} role="alert">
            Der aktuelle Stand ließ sich nicht laden. {neuFehler.text}
          </p>
        )}
        {aktiv ? (
          <div className={styles.grund}>{liste.liste}</div>
        ) : zeilen.length === 0 ? (
          <p className={styles.hinweis}>Die Vorlage ist noch leer.</p>
        ) : (
          <div className={styles.grund}>
            <AblaufListe zeilen={zeilen} vorlage />
          </div>
        )}
      </section>

      {liste.ueberlagerung}
      {umbenennen && (
        <VorlageUmbenennenFenster
          name={name}
          onUmbenennen={async (neu) => {
            await zugriff.umbenennen(vorlageId, neu);
            setUmbenennen(false);
            neuLesen();
          }}
          onClose={() => setUmbenennen(false)}
        />
      )}
      {loeschen && (
        <VorlageLoeschenFenster
          name={name}
          onLoeschen={async () => {
            await zugriff.loeschen(vorlageId);
            setLoeschen(false);
            onGeloescht();
          }}
          onClose={() => setLoeschen(false)}
        />
      )}
    </div>
  );
}
