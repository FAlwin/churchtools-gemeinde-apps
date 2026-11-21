import { useState } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { useLaden } from '@ui/ct/useLaden';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Sheet } from '@ui/fenster/Sheet';
import { tagLang } from '@shared/ct/datum';
import type { Vorschlag } from '@shared/dienstplan/vertretung';
import type { VertretungLage } from './ladeVertretung';
import type { EigenerDienst } from './TauschTeile';
import type { VertretungZugriff } from './useVertretung';
import {
  offeneMails,
  ohneMailAdresse,
  unklareMails,
  type AblaufErgebnis,
  type MailBericht,
  type VertretungsAuftrag,
} from './vertretungAblauf';
import infos from './InfosFenster.module.scss';
import styles from './VertretungFenster.module.scss';

/** „Ben und Finn“ / „Ben, Finn und Clara“. */
const aufzaehlung = (namen: readonly string[]): string =>
  namen.length <= 1
    ? (namen[0] ?? '')
    : `${namen.slice(0, -1).join(', ')} und ${namen[namen.length - 1]}`;

/** Der Name einer Person in einer Meldung – die Vornamen reichen nicht, es kann zwei „Anna“ geben. */
const namenText = (z: readonly { name: string }[]) => aufzaehlung(z.map((x) => x.name));

/**
 * **Das Fenster „Vertretung suchen“** (Bauplan E5c-6, Entwurf `e5c-6-vertretung.html` v1): Wer seinen zugesagten Dienst nicht
 * machen kann, wählt, wen er fragt, und drückt **einen** Knopf – „Absagen und fragen“ (ist niemand angehakt: „Absagen“). Dann
 * läuft `vertretungSuchen`: Markierung speichern → absagen → Mails. Jeder Schritt ist geprüft; **scheitert die Markierung oder
 * die Absage, ist nichts passiert** (das Fenster bleibt offen und sagt es). Sind nur die Mails nicht (alle) raus, ist abgesagt:
 * das Fenster sagt, an wen nicht, und bietet „Erneut senden“ für genau diese – nichts läuft von allein noch einmal.
 *
 * Wen man fragen kann, lädt das Fenster beim Öffnen (`anschluss.lage`): nur Teammitglieder dieses Dienstes, in drei
 * Abschnitten (Ja · Vielleicht · Ohne Antwort), **ohne** wer am Tag schon eingeteilt, Nein-sagend oder abwesend ist.
 * Lädt etwas nicht, steht es da – nichts wird erfunden.
 *
 * **Ein geschlossenes Fenster lädt die Seite neu** (`geaendert`) – aber erst beim Schließen: Der Dienst verschwindet mit dem
 * Neuladen aus den Listen, und mit ihm dieses Fenster, in dem das Ergebnis steht.
 */
export function VertretungFenster({
  d,
  vertretung,
  onClose,
}: {
  d: EigenerDienst;
  vertretung: VertretungZugriff;
  onClose: () => void;
}) {
  const { stand, neu } = useLaden<VertretungLage>(
    () => vertretung.anschluss.lage(d),
    // Beim Öffnen laden – `vertretung` ändert sich bei jedem Zeichnen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d.terminId, d.ort.serviceId, d.ort.index],
  );
  // `null` = noch nichts angefasst: „Ja“ ist vorab angehakt. Danach gilt, was angehakt wurde.
  const [angefasst, setAngefasst] = useState<Set<number> | null>(null);
  const [nachricht, setNachricht] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<{
    auftrag: VertretungsAuftrag;
    mails: MailBericht;
  } | null>(null);

  const lage = stand.art === 'fertig' ? stand.daten : null;
  const liste = lage?.art === 'da' ? lage.vorschlaege : null;
  const alle: Vorschlag[] =
    liste?.art === 'liste'
      ? [...liste.ja, ...liste.vielleicht, ...liste.ohne]
      : liste?.art === 'ohneAntworten'
        ? liste.team
        : [];
  const angehakt = (v: Vorschlag): boolean =>
    angefasst
      ? angefasst.has(v.personId)
      : // Vorab: wer „Ja“ gesagt hat.
        v.a === 'ja';
  const gewaehlt = alle.filter(angehakt);
  const umschalten = (v: Vorschlag) => {
    const jetzt = new Set(gewaehlt.map((x) => x.personId));
    if (jetzt.has(v.personId)) jetzt.delete(v.personId);
    else jetzt.add(v.personId);
    setAngefasst(jetzt);
  };

  const auftrag = (): VertretungsAuftrag => ({
    termin: { id: d.terminId, name: d.termin, tag: d.tag, uhrzeit: d.uhrzeit },
    dienst: { id: d.ort.serviceId, name: d.dienst },
    ich: vertretung.ich,
    gefragt: gewaehlt,
    leitung: lage?.art === 'da' ? lage.leitung : [],
    nachricht,
  });

  const schliessen = () => {
    // Erst jetzt neu laden (s. oben). Ohne Absage ist nichts zu laden.
    if (ergebnis) vertretung.geaendert();
    onClose();
  };

  const absagen = async () => {
    if (laeuft || !lage || lage.art !== 'da') return;
    setLaeuft(true);
    setFehler(null);
    const a = auftrag();
    let r: AblaufErgebnis;
    try {
      r = await vertretung.anschluss.suchen(a, d);
    } catch {
      // `vertretungSuchen` wirft nicht – kommt es trotzdem hier an, ist nichts bestätigt.
      setLaeuft(false);
      setFehler(
        'Es ist etwas schiefgegangen. Bitte unter „Dienste“ nachsehen, ob dein Dienst abgesagt ist, bevor du es noch einmal versuchst.',
      );
      return;
    }
    setLaeuft(false);
    if (r.art === 'nichtAbgesagt') setFehler(r.text);
    else setErgebnis({ auftrag: a, mails: r.mails });
  };

  const erneut = async () => {
    if (laeuft || !ergebnis) return;
    setLaeuft(true);
    try {
      const mails = await vertretung.anschluss.erneut(ergebnis.auftrag, ergebnis.mails);
      setErgebnis({ auftrag: ergebnis.auftrag, mails });
    } finally {
      setLaeuft(false);
    }
  };

  // ── Nach dem Absagen ──
  if (ergebnis) {
    const offen = offeneMails(ergebnis.mails);
    const unklar = unklareMails(ergebnis.mails);
    const ohneAdresse = ohneMailAdresse(ergebnis.mails);
    // Wiederholen lohnt nur für `offen`; wer keine Adresse hat, bleibt auch beim zweiten Mal ohne Mail.
    const nichtsMehrOffen = offen.length === 0;
    const alleVersorgt = nichtsMehrOffen && ohneAdresse.length === 0;
    // Nur wer WIRKLICH eine Mail bekommen hat – wer keine Adresse hat oder nicht erreicht wurde, steht nicht in diesem Satz.
    const ergebnisArt = (id: number) => ergebnis.mails.ergebnisse.get(id)?.art;
    const verschickt = ergebnis.mails.ziele.filter(
      (z) => z.rolle === 'gefragt' && ergebnisArt(z.personId) === 'verschickt',
    );
    const leitungKopie = ergebnis.mails.ziele.some(
      (z) => z.rolle === 'leitung' && ergebnisArt(z.personId) === 'verschickt',
    );
    return (
      <Sheet
        title="Vertretung suchen"
        onClose={schliessen}
        cancelLabel={null}
        beschaeftigt={laeuft}
        knoepfe={
          <>
            {!nichtsMehrOffen && (
              <FensterKnopf art="zweit" disabled={laeuft} onClick={() => void erneut()}>
                {laeuft ? 'Wird gesendet …' : 'Erneut senden'}
              </FensterKnopf>
            )}
            <FensterKnopf disabled={laeuft} onClick={schliessen}>
              Fertig
            </FensterKnopf>
          </>
        }
      >
        <div className={`${styles.stand} ${alleVersorgt ? styles.gut : styles.halb}`} role="status">
          <p>
            <b>Abgesagt.</b> Dein Dienst „{d.dienst}“ am {tagLang(d.tag)} ist frei – dein Team sieht
            „{vertretung.ich.name} sucht eine Vertretung“.
          </p>
          {ergebnis.auftrag.gefragt.length === 0 && <p>Es wurde niemand direkt gefragt.</p>}
          {verschickt.length > 0 && (
            <p>
              Mail verschickt an {namenText(verschickt)}
              {leitungKopie ? ' – die Leitung hat eine Kopie.' : '.'}
            </p>
          )}
          {offen.length > 0 && (
            <p>
              <b>Mail an {namenText(offen)} nicht verschickt.</b>{' '}
              {ergebnis.mails.angehalten ?? 'ChurchTools hat sie nicht genommen.'}
            </p>
          )}
          {ohneAdresse.length > 0 && (
            <p>
              Für {namenText(ohneAdresse)} hat ChurchTools keine Mail-Adresse – sag persönlich
              Bescheid.
            </p>
          )}
          {unklar.length > 0 && (
            <p>
              Bei {namenText(unklar)} ist unklar, ob die Mail angekommen ist. „Erneut senden“ könnte
              sie doppelt schicken.
            </p>
          )}
        </div>
      </Sheet>
    );
  }

  const nichts = gewaehlt.length === 0;
  const knopf = laeuft ? 'Wird abgesagt …' : nichts ? 'Absagen' : 'Absagen und fragen';
  return (
    <Sheet
      title="Vertretung suchen"
      onClose={onClose}
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf
          disabled={laeuft || !lage || lage.art !== 'da'}
          onClick={() => void absagen()}
        >
          {knopf}
        </FensterKnopf>
      }
    >
      <p className={infos.fuer}>
        <b>
          {d.dienst} · {d.termin} · {tagLang(d.tag)}
        </b>{' '}
        – wähle, wen du fragst. Dein Dienst wird dabei abgesagt. Wer zuerst übernimmt, hat ihn.
      </p>
      {stand.art === 'laedt' && <p className={infos.hinweis}>Dein Team wird geladen …</p>}
      {stand.art === 'fehler' && <FehlerKasten fehler={stand.fehler} onNochmal={neu} />}
      {lage?.art === 'keineMitglieder' && (
        <p className={infos.hinweis}>
          Das Team dieses Dienstes ist für dich nicht zu sehen – darum lässt sich niemand fragen.
          Wenn du nicht kannst, sag bitte direkt der Leitung Bescheid.
        </p>
      )}
      {lage?.art === 'da' && liste && (
        <>
          {lage.abwesenheitenUnbekannt && (
            <p className={styles.hinweis} role="status">
              Wer abwesend ist, konnte nicht geprüft werden – die Liste zeigt vielleicht auch Leute,
              die gar nicht können.
            </p>
          )}
          {liste.art === 'liste' ? (
            <>
              <Abschnitt
                titel="Hat Ja gesagt"
                art="ja"
                personen={liste.ja}
                angehakt={angehakt}
                onUmschalten={umschalten}
                gesperrt={laeuft}
              />
              <Abschnitt
                titel="Vielleicht"
                art="vielleicht"
                personen={liste.vielleicht}
                angehakt={angehakt}
                onUmschalten={umschalten}
                gesperrt={laeuft}
              />
              <Abschnitt
                titel="Ohne Antwort"
                art="ohne"
                personen={liste.ohne}
                angehakt={angehakt}
                onUmschalten={umschalten}
                gesperrt={laeuft}
              />
            </>
          ) : (
            <>
              <p className={styles.hinweis}>
                Die Antworten aus „Wann kann ich?“ sind für dich nicht lesbar – darum steht hier das
                ganze Team, ohne Einordnung.
              </p>
              <Abschnitt
                titel="Team"
                art="ohne"
                personen={liste.team}
                angehakt={angehakt}
                onUmschalten={umschalten}
                gesperrt={laeuft}
              />
            </>
          )}
          {alle.length === 0 && (
            <p className={infos.hinweis}>
              Gerade kommt niemand aus dem Team in Frage (alle sind schon eingeteilt, abwesend oder
              haben Nein gesagt). Du kannst trotzdem absagen – dein Team sieht dann, dass eine
              Vertretung gesucht wird.
            </p>
          )}
          <label className={styles.feldName} htmlFor="vertretung-nachricht">
            Nachricht (freiwillig)
          </label>
          <textarea
            id="vertretung-nachricht"
            className={styles.feld}
            value={nachricht}
            maxLength={500}
            disabled={laeuft}
            onChange={(e) => setNachricht(e.target.value)}
          />
          <p className={styles.hinweis}>
            {nichts
              ? `Niemand wird angeschrieben – dein Dienst wird nur abgesagt. Dein Team sieht auf der Startseite „${vertretung.ich.name} sucht eine Vertretung“.`
              : `${namenText(gewaehlt)} ${gewaehlt.length === 1 ? 'bekommt' : 'bekommen'} eine Mail${
                  lage.leitung.length > 0 ? `, die Leitung des ${lage.teamName} eine Kopie` : ''
                }.`}
          </p>
        </>
      )}
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}

/** Ein Abschnitt der Liste – Plakette, Titel, Zahl, und je Person ein Häkchen mit ihrem Kommentar. */
function Abschnitt({
  titel,
  art,
  personen,
  angehakt,
  onUmschalten,
  gesperrt,
}: {
  titel: string;
  art: 'ja' | 'vielleicht' | 'ohne';
  personen: readonly Vorschlag[];
  angehakt: (v: Vorschlag) => boolean;
  onUmschalten: (v: Vorschlag) => void;
  gesperrt: boolean;
}) {
  if (personen.length === 0) return null;
  return (
    <section className={styles.abschnitt} aria-label={titel}>
      <h3 className={styles.kopf}>
        <span
          className={`${styles.plakette}${art === 'vielleicht' ? ' ' + styles.vielleicht : art === 'ohne' ? ' ' + styles.ohne : ''}`}
          aria-hidden="true"
        />
        {titel} <span className={styles.zahl}>{personen.length}</span>
      </h3>
      <ul className={styles.liste}>
        {personen.map((v) => (
          <li key={v.personId}>
            <label className={styles.zeile}>
              <input
                type="checkbox"
                className={styles.haken}
                checked={angehakt(v)}
                disabled={gesperrt}
                onChange={() => onUmschalten(v)}
                aria-label={v.name}
              />
              <span className={styles.wer}>
                <b>{v.name}</b>
                {v.notiz && <small>„{v.notiz}“</small>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
