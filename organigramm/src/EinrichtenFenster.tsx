import { useMemo, useRef, useState } from 'react';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Sheet } from '@ui/fenster/Sheet';
import { useLaden } from '@ui/ct/useLaden';
import { heuteImKalender } from '@shared/ct/zeit';
import {
  darfSchreiben,
  einrichtungsPlan,
  fremdeRegeln,
  type EinrichtungsPlan,
} from '@shared/organigramm/einrichtungPlan';
import {
  einrichtungAusFormular,
  formularAus,
  type Formular,
} from '@shared/organigramm/einrichtungFormular';
import { werVorschau, type WerVorschau } from '@shared/organigramm/einrichtungVorschau';
import type { EinrichtungDaten } from '@shared/organigramm/einrichtungStand';
import { aktuellesWechseljahr } from '@shared/organigramm/gruppenwechselSicht';
import { GRUNDWERTE, wechseljahre } from '@shared/organigramm/gruppenwechsel';
import type { Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import { istLeitung } from '@shared/organigramm/mitglieder';
import { EinrichtenStufen } from './EinrichtenStufen';
import { EinrichtenVorschau, type Teil } from './EinrichtenVorschau';
import { ladeEinrichtungStand } from './ladeEinrichtungStand';
import { ladeKalenderNamen, ladeRegelnDerStufen, ladeTypVorhanden } from './ladeEinrichten';
import { ladeFerien, ladeKjDaten } from './ladeKinderJugend';
import type { Start } from './start';
import styles from './Einrichten.module.scss';

/** Solange das Schreiben fehlt (kommt mit O9-5d), ist der Hauptknopf aus – auch wenn alles stimmt. */
const SCHREIBEN_FREIGEGEBEN = false;

const SCHRITTE = ['Stufen', 'Vorschau', 'Fertig'] as const;

function Schritte({ schritt }: { schritt: 1 | 2 }) {
  return (
    <ol className={styles.schritte} aria-label="Schritte">
      {SCHRITTE.map((n, i) => (
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

/**
 * **Das Fenster „Gruppenwechsel einrichten“ / „Stufen ändern“** (Bauplan O9-5c-2, Entwurf `o9-5-einrichten-v1`) – zwei
 * Schritte: Stufen, Vorschau. **Es schreibt nichts:** Der Hauptknopf ist aus („Schreiben kommt mit der nächsten
 * Fassung“); „Fertig“ gibt es mit O9-5d. Fenster sind immer Modal (`Sheet`).
 *
 * Nur für „Berechtigungen verwalten“ (der Aufrufer zeigt es nur dort). `einrichtung` ist beim Ändern die gespeicherte,
 * beim ersten Einrichten `null`; `standDaten` der Stand in ChurchTools, den die Seite schon gelesen hat (sonst liest ihn
 * das Fenster).
 */
export function EinrichtenFenster({
  art,
  start,
  einrichtung,
  standDaten,
  onSchliessen,
}: {
  art: 'einrichten' | 'aendern';
  start: Start;
  einrichtung: Einrichtung | null;
  standDaten?: EinrichtungDaten;
  onSchliessen: () => void;
}) {
  const heute = useMemo(() => heuteImKalender(), []);
  const alt = art === 'aendern' ? einrichtung : null;
  const [form, setForm] = useState<Formular>(() => formularAus(alt));
  const anfang = useRef(form);
  const [schritt, setSchritt] = useState<1 | 2>(1);
  const [versucht, setVersucht] = useState(false);
  const [haken, setHaken] = useState(false);

  const berechnet = useMemo(() => einrichtungAusFormular(form), [form]);
  const fehler = berechnet.fehler;
  const aktiv = schritt === 2;

  // ── Was gelesen wird ──────────────────────────────────────────────────────────────────────────────────────────
  const kalender = useLaden(() => ladeKalenderNamen(), []);
  const { ferienkalender, ferienStichwort } = form;
  const ferien = useLaden(
    () => ladeFerien({ ...GRUNDWERTE, ferienkalender, ferienStichwort }, heute),
    [ferienkalender, ferienStichwort, heute],
  );
  const kinder = useLaden(
    () =>
      aktiv
        ? ladeKjDaten({ ...berechnet.einrichtung, wechselGruppen: [] }, (rolleId) =>
            istLeitung(start.rollen, rolleId),
          )
        : null,
    [aktiv, berechnet, start.rollen],
  );
  const typ = useLaden(() => (aktiv ? ladeTypVorhanden() : null), [aktiv]);
  const stand = useLaden(
    () =>
      aktiv && alt ? (standDaten ? Promise.resolve(standDaten) : ladeEinrichtungStand(alt)) : null,
    [aktiv, alt, standDaten],
  );
  const regeln = useLaden(
    () =>
      aktiv
        ? ladeRegelnDerStufen(berechnet.einrichtung.einstellung.stufen.map((s) => s.gruppeId))
        : null,
    [aktiv, berechnet],
  );

  // ── Daraus gerechnet ──────────────────────────────────────────────────────────────────────────────────────────
  const gueltig = fehler.length === 0;
  const jahre = useMemo(() => {
    if (!gueltig || ferien.stand.art !== 'fertig' || ferien.stand.daten.art !== 'da') return [];
    const alle = wechseljahre(ferien.stand.daten.ferien, berechnet.einrichtung.einstellung);
    const ab = aktuellesWechseljahr(alle, heute);
    return ab ? alle.filter((j) => j.jahr >= ab.jahr) : [];
  }, [gueltig, ferien.stand, berechnet, heute]);

  const wer = useMemo((): Teil<WerVorschau> => {
    const f = ferien.stand;
    if (f.art === 'fehler') return { art: 'fehler', text: f.fehler.text, neu: ferien.neu };
    if (f.art !== 'fertig') return { art: 'laedt' };
    if (f.daten.art !== 'da')
      return {
        art: 'fehler',
        text:
          f.daten.art === 'keinKalender'
            ? `Den Kalender „${form.ferienkalender}“ gibt es nicht oder er ist für dich nicht sichtbar.`
            : 'Der Ferienkalender ließ sich gerade nicht lesen.',
        neu: ferien.neu,
      };
    const k = kinder.stand;
    if (k.art === 'fehler') return { art: 'fehler', text: k.fehler.text, neu: kinder.neu };
    if (k.art !== 'fertig') return { art: 'laedt' };
    if (k.daten.art === 'fehler')
      return { art: 'fehler', text: 'Die Kinder ließen sich gerade nicht lesen.', neu: kinder.neu };
    return {
      art: 'da',
      daten: werVorschau(k.daten.daten, berechnet.einrichtung.einstellung, jahre),
    };
  }, [ferien, kinder, berechnet, jahre, form.ferienkalender]);

  const typStand = typ.stand.art === 'fertig' ? typ.stand.daten : null;
  const standGelesen: EinrichtungDaten | null =
    stand.stand.art === 'fertig' ? stand.stand.daten : null;
  // Der Plan steht erst, wenn alles gefragt ist – ein „noch nicht geladen“ darf nie wie „fehlt“ aussehen.
  const planBereit =
    aktiv &&
    gueltig &&
    typ.stand.art !== 'laedt' &&
    ferien.stand.art !== 'laedt' &&
    (alt === null || stand.stand.art !== 'laedt');
  const plan: EinrichtungsPlan | null = useMemo(
    () =>
      planBereit
        ? einrichtungsPlan(berechnet.einrichtung, {
            typ: typStand ?? { ok: false },
            alt,
            gruppen: new Map(start.gruppen.map((g) => [g.id, g.name])),
            stand: standGelesen,
            jahre: jahre.map((j) => j.jahr),
          })
        : null,
    [planBereit, berechnet, typStand, alt, start.gruppen, standGelesen, jahre],
  );
  const planTeil: Teil<EinrichtungsPlan> = plan ? { art: 'da', daten: plan } : { art: 'laedt' };

  const fremd = useMemo(
    () =>
      regeln.stand.art === 'fertig'
        ? fremdeRegeln(berechnet.einrichtung.einstellung.stufen, regeln.stand.daten)
        : // Konnten die Regeln nicht gelesen werden: unlesbar – nie „keine“.
          regeln.stand.art === 'fehler'
          ? fremdeRegeln(berechnet.einrichtung.einstellung.stufen, new Map())
          : null,
    [regeln.stand, berechnet],
  );

  const bereit = darfSchreiben({
    art,
    fehler: fehler.map((f) => f.text),
    plan,
    fremd,
    jahre: jahre.length,
    haken,
  });

  // Sommerferien-Hinweis in den weiteren Einstellungen.
  const ferienBis =
    ferien.stand.art !== 'fertig'
      ? 'Der Kalender wird gelesen …'
      : ferien.stand.daten.art === 'da' && ferien.stand.daten.ferien.length > 0
        ? `Sommerferien gefunden bis ${ferien.stand.daten.ferien[ferien.stand.daten.ferien.length - 1].jahr}.`
        : ferien.stand.daten.art === 'keinKalender'
          ? 'Diesen Kalender gibt es nicht oder er ist für dich nicht sichtbar.'
          : ferien.stand.daten.art === 'da'
            ? 'In diesem Kalender stehen keine Sommerferien.'
            : 'Der Kalender ließ sich gerade nicht lesen.';

  const geaendert = JSON.stringify(form) !== JSON.stringify(anfang.current);
  const weiter = () => {
    if (fehler.length > 0) {
      setVersucht(true);
      return;
    }
    setHaken(false);
    setSchritt(2);
  };

  return (
    <Sheet
      title={art === 'einrichten' ? 'Gruppenwechsel einrichten' : 'Stufen ändern'}
      onClose={onSchliessen}
      // Ein Tipp daneben verwirft keine Eingaben (wie das Punkt-Fenster).
      onHintergrund={geaendert ? () => {} : onSchliessen}
      breit
      // „Zurück“ steht als ‹ vor dem Titel, nicht unten (Entwurf „Fenster mit Zurück“, 02.11.2026).
      zurueck={schritt === 2 ? () => setSchritt(1) : undefined}
      knoepfe={
        schritt === 1 ? (
          <FensterKnopf onClick={weiter}>Weiter zur Vorschau</FensterKnopf>
        ) : (
          <>
            <span className={styles.fussHinweis}>Schreiben kommt mit der nächsten Fassung.</span>
            <FensterKnopf disabled={!SCHREIBEN_FREIGEGEBEN} data-bereit={bereit ? 'ja' : 'nein'}>
              {art === 'einrichten' ? 'Jetzt einrichten' : 'Änderungen schreiben'}
            </FensterKnopf>
          </>
        )
      }
    >
      <Schritte schritt={schritt} />
      {schritt === 1 ? (
        <>
          {versucht && fehler.length > 0 && (
            <p className={styles.fehlerKopf} role="alert">
              Hier fehlt noch etwas – siehe die roten Hinweise.
            </p>
          )}
          <EinrichtenStufen
            form={form}
            onForm={setForm}
            baum={start.baum}
            gruppen={start.gruppen}
            fehler={fehler}
            zeigeFehler={versucht}
            kalender={
              kalender.stand.art === 'fertig' && kalender.stand.daten.ok
                ? kalender.stand.daten.wert
                : null
            }
            ferienBis={ferienBis}
          />
        </>
      ) : (
        <EinrichtenVorschau
          art={art}
          wer={wer}
          jahre={jahre}
          plan={planTeil}
          fremd={fremd}
          fremdNeu={regeln.neu}
          haken={haken}
          onHaken={setHaken}
        />
      )}
    </Sheet>
  );
}
