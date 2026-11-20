/**
 * **Einsicht festhalten** (N2b; Entwurf `n2-stand-v1`, Ansicht 3) – in ChurchTools, in fester Reihenfolge:
 *
 * 1. die drei Angaben in die Gruppenfelder schreiben **und nachlesen** (`felderSchreiben`). Scheitert das: nichts weiter.
 * 2. ist die offene Aufgabe durch die Einsicht erledigt (`aufgabeErledigtDurch`): `POST /followups/{id}/complete` und
 *    **nachlesen** (`doneDate` gesetzt, sonst `NichtUebernommen` – ein 200 beweist nichts). Scheitert das, sind die Felder
 *    schon gespeichert: `EinsichtTeilweise` sagt es; noch einmal „Festhalten“ ist gefahrlos (gleiche Felder, die Aufgabe
 *    wird nur erledigt, wenn sie noch offen ist).
 * 3. „Erneut einsehen“ auf „Gültig bis“ legen (`POST /followups/{id}/postpone`, gemessen 20.11.2026). Nach dem Erledigen
 *    von „Einsicht nehmen“ legt der Ablauf die nächste binnen Sekunden an (gemessen: 3 s) – darum ein paar Mal kurz
 *    nachlesen. Nach „Erneut einsehen“ kommt die nächste erst nach einem Tag; dann zieht `einsichtNachziehen` das Datum beim
 *    Öffnen der Seite nach (Ergebnis: „wird beim nächsten Öffnen nachgezogen“, kein Fehler). Scheitert das Setzen selbst
 *    (Netz, 5xx, Datum nicht übernommen), steht Gespeichertes und Erledigtes – `EinsichtTeilweise` sagt es.
 *
 * ChurchTools verschiebt nur auf ein Datum **strikt nach heute** (OpenAPI der Test-Instanz): `einsichtPlan` lässt ein
 * Gültig-bis ≤ heute aus, das ist kein Fehler.
 *
 * Die Regeln (neu oder berichtigen, Datum, Texte) stehen in `shared/anmeldung/nachweisStand.ts`.
 */
import { ctAnfrage } from '@ui/ct/verbindung';
import { NichtUebernommen } from '@ui/ct/fehler';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { tagPunkt } from '@shared/ct/datum';
import {
  gleicherGruppenName,
  ERGEBNIS_EINTRAG,
  ERGEBNIS_OHNE,
  NACHWEIS_AUFGABE_ERNEUT,
  NACHWEIS_FELDER,
  type NachweisEinstellungen,
} from '@shared/anmeldung/nachweise';
import type { CtFeldwert } from '@shared/anmeldung/feldwert';
import {
  aufgabeErledigtDurch,
  einsichtPlan,
  istErsteAufgabe,
  nachweisGueltigBis,
} from '@shared/anmeldung/nachweisStand';
import { felderSchreiben } from './zahlung';
import { gruppenfelderLaden } from './mitglieder';
import { aufgabenLesen, offeneAufgaben, type NachweisPerson } from './nachweisPersonen';

/** Die Angaben sind gespeichert, aber ein späterer Schritt ist gescheitert – die Meldung sagt, was steht. */
export class EinsichtTeilweise extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EinsichtTeilweise';
  }
}

export interface EinsichtEingabe {
  art: { id: number; einstellungen: NachweisEinstellungen | null };
  /** Die Person, wie die Seite sie gelesen hat (mit ihrer offenen Aufgabe). */
  person: Pick<NachweisPerson, 'personId' | 'name' | 'aufgabe'>;
  eingesehenAm: string;
  /** Leer: nicht eintragen (nur bei Arten „ab Einsicht“ erlaubt). */
  ausgestelltAm: string | null;
  ergebnis: 'ohne' | 'eintrag';
  heute: string;
}

export interface EinsichtZeit {
  /** Wartet `ms` Millisekunden – Tests reichen eine sofortige Funktion. */
  warte?: (ms: number) => Promise<void>;
  /** Wie oft nach der neuen „Erneut einsehen“ geschaut wird (Standard 5). */
  versuche?: number;
  /** Pause zwischen zwei Blicken (Standard 1000 ms). */
  pauseMs?: number;
}

export interface EinsichtErgebnis {
  neu: boolean;
  gueltigBis: string | null;
  /** Titel der erledigten Aufgabe. */
  erledigt: string | null;
  /** „Erneut einsehen“ liegt jetzt auf „Gültig bis“. */
  verschoben: boolean;
  /** Das Datum der „Erneut einsehen“ konnte jetzt nicht gesetzt werden; die Seite zieht es beim nächsten Öffnen nach. */
  nachziehen: boolean;
  /** Die Meldung nach dem Schließen. */
  text: string;
}

const warteEcht = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const postpone = (id: number, tag: string) =>
  ctAnfrage(`/followups/${id}/postpone`, {
    method: 'POST',
    body: JSON.stringify({ dueDate: tag }),
  });

/** Die Meldung, wenn nach dem Speichern der Felder etwas scheitert. */
function teilweise(wasFehlt: string, ursache: unknown): EinsichtTeilweise {
  return new EinsichtTeilweise(
    `Die Angaben sind in ChurchTools gespeichert, ${wasFehlt}. ${fehlerMeldung(ursache).text} Du kannst noch einmal „Festhalten“ wählen – es wird nichts doppelt angelegt.`,
  );
}

/** Die Nummer der Option eines Auswahlfelds nach ihrem NAMEN. */
function optionsNummer(
  options: { id: string | number; name: string }[] | undefined,
  name: string,
): string {
  const o = options?.find((x) => gleicherGruppenName(x.name, name));
  if (!o) throw new NichtUebernommen(`das Ergebnis (die Option „${name}“ fehlt in der Gruppe)`);
  return String(o.id);
}

/** **Einsicht festhalten** – siehe oben. Wirft, wenn schon das Schreiben der Felder scheitert; `EinsichtTeilweise` beim Erledigen. */
export async function einsichtFesthalten(
  e: EinsichtEingabe,
  zeit: EinsichtZeit = {},
): Promise<EinsichtErgebnis> {
  const { warte = warteEcht, versuche = 5, pauseMs = 1000 } = zeit;
  const einst = e.art.einstellungen;
  if (!einst) throw new NichtUebernommen('die Einsicht (die Art ist nicht fertig eingerichtet)');
  const plan = einsichtPlan({
    einstellungen: einst,
    eingesehenAm: e.eingesehenAm,
    ausgestelltAm: e.ausgestelltAm,
    aufgabe: e.person.aufgabe,
    heute: e.heute,
  });
  const ergebnisName = e.ergebnis === 'eintrag' ? ERGEBNIS_EINTRAG : ERGEBNIS_OHNE;

  // ── 1. Felder (nach Namen) schreiben und nachlesen ──
  const defs = [...(await gruppenfelderLaden(e.art.id)).values()];
  const feld = (name: string) => {
    const d = defs.find((x) => gleicherGruppenName(x.name, name));
    if (!d) throw new NichtUebernommen(`das Feld „${name}“ (es fehlt in der Gruppe)`);
    return d;
  };
  const [fEin, fAus, fErg] = NACHWEIS_FELDER.map((f) => feld(f.name));
  const felder: Record<number, CtFeldwert> = {
    [fEin.id]: e.eingesehenAm,
    [fAus.id]: e.ausgestelltAm || null,
    [fErg.id]: optionsNummer(fErg.options, ergebnisName),
  };
  await felderSchreiben(e.art.id, e.person.personId, felder, 'die Einsicht');

  // ── 2. Aufgabe erledigen (nur wenn sie noch offen ist) ──
  const aufgabe = e.person.aufgabe;
  let erledigtId: number | null = null;
  let liste: Awaited<ReturnType<typeof aufgabenLesen>> | null = null;
  if (plan.erledigt && aufgabe) {
    try {
      const frisch = await aufgabenLesen(e.art.id);
      const jetzt = frisch.find((a) => a.id === aufgabe.id);
      if (jetzt && !jetzt.doneDate)
        await ctAnfrage(`/followups/${aufgabe.id}/complete`, { method: 'POST' });
      const danach = await aufgabenLesen(e.art.id);
      if (!danach.find((a) => a.id === aufgabe.id)?.doneDate)
        throw new NichtUebernommen('das Erledigen der Aufgabe');
      liste = danach;
    } catch (x) {
      throw teilweise(`aber die Aufgabe „${aufgabe.titel}“ ist noch offen`, x);
    }
    erledigtId = aufgabe.id;
  }

  // ── 3. „Erneut einsehen“ auf „Gültig bis“ ──
  let verschoben = false;
  let nachziehen = false;
  const bis = plan.verschiebenAuf;
  if (bis && plan.verschieben) {
    try {
      const sucheNeu = (l: Awaited<ReturnType<typeof aufgabenLesen>>) =>
        offeneAufgaben(
          l.filter(
            (a) =>
              a.personId === e.person.personId &&
              a.id !== erledigtId &&
              typeof a.title === 'string' &&
              gleicherGruppenName(a.title, NACHWEIS_AUFGABE_ERNEUT),
          ),
        ).get(e.person.personId) ?? null;
      let ziel: ReturnType<typeof sucheNeu> = null;
      if (plan.verschieben === 'vorhandene') {
        ziel = sucheNeu(await aufgabenLesen(e.art.id));
      } else if (aufgabe && istErsteAufgabe(aufgabe.titel)) {
        // Der Ablauf legt „Erneut einsehen“ nach dem Erledigen von „Einsicht nehmen“ erst nach einigen Sekunden an.
        for (let i = 0; i < versuche && !ziel; i++) {
          if (i > 0) await warte(pauseMs);
          ziel = sucheNeu(i === 0 && liste ? liste : await aufgabenLesen(e.art.id));
        }
      }
      if (!ziel) nachziehen = plan.verschieben === 'naechste';
      else if (ziel.faellig === bis) verschoben = true;
      else {
        await postpone(ziel.id, bis);
        const geprueft = offeneAufgaben(await aufgabenLesen(e.art.id)).get(e.person.personId);
        if (geprueft?.id === ziel.id && geprueft.faellig === bis) verschoben = true;
        else throw new NichtUebernommen('das neue Datum der Aufgabe');
      }
    } catch (x) {
      // Angaben und Erledigen stehen; nur das Datum der nächsten Aufgabe fehlt – noch einmal „Festhalten“ ist gefahrlos,
      // und die Seite zieht es beim nächsten Öffnen ohnehin nach.
      throw teilweise(
        `${plan.erledigt ? 'die Aufgabe ist erledigt, ' : ''}aber das Datum der „${NACHWEIS_AUFGABE_ERNEUT}“ ließ sich nicht setzen`,
        x,
      );
    }
  }

  const bisText = plan.gueltigBis ? tagPunkt(plan.gueltigBis) : null;
  const kopf = plan.neu
    ? `Einsicht bei ${e.person.name} festgehalten${bisText ? ` – gültig bis ${bisText}` : ''}.`
    : `Angaben bei ${e.person.name} berichtigt.`;
  return {
    neu: plan.neu,
    gueltigBis: plan.gueltigBis,
    erledigt: plan.erledigt,
    verschoben,
    nachziehen,
    text: nachziehen
      ? `${kopf} Das Datum der nächsten Aufgabe wird beim nächsten Öffnen nachgezogen.`
      : kopf,
  };
}

/**
 * **Nachziehen beim Öffnen der Seite:** Für jede Person mit Einsicht und bekanntem Gültig bis wird eine offene „Erneut
 * einsehen“, die die Einsicht NICHT erledigt hat und deren Fälligkeit abweicht, auf „Gültig bis“ verschoben. Nur
 * verschieben, nie erledigen; nie auf ein Datum ≤ heute. Ein Fehler (auch bei einer einzelnen Person) bricht nichts ab und
 * wird nicht gemeldet – das nächste Öffnen versucht es wieder; nichts Personenbezogenes im Log. Liefert, wie viele
 * verschoben wurden.
 */
export async function einsichtNachziehen(
  art: { einstellungen: NachweisEinstellungen | null },
  personen: readonly NachweisPerson[],
  heute: string,
): Promise<number> {
  const einst = art.einstellungen;
  if (!einst) return 0;
  let geschafft = 0;
  for (const p of personen) {
    const a = p.aufgabe;
    if (!a || !p.eingesehenAm || !gleicherGruppenName(a.titel, NACHWEIS_AUFGABE_ERNEUT)) continue;
    if (aufgabeErledigtDurch(a, p.eingesehenAm)) continue;
    const bis = nachweisGueltigBis(einst, p);
    if (!bis || bis <= heute || a.faellig === bis) continue;
    try {
      await postpone(a.id, bis);
      geschafft++;
    } catch {
      // Still: nächstes Öffnen, nächster Versuch.
    }
  }
  return geschafft;
}
