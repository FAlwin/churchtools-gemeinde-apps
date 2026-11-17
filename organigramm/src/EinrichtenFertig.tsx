import { CenterMessage } from '@ui/bedienung/CenterMessage';
import { Icon } from '@ui/icons/icons';
import type { GruppenwechselEinstellung } from '@shared/organigramm/gruppenwechsel';
import type { Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import { fertigKopf, fertigListe, nichtMehrGebrauchtText, type FertigZeile } from './fertigListe';
import type { Lauf } from './einrichtenSchreiben';
import type { LaufStand } from './useSchreibLauf';
import { Hinweis } from './KjHinweis';
import kj from './KinderJugend.module.scss';
import styles from './Einrichten.module.scss';

/** Die Schrittanzeige oben im Fenster – `namen` je nach Fenster („Stufen › Vorschau › Fertig“ oder „Vorschau › Fertig“). */
export function Schritte({ namen, schritt }: { namen: readonly string[]; schritt: number }) {
  return (
    <ol className={styles.schritte} aria-label="Schritte">
      {namen.map((n, i) => (
        <li
          key={n}
          className={i + 1 < schritt ? styles.fertig : i + 1 === schritt ? styles.dran : undefined}
          aria-current={i + 1 === schritt ? 'step' : undefined}
        >
          <i aria-hidden="true">{i + 1 < schritt ? '✓' : i + 1}</i>
          {n}
        </li>
      ))}
    </ol>
  );
}

/** Nie nur Farbe: Das Zeichen hat einen Text für Vorlese-Programme. */
function Zeichen({ art }: { art: FertigZeile['zeichen'] }) {
  if (art === 'ok')
    return (
      <span className={`${kj.zeichen} ${kj.zeichenOk}`} role="img" aria-label="erledigt">
        <Icon name="check" size={14} />
      </span>
    );
  if (art === 'fehler')
    return (
      <span className={`${kj.zeichen} ${kj.zeichenWarn}`} role="img" aria-label="nicht geklappt">
        <Icon name="x" size={14} />
      </span>
    );
  return (
    <span className={`${kj.zeichen} ${kj.zeichenGrau}`} role="img" aria-label="noch offen">
      ·
    </span>
  );
}

/**
 * **Schritt „Fertig“** (Entwurf `o9-5-einrichten-v1`, `schritt3()`): Während es läuft, die Schritte mit dem, was schon
 * geschafft ist; danach „Fertig. Alles ist in ChurchTools nachgelesen.“ oder „Nicht ganz fertig.“ mit der Liste –
 * ✓ nachgelesen, ✗ mit dem Grund, „noch nicht geschrieben“. Wurde nichts geschrieben (eine Voraussetzung stimmte nicht),
 * steht das in Rot da.
 */
export function FertigAnsicht({
  stand,
  einrichtung,
  mitLeseRechten,
}: {
  stand: LaufStand;
  /** Für den Kasten „Damit die Leitungen den Reiter sehen“; ohne ihn (Nachtragen, Rechte) fehlt er. */
  einrichtung?: Pick<Einrichtung, 'einstellung' | 'bereichGruppeId'> & { bereich: string };
  mitLeseRechten: boolean;
}) {
  if (stand.art === 'laeuft')
    return (
      <div className={styles.stapel}>
        <CenterMessage
          loading
          text="Es wird geschrieben und nachgelesen – bitte das Fenster offen lassen …"
        />
        {stand.ergebnisse.length > 0 && <Liste zeilen={fertigListe(stand.ergebnisse)} />}
      </div>
    );
  const lauf: Lauf = stand.lauf;
  if (lauf.art === 'gestoppt')
    return (
      <div className={styles.stapel}>
        <Hinweis rot>
          <b>Es wurde nichts geschrieben.</b> {lauf.grund}
          {lauf.nochmal ? ' „Nochmal versuchen“ liest alles neu.' : ''}
        </Hinweis>
      </div>
    );
  const kopf = fertigKopf(lauf);
  const nicht = nichtMehrGebrauchtText(lauf.nichtMehrGebraucht);
  return (
    <div className={styles.stapel}>
      {kopf.art === 'ok' ? (
        <Hinweis>
          <b>{kopf.titel}</b> {kopf.text}
        </Hinweis>
      ) : (
        <Hinweis rot>
          <b>{kopf.titel}</b> {kopf.text}
        </Hinweis>
      )}
      {lauf.ergebnisse.length > 0 && <Liste zeilen={fertigListe(lauf.ergebnisse)} />}
      {nicht && <Hinweis gelb>{nicht}</Hinweis>}
      {mitLeseRechten && einrichtung && lauf.ok && <LeseRechte e={einrichtung} />}
    </div>
  );
}

function Liste({ zeilen }: { zeilen: readonly FertigZeile[] }) {
  return (
    <ul className={`${kj.pruef} ${kj.karte} ${kj.rahmen}`} aria-label="Was geschrieben wurde">
      {zeilen.map((z, i) => (
        <li key={`${i}-${z.titel}`}>
          <Zeichen art={z.zeichen} />
          <span className={kj.pruefMitte}>
            <b>{z.titel}</b>
            <span>{z.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * **„Damit die Leitungen den Reiter sehen“** (O9-F12, Alwin 17.11.2026): Die Leserechte der Leitungen setzt „Einrichten“
 * NICHT – es sagt nur, was an welchen Rollen fehlt, und Alwin setzt es (wie die Rechte der Kategorie, O9-F5). Nur Text,
 * nichts wird gesetzt oder geprüft.
 */
export function LeseRechte({ e }: { e: Pick<Einrichtung, 'einstellung'> & { bereich: string } }) {
  const s: GruppenwechselEinstellung = e.einstellung;
  return (
    <section className={styles.leseRechte} aria-label="Damit die Leitungen den Reiter sehen">
      <h4>Damit die Leitungen den Reiter sehen</h4>
      <p>
        Das setzt „Einrichten“ nicht selbst. In ChurchTools brauchen die Leitungen diese Leserechte:
      </p>
      <ul>
        <li>
          <b>„Organigramm“ sehen</b> (das Recht der Erweiterung selbst)
        </li>
        <li>
          Die Kategorien <b>„Gruppenwechsel“</b> und <b>„Was das Organigramm zeigt“</b>:{' '}
          <b>Kategorie sehen</b> und <b>Daten sehen</b>
        </li>
        <li>
          Den Kalender <b>„{s.ferienkalender}“</b> sehen (daraus kommen die Wechseltage)
        </li>
      </ul>
      <p>
        An diesen Rollen: die <b>Leiter der Stufen-Gruppen</b> (
        {s.stufen.map((x) => x.name).join(', ')}) und die <b>Leitung der Gruppe „{e.bereich}“</b>.
      </p>
    </section>
  );
}
