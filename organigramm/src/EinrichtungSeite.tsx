import { useMemo } from 'react';
import { CenterMessage } from '@ui/bedienung/CenterMessage';
import { Icon } from '@ui/icons/icons';
import { useLaden } from '@ui/ct/useLaden';
import {
  einrichtungStand,
  sammelHinweis,
  stufenAnzeige,
  type RegelStandRoh,
  type StandZeile,
} from '@shared/organigramm/einrichtungStand';
import type { Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import { ladeEinrichtungStand } from './ladeEinrichtungStand';
import { Hinweis } from './KjHinweis';
import type { Start } from './start';
import styles from './KinderJugend.module.scss';

/**
 * **Seite „Einrichtung“ im Reiter „Kinder & Jugend“** (Bauplan O9-5c, Entwurf `o9-5-einrichten-v1`) – nur für Leute mit
 * „Berechtigungen verwalten“: die Stufen, wie sie eingerichtet sind, und **was in ChurchTools davon wirklich steht**. Sie
 * liest nur; Knöpfe zum Ändern und Reparieren kommen mit O9-5c-2 und O9-5d.
 *
 * `regel` ist der Stand der Wechseltage in den Regeln, den der Reiter für „Wechseltage“ schon lädt (eine Quelle, O9-4);
 * `jahr` das Jahr des nächsten Wechsels.
 */
export function EinrichtungSeite({
  start,
  einrichtung,
  regel,
  jahr,
}: {
  start: Start;
  einrichtung: Einrichtung;
  regel: { art: 'laedt' } | RegelStandRoh;
  jahr: number;
}) {
  // Über `useLaden` (#845). `ladeEinrichtungStand` wirft nie; käme doch ein Fehler, steht „gerade nicht ladbar“.
  const { stand, neu } = useLaden(() => ladeEinrichtungStand(einrichtung), [einrichtung]);
  const stufen = useMemo(() => stufenAnzeige(einrichtung, start), [einrichtung, start]);
  const zeilen: StandZeile[] | null = useMemo(
    () =>
      stand.art === 'fertig' && regel.art !== 'laedt'
        ? einrichtungStand(einrichtung, start, stand.daten, regel, jahr)
        : null,
    [stand, einrichtung, start, regel, jahr],
  );
  const hinweis = zeilen ? sammelHinweis(zeilen) : null;

  return (
    <>
      <div className={styles.kopf}>
        <h2>Einrichtung</h2>
        <span className={styles.leise}>nur für „Berechtigungen verwalten“</span>
      </div>
      {hinweis && (
        <Hinweis gelb>
          <b>{hinweis.titel}</b> {hinweis.text}
        </Hinweis>
      )}
      <section className={styles.karte} aria-label="Stufen">
        <h3 className={styles.abschnitt}>Stufen</h3>
        <ol className={styles.kette}>
          {stufen.kette.map((s, i) => (
            <li key={`${i}-${s.name}`} style={{ display: 'contents' }}>
              {i > 0 && (
                <span className={styles.pfeil} aria-hidden="true">
                  →
                </span>
              )}
              <span className={styles.stufe}>
                <b>{s.name}</b>
                <small>ab {s.abAlter} Jahren</small>
              </span>
            </li>
          ))}
        </ol>
        <dl className={styles.einrichtungDaten}>
          <dt>Wechsel-Gruppen unter</dt>
          <dd>{stufen.bereich}</dd>
          <dt>Ferien aus</dt>
          <dd>Kalender „{stufen.ferien}“</dd>
          <dt>Stichtag fürs Alter</dt>
          <dd>{stufen.stichtag}</dd>
          <dt>Ankündigung</dt>
          <dd>{stufen.ankuendigung}</dd>
        </dl>
      </section>
      <section className={styles.karte} aria-label="Stand in ChurchTools">
        <h3 className={styles.abschnitt}>Stand in ChurchTools</h3>
        {stand.art === 'fehler' ? (
          <CenterMessage icon="warnung" text="Gerade nicht ladbar." onRetry={neu} />
        ) : !zeilen ? (
          <CenterMessage loading text="Der Stand in ChurchTools wird geprüft …" />
        ) : (
          <ul className={styles.pruef}>
            {zeilen.map((z) => (
              <li key={z.id}>
                <Zeichen stand={z.stand.art} />
                <span className={styles.pruefMitte}>
                  <b>{z.titel}</b>
                  <span>{z.stand.text}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** Nie nur Farbe: Das Zeichen hat auch einen Text für Vorlese-Programme. */
function Zeichen({ stand }: { stand: StandZeile['stand']['art'] }) {
  if (stand === 'ok')
    return (
      <span className={`${styles.zeichen} ${styles.zeichenOk}`} role="img" aria-label="in Ordnung">
        <Icon name="check" size={14} />
      </span>
    );
  if (stand === 'warn')
    return (
      <span
        className={`${styles.zeichen} ${styles.zeichenWarn}`}
        role="img"
        aria-label="stimmt nicht"
      >
        <Icon name="warnung" size={14} />
      </span>
    );
  return (
    <span
      className={`${styles.zeichen} ${styles.zeichenGrau}`}
      role="img"
      aria-label="nicht prüfbar"
    >
      ?
    </span>
  );
}

/**
 * **Reiter, solange es keine Einrichtung gibt** – nur für „Berechtigungen verwalten“. Der Knopf „Einrichten …“ kommt
 * mit O9-5c-2; bis dahin steht hier der ruhige Satz.
 */
export function NichtEingerichtet() {
  return (
    <section className={styles.leerKarte} aria-label="Noch nicht eingerichtet">
      <h2>Gruppenwechsel noch nicht eingerichtet</h2>
      <p>
        Hier wechseln Kinder nach den Sommerferien von selbst in die nächste Gruppe. Einmal
        eingerichtet, läuft es ohne Zutun:
      </p>
      <ol>
        <li>
          Acht Wochen vor dem Wechseltag sehen die Leitungen, welche Kinder wechseln, und können
          Ausnahmen setzen.
        </li>
        <li>
          Am ersten Montag nach den Sommerferien kommen die Kinder in die neue Gruppe und verlassen
          die alte.
        </li>
        <li>
          Die Wechseltage stehen für mehrere Jahre im Voraus fest. Sind neue Ferien bekannt,
          erinnert die Erweiterung ans Nachtragen.
        </li>
      </ol>
      <Hinweis>
        Diesen Reiter siehst nur du und wer in ChurchTools „Berechtigungen verwalten“ hat. Leitungen
        sehen ihn erst nach dem Einrichten.
      </Hinweis>
      <p className={styles.leise}>Einrichten folgt in der nächsten Fassung.</p>
    </section>
  );
}

/** Es gibt eine gespeicherte Einrichtung, aber diese Fassung kann sie nicht lesen – nie wie „noch nicht eingerichtet“. */
export function EinrichtungUnlesbar() {
  return (
    <Hinweis gelb>
      <b>Die gespeicherte Einrichtung ließ sich nicht lesen.</b> Es wird nichts überschrieben.
    </Hinweis>
  );
}
