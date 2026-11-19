import { useState, type MouseEvent } from 'react';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Sheet } from '@ui/fenster/Sheet';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { tagKurz } from '@shared/ct/datum';
import {
  betreffAus,
  betreffStandard,
  EINLEITUNG_STANDARD,
  empfaengerAus,
  erinnerSpalten,
  fehlendeInGruppe,
  mailInhalt,
  offenKurz,
  type Empfaenger,
  type GruppenErgebnis,
} from '@shared/dienstplan/erinnern';
import { gruppenDerDienste } from '@shared/dienstplan/personenDaten';
import { rasterDienste } from '@shared/dienstplan/personenRaster';
import {
  gruppenName,
  gruppenSchluessel,
  type Plan,
  type PlanGruppe,
} from '@shared/dienstplan/plan';
import { ErinnernErgebnis } from './ErinnernErgebnis';
import {
  erinnernSenden,
  type MailErgebnis,
  type MailLauf,
  type MailSender,
} from './erinnernSenden';
import type { AntwortenLader } from './ladeAntworten';
import type { PersonenLader } from './ladePersonen';
import { usePersonenAntworten } from './usePersonenAntworten';
import { usePersonenDaten } from './usePersonenDaten';
import styles from './ErinnernFenster.module.scss';

/** Was „Erinnern“ von außen braucht: wie verschickt wird, und die volle Adresse des Knopfs in der Mail. */
export interface ErinnernAnschluss {
  senden: MailSender;
  /** Die volle Adresse von „Wann kann ich?“ (Instanz + `/ccm/<Kürzel>/#/abwesenheiten`). */
  link: () => string;
}

type Phase = 'wahl' | 'laeuft' | 'fertig';

/**
 * **Das Fenster „Erinnern“** (Bauplan E5c-5, Entwurf `e5c-5-erinnern.html`, Variante B „Alles in einem“): oben die
 * Dienstgruppen als Knöpfe mit der Zahl der Fehlenden, darunter die Empfänger mit Vorschau, einklappbar „Text anpassen“,
 * unten „Eine Kopie an mich“ und „An N Personen senden“. Wer fehlt, rechnet `fehlendeInGruppe` (`shared/dienstplan/erinnern.ts`)
 * aus denselben Daten wie die Ansicht „Personen“; geladen wird beim Öffnen für alle planbaren Gruppen. Eine Gruppe, deren
 * Lage unsicher ist (Antworten oder Abwesenheiten nicht sichtbar, Ladefehler), ist **gesperrt** – mit Grund.
 *
 * Verschickt wird je Person eine eigene Mail, nacheinander (`erinnernSenden.ts`); bei einem Fehler hält es an, und
 * „An die übrigen senden“ schickt nur, was noch nicht erledigt ist – nichts doppelt. Während es läuft, schließt Esc nicht.
 */
export function ErinnernFenster({
  plan,
  spalten,
  gruppen,
  heute,
  ladePersonen,
  ladeAntworten,
  anschluss,
  onClose,
}: {
  plan: Plan;
  /** Die gezeigten Spalten (Indizes in `plan.spalten`) – „wie gezeigt“. */
  spalten: readonly number[];
  /** Die planbaren Dienstgruppen, die der Plan zeigt – **ganze** Gruppen des Plans (mit allen Diensten). */
  gruppen: readonly PlanGruppe[];
  heute: string;
  ladePersonen: PersonenLader;
  ladeAntworten: AntwortenLader;
  anschluss: ErinnernAnschluss;
  onClose: () => void;
}) {
  // ── Laden: Mitglieder und Abwesenheiten der CT-Gruppen, Antworten je Dienstgruppe – beim Öffnen ──
  const termine = erinnerSpalten(plan, spalten, heute);
  const dienste = rasterDienste(plan, termine, gruppen);
  const ctGruppen = gruppenDerDienste(dienste.map((x) => x.zeile.dienst));
  const zeitraum = plan.spalten.length
    ? { von: plan.spalten[0].tag, bis: plan.spalten[plan.spalten.length - 1].tag }
    : null;
  const personen = usePersonenDaten(ladePersonen, ctGruppen, zeitraum);
  const antwortGruppen = [...new Set(gruppen.flatMap((g) => (g.gruppe ? [g.gruppe.id] : [])))];
  const antw = usePersonenAntworten(ladeAntworten, antwortGruppen);

  // ── Was der Planer gewählt hat ──
  const [auswahl, setAuswahl] = useState<Set<string> | null>(null);
  const [aus, setAus] = useState<Set<number>>(new Set());
  const [vorschau, setVorschau] = useState<number | null>(null);
  const [textOffen, setTextOffen] = useState(false);
  const [betreffEigen, setBetreffEigen] = useState<string | null>(null);
  const [einleitung, setEinleitung] = useState(EINLEITUNG_STANDARD);
  const [kopie, setKopie] = useState(false);

  // ── Was beim Senden geschah ──
  const [phase, setPhase] = useState<Phase>('wahl');
  const [ziel, setZiel] = useState<Empfaenger[]>([]);
  const [ergebnisse, setErgebnisse] = useState<Map<number, MailErgebnis>>(new Map());
  const [angehalten, setAngehalten] = useState<MailLauf['angehalten']>(null);
  const [kopieAngefordert, setKopieAngefordert] = useState(false);
  // Zählt die Läufe – der Ergebnis-Bildschirm fängt mit jedem neu an (Haken der übrigen).
  const [laeufe, setLaeufe] = useState(0);

  const laedt = personen.laedt || antw.laedt;
  const ladeFehler = antw.fehler ?? personen.fehler;
  const neuLaden = () => {
    personen.neuLaden();
    antw.neuLaden();
  };

  const zeilen: { schluessel: string; name: string; ergebnis: GruppenErgebnis }[] = gruppen.map(
    (g) => ({
      schluessel: gruppenSchluessel(g),
      name: gruppenName(g),
      ergebnis: ladeFehler
        ? { art: 'gesperrt', grund: 'Nicht geladen', nochmal: true }
        : fehlendeInGruppe({
            plan,
            spalten,
            gruppe: g,
            daten: personen.daten,
            antworten: antw.antworten,
            heute,
          }),
    }),
  );
  const offeneZahl = (z: (typeof zeilen)[number]) =>
    z.ergebnis.art === 'ok' ? z.ergebnis.personen.length : 0;
  // Vorauswahl: die erste Gruppe mit Fehlenden – sonst die erste, die sich beurteilen lässt.
  const vorwahl =
    zeilen.find((z) => offeneZahl(z) > 0) ?? zeilen.find((z) => z.ergebnis.art === 'ok');
  const gewaehlt = new Set(
    [...(auswahl ?? new Set(vorwahl ? [vorwahl.schluessel] : []))].filter((k) =>
      zeilen.some((z) => z.schluessel === k && z.ergebnis.art === 'ok'),
    ),
  );
  const empfaenger = empfaengerAus(
    zeilen.flatMap((z) =>
      gewaehlt.has(z.schluessel) && z.ergebnis.art === 'ok'
        ? [{ gruppe: z.name, personen: z.ergebnis.personen }]
        : [],
    ),
  );
  const zuSenden = empfaenger.filter((e) => !aus.has(e.personId));
  const betreff = betreffEigen ?? betreffStandard(empfaenger.flatMap((e) => e.termine));
  const gesperrte = zeilen.filter((z) => z.ergebnis.art === 'gesperrt');
  const erstesTag = termine.length ? plan.spalten[termine[0]].tag : null;
  const letztesTag = termine.length ? plan.spalten[termine[termine.length - 1]].tag : null;

  const inhalt = (e: Empfaenger) => ({
    subject: betreffAus(betreff),
    body: mailInhalt({ name: e.name, einleitung, termine: e.termine, link: anschluss.link() }),
  });

  const los = async (liste: Empfaenger[]) => {
    if (liste.length === 0) return;
    setPhase('laeuft');
    setLaeufe((n) => n + 1);
    const lauf = await erinnernSenden({
      empfaenger: liste,
      inhalt,
      kopie: kopie && !kopieAngefordert,
      senden: anschluss.senden,
      melde: (id, e) => setErgebnisse((alt) => new Map(alt).set(id, e)),
    });
    setKopieAngefordert((alt) => alt || lauf.kopieAngefordert);
    setAngehalten(lauf.angehalten);
    setPhase('fertig');
  };
  const ersterLauf = () => {
    setZiel(zuSenden);
    setErgebnisse(new Map());
    setAngehalten(null);
    void los(zuSenden);
  };

  const umschalten = <T,>(menge: Set<T>, wert: T): Set<T> => {
    const neu = new Set(menge);
    if (neu.has(wert)) neu.delete(wert);
    else neu.add(wert);
    return neu;
  };

  const unter =
    erstesTag && letztesTag
      ? `Termine ${tagKurz(erstesTag)} – ${tagKurz(letztesTag)} (wie gezeigt) · Mail über ChurchTools, Absender: du`
      : 'Keine kommenden Termine im gezeigten Zeitraum';

  if (phase !== 'wahl') {
    return (
      <ErinnernErgebnis
        key={laeufe}
        laeuft={phase === 'laeuft'}
        ziel={ziel}
        ergebnisse={ergebnisse}
        angehalten={angehalten}
        onNochmal={(liste) => void los(liste)}
        onClose={onClose}
      />
    );
  }

  return (
    <Sheet
      title="Erinnern"
      onClose={onClose}
      knoepfe={
        <FensterKnopf onClick={ersterLauf} disabled={laedt || zuSenden.length === 0}>
          {`An ${zuSenden.length} ${zuSenden.length === 1 ? 'Person' : 'Personen'} senden`}
        </FensterKnopf>
      }
    >
      <p className={styles.unter}>{unter}</p>

      {laedt && <p className={styles.hinweis}>Antworten und Abwesenheiten werden geladen …</p>}
      {ladeFehler && <FehlerKasten fehler={ladeFehler} onNochmal={neuLaden} />}

      {!laedt && !ladeFehler && (
        <>
          <ul className={styles.chips} aria-label="Dienstgruppen">
            {zeilen.map((z) => (
              <li key={z.schluessel}>
                <button
                  type="button"
                  className={styles.chip}
                  aria-pressed={gewaehlt.has(z.schluessel)}
                  disabled={z.ergebnis.art === 'gesperrt'}
                  onClick={() => setAuswahl(umschalten(gewaehlt, z.schluessel))}
                >
                  {z.name} · {z.ergebnis.art === 'ok' ? offeneZahl(z) : 'gesperrt'}
                </button>
              </li>
            ))}
          </ul>
          {gesperrte.map((z) =>
            z.ergebnis.art === 'gesperrt' ? (
              <p key={z.schluessel} className={styles.gesperrt}>
                {z.name} ist gesperrt: {z.ergebnis.grund}.
              </p>
            ) : null,
          )}
          {gesperrte.some((z) => z.ergebnis.art === 'gesperrt' && z.ergebnis.nochmal) && (
            <p className={styles.hinweis}>
              <button type="button" className={styles.link} onClick={neuLaden}>
                Erneut versuchen
              </button>
            </p>
          )}
          <p className={styles.hinweis}>
            Erinnert wird, wer für mindestens einen Termin weder Ja/Vielleicht noch Nein eingetragen
            hat – und dort nicht schon eingeteilt ist.
          </p>

          <h3 className={styles.titel}>
            {empfaenger.length === 0
              ? gewaehlt.size === 0
                ? 'Wähle mindestens eine Dienstgruppe.'
                : 'In den gewählten Dienstgruppen haben alle geantwortet.'
              : `${zuSenden.length} ${zuSenden.length === 1 ? 'bekommt' : 'bekommen'} eine eigene Mail mit ihren offenen Terminen`}
          </h3>
          <ul className={styles.liste} aria-label="Empfänger">
            {empfaenger.map((e) => {
              const abgewaehlt = aus.has(e.personId);
              return (
                <li
                  key={e.personId}
                  className={`${styles.zeile}${abgewaehlt ? ' ' + styles.blass : ''}`}
                >
                  <input
                    type="checkbox"
                    className={styles.haken}
                    checked={!abgewaehlt}
                    aria-label={`${e.name} erinnern`}
                    onChange={() => setAus(umschalten(aus, e.personId))}
                  />
                  <span className={styles.wer}>
                    <b>
                      {e.name}
                      {e.gruppen.length > 1 ? ` · ${e.gruppen.join(', ')}` : ''}
                    </b>
                    <small>
                      {e.termine.length} offen: {offenKurz(e.termine)}
                    </small>
                  </span>
                  <button
                    type="button"
                    className={styles.link}
                    aria-expanded={vorschau === e.personId}
                    aria-label={`Vorschau der Mail an ${e.name}`}
                    onClick={() => setVorschau(vorschau === e.personId ? null : e.personId)}
                  >
                    Vorschau
                  </button>
                </li>
              );
            })}
          </ul>

          {empfaenger.map((e) =>
            vorschau === e.personId ? <Vorschau key={e.personId} e={e} inhalt={inhalt(e)} /> : null,
          )}

          <button
            type="button"
            className={styles.klapp}
            aria-expanded={textOffen}
            onClick={() => setTextOffen(!textOffen)}
          >
            {textOffen ? '▾' : '▸'} Text anpassen
          </button>
          {textOffen && (
            <>
              <label className={styles.feldName} htmlFor="erinnern-betreff">
                Betreff
              </label>
              <input
                id="erinnern-betreff"
                className={styles.feld}
                value={betreff}
                onChange={(ev) => setBetreffEigen(ev.target.value)}
              />
              <label className={styles.feldName} htmlFor="erinnern-text">
                Text (nach „Hallo &lt;Vorname&gt;,“)
              </label>
              <textarea
                id="erinnern-text"
                className={`${styles.feld} ${styles.mehrzeilig}`}
                value={einleitung}
                onChange={(ev) => setEinleitung(ev.target.value)}
              />
              <p className={styles.hinweis}>
                Darunter folgen automatisch die offenen Termine der Person und der Knopf „Im
                Dienstplaner eintragen“.
              </p>
            </>
          )}

          <label className={styles.kopie}>
            <input
              type="checkbox"
              className={styles.haken}
              checked={kopie}
              onChange={(ev) => setKopie(ev.target.checked)}
            />
            Eine Kopie an mich
          </label>
        </>
      )}
    </Sheet>
  );
}

/** Die Mail an eine Person – genau das, was verschickt wird (`mailInhalt`, dieselbe Funktion wie beim Senden). */
function Vorschau({ e, inhalt }: { e: Empfaenger; inhalt: { subject: string; body: string } }) {
  // Der Knopf in der Vorschau führt nirgends hin – es ist ein Bild der Mail, kein Link.
  const nichtOeffnen = (ev: MouseEvent) => {
    if ((ev.target as HTMLElement).closest('a')) ev.preventDefault();
  };
  return (
    <section className={styles.mail} aria-label={`Vorschau für ${e.name}`}>
      <div className={styles.betreff}>Betreff: {inhalt.subject}</div>
      {/* Der Inhalt ist `mailInhalt`: alles, was der Planer tippt, ist dort maskiert. */}
      <div onClick={nichtOeffnen} dangerouslySetInnerHTML={{ __html: inhalt.body }} />
      <div className={styles.ct}>
        Darunter hängt ChurchTools je Termin einen eigenen Knopf zum Termin an (lässt sich nicht
        abschalten).
      </div>
    </section>
  );
}
