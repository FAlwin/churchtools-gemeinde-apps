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
import {
  kuenftigeWechseljahre,
  offenesFenster,
  type WerVorschau,
} from '@shared/organigramm/einrichtungVorschau';
import type { EinrichtungDaten } from '@shared/organigramm/einrichtungStand';
import { GRUNDWERTE, wechseljahre } from '@shared/organigramm/gruppenwechsel';
import type { Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import { istLeitung } from '@shared/organigramm/mitglieder';
import { EinrichtenStufen } from './EinrichtenStufen';
import { FertigAnsicht, Schritte } from './EinrichtenFertig';
import { EinrichtenVorschau, type Teil } from './EinrichtenVorschau';
import { ladeEinrichtungStand } from './ladeEinrichtungStand';
import { ladeKalenderNamen, ladeRegelnDerStufen, ladeTypVorhanden } from './ladeEinrichten';
import { ladeFerien, ladeKjDaten } from './ladeKinderJugend';
import type { Start } from './start';
import { useSchreibLauf } from './useSchreibLauf';
import { werTeil } from './werTeil';
import styles from './Einrichten.module.scss';

const SCHRITTE = ['Stufen', 'Vorschau', 'Fertig'] as const;

/**
 * **Das Fenster „Gruppenwechsel einrichten“ / „Stufen ändern“** (Bauplan O9-5c-2/O9-5d, Entwurf `o9-5-einrichten-v1`) –
 * drei Schritte: Stufen, Vorschau, Fertig. Der Hauptknopf der Vorschau schreibt (`useSchreibLauf` → `schreibeEinrichtung`),
 * „Fertig“ zeigt, was nachgelesen wurde, und bei einem Fehler „Später“ / „Nochmal versuchen“. Fenster sind immer Modal
 * (`Sheet`); solange geschrieben wird, lässt es sich nicht schließen.
 *
 * Nur für „Berechtigungen verwalten“ (der Aufrufer zeigt es nur dort). `einrichtung` ist beim Ändern die gespeicherte,
 * beim ersten Einrichten `null`; `standDaten` der Stand in ChurchTools, den die Seite schon gelesen hat (sonst liest ihn
 * das Fenster). **Beim Ändern ist die Bereichsgruppe gesperrt** (O9-F11). `onGeschrieben` ruft das Fenster beim Schließen,
 * wenn geschrieben wurde – dann lädt die Seite die Einrichtung und den Stand neu (vorher nicht: Sie würde unter dem
 * Fenster verschwinden).
 */
export function EinrichtenFenster({
  art,
  start,
  einrichtung,
  standDaten,
  onSchliessen,
  onGeschrieben,
}: {
  art: 'einrichten' | 'aendern';
  start: Start;
  einrichtung: Einrichtung | null;
  standDaten?: EinrichtungDaten;
  onSchliessen: () => void;
  /** Es wurde (vielleicht) geschrieben: Seite und Einrichtung neu laden. */
  onGeschrieben: () => void;
}) {
  const heute = useMemo(() => heuteImKalender(), []);
  const alt = art === 'aendern' ? einrichtung : null;
  const [form, setForm] = useState<Formular>(() => formularAus(alt));
  const anfang = useRef(form);
  const [schritt, setSchritt] = useState<1 | 2 | 3>(1);
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
    return kuenftigeWechseljahre(
      wechseljahre(ferien.stand.daten.ferien, berechnet.einrichtung.einstellung),
      heute,
    );
  }, [gueltig, ferien.stand, berechnet, heute]);

  const wer = useMemo(
    (): Teil<WerVorschau> =>
      werTeil({
        ferien,
        kinder,
        einstellung: berechnet.einrichtung.einstellung,
        jahre,
        kalender: form.ferienkalender,
      }),
    [ferien, kinder, berechnet, jahre, form.ferienkalender],
  );

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

  const offen = useMemo(
    () => (wer.art === 'da' ? offenesFenster(wer.daten, heute) : null),
    [wer, heute],
  );

  const {
    stand: lauf,
    starten,
    geschrieben,
  } = useSchreibLauf({
    art,
    soll: berechnet.einrichtung,
    ausgang: alt,
    von: { personId: start.ichId, name: start.vorname },
  });
  const laeuft = lauf?.art === 'laeuft';
  const schliessen = () => {
    onSchliessen();
    if (geschrieben()) onGeschrieben();
  };
  const schreiben = () => {
    setSchritt(3);
    void starten();
  };
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

  // Nach einem Lauf, der gar nicht erst schreiben durfte, geht es zurück zur Vorschau; sonst gibt es kein Zurück.
  const gestoppt = lauf?.art === 'vorbei' && lauf.lauf.art === 'gestoppt';
  const gestopptNochmal = gestoppt && lauf.lauf.art === 'gestoppt' && lauf.lauf.nochmal;
  const nochNichtFertig = lauf?.art === 'vorbei' && (lauf.lauf.art === 'gestoppt' || !lauf.lauf.ok);

  return (
    <Sheet
      title={art === 'einrichten' ? 'Gruppenwechsel einrichten' : 'Stufen ändern'}
      onClose={schliessen}
      // Ein Tipp daneben verwirft keine Eingaben (wie das Punkt-Fenster) – und stört kein laufendes Schreiben.
      onHintergrund={geaendert || schritt === 3 ? () => {} : schliessen}
      beschaeftigt={laeuft}
      cancelLabel={schritt === 3 ? null : undefined}
      breit
      // „Zurück“ steht als ‹ vor dem Titel, nicht unten (Entwurf „Fenster mit Zurück“, 02.11.2026).
      zurueck={
        schritt === 2
          ? () => setSchritt(1)
          : schritt === 3 && gestoppt
            ? () => setSchritt(2)
            : undefined
      }
      knoepfe={
        schritt === 1 ? (
          <FensterKnopf onClick={weiter}>Weiter zur Vorschau</FensterKnopf>
        ) : schritt === 2 ? (
          <FensterKnopf disabled={!bereit} onClick={schreiben}>
            {art === 'einrichten' ? 'Jetzt einrichten' : 'Änderungen schreiben'}
          </FensterKnopf>
        ) : laeuft || !lauf ? (
          <FensterKnopf disabled>Es wird geschrieben …</FensterKnopf>
        ) : nochNichtFertig ? (
          <>
            <FensterKnopf art="zweit" onClick={schliessen}>
              Später
            </FensterKnopf>
            {(!gestoppt || gestopptNochmal) && (
              <FensterKnopf onClick={schreiben}>Nochmal versuchen</FensterKnopf>
            )}
          </>
        ) : (
          <FensterKnopf onClick={schliessen}>Fertig</FensterKnopf>
        )
      }
    >
      <Schritte namen={SCHRITTE} schritt={schritt} />
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
            bereichGesperrt={art === 'aendern'}
          />
        </>
      ) : schritt === 2 ? (
        <EinrichtenVorschau
          art={art}
          wer={wer}
          jahre={jahre}
          plan={planTeil}
          fremd={fremd}
          fremdNeu={regeln.neu}
          haken={haken}
          onHaken={setHaken}
          offen={offen}
        />
      ) : lauf ? (
        <FertigAnsicht
          stand={lauf}
          mitLeseRechten
          einrichtung={{
            ...berechnet.einrichtung,
            bereich:
              start.gruppen.find((g) => g.id === berechnet.einrichtung.bereichGruppeId)?.name ??
              `Gruppe ${berechnet.einrichtung.bereichGruppeId}`,
          }}
        />
      ) : null}
    </Sheet>
  );
}
