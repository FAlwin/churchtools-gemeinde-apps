/**
 * **„Als Vorlage speichern“** (E10-V5, Entwurf `e10-vorlagen.html` Abschnitt 4, abgenommen 17.11.2026): der Ablauf eines
 * Termins wird zur Ablaufvorlage – **ein** Fenster mit zwei Wegen, aufgebaut wie „Ablauf neu aufsetzen“ (Wahl-Karten aus
 * `AblaufAnlegenFenster`): „Als neue Vorlage“ (Name, Kalender) oder „Vorhandene Vorlage ersetzen“ (Auswahl, roter Hinweis,
 * roter Knopf). Gemeinsamer Baustein für Dienstplaner und Musik-App; was geschrieben wird, steht im Kern
 * (`@shared/ct/ablaufVorlagen`: `ablaufAlsVorlage`, `vorlageErsetzen`) – hier steht, was man sieht und was man wählen darf.
 *
 * - **Nur, was man darf:** Kalender und Vorlagen nur dort, wo man Vorlagen bearbeiten darf (`darfIn`). Die Vorlagen des
 *   Termin-Kalenders stehen zuerst (`vorlagenFuer`), vorbelegt ist der Kalender des Termins – ist er nicht erlaubt, der
 *   Kalender mit den meisten Vorlagen (`vorgabeKalender`, wie bei „Neue Vorlage“).
 * - **Ersetzen vergleicht:** Der Änderungsstempel, den die Liste beim Öffnen kannte (`modifiedDate`), geht als `gesehen` an den
 *   Kern; hat inzwischen jemand die Vorlage geändert, kommt 412 – dann wird die Liste neu geladen und die Meldung steht im
 *   Fenster, überschrieben wird nichts.
 * - **Fehler** (403, 423, 412, 502 „nicht vollständig …“) stehen **im Fenster**, das offen bleibt.
 */
import { useMemo, useState } from 'react';
import { vorlageNameFehler } from '@shared/ct/ablaufVorlagen';
import { vorgabeKalender, type VorlagenEintrag } from '@shared/ct/ablaufVorlagenListe';
import { vorlagenFuer } from '@shared/ct/ablaufVorschlaege';
import type { Kalender } from '@shared/types/index';
import { useLaden } from '../ct/useLaden';
import { FensterKnopf } from '../fenster/FensterKnopf';
import { Sheet } from '../fenster/Sheet';
import { Eintrag, Option } from './AblaufAnlegenFenster';
import { KalenderFeld, NameFeld } from './VorlagenFenster';
import { meldung, punkteText } from './vorlagenMeta';
import type { AlsVorlageZugriff } from './vorlagenZugriff';
import karten from './AblaufAnlegenFenster.module.scss';
import styles from './AlsVorlageFenster.module.scss';

type Weg = 'neu' | 'ersetzen';

export function AlsVorlageFenster({
  terminTitel,
  terminText,
  punkte,
  terminKalenderId,
  darfIn,
  zugriff,
  onFertig,
  onClose,
}: {
  /** Titel des Termins – damit ist der Name der neuen Vorlage vorbelegt. */
  terminTitel: string;
  /** „Gottesdienst · So, 23.11.2026“ – die Unterzeile „Ablauf von: …“ ergänzt die Zahl der Punkte. */
  terminText: string;
  /** Wie viele Punkte der Ablauf hat – für die Unterzeile und den Warntext. */
  punkte: number;
  /** Der Kalender des Termins – `null`, wenn unbekannt. */
  terminKalenderId: number | null;
  /** Darf man in diesem Kalender Vorlagen bearbeiten (`darfVorlageBearbeiten`)? */
  darfIn: (kalenderId: number | null) => boolean;
  /** Muss über die Lebensdauer des Fensters gleich bleiben (`useMemo`) – sonst lädt es ständig neu. */
  zugriff: AlsVorlageZugriff;
  /** Nach dem Speichern: Art und Name – der Aufrufer schließt das Fenster und zeigt die Bestätigung. */
  onFertig: (art: 'neu' | 'ersetzt', name: string) => void;
  onClose: () => void;
}) {
  const liste = useLaden(() => zugriff.stand(), [zugriff], { behalten: true });
  const stand = liste.stand.art === 'fertig' ? liste.stand.daten : null;

  const [weg, setWeg] = useState<Weg>('neu');
  const [name, setName] = useState(terminTitel.slice(0, 100));
  const [gewaehlterKalender, setGewaehlterKalender] = useState<number | null>(null);
  const [gewaehlteVorlage, setGewaehlteVorlage] = useState<number | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const kalender: Kalender[] = useMemo(
    () => (stand?.kalender ?? []).filter((k) => darfIn(k.id)),
    [stand, darfIn],
  );
  // Vorbelegt: der Kalender des Termins, wenn man dort darf – sonst der übliche (`vorgabeKalender`).
  const vorbelegt =
    terminKalenderId !== null && kalender.some((k) => k.id === terminKalenderId)
      ? terminKalenderId
      : stand
        ? vorgabeKalender(kalender, stand.gruppen)
        : null;
  const kalenderId = gewaehlterKalender ?? vorbelegt;

  // Die Vorlagen, die man ersetzen darf – die des Termin-Kalenders zuerst, sonst nach Namen.
  const ersetzbar: VorlagenEintrag[] = useMemo(
    () =>
      vorlagenFuer(
        (stand?.gruppen ?? [])
          .filter((g) => darfIn(g.kalenderId))
          .flatMap((g) => g.vorlagen)
          .sort((a, b) => a.name.localeCompare(b.name, 'de')),
        terminKalenderId,
      ),
    [stand, darfIn, terminKalenderId],
  );
  // **Bewusst wählen** (Alwin, 17.11.2026, nach dem Durchklick): Nichts ist vorausgewählt – „Ersetzen“ überschreibt eine
  // Vorlage, und vorausgewählt war im Test ausgerechnet eine echte. Fehlt die gewählte inzwischen, ist wieder keine gewählt.
  const vorlage = ersetzbar.find((v) => v.id === gewaehlteVorlage) ?? null;

  const ersetzen = weg === 'ersetzen';
  const nameFehler = name === '' ? null : vorlageNameFehler(name);
  const kannSpeichern =
    stand !== null &&
    (ersetzen ? vorlage !== null : vorlageNameFehler(name) === null && kalenderId !== null);

  async function speichern() {
    setFehler(null);
    if (!ersetzen) {
      const f = vorlageNameFehler(name);
      if (f) return setFehler(f);
      if (kalenderId === null) return setFehler('Bitte einen Kalender wählen.');
    } else if (vorlage === null) {
      return;
    }
    setLaeuft(true);
    try {
      if (!ersetzen && kalenderId !== null) {
        await zugriff.speichern({ name, kalenderId });
        onFertig('neu', name.trim());
      } else if (vorlage !== null) {
        await zugriff.ersetzen(vorlage.id, vorlage.modifiedDate ?? undefined);
        onFertig('ersetzt', vorlage.name);
      }
    } catch (e) {
      // Inzwischen woanders geändert (412): die Liste neu lesen, damit „Ersetzen“ beim nächsten Versuch den neuen Stand kennt.
      if ((e as { status?: unknown } | null)?.status === 412) liste.neu();
      setFehler(meldung(e, 'Der Ablauf konnte nicht als Vorlage gespeichert werden.'));
      setLaeuft(false);
    }
  }

  return (
    <Sheet
      title="Als Vorlage speichern"
      onClose={onClose}
      mittel
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf
          art={ersetzen ? 'gefahr' : 'haupt'}
          onClick={() => void speichern()}
          disabled={laeuft || !kannSpeichern}
        >
          {ersetzen ? (laeuft ? 'Ersetze …' : 'Ersetzen') : laeuft ? 'Speichere …' : 'Speichern'}
        </FensterKnopf>
      }
    >
      <p className={karten.fuer}>
        Ablauf von: {terminText} · {punkteText(punkte)}
      </p>

      <div className={karten.optionen}>
        <Option
          icon="plus"
          titel="Als neue Vorlage"
          an={!ersetzen}
          onWaehle={() => {
            setWeg('neu');
            setFehler(null);
          }}
        >
          {!ersetzen && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (kannSpeichern && !laeuft) void speichern();
              }}
            >
              <NameFeld
                wert={name}
                onChange={(w) => {
                  setName(w);
                  setFehler(null);
                }}
                fehler={nameFehler}
                beschaeftigt={laeuft}
              />
              <KalenderFeld
                kalender={kalender}
                wert={kalenderId}
                onChange={setGewaehlterKalender}
                beschaeftigt={laeuft}
              />
              {/* Enter im Namensfeld speichert – ohne verstecktes Absenden-Knöpfchen geht das in manchen Browsern nicht. */}
              <button type="submit" hidden />
            </form>
          )}
        </Option>

        <Option
          icon="refresh"
          titel="Vorhandene Vorlage ersetzen"
          an={ersetzen}
          onWaehle={() => {
            setWeg('ersetzen');
            setFehler(null);
          }}
          hinweis={
            ersetzen && stand !== null && ersetzbar.length === 0
              ? 'Es gibt keine Vorlage, die du bearbeiten darfst.'
              : undefined
          }
        >
          {ersetzen &&
            ersetzbar.map((v) => (
              <Eintrag
                key={v.id}
                an={vorlage?.id === v.id}
                onWaehle={() => {
                  setGewaehlteVorlage(v.id);
                  setFehler(null);
                }}
                titel={v.name}
                meta={punkteText(v.punkte)}
              />
            ))}
        </Option>
      </div>

      {!ersetzen && (
        <p className={styles.info}>
          Übernommen werden alle Einträge mit Dauer, Notiz und Infos je Dienstgruppe, die Lieder und
          die Platzhalter wie „[Moderation]“ – keine Namen von Personen.
        </p>
      )}
      {ersetzen && vorlage !== null && (
        <p className={styles.warnung}>
          Die {punkteText(vorlage.punkte)} von „{vorlage.name}“ werden durch die{' '}
          {punkteText(punkte)} dieses Ablaufs ersetzt. Name und Kalender bleiben. Abläufe, die schon
          aus der Vorlage entstanden sind, ändern sich nicht.
        </p>
      )}

      {liste.stand.art === 'laedt' && <p className={styles.hinweis}>Vorlagen werden geladen …</p>}
      {liste.stand.art === 'fehler' && (
        <p className={karten.fehler} role="alert">
          {liste.stand.fehler.text}{' '}
          {liste.stand.fehler.nochmal && (
            <button type="button" className={styles.nochmal} onClick={liste.neu}>
              Erneut versuchen
            </button>
          )}
        </p>
      )}
      {fehler && (
        <p className={karten.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}
