import { useMemo, useState } from 'react';
import { CenterMessage } from '@ui/bedienung/CenterMessage';
import { Icon } from '@ui/icons/icons';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { useLaden } from '@ui/ct/useLaden';
import {
  einrichtungStand,
  fehlendeLeiterRechte,
  sammelHinweis,
  stufenAnzeige,
  type RegelStandRoh,
  type StandZeile,
} from '@shared/organigramm/einrichtungStand';
import type { Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import { ladeEinrichtungStand } from './ladeEinrichtungStand';
import { EinrichtenFenster } from './EinrichtenFenster';
import { NachtragenFenster } from './NachtragenFenster';
import { RechteFenster } from './RechteFenster';
import { Hinweis } from './KjHinweis';
import type { Start } from './start';
import styles from './KinderJugend.module.scss';
import einr from './Einrichten.module.scss';

/**
 * **Seite „Einrichtung“ im Reiter „Kinder & Jugend“** (Bauplan O9-5c, Entwurf `o9-5-einrichten-v1`) – nur für Leute mit
 * „Berechtigungen verwalten“: die Stufen, wie sie eingerichtet sind, und **was in ChurchTools davon wirklich steht**. Sie
 * liest selbst nur; geschrieben wird in den Fenstern (O9-5d): „Stufen ändern …“, bei einem ⚠ „Rechte der Leitung“ das
 * Fenster „Rechte setzen …“ und bei ⚠ „Wechseltage“ „Nachtragen …“. Nach dem Schreiben ruft sie `onGeschrieben`: Die
 * Einrichtung und der Stand werden neu gelesen.
 *
 * `regel` ist der Stand der Wechseltage in den Regeln, den der Reiter für „Wechseltage“ schon lädt (eine Quelle, O9-4);
 * `jahr` das Jahr des nächsten Wechsels.
 */
export function EinrichtungSeite({
  start,
  einrichtung,
  regel,
  jahr,
  onGeschrieben,
}: {
  start: Start;
  einrichtung: Einrichtung;
  regel: { art: 'laedt' } | RegelStandRoh;
  jahr: number;
  /** Es wurde (vielleicht) geschrieben: Einrichtung und Stand neu lesen. */
  onGeschrieben: () => void;
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
  const [aendern, setAendern] = useState(false);
  const [rechteOffen, setRechteOffen] = useState(false);
  const [nachtragenOffen, setNachtragenOffen] = useState(false);
  // Was an der Rolle „Leiter“ fehlt – nur, wenn es sich lesen ließ (nie aus „nicht prüfbar“ ein „fehlt“ machen).
  const fehlendeRechte =
    stand.art === 'fertig' && stand.daten.rechte.leiter.ok
      ? fehlendeLeiterRechte(stand.daten.rechte.leiter.wert)
      : [];

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
        <div className={styles.kartenFuss}>
          <FensterKnopf art="zweit" onClick={() => setAendern(true)}>
            Stufen ändern …
          </FensterKnopf>
        </div>
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
                  {z.stand.art === 'warn' && z.stand.liste && (
                    <ul className={styles.befunde}>
                      {z.stand.liste.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  )}
                </span>
                {z.id === 'rechte' && z.stand.art === 'warn' && fehlendeRechte.length > 0 && (
                  <span className={einr.zeilenKnopf}>
                    <FensterKnopf art="zweit" onClick={() => setRechteOffen(true)}>
                      Rechte setzen …
                    </FensterKnopf>
                  </span>
                )}
                {z.id === 'wechseltage' && z.stand.art === 'warn' && (
                  <span className={einr.zeilenKnopf}>
                    <FensterKnopf
                      onClick={() => setNachtragenOffen(true)}
                      aria-label="Wechseltage nachtragen"
                    >
                      Nachtragen …
                    </FensterKnopf>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {aendern && (
        <EinrichtenFenster
          art="aendern"
          start={start}
          einrichtung={einrichtung}
          standDaten={stand.art === 'fertig' ? stand.daten : undefined}
          onSchliessen={() => setAendern(false)}
          onGeschrieben={onGeschrieben}
        />
      )}
      {rechteOffen && (
        <RechteFenster
          start={start}
          fehlend={fehlendeRechte}
          onSchliessen={() => setRechteOffen(false)}
          onGeschrieben={onGeschrieben}
        />
      )}
      {nachtragenOffen && (
        <NachtragenFenster
          start={start}
          einrichtung={einrichtung}
          regelBis={regel.art === 'da' ? regel.bis : undefined}
          onSchliessen={() => setNachtragenOffen(false)}
          onGeschrieben={onGeschrieben}
        />
      )}
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
 * **Reiter, solange es keine Einrichtung gibt** – nur für „Berechtigungen verwalten“. „Einrichten …“ öffnet das Fenster
 * (O9-5c-2/O9-5d): Stufen wählen, Vorschau ansehen, schreiben. Danach `onGeschrieben`: Die Einrichtung wird neu gelesen,
 * der Reiter wird zur Seite „Einrichtung“.
 */
export function NichtEingerichtet({
  start,
  onGeschrieben,
}: {
  start: Start;
  onGeschrieben: () => void;
}) {
  const [offen, setOffen] = useState(false);
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
      <div className={styles.knopfzeile}>
        <FensterKnopf onClick={() => setOffen(true)}>Einrichten …</FensterKnopf>
        <span className={styles.leise}>Es wird erst nach einer Vorschau etwas angelegt.</span>
      </div>
      {offen && (
        <EinrichtenFenster
          art="einrichten"
          start={start}
          einrichtung={null}
          onSchliessen={() => setOffen(false)}
          onGeschrieben={onGeschrieben}
        />
      )}
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
