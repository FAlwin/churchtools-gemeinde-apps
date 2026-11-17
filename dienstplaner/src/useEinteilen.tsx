import { useState, type ReactNode } from 'react';
import { Toast } from '@ui/fenster/Toast';
import { useToast } from '@ui/fenster/useToast';
import { gruppenName, type Plan } from '@shared/dienstplan/plan';
import {
  ortSchluessel,
  zielText,
  type Besetzung,
  type Entwurf,
  type EntwurfErgebnis,
} from '@shared/dienstplan/entwuerfe';
import type { Eingeplant } from '@shared/dienstplan/zauberstab';
import { einsaetzeUm, einsaetzeUmText } from '@shared/dienstplan/fokus';
import { WerKann, type Eintragen, type FreierPlatz } from './WerKann';
import { EntwurfFach } from './EntwurfFach';
import { BelegtFach } from './BelegtFach';
import { ZauberstabFach, type Wahl, type ZauberZeile } from './ZauberstabFach';
import { SendenFach, type SendeZeile } from './SendenFach';
import { grundText, type EntwurfAnschluss } from './ladeEntwuerfe';
import { zellenAktion } from '@shared/dienstplan/personenEintragen';
import {
  darfPlanen,
  freierPlatz,
  stehtInChurchTools,
  zauberUnter,
  type PersonenEintragen,
  type Sicht,
} from './planSicht';
import { useEntwuerfe } from './useEntwuerfe';
import {
  darfAendern,
  entwurfAmPlatz,
  sendbareZeilen,
  zauberEingeplant,
  zauberZeilen,
} from './planEntwuerfe';
import styles from './Planen.module.scss';

/** Was die Plätze und Gruppen zum Einteilen bekommen – ein Teil der `Sicht` der Matrix. */
export type EinteilenAmPlatz = Pick<
  Sicht,
  | 'onFrei'
  | 'onBelegt'
  | 'entwurf'
  | 'onEntwurf'
  | 'ohnePlatz'
  | 'onOhnePlatz'
  | 'darfAendern'
  | 'ichId'
  | 'onZauberstab'
>;

/** Aus welchem Fenster „Wer kann?“ aufging – „‹“ öffnet genau dieses wieder (`null`: vom freien Platz aus, kein Pfeil). */
export type WerKannVon =
  | { art: 'entwurf'; fach: { platz: FreierPlatz; entwurf: Entwurf; inChurchTools: string | null } }
  | { art: 'belegt'; platz: FreierPlatz };

/**
 * Wohin „Zurück zu ‚Wer kann?‘“ in der Fokus-Leiste führt (Wunsch 11): derselbe Platz, mit allem, was beim Schließen
 * dranhing – dem Entwurf, den die Wahl ersetzt (`ersetzt`), und dem Fenster davor (`von`).
 */
export interface WerKannZurueck {
  platz: FreierPlatz;
  ersetzt: number | null;
  von: WerKannVon | null;
}

/**
 * **Einteilen über Entwürfe – für „Planen“ und die Termin-Ansicht** (F1, 09.11.2026; bis dahin stand alles in
 * `Planen.tsx`, Bauplan E4/E5): freien Platz antippen → „Wer kann?“, belegten Platz → zurückziehen oder ersetzen, Entwurf
 * → Entwurfs-Fach, Zauberstab → Vorschläge, unten die Leiste „Ansehen und senden“. Dieselben Fenster an beiden Stellen –
 * wer hier etwas ändert, ändert es für beide.
 *
 * Gesendet wird, was in `plan` steht (`sendbareZeilen`): in „Planen“ die geladenen Termine, in der Termin-Ansicht nur
 * dieser Termin (Alwin, 09.11.2026: „wenn ich an nur diesem einen Gottesdienst arbeiten möchte“).
 */
export function useEinteilen({
  plan,
  entwuerfe,
  heute,
  handy,
  onGesendet,
  nachfragen = true,
  leisteZusatz,
  sendenZusatz,
  fokus,
}: {
  plan: Plan | null;
  /** Ohne Anschluss bleibt „Wer kann?“ nur zum Ansehen. */
  entwuerfe?: EntwurfAnschluss;
  /** Heute (`YYYY-MM-DD`, Ortszeit der Gemeinde). */
  heute: string;
  handy: boolean;
  /** Nach dem Senden – die Termine leise neu laden, damit dasteht, was jetzt in ChurchTools gilt. */
  onGesendet: () => void;
  /** Termine außerhalb von `plan` für alte Entwürfe nachfragen (`useEntwuerfe`) – nur in „Planen“. */
  nachfragen?: boolean;
  /** Zweite Zeile der Leiste (Termin-Ansicht: „an diesem Termin“). */
  leisteZusatz?: string;
  /** Satz unter der Liste im Senden-Fach (Termin-Ansicht: Entwürfe an anderen Terminen). */
  sendenZusatz?: (
    daten: NonNullable<ReturnType<typeof useEntwuerfe>['daten']>,
  ) => string | undefined;
  /**
   * Fokus-Modus (Wunsch 11, nur „Planen“): Aus dem Fenster am belegten Platz („Im Plan hervorheben“) und aus „Wer kann?“
   * („im Plan zeigen“, mit dem Weg zurück) wird eine Person in den Fokus genommen. Ohne Angabe gibt es die Knöpfe nicht.
   */
  fokus?: {
    hervorheben: (person: { personId: number; name: string }) => void;
    zeigen: (person: { personId: number; name: string }, zurueck: WerKannZurueck) => void;
  };
}) {
  const [frei, setFrei] = useState<FreierPlatz | null>(null);
  // Das Fenster am belegten Platz (E4-5): zurückziehen oder ersetzen.
  const [belegt, setBelegt] = useState<FreierPlatz | null>(null);
  // Das Zauberstab-Fenster (E5-2): Gruppe und Termine (Indizes in `plan.spalten`).
  // Beim Öffnen festgehalten – sonst verschwänden Zeilen, sobald ein Vorschlag als Entwurf dasteht.
  const [zauber, setZauber] = useState<{
    titel: string;
    unter: string;
    zeilen: ZauberZeile[];
    mitEntwurf: number;
    eingeplant: Eingeplant[];
    gruppe: { id: number; name: string };
  } | null>(null);
  // Ein angetippter Entwurf (E4-3-3) – und ob „Andere Person wählen“ einen Entwurf ersetzt (seine Version).
  const [fach, setFach] = useState<{
    platz: FreierPlatz;
    entwurf: Entwurf;
    inChurchTools: string | null;
  } | null>(null);
  const [ersetzt, setErsetzt] = useState<number | null>(null);
  /**
   * Aus welchem Fenster „Wer kann?“ aufging (Alwin, 02.11.2026: „Wechselt ein Screen im Fenster, soll es einen
   * Zurück-Pfeil geben“) – „‹“ öffnet genau dieses wieder. `null`: vom freien Platz aus, dann gibt es keinen Pfeil.
   */
  const [werKannVon, setWerKannVon] = useState<WerKannVon | null>(null);
  // Das offene Senden-Fach mit seiner Liste (beim Öffnen festgehalten).
  const [sendenListe, setSendenListe] = useState<SendeZeile[] | null>(null);
  const { toast, showToast } = useToast();

  // Entwürfe (E4-3) und wo sie stehen (#582) – Laden, Speichern und Regeln in `useEntwuerfe` / `planEntwuerfe`.
  const {
    ew,
    daten,
    neu: ewNeu,
    setzen: ewSetzen,
    speichern: entwurfSpeichern,
    lage,
  } = useEntwuerfe(entwuerfe, plan, heute, nachfragen);

  const amPlatz: EinteilenAmPlatz = {
    onFrei: (i, zl, nr) => {
      if (plan) setFrei(freierPlatz(plan.spalten[i], zl, zl.zellen[i] ?? [], nr));
    },
    onBelegt: (i, zl, nr) => {
      if (plan) setBelegt(freierPlatz(plan.spalten[i], zl, zl.zellen[i] ?? [], nr));
    },
    entwurf: (i, zl, p) => (plan ? entwurfAmPlatz(daten, plan.spalten[i], zl, p) : null),
    onEntwurf: (i, zl, nr) => {
      if (!plan) return;
      const plaetze = zl.zellen[i] ?? [];
      const p = plaetze[nr - 1];
      const a = p ? entwurfAmPlatz(daten, plan.spalten[i], zl, p) : null;
      if (!p || !a) return;
      setFach({
        platz: freierPlatz(plan.spalten[i], zl, plaetze, nr),
        entwurf: a.entwurf,
        inChurchTools: a.veraltet ? stehtInChurchTools(p) : null,
      });
    },
    ohnePlatz: (i, zl) =>
      plan ? (lage.schilder.get(`${plan.spalten[i].id}|${zl.dienst.id}`) ?? []) : [],
    onOhnePlatz: (i, zl, e) => {
      if (!plan) return;
      setFach({
        platz: {
          ...freierPlatz(plan.spalten[i], zl, zl.zellen[i] ?? [], 1),
          nr: e.ort.index ?? 1,
          index: e.ort.index,
          bisher: undefined,
        },
        entwurf: e,
        inChurchTools:
          'Diesen Platz gibt es so nicht mehr – die Platzzahl wurde in ChurchTools geändert.',
      });
    },
    darfAendern: (zl) => darfAendern(daten, zl),
    ichId: entwuerfe?.ich.personId ?? null,
    onZauberstab: (idx, g) => {
      const z = entwuerfe && plan ? zauberZeilen(plan, daten, heute, idx, g) : null;
      if (!plan || !z || z.zeilen.length === 0) return undefined;
      return () =>
        setZauber({
          titel: `Automatische Planung · ${gruppenName(g)}`,
          unter: zauberUnter(plan, idx),
          ...z,
          eingeplant: zauberEingeplant(plan, daten, g),
          gruppe: { id: g.gruppe?.id ?? 0, name: gruppenName(g) },
        });
    },
  };

  /** Übernehmen (E5-2): je Vorschlag ein Entwurf, einer nach dem anderen – wie „Wer kann?“ ihn anlegt. */
  async function zauberUebernehmen(
    wahlen: Wahl[],
    melde: (index: number, ergebnis: EntwurfErgebnis) => void,
  ): Promise<void> {
    if (!entwuerfe || !daten) return;
    for (const [i, w] of wahlen.entries()) {
      const ort = { eventId: w.zeile.terminId, serviceId: w.zeile.serviceId, index: w.zeile.index };
      const r = await entwurfSpeichern(
        daten,
        w.zeile.gruppeId,
        {
          ort,
          ziel: { art: 'person', personId: w.personId, name: w.name },
          gesehen: w.zeile.gesehen,
        },
        null,
      );
      melde(i, r);
    }
  }

  /** Nach einer Änderung im Entwurfs-Fach: Ergebnis übernehmen, bei Erfolg schließen und Bescheid geben. */
  const nachFach = (r: EntwurfErgebnis, k: string, text: () => string) => {
    if (r.ok) {
      ewSetzen(k, r.entwurf);
      setFach(null);
      showToast(text());
    } else if (r.grund === 'konflikt') {
      // Was jetzt dasteht, zeigt die Matrix sofort – und das offene Fach auch (sonst zeigte es die alte Fassung,
      // Prüfung mit zwei Planern 16.10.2026). Ist der Entwurf weg, bleibt das Fach mit seinem Hinweis stehen.
      ewSetzen(k, r.jetzt ?? null);
      const jetzt = r.jetzt;
      if (jetzt) setFach((f) => (f ? { ...f, entwurf: jetzt } : f));
    }
  };

  /**
   * Einen Entwurf entfernen – **eine Funktion** fürs Entwurfs-Fach („Entfernen“, „Verwerfen“) und für „Personen“ (Klick
   * auf den eigenen Entwurf): Versions-Schutz im Kern, Ergebnis übernehmen, Bescheid geben. `verwerfen`: der Entwurf war
   * veraltet.
   */
  const entferneEntwurf = async (
    gruppeId: number,
    e: Entwurf,
    erwartet: number,
    verwerfen: boolean,
  ): Promise<EntwurfErgebnis> => {
    if (!entwuerfe || ew.art !== 'fertig') return { ok: false, grund: 'voruebergehend' };
    const r = await entwuerfe.entfernen(ew.daten, gruppeId, e.ort, erwartet);
    nachFach(r, ortSchluessel(e.ort), () =>
      verwerfen ? 'Entwurf verworfen.' : 'Entwurf entfernt.',
    );
    return r;
  };

  /** Der Stift in „Wer kann?“ (E5-3) – nur, wo man die Dienstgruppe plant (nicht nur als Termin-Admin). */
  const stiftFuer = (f: FreierPlatz) => {
    const g = plan?.gruppen.find((x) => x.gruppe?.id === f.gruppeId);
    return entwuerfe && f.stift && g
      ? { vorlieben: entwuerfe.vorlieben, gruppe: { id: f.gruppeId, name: gruppenName(g) } }
      : undefined;
  };

  /** Ob und wie man an diesem Platz eintragen kann – aus Anschluss, Schublade und Rechten. */
  const eintragenFuer = (
    f: FreierPlatz,
    ersetztVersion: number | null = ersetzt,
  ): Eintragen | undefined => {
    if (!entwuerfe) return undefined;
    if (ew.art === 'laedt') return { art: 'laedt' };
    if (ew.art === 'fehler') return { art: 'gesperrt', text: ew.text, onNochmal: ewNeu };
    const daten = ew.daten;
    const s = daten.schubladen.get(f.gruppeId);
    if (!s) {
      return { art: 'gesperrt', text: 'Für diesen Dienst kannst du hier keine Entwürfe anlegen.' };
    }
    if (s.fehler) return { art: 'gesperrt', text: grundText(s.fehler), onNochmal: ewNeu };
    if (s.stand === 'einrichtbar') {
      return {
        art: 'einrichten',
        gruppe: s.gruppe.name,
        onEinrichten: async () => {
          await entwuerfe.einrichten(s.gruppe);
          ewNeu();
        },
      };
    }
    if (s.stand === 'fehlt') {
      return {
        art: 'gesperrt',
        text: `Für „${s.gruppe.name}“ gibt es noch keinen Platz für Entwürfe – oder dir fehlt das Recht, ihn zu sehen. Bitte die Gemeinde-Verwaltung fragen.`,
      };
    }
    if (s.stand === 'nur-lesen') {
      return {
        art: 'gesperrt',
        text: `Du darfst die Entwürfe von „${s.gruppe.name}“ ansehen, aber nicht ändern. Bitte die Gemeinde-Verwaltung nach dem Recht fragen.`,
      };
    }
    const ort = { eventId: f.eventId, serviceId: f.serviceId, index: f.index };
    return {
      art: 'bereit',
      erwartet: ersetztVersion,
      onWahl: async (ziel: Besetzung, erwartet: number | null): Promise<EntwurfErgebnis> => {
        // Ersetzt man einen Entwurf („Andere Person wählen“), bleibt „Beim Senden“ wie es war. „Gesehen“ ist, was
        // jetzt in ChurchTools steht – frei, oder die Person, die ersetzt wird (E4-5); bei einem gültigen Entwurf
        // ist das genau, was er gesehen hat (`gleicherStand`).
        const alt = erwartet !== null ? daten.entwuerfe.get(ortSchluessel(ort)) : undefined;
        const r = await entwurfSpeichern(
          daten,
          f.gruppeId,
          { ort, ziel, modus: alt?.modus, gesehen: f.bisher?.belegung ?? { art: 'frei' } },
          erwartet,
        );
        if (r.ok) {
          setFrei(null);
          setErsetzt(null);
          setWerKannVon(null);
          showToast(
            f.bisher
              ? `${ziel.name} statt ${f.bisher.name} eingetragen – noch nicht gesendet.`
              : `${ziel.name} eingetragen – noch nicht gesendet.`,
          );
        }
        return r;
      },
    };
  };

  const offen = sendbareZeilen(plan, daten).length;

  // Wer am angetippten belegten Platz steht – nur eine Person mit Konto kann in den Fokus (kein Gast, kein verborgener Name).
  const bel = belegt?.bisher?.belegung;
  const belegtPerson =
    belegt?.bisher && (bel?.art === 'zusage' || bel?.art === 'anfrage')
      ? { personId: bel.personId, name: belegt.bisher.name }
      : null;

  const leiste: ReactNode = offen > 0 && (
    <div className={styles.sendeLeiste} role="status" aria-label="Noch nicht gesendet">
      {/* Am Handy kürzer, wie im Entwurf (Abschnitt 6) – sonst bricht alles um. */}
      <span>
        {offen} {offen === 1 ? 'Entwurf' : 'Entwürfe'}
        {handy ? '' : ' noch nicht gesendet'}
        {leisteZusatz && !handy && <small>{leisteZusatz}</small>}
      </span>
      <button
        type="button"
        className={styles.sendenKnopf}
        onClick={() => setSendenListe(sendbareZeilen(plan, daten))}
      >
        {handy ? 'Ansehen & senden' : 'Ansehen und senden'}
      </button>
    </div>
  );

  const fenster: ReactNode = (
    <>
      {fach && entwuerfe && ew.art === 'fertig' && (
        <EntwurfFach
          platz={fach.platz}
          entwurf={fach.entwurf}
          inChurchTools={fach.inChurchTools}
          onClose={() => setFach(null)}
          onModus={async (modus, erwartet) => {
            const e = fach.entwurf;
            const r = await entwurfSpeichern(
              ew.daten,
              fach.platz.gruppeId,
              { ort: e.ort, ziel: e.ziel, modus, gesehen: e.gesehen },
              erwartet,
            );
            nachFach(r, ortSchluessel(e.ort), () =>
              modus === 'direkt'
                ? `${zielText(e.ziel)} wird beim Senden direkt zugeteilt.`
                : `${zielText(e.ziel)} bekommt beim Senden eine Anfrage.`,
            );
            return r;
          }}
          onEntfernen={(erwartet) =>
            entferneEntwurf(
              fach.platz.gruppeId,
              fach.entwurf,
              erwartet,
              fach.inChurchTools !== null,
            )
          }
          onAnderePerson={() => {
            // „Wer kann?“ für denselben Platz – es ersetzt den Entwurf (mit seiner Version).
            setErsetzt(fach.entwurf.version);
            setFrei(fach.platz);
            setWerKannVon({ art: 'entwurf', fach });
            setFach(null);
          }}
        />
      )}
      {frei && (
        <WerKann
          platz={frei}
          onClose={() => {
            setFrei(null);
            setErsetzt(null);
            setWerKannVon(null);
          }}
          zurueck={
            werKannVon
              ? () => {
                  setFrei(null);
                  setErsetzt(null);
                  setWerKannVon(null);
                  if (werKannVon.art === 'entwurf') setFach(werKannVon.fach);
                  else setBelegt(werKannVon.platz);
                }
              : undefined
          }
          eintragen={eintragenFuer(frei)}
          stift={stiftFuer(frei)}
          fokus={
            fokus && plan && frei.datum
              ? {
                  mini: (personId) =>
                    einsaetzeUmText(
                      einsaetzeUm(plan, {
                        personId,
                        tag: frei.datum ?? '',
                        entwurf: amPlatz.entwurf,
                      }),
                    ),
                  zeigen: (person) => {
                    const zurueck: WerKannZurueck = { platz: frei, ersetzt, von: werKannVon };
                    setFrei(null);
                    setErsetzt(null);
                    setWerKannVon(null);
                    fokus.zeigen(person, zurueck);
                  },
                }
              : undefined
          }
        />
      )}
      {belegt?.bisher && entwuerfe && (
        <BelegtFach
          platz={{ ...belegt, bisher: belegt.bisher }}
          eintragen={eintragenFuer(belegt)}
          onClose={() => setBelegt(null)}
          onFokus={
            fokus && belegtPerson
              ? () => {
                  setBelegt(null);
                  fokus.hervorheben(belegtPerson);
                }
              : undefined
          }
          onAnderePerson={() => {
            // „Wer kann?“ für denselben Platz – die Wahl ersetzt die Person, die dort steht.
            setFrei(belegt);
            setWerKannVon({ art: 'belegt', platz: belegt });
            setBelegt(null);
          }}
          onZurueckziehen={async () => {
            const b = belegt.bisher;
            if (!b) return { ok: false, grund: 'voruebergehend' };
            const ort = {
              eventId: belegt.eventId,
              serviceId: belegt.serviceId,
              index: belegt.index,
            };
            if (ew.art !== 'fertig') return { ok: false, grund: 'voruebergehend' };
            const r = await entwurfSpeichern(
              ew.daten,
              belegt.gruppeId,
              { ort, ziel: { art: 'frei' }, gesehen: b.belegung },
              null,
            );
            if (r.ok) {
              setBelegt(null);
              showToast(`${b.name} wird beim Senden zurückgezogen – noch nicht gesendet.`);
            }
            return r;
          }}
        />
      )}
      {sendenListe && entwuerfe && ew.art === 'fertig' && (
        <SendenFach
          zeilen={sendenListe}
          ichId={entwuerfe.ich.personId}
          hinweise={(z) => entwuerfe.hinweise(z)}
          senden={(eintraege, melde) => entwuerfe.senden(ew.daten, eintraege, melde)}
          zusatz={sendenZusatz?.(ew.daten)}
          onClose={(geaendert) => {
            setSendenListe(null);
            if (geaendert) {
              ewNeu();
              onGesendet();
            }
          }}
        />
      )}
      {zauber && (
        <ZauberstabFach
          {...zauber}
          vorlieben={entwuerfe?.vorlieben}
          uebernehmen={zauberUebernehmen}
          onClose={(n) => {
            setZauber(null);
            if (n > 0)
              showToast(
                n === 1
                  ? '1 Vorschlag als Entwurf eingetragen – noch nicht gesendet.'
                  : `${n} Vorschläge als Entwurf eingetragen – noch nicht gesendet.`,
              );
          }}
        />
      )}
      <Toast message={toast} />
    </>
  );

  /** „Zurück zu ‚Wer kann?‘“ (Fokus-Leiste): dasselbe Fenster für denselben Platz noch einmal. */
  const werKannOeffnen = (z: WerKannZurueck) => {
    setFrei(z.platz);
    setErsetzt(z.ersetzt);
    setWerKannVon(z.von);
  };

  /** Kann man an diesem Platz gerade Entwürfe anlegen? (Fokus-Leiste: sonst gibt es „Hier eintragen“ nicht.) */
  const eintragenMoeglich = (z: WerKannZurueck) =>
    eintragenFuer(z.platz, z.ersetzt)?.art === 'bereit';

  /**
   * „Hier eintragen“ (Fokus-Leiste): **dieselbe Funktion wie die Wahl in „Wer kann?“** (`eintragenFuer` → `onWahl`) –
   * Entwurf, Konflikt-Schutz und Hinweis („noch nicht gesendet“) kommen von dort. `null`, wo es nicht geht.
   */
  const trageEin = (z: WerKannZurueck, ziel: Besetzung): Promise<EntwurfErgebnis> | null => {
    const e = eintragenFuer(z.platz, z.ersetzt);
    return e?.art === 'bereit' ? e.onWahl(ziel, z.ersetzt) : null;
  };

  /**
   * Eintragen per Klick in „Personen“ (P2a): was ein Klick tut (`zellenAktion`) – nur wo man den Dienst planen und seine
   * Entwürfe ändern darf (`darfPlanen`, `darfAendern`, wie in der Matrix) –, das Eintragen über **`trageEin`** (also die
   * Wahl in „Wer kann?“) und das Wegnehmen über **`entferneEntwurf`** (also „Entfernen“ im Entwurfs-Fach).
   */
  const amPersonen: PersonenEintragen = {
    aktion: (i, zl, personId, zustand) => {
      if (!plan) return null;
      const s = plan.spalten[i];
      if (!darfPlanen(zl, s) || !amPlatz.darfAendern(zl)) return null;
      return zellenAktion({
        plaetze: zl.zellen[i],
        personId,
        zustand,
        entwurf: (p) => entwurfAmPlatz(daten, s, zl, p),
        ichId: amPlatz.ichId,
      });
    },
    eintragen: async (i, zl, nr, person) => {
      if (!plan) return;
      const platz = freierPlatz(plan.spalten[i], zl, zl.zellen[i] ?? [], nr);
      const r = await trageEin({ platz, ersetzt: null, von: null }, { art: 'person', ...person });
      if (!r) showToast('Hier kannst du gerade keine Entwürfe anlegen.');
      else if (!r.ok) showToast(fehlerHinweis(r));
    },
    wegnehmen: async (zl, e) => {
      const r = await entferneEntwurf(zl.dienst.dienstgruppeId ?? 0, e, e.version, false);
      if (!r.ok) showToast(fehlerHinweis(r));
    },
  };

  return {
    ew,
    daten,
    ewNeu,
    lage,
    showToast,
    amPlatz,
    leiste,
    fenster,
    werKannOeffnen,
    eintragenMoeglich,
    trageEin,
    amPersonen,
  };
}

/**
 * Was der Toast sagt, wenn ein Entwurf nicht angelegt oder entfernt werden konnte – **eine Stelle** für „Hier eintragen“
 * (Fokus-Leiste) und „Personen“. Bei einem Konflikt zeigt die Matrix schon, was jetzt dasteht.
 */
export const fehlerHinweis = (r: Extract<EntwurfErgebnis, { ok: false }>): string =>
  r.grund === 'konflikt'
    ? 'Hier hat eben jemand den Platz geändert – bitte noch einmal ansehen.'
    : grundText(r.grund);
