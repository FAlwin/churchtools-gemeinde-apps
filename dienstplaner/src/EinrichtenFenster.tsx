import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { useLaden } from '@ui/ct/useLaden';
import { HILFSGRUPPEN_TYP } from '@shared/dienstplan/abfrageAutomatik';
import {
  einrichten,
  lageLesen,
  type EinrichtenAnschluss,
  type Lage,
  type Lauf,
} from './einrichtenAbfragen';
import {
  EINRICHTEN_ANSEHEN,
  EINRICHTEN_GRUPPE,
  EINRICHTEN_RECHTE,
  EINRICHTEN_ROUTINE,
  EINRICHTEN_WARUM,
} from './abfragenTexte';
import styles from './EinrichtenFenster.module.scss';

const namen = (l: readonly { name: string }[]) => l.map((x) => x.name).join(', ');

/**
 * **Fenster „Erinnerungen für <Gruppe> einrichten“** (R-5a, Entwurf `runden-entwurf.html` Schritt 2). Es liest zuerst (nichts wird
 * geschrieben) und sagt **vor dem Klick**, was angelegt wird und warum: die Gruppe, die Routine, welche Planer welche zwei Rechte
 * (nur für diese Gruppe) bekommen, was Mitarbeitende davon sehen. Erst „Einrichten“ schreibt – danach steht hier, was angelegt bzw. ergänzt und nachgelesen wurde.
 * Scheitert etwas, steht da, was schon angelegt ist; nichts wird automatisch wiederholt („Nochmal versuchen“ ist ein Klick).
 */
export function EinrichtenFenster({
  gruppe: gruppeNeu,
  gruppenIds: gruppenIdsNeu,
  anschluss,
  onGelaufen,
  onClose,
}: {
  gruppe: { id: number; name: string };
  /** Die ChurchTools-Gruppen der Dienste dieser Dienstgruppe (zweite Quelle der Planer-Liste). */
  gruppenIds: readonly number[];
  anschluss: EinrichtenAnschluss;
  /** Nach jedem Lauf (auch einem halben): Das Dokument kann sich geändert haben – der Aufrufer liest neu. */
  onGelaufen: () => void;
  onClose: () => void;
}) {
  // Beim Öffnen festgehalten: Die Aufrufer bauen die Liste bei jedem Zeichnen neu, das ließe sonst bei jedem Zeichnen neu lesen.
  const [gruppe] = useState(gruppeNeu);
  const [gruppenIds] = useState(gruppenIdsNeu);
  const { stand, neu } = useLaden(
    () => lageLesen(gruppe, gruppenIds, anschluss),
    [gruppe, gruppenIds, anschluss],
  );
  const [arbeitet, setArbeitet] = useState(false);
  const [lauf, setLauf] = useState<Lauf | null>(null);

  const lage = stand.art === 'fertig' && stand.daten.art === 'bereit' ? stand.daten : null;
  const gestoppt = stand.art === 'fertig' && stand.daten.art === 'gestoppt' ? stand.daten : null;

  const starten = async () => {
    setArbeitet(true);
    try {
      const r = await einrichten(gruppe, gruppenIds, anschluss);
      setLauf(r);
      if (r.art === 'gelaufen') onGelaufen();
    } finally {
      setArbeitet(false);
    }
  };

  const fertig = lauf?.art === 'gelaufen' && lauf.ok;
  const nurRechte =
    lage !== null &&
    lage.gruppeId !== null &&
    !lage.plan.gruppeAnlegen &&
    !lage.plan.routineAnlegen;
  const aufgegeben =
    (lauf?.art === 'gelaufen' && !lauf.ok && lauf.fehler?.nochmal === false) ||
    (lauf?.art === 'gestoppt' && !lauf.nochmal);
  const knopf = fertig ? (
    <FensterKnopf onClick={onClose}>Fertig</FensterKnopf>
  ) : aufgegeben ? undefined : lage && !lage.fertig ? (
    <FensterKnopf disabled={arbeitet} onClick={() => void starten()}>
      {arbeitet
        ? 'Wird eingerichtet …'
        : lauf
          ? 'Nochmal versuchen'
          : nurRechte && !lage.plan.einrichtungSchreiben
            ? 'Rechte nachtragen'
            : 'Einrichten'}
    </FensterKnopf>
  ) : gestoppt?.nochmal ? (
    <FensterKnopf onClick={neu}>Nochmal versuchen</FensterKnopf>
  ) : undefined;

  return (
    <Sheet
      title={`Erinnerungen für ${gruppe.name} einrichten`}
      onClose={onClose}
      mittel
      beschaeftigt={arbeitet}
      cancelLabel={fertig ? null : 'Abbrechen'}
      // Ohne Knopf (alles eingerichtet, oder aufgegeben) gibt es keine Fußzeile – geschlossen wird mit dem X.
      knoepfe={knopf ?? null}
    >
      {stand.art === 'laedt' && (
        <p className={styles.hinweis} role="status">
          ChurchTools wird gelesen – es wird noch nichts angelegt …
        </p>
      )}
      {stand.art === 'fehler' && (
        <p className={styles.fehler} role="alert">
          {stand.fehler.text}
        </p>
      )}
      {gestoppt && !lauf && (
        <p className={styles.fehler} role="alert">
          {gestoppt.text}
        </p>
      )}
      {lauf?.art === 'gestoppt' && (
        <p className={styles.fehler} role="alert">
          {lauf.text}
        </p>
      )}
      {lauf?.art === 'gelaufen' ? (
        <Ergebnis lauf={lauf} gruppeName={gruppe.name} />
      ) : (
        lage && <Vorher lage={lage} />
      )}
    </Sheet>
  );
}

/** Was passieren wird – gelesen, nichts geschrieben. */
function Vorher({ lage }: { lage: Lage }) {
  if (lage.fertig)
    return (
      <>
        <p className={styles.text}>
          Alles ist eingerichtet: die Gruppe „{lage.gruppeName}“, ihre Routine und die zwei Rechte
          aller Planer – nur für diese Gruppe.
        </p>
        <Hinweise lage={lage} />
        <p className={styles.hinweis}>{EINRICHTEN_ANSEHEN}</p>
      </>
    );
  const nurRechte = lage.gruppeId !== null && !lage.plan.gruppeAnlegen && !lage.plan.routineAnlegen;
  const bekommen = lage.rechteNachtragen.map((r) => r.person);
  return (
    <>
      <p className={styles.text}>{EINRICHTEN_WARUM}</p>
      <ol className={styles.schritte}>
        <li>
          <b>Gruppe „{lage.gruppeName}“</b> (Gruppentyp „{HILFSGRUPPEN_TYP}“, ohne Obergruppe) –{' '}
          {lage.plan.gruppeAnlegen
            ? 'wird angelegt.'
            : lage.uebernommen
              ? 'steht schon da und wird übernommen.'
              : 'gibt es schon.'}
          <span className={styles.leise}>{EINRICHTEN_GRUPPE}</span>
        </li>
        <li>
          <b>Eine Routine „{lage.routineName}“ an dieser Gruppe</b> –{' '}
          {lage.plan.routineAnlegen
            ? 'wird angelegt.'
            : lage.routineAus
              ? 'steht da, ist aber ausgeschaltet und wird eingeschaltet.'
              : 'gibt es schon.'}
          <span className={styles.leise}>{EINRICHTEN_ROUTINE}</span>
        </li>
        <li>
          <b>Zwei Rechte für die Planer – nur für die Gruppe „{lage.gruppeName}“</b> –{' '}
          {bekommen.length > 0 ? (
            <>
              {nurRechte ? 'noch nicht gesetzt bei: ' : 'werden gesetzt bei: '}
              {namen(bekommen)}.
            </>
          ) : lage.planer.length > 0 ? (
            'alle schon gesetzt.'
          ) : (
            'es wurden keine Planer gefunden.'
          )}
          <span className={styles.leise}>{EINRICHTEN_RECHTE}</span>
        </li>
      </ol>
      <Hinweise lage={lage} />
      <p className={styles.hinweis}>{EINRICHTEN_ANSEHEN}</p>
    </>
  );
}

function Hinweise({ lage }: { lage: Lage }) {
  return (
    <>
      {lage.verschwunden && (
        <p className={styles.hinweis} role="status">
          Die bisherige Gruppe gibt es in ChurchTools nicht mehr – es wird eine neue angelegt.
        </p>
      )}
    </>
  );
}

/** Was angelegt bzw. ergänzt wurde – jeder Punkt nachgelesen. */
function Ergebnis({
  lauf,
  gruppeName,
}: {
  lauf: Extract<Lauf, { art: 'gelaufen' }>;
  gruppeName: string;
}) {
  return (
    <>
      {lauf.ok ? (
        <p className={styles.text} role="status">
          {lauf.angelegt.length > 0
            ? `Die Erinnerungen für ${gruppeName} sind eingerichtet. Nachgelesen steht in ChurchTools:`
            : `Für ${gruppeName} war schon alles eingerichtet.`}
        </p>
      ) : (
        <p className={styles.fehler} role="alert">
          {lauf.fehler?.text}
          {lauf.angelegt.length > 0 ? ' Schon angelegt:' : ' Es wurde noch nichts angelegt.'}
        </p>
      )}
      {lauf.angelegt.length > 0 && (
        <ul className={styles.liste}>
          {lauf.angelegt.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {lauf.hinweise.map((t) => (
        <p key={t} className={styles.hinweis}>
          {t}
        </p>
      ))}
      <p className={styles.hinweis}>{EINRICHTEN_ANSEHEN}</p>
    </>
  );
}
