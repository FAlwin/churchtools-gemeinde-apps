import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Etikett, type EtikettTon } from '@ui/bedienung/Etikett';
import { CenterMessage } from '@ui/bedienung/CenterMessage';
import { Segment } from '@ui/bedienung/Segment';
import { PersonBild } from '@ui/bedienung/PersonBild';
import { Schalter } from '@ui/bedienung/Schalter';
import { TitelWahl } from '@ui/bedienung/TitelWahl';
import { Icon } from '@ui/icons/icons';
import { Sheet } from '@ui/fenster/Sheet';
import { personLink } from '@ui/ct/links';
import { useLaden } from '@ui/ct/useLaden';
import { ApiError } from '@ui/ct/fehler';
import { tagPunkt } from '@shared/ct/datum';
import { heuteImKalender } from '@shared/ct/zeit';
import type { Stufe, Wechseljahr } from '@shared/organigramm/gruppenwechsel';
import type { Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import {
  aktuellesWechseljahr,
  vorigerWechseltag,
  ausnahmeStand,
  gruppenSicht,
  phaseAm,
  pflegeAus,
  type AusnahmeStand,
  type GruppenSicht,
  type KindZeile,
  type KjZugang,
  type NeuZeile,
  type Phase,
  wechslerZahl,
} from '@shared/organigramm/gruppenwechselSicht';
import {
  kurz,
  tageHinweis,
  wechseltageStand,
  wechseltagText,
  type TageStand,
} from '@shared/organigramm/wechseltage';
import { initialenAus, istLeitung } from '@shared/organigramm/mitglieder';
import {
  ausnahmeAufheben,
  ausnahmeSetzen,
  ausnahmeZurueck,
  type Mitgliedschaft,
} from '@shared/organigramm/mitgliedschaft';
import { mitgliederRechteOderNichts, type GruppenRechte } from '@shared/organigramm/rechte';
import { ausnahmeFehlerText, keinSchalterText } from './ausnahmeTexte';
import { ladeFerien, ladeKjDaten, type FerienStand, type KjLadeStand } from './ladeKinderJugend';
import { ladeRegelStand, type RegelStand } from './ladeRegelStand';
import { ladeTeilnehmerRolle, mitgliedZugriff } from './mitgliedschaft';
import { EinrichtungSeite } from './EinrichtungSeite';
import { Hinweis } from './KjHinweis';
import type { Start } from './start';
import { Wechseltage } from './Wechseltage';
import styles from './KinderJugend.module.scss';

interface Props {
  start: Start;
  einrichtung: Einrichtung;
  zugang: KjZugang;
  /** Abgemeldet gilt für die ganze Seite – dieselbe Stelle wie für den Rest der App. */
  onAbgemeldet: (e: unknown) => void;
  /** Nach dem Schreiben (Einrichten, Nachtragen, Rechte setzen): Die Einrichtung wird neu gelesen – alles hier lädt neu. */
  onGeschrieben: () => void;
}

type Unter = 'gruppe' | 'daten' | 'tage' | 'einrichtung';
type Laden<T> = { art: 'laedt' } | T;

/**
 * **Der Reiter „Kinder & Jugend“** (Bauplan O9-2/O9-3, Entwurf v3): Leitungen sehen ihre Gruppe, Bereichsleitung und
 * Admins eine Übersicht über alle Stufen; dazu „Daten pflegen“. Ein Kind öffnet ein Fenster; darin setzt man die
 * **Ausnahme** („Bleibt noch ein Jahr“) – wenn das Recht an der Wechsel-Gruppe da ist (`ausnahmeStand`).
 */
export function KinderJugend({ start, einrichtung, zugang, onAbgemeldet, onGeschrieben }: Props) {
  const heute = useMemo(() => heuteImKalender(), []);
  const [ferien, setFerien] = useState<Laden<FerienStand>>({ art: 'laedt' });
  const [daten, setDaten] = useState<Laden<KjLadeStand>>({ art: 'laedt' });
  const [unter, setUnter] = useState<Unter>('gruppe');
  // Leitung mehrerer Stufen: welche gerade. Bereichsleitung: die aus der Übersicht geöffnete (`null` = Übersicht).
  const [stufeWahl, setStufeWahl] = useState<number | null>(
    zugang.art === 'leitung' ? zugang.stufen[0] : null,
  );
  // Nur WER offen ist – das Kind selbst kommt bei jedem Zeichnen frisch aus den Daten: Nach dem Setzen einer Ausnahme
  // lädt der Reiter neu, und das Fenster zeigt den neuen Stand.
  const [offenesKind, setOffenesKind] = useState<{ personId: number; stufeId: number } | null>(
    null,
  );

  const laden = useCallback(() => {
    setFerien({ art: 'laedt' });
    setDaten({ art: 'laedt' });
    // Beide werfen nur, wenn man abgemeldet ist; alles andere kommt als `fehler` zurück.
    ladeFerien(einrichtung.einstellung, heute).then(setFerien, onAbgemeldet);
    ladeKjDaten(einrichtung, (rolleId) => istLeitung(start.rollen, rolleId)).then(
      setDaten,
      onAbgemeldet,
    );
  }, [einrichtung, heute, start.rollen, onAbgemeldet]);
  useEffect(laden, [laden]);

  /**
   * Nach dem Schreiben: die Daten des Reiters neu holen, **ohne** „wird geladen“ dazwischen – das Fenster bleibt offen
   * (mit „Rückgängig“). `false`, wenn das nicht ging; dann bleibt der alte Stand stehen.
   */
  const neuLesen = useCallback(async (): Promise<boolean> => {
    try {
      const neu = await ladeKjDaten(einrichtung, (rolleId) => istLeitung(start.rollen, rolleId));
      if (neu.art === 'fehler') return false;
      setDaten(neu);
      return true;
    } catch (e) {
      onAbgemeldet(e);
      return false;
    }
  }, [einrichtung, start.rollen, onAbgemeldet]);

  const jahr = ferien.art === 'da' ? aktuellesWechseljahr(ferien.jahre, heute) : null;
  // Welche Wechseltage in den Regeln von ChurchTools stehen – nur für Leute mit „Berechtigungen verwalten“ (O9-F8):
  // Nur sie dürfen die Regeln lesen, nur sie sehen Spalte „In ChurchTools“ und die Erinnerung.
  const darfRegeln = start.rechte.rechteVerwalten;
  const kuenftig = useMemo(
    () => (ferien.art === 'da' && jahr ? ferien.jahre.filter((j) => j.jahr >= jahr.jahr) : []),
    [ferien, jahr],
  );
  // Über `useLaden` (#845): Eine späte Antwort zu alten Jahren zählt nicht. `ladeRegelStand` wirft nie – 401, 403, Netz
  // und 5xx heißen dort „nicht prüfbar“ (401 ist hier fehlendes Recht, kein Abmelden); käme doch ein Fehler, gilt dasselbe.
  const regelStand = useLaden(
    () =>
      darfRegeln && jahr && kuenftig.length > 0
        ? ladeRegelStand(einrichtung, kuenftig, jahr.jahr)
        : null,
    [darfRegeln, einrichtung, kuenftig, jahr],
  ).stand;
  const regel: Laden<RegelStand> =
    regelStand.art === 'fertig'
      ? regelStand.daten
      : regelStand.art === 'fehler'
        ? { art: 'nichtPruefbar' }
        : { art: 'laedt' };

  // Grenze für „Ausnahme vom letzten Jahr“ – der Wechseltag des Vorjahres (der Ferienkalender lädt ab dem Vorjahr).
  const voriger = ferien.art === 'da' && jahr ? vorigerWechseltag(ferien.jahre, jahr) : null;
  const sichten = useMemo(() => {
    if (!jahr || daten.art !== 'da') return [];
    const stufen =
      zugang.art === 'bereich'
        ? einrichtung.einstellung.stufen.map((s) => s.gruppeId)
        : zugang.stufen;
    const neu = zugang.art === 'bereich' ? 'immer' : 'abAnkuendigung';
    return stufen.flatMap(
      (id) =>
        gruppenSicht(einrichtung, id, daten.daten, jahr, heute, neu, {
          vorigerWechseltag: voriger,
        }) ?? [],
    );
  }, [jahr, voriger, daten, zugang, einrichtung, heute]);

  // Was die eigene Rolle an den Wechsel-Gruppen darf – global (Admin, Bereichsleitung) oder über die Rolle dort.
  // Wo es sich nicht sagen lässt, fehlt die Gruppe (dann: „nicht lesbar“ statt „fehlt dir das Recht“).
  const rechte = useMemo(() => {
    const m = new Map<number, GruppenRechte>();
    if (daten.art !== 'da') return m;
    for (const w of einrichtung.wechselGruppen) {
      const typId = start.gruppen.find((x) => x.id === w.gruppeId)?.typId ?? null;
      const r = mitgliederRechteOderNichts(start.rechte, daten.rechte.get(w.gruppeId) ?? null, {
        id: w.gruppeId,
        typId,
      });
      if (r) m.set(w.gruppeId, r);
    }
    return m;
  }, [daten, einrichtung, start.gruppen, start.rechte]);

  if (ferien.art === 'laedt' || daten.art === 'laedt')
    return <CenterMessage loading text="Kinder und Wechseltage werden geladen …" />;
  if (ferien.art === 'fehler' || daten.art === 'fehler')
    return <CenterMessage icon="warnung" text="Gerade nicht ladbar." onRetry={laden} />;
  if (ferien.art === 'keinKalender')
    return (
      <CenterMessage
        icon="calendar"
        text={`Der Kalender „${einrichtung.einstellung.ferienkalender}“ ist für dich nicht sichtbar. Ohne ihn fehlen die Wechseltage – bitte einen Admin, ihn für dich freizugeben.`}
      />
    );
  if (!jahr)
    return (
      <CenterMessage
        icon="calendar"
        text={`Im Kalender „${einrichtung.einstellung.ferienkalender}“ stehen keine künftigen Sommerferien. Bitte einem Admin Bescheid geben.`}
      />
    );

  const phase = phaseAm(jahr, heute);
  const bereich = zugang.art === 'bereich';
  // Läuft das Eingetragene aus? Die eine Regel (`wechseltageStand`), das nächste Jahr ist das Jahr des Reiters.
  // Ohne das Recht oder ohne lesbare Regeln: keine Erinnerung.
  const tage = wechseltageStand(
    darfRegeln && regel.art === 'da' ? regel.bis : undefined,
    jahr.jahr,
  );
  const offeneSicht = sichten.find((s) => s.stufe.gruppeId === stufeWahl) ?? null;
  const kindOeffnen = (stufe: GruppenSicht) => (kind: KindZeile) =>
    setOffenesKind({ personId: kind.personId, stufeId: stufe.stufe.gruppeId });
  const offen = offenesKind
    ? sichten.find((s) => s.stufe.gruppeId === offenesKind.stufeId)
    : undefined;
  const offenKind = offen?.kinder.find((k) => k.personId === offenesKind?.personId);

  return (
    <div className={styles.seite}>
      <Segment<Unter>
        value={unter}
        options={[
          { value: 'gruppe', label: bereich ? 'Übersicht' : 'Meine Gruppe' },
          { value: 'daten', label: 'Daten pflegen' },
          ...(bereich ? [{ value: 'tage' as const, label: 'Wechseltage' }] : []),
          // Nur mit „Berechtigungen verwalten“ (O9-5c): Sie allein dürfen lesen, was in ChurchTools steht.
          ...(darfRegeln ? [{ value: 'einrichtung' as const, label: 'Einrichtung' }] : []),
        ]}
        onChange={(u) => {
          setUnter(u);
          if (bereich) setStufeWahl(null);
        }}
        ariaLabel="Kinder & Jugend"
        verbunden
      />
      {unter === 'gruppe' &&
        (offeneSicht ? (
          <GruppenSeite
            sicht={offeneSicht}
            jahr={jahr}
            phase={phase}
            bereich={bereich}
            onZurueck={bereich ? () => setStufeWahl(null) : undefined}
            // Leitung mehrerer Stufen: Die Überschrift mit dem Namen der Stufe ist die Gruppenwahl.
            wahl={
              !bereich && sichten.length > 1
                ? {
                    optionen: sichten.map((x) => ({
                      wert: String(x.stufe.gruppeId),
                      text: x.stufe.name,
                    })),
                    onWahl: (v) => setStufeWahl(Number(v)),
                  }
                : undefined
            }
            onKind={kindOeffnen(offeneSicht)}
          />
        ) : bereich ? (
          <Uebersicht
            sichten={sichten}
            jahr={jahr}
            phase={phase}
            tage={tage}
            ferienkalender={einrichtung.einstellung.ferienkalender}
            onStufe={setStufeWahl}
          />
        ) : null)}
      {unter === 'daten' && (
        <DatenPflegen
          sichten={sichten}
          bereich={bereich}
          jahr={jahr}
          onKind={({ kind, stufe }) => kindOeffnen(stufe)(kind)}
        />
      )}
      {unter === 'tage' && bereich && (
        <Wechseltage
          einrichtung={einrichtung}
          jahr={jahr}
          jahre={ferien.jahre}
          ferien={ferien.ferien}
          phase={phase}
          sichten={sichten}
          regel={darfRegeln ? regel : null}
          tage={tage}
          start={start}
          onGeschrieben={onGeschrieben}
        />
      )}
      {unter === 'einrichtung' && darfRegeln && (
        <EinrichtungSeite
          start={start}
          einrichtung={einrichtung}
          regel={regel}
          jahr={jahr.jahr}
          onGeschrieben={onGeschrieben}
        />
      )}
      {offen && offenKind && (
        <KindFenster
          kind={offenKind}
          sicht={offen}
          jahr={jahr}
          stand={ausnahmeStand(
            einrichtung,
            offen.stufe.gruppeId,
            offenKind,
            daten.daten,
            jahr,
            heute,
            rechte,
          )}
          onGeaendert={neuLesen}
          onAbgemeldet={onAbgemeldet}
          onSchliessen={() => setOffenesKind(null)}
        />
      )}
    </div>
  );
}

// ── Bausteine ──────────────────────────────────────────────────────────────────────────────────────────────────

function Jahresband({ jahr, phase }: { jahr: Wechseljahr; phase: Phase }) {
  return (
    <section className={styles.jahr} aria-label="Ablauf im Jahr">
      <div className={phase === 'angekuendigt' ? styles.jetzt : undefined}>
        <b>Angekündigt</b>
        <span>
          {phase === 'ruhig' ? 'am' : 'seit'} {tagPunkt(jahr.ankuendigung)}
        </span>
        <small>von selbst</small>
      </div>
      <div className={phase === 'wechsel' ? styles.jetzt : undefined}>
        <b>Wechseltag</b>
        <span>{wechseltagText(jahr.wechseltag)}</span>
        <small>Kinder gehen von selbst in die neue Gruppe</small>
      </div>
      <div>
        <b>Stichtag</b>
        <span>{tagPunkt(jahr.stichtag)}</span>
        <small>zählt fürs Alter</small>
      </div>
    </section>
  );
}

function Chips({ kind, neuVon }: { kind?: KindZeile; neuVon?: string }) {
  const chips: { text: string; ton: EtikettTon }[] = [];
  if (neuVon) chips.push({ text: `kommt aus ${kurz(neuVon)}`, ton: 'gruen' });
  if (kind) {
    const w = kind.wechsel;
    if (w.art === 'wechselt') chips.push({ text: `wechselt → ${kurz(w.nach.name)}`, ton: 'blau' });
    if (w.art === 'ausnahme')
      chips.push(
        w.vomVorjahr
          ? { text: 'Ausnahme vom letzten Jahr', ton: 'blau' }
          : { text: 'bleibt noch ein Jahr', ton: 'neutral' },
      );
    if (w.art === 'ohneGeburtstag') chips.push({ text: 'Geburtstag fehlt', ton: 'rot' });
    if (w.art === 'unbekannt') chips.push({ text: 'nicht lesbar', ton: 'neutral' });
    if (kind.wird18) chips.push({ text: 'wird 18', ton: 'blau' });
  }
  return (
    <span className={styles.chips}>
      {chips.map((c) => (
        <Etikett key={c.text} ton={c.ton}>
          {c.text}
        </Etikett>
      ))}
    </span>
  );
}

function meta(k: KindZeile, jahr: Wechseljahr): string {
  if (k.wechsel.art === 'unbekannt') return 'Daten nicht lesbar';
  if (!k.geburtstag) return 'ohne Geburtstag';
  return `geb. ${tagPunkt(k.geburtstag)} · am ${tagPunkt(jahr.stichtag).slice(0, 6)} ${k.alter} Jahre`;
}

function KindListe<K extends KindZeile>({
  kinder,
  leer,
  jahr,
  onKind,
}: {
  kinder: readonly K[];
  leer: string;
  jahr: Wechseljahr;
  onKind: (k: K) => void;
}) {
  if (kinder.length === 0) return <p className={styles.leer}>{leer}</p>;
  return (
    <ul className={styles.zeilen}>
      {kinder.map((k) => (
        <li key={k.personId}>
          <button type="button" className={styles.zeile} onClick={() => onKind(k)}>
            <PersonBild name={k.name} bild={null} initialen={initialenAus(k.name)} groesse={32} />
            <span className={styles.mitte}>
              <span className={styles.name}>{k.name}</span>
              <span className={styles.meta}>{meta(k, jahr)}</span>
            </span>
            <Chips kind={k} />
            <Icon name="chev-right" size={16} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function NeuListe({ neu }: { neu: readonly NeuZeile[] }) {
  if (neu.length === 0) return <p className={styles.leer}>Niemand kommt neu dazu.</p>;
  return (
    <ul className={styles.zeilen}>
      {neu.map((k) => (
        <li key={k.personId} className={styles.zeile}>
          <PersonBild name={k.name} bild={null} initialen={initialenAus(k.name)} groesse={32} />
          <span className={styles.mitte}>
            <span className={styles.name}>{k.name}</span>
          </span>
          <Chips neuVon={k.von.name} />
        </li>
      ))}
    </ul>
  );
}

function Abschnitt({
  titel,
  anzahl,
  children,
}: {
  titel: string;
  anzahl: number;
  children: ReactNode;
}) {
  return (
    <>
      <h3 className={styles.abschnitt}>
        {titel}
        <span className={styles.anzahl}>{anzahl}</span>
      </h3>
      {children}
    </>
  );
}

// ── Seiten ─────────────────────────────────────────────────────────────────────────────────────────────────────

function GruppenSeite({
  sicht,
  jahr,
  phase,
  bereich,
  onZurueck,
  wahl,
  onKind,
}: {
  sicht: GruppenSicht;
  jahr: Wechseljahr;
  phase: Phase;
  bereich: boolean;
  onZurueck?: () => void;
  /** Mehrere Stufen zur Wahl: Die Überschrift wird zum Auswahlknopf. */
  wahl?: { optionen: { wert: string; text: string }[]; onWahl: (stufeId: string) => void };
  onKind: (k: KindZeile) => void;
}) {
  const s = sicht;
  const wt = wechseltagText(jahr.wechseltag);
  return (
    <>
      <div className={styles.kopf}>
        {onZurueck && (
          <button
            type="button"
            className={styles.zurueck}
            onClick={onZurueck}
            aria-label="Zurück zur Übersicht"
          >
            <Icon name="chev-left" size={16} />
            Übersicht
          </button>
        )}
        {wahl ? (
          <TitelWahl
            optionen={wahl.optionen}
            wert={String(s.stufe.gruppeId)}
            onWahl={wahl.onWahl}
          />
        ) : (
          <h2>{s.stufe.name}</h2>
        )}
        <span className={styles.leise}>
          {s.leitung.length > 0 ? `Leitung: ${s.leitung.join(', ')} · ` : ''}
          {s.kinder.length} Kinder
        </span>
      </div>
      <Jahresband jahr={jahr} phase={phase} />
      {s.stand !== 'sichtbar' ? (
        <Hinweis>
          {s.stand === 'verborgen'
            ? 'Die Mitglieder dieser Gruppe darfst du nicht sehen.'
            : 'Die Mitglieder dieser Gruppe sind gerade nicht ladbar.'}
        </Hinweis>
      ) : phase === 'ruhig' ? (
        <Hinweis>
          Noch nicht angekündigt. Unten steht, wer <b>nach heutigem Stand</b> am {wt} wechselt.
          {bereich && ' Ausnahmen kannst du schon jetzt eintragen.'}
        </Hinweis>
      ) : phase === 'angekuendigt' ? (
        <Hinweis>
          <b>Der Wechsel ist angekündigt.</b> Prüfe die Liste bis zum {wt}. Soll ein Kind noch
          bleiben? Tippe es an. Danach geht alles von selbst.
        </Hinweis>
      ) : (
        <Hinweis>
          <b>Der Wechsel läuft.</b> Die Kinder kommen bis zum {tagPunkt(jahr.aufnahmeBis)} von
          selbst in die neue Gruppe.
        </Hinweis>
      )}
      {s.ausVorjahr.length > 0 && (
        <Hinweis gelb>
          <span>
            <b>Ausnahme vom letzten Jahr:</b> {s.ausVorjahr.map((k) => k.name).join(', ')} bleibt
            weiter in {kurz(s.stufe.name)}. Soll{' '}
            {s.ausVorjahr.length > 1 ? 'jemand' : kurz(s.ausVorjahr[0].name)} dieses Jahr wechseln?
            Antippen und die Ausnahme aufheben.
          </span>
        </Hinweis>
      )}
      {s.naechste && !s.ausnahmenBekannt && (
        <Hinweis>
          Ob jemand als Ausnahme noch bleibt, ist gerade nicht lesbar – die Liste zeigt alle, die
          alt genug sind.
        </Hinweis>
      )}
      <section className={styles.karte}>
        {s.naechste && (
          <Abschnitt titel={`Wechseln zu ${s.naechste.name}`} anzahl={s.wechseln.length}>
            <KindListe kinder={s.wechseln} leer="Niemand wechselt." jahr={jahr} onKind={onKind} />
          </Abschnitt>
        )}
        <Abschnitt titel={`Bleiben in ${kurz(s.stufe.name)}`} anzahl={s.bleiben.length}>
          <KindListe kinder={s.bleiben} leer="Niemand bleibt." jahr={jahr} onKind={onKind} />
        </Abschnitt>
      </section>
      {s.vorige &&
        (s.neu ? (
          <section className={styles.karte}>
            <Abschnitt titel="Kommen neu dazu" anzahl={s.neu.length}>
              <NeuListe neu={s.neu} />
            </Abschnitt>
          </section>
        ) : (
          <p className={styles.leise}>
            {bereich || phase !== 'ruhig'
              ? `Wer aus ${s.vorige.name} neu dazukommt, ist gerade nicht lesbar.`
              : `Kinder, die aus ${s.vorige.name} neu zu euch kommen, siehst du ab der Ankündigung am ${tagPunkt(jahr.ankuendigung)}.`}
          </p>
        ))}
    </>
  );
}

function Uebersicht({
  sichten,
  jahr,
  phase,
  tage,
  ferienkalender,
  onStufe,
}: {
  sichten: readonly GruppenSicht[];
  jahr: Wechseljahr;
  phase: Phase;
  /** Läuft das Eingetragene aus? – dann steht hier ein kurzer Hinweis (O9-4). */
  tage: TageStand;
  ferienkalender: string;
  onStufe: (id: number) => void;
}) {
  const alle = sichten.reduce((n, s) => n + s.kinder.length, 0);
  const wechseln = sichten.reduce((n, s) => n + wechslerZahl(s), 0);
  const pflege = pflegeAus(sichten);
  const hinweis = tageHinweis(tage, ferienkalender);
  return (
    <>
      <div className={styles.kopf}>
        <h2>Übersicht</h2>
        <span className={styles.leise}>
          {alle} Kinder und Jugendliche · {wechseln} wechseln · {pflege.ohneGeburtstag.length} ohne
          Geburtstag
        </span>
      </div>
      <Jahresband jahr={jahr} phase={phase} />
      {hinweis && (
        <Hinweis gelb>
          <b>{hinweis.titel}</b> {hinweis.kurz}
        </Hinweis>
      )}
      <div className={styles.kacheln}>
        {sichten.map((s) => {
          const w = wechslerZahl(s);
          const a = s.wechseln.filter((k) => k.wechsel.art === 'ausnahme').length;
          const o = s.kinder.filter((k) => k.wechsel.art === 'ohneGeburtstag').length;
          const e = s.kinder.filter((k) => k.wird18).length;
          return (
            <button
              key={s.stufe.gruppeId}
              type="button"
              className={styles.kachel}
              onClick={() => onStufe(s.stufe.gruppeId)}
            >
              <h3>{s.stufe.name}</h3>
              <span className={styles.zahl}>
                {s.stand === 'sichtbar' ? s.kinder.length : '–'}
                <small>Kinder</small>
              </span>
              <span className={styles.chips}>
                {w > 0 && <Etikett ton="blau">{w} wechseln</Etikett>}
                {a > 0 && <Etikett>{a} bleiben</Etikett>}
                {o > 0 && <Etikett ton="rot">{o} ohne Geburtstag</Etikett>}
                {e > 0 && <Etikett ton="blau">{e} wird 18</Etikett>}
                {s.stand !== 'sichtbar' && <Etikett>nicht lesbar</Etikett>}
              </span>
              {s.leitung.length > 0 && (
                <span className={styles.leise}>Leitung: {s.leitung.join(', ')}</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function DatenPflegen({
  sichten,
  bereich,
  jahr,
  onKind,
}: {
  sichten: readonly GruppenSicht[];
  bereich: boolean;
  jahr: Wechseljahr;
  onKind: (x: { kind: KindZeile; stufe: GruppenSicht }) => void;
}) {
  const p = pflegeAus(sichten);
  const oeffnen = (k: KindZeile & { stufe: Stufe }) => {
    const stufe = sichten.find((s) => s.stufe.gruppeId === k.stufe.gruppeId);
    if (stufe) onKind({ kind: k, stufe });
  };
  return (
    <>
      <div className={styles.kopf}>
        <h2>Daten pflegen</h2>
        <span className={styles.leise}>
          {bereich ? 'alle Gruppen' : sichten.map((s) => s.stufe.name).join(', ')}
        </span>
      </div>
      <section className={styles.karte}>
        <Abschnitt titel="Geburtstag fehlt" anzahl={p.ohneGeburtstag.length}>
          <p className={styles.erklaerung}>
            Ohne Geburtstag fällt ein Kind durch jede Altersregel und wechselt nie von selbst.
          </p>
          <KindListe
            kinder={p.ohneGeburtstag}
            leer="Alles erledigt."
            jahr={jahr}
            onKind={oeffnen}
          />
        </Abschnitt>
      </section>
      {bereich && (
        <section className={styles.karte}>
          <Abschnitt titel="Wird bis zum Stichtag 18" anzahl={p.wird18.length}>
            <p className={styles.erklaerung}>
              Mitglieder bleiben in der Gemeindeliste, alle anderen kommen zu „Externe Kontakte“.
            </p>
            <KindListe kinder={p.wird18} leer="Niemand." jahr={jahr} onKind={oeffnen} />
          </Abschnitt>
        </section>
      )}
    </>
  );
}

// ── Fenster: ein Kind ──────────────────────────────────────────────────────────────────────────────────────────

/** „Rückgängig“ im Fenster – nach dem Schreiben bereit, nie in einer Leiste dahinter. */
interface Zurueck {
  text: string;
  tun: () => Promise<void>;
}

function KindFenster({
  kind,
  sicht,
  jahr,
  stand,
  onGeaendert,
  onAbgemeldet,
  onSchliessen,
}: {
  kind: KindZeile;
  sicht: GruppenSicht;
  jahr: Wechseljahr;
  stand: AusnahmeStand;
  /** Die Daten des Reiters neu laden – `false`, wenn das nicht ging. */
  onGeaendert: () => Promise<boolean>;
  onAbgemeldet: (e: unknown) => void;
  onSchliessen: () => void;
}) {
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [zurueck, setZurueck] = useState<Zurueck | null>(null);
  const w = kind.wechsel;
  const vorname = kurz(kind.name);
  const wt = wechseltagText(jahr.wechseltag);
  const wechsel =
    w.art === 'wechselt'
      ? `${wt} → ${w.nach.name}`
      : w.art === 'ausnahme'
        ? w.vomVorjahr
          ? 'bleibt noch ein Jahr (Ausnahme vom letzten Jahr)'
          : 'bleibt noch ein Jahr (Ausnahme)'
        : w.art === 'bleibt'
          ? 'nein'
          : 'unbekannt';

  /**
   * **Schreiben, neu laden, „Rückgängig“ anbieten.** 401 → abgemeldet (für die ganze Seite); jeder andere Fehler bleibt
   * im Fenster stehen, der Zustand ändert sich nicht, und nichts wird von selbst wiederholt. Neu geladen wird auch nach
   * einem Fehler: Was ChurchTools jetzt hat, soll da stehen.
   */
  const ausfuehren = async (tun: () => Promise<void>, danach: Zurueck | null) => {
    setArbeitet(true);
    setFehler(null);
    setZurueck(null);
    let geschrieben = false;
    try {
      await tun();
      geschrieben = true;
      setZurueck(danach);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        onAbgemeldet(e);
        return;
      }
      setFehler(ausnahmeFehlerText(e));
    }
    const geladen = await onGeaendert();
    if (geschrieben && !geladen) {
      setFehler(
        'Gespeichert – aber die Liste ließ sich gerade nicht neu laden. Bitte lade den Reiter neu.',
      );
    }
    setArbeitet(false);
  };

  const schalten = () => {
    if (stand.art !== 'schalter') return;
    const gruppeId = stand.gruppeId;
    let vorher: Mitgliedschaft | null = null;
    const rueckgaengig = (text: string): Zurueck => ({
      text,
      tun: () => ausnahmeZurueck(mitgliedZugriff, gruppeId, kind.personId, vorher),
    });
    if (stand.an) {
      void ausfuehren(async () => {
        vorher = await ausnahmeAufheben(mitgliedZugriff, gruppeId, kind.personId);
      }, rueckgaengig('Ausnahme aufgehoben'));
    } else {
      void ausfuehren(async () => {
        vorher = await ausnahmeSetzen(mitgliedZugriff, gruppeId, kind.personId, () =>
          ladeTeilnehmerRolle(gruppeId),
        );
      }, rueckgaengig('Ausnahme eingetragen'));
    }
  };

  return (
    <Sheet title={kind.name} onClose={onSchliessen} knoepfe={null} beschaeftigt={arbeitet}>
      <dl className={styles.daten}>
        <dt>Gruppe</dt>
        <dd>{sicht.stufe.name}</dd>
        <dt>Geburtstag</dt>
        <dd>
          {w.art === 'unbekannt'
            ? 'nicht lesbar'
            : kind.geburtstag
              ? tagPunkt(kind.geburtstag)
              : 'fehlt'}
        </dd>
        <dt>Alter am {tagPunkt(jahr.stichtag)}</dt>
        <dd>{kind.alter === null ? 'unbekannt' : `${kind.alter} Jahre`}</dd>
        <dt>Wechsel</dt>
        <dd>{wechsel}</dd>
      </dl>
      {w.art === 'ohneGeburtstag' && (
        <Hinweis>
          Ohne Geburtstag wechselt das Kind nie von selbst. Bitte in ChurchTools nachtragen.
        </Hinweis>
      )}
      {stand.art === 'schalter' && (
        <button
          type="button"
          className={styles.schalterKnopf}
          aria-pressed={stand.an}
          disabled={arbeitet}
          onClick={schalten}
        >
          <Schalter an={stand.an} />
          Bleibt noch ein Jahr in {kurz(sicht.stufe.name)}
        </button>
      )}
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}
      {zurueck ? (
        <p className={styles.leise}>
          {zurueck.text} ·{' '}
          <button
            type="button"
            className={styles.rueck}
            disabled={arbeitet}
            onClick={() => void ausfuehren(zurueck.tun, null)}
          >
            Rückgängig
          </button>
        </p>
      ) : stand.art === 'schalter' ? (
        <p className={styles.leise}>
          {w.art === 'ausnahme'
            ? w.vomVorjahr
              ? `Diese Ausnahme gilt seit letztem Jahr. Hebst du sie auf, wechselt ${vorname} am ${wt}.`
              : 'Die Ausnahme bleibt, bis du sie aufhebst – auch über den Wechseltag hinaus.'
            : `${vorname} wechselt am ${wt} von selbst. Danach lässt sich das nur noch von Hand ändern.`}
        </p>
      ) : (
        <>
          {stand.art === 'hinweis' && <Hinweis>{keinSchalterText(stand.grund, jahr)}</Hinweis>}
          {w.art === 'ausnahme' && (
            <Hinweis>
              Die Ausnahme bleibt, bis jemand sie aufhebt – auch über den Wechseltag hinaus.
            </Hinweis>
          )}
          {w.art === 'wechselt' && (
            <Hinweis>
              {vorname} wechselt am {wt} von selbst.
            </Hinweis>
          )}
        </>
      )}
      <a className={styles.oeffnen} href={personLink(kind.personId)} target="_top">
        In ChurchTools öffnen
      </a>
    </Sheet>
  );
}
