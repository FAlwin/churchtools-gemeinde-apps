import { useEffect, useRef } from 'react';
import type { AnzahlErgebnis } from '@shared/dienstplan/anzahl';
import type { Besetzung } from '@shared/dienstplan/entwuerfe';
import type { Plan, PlanZeile } from '@shared/dienstplan/plan';
import type { EntwuerfeDaten, EntwurfAnschluss } from './ladeEntwuerfe';
import { anzahlFehlerText, mitnehmenText, plaetzeText } from './plaetzeTexte';
import type { PersonenEintragen } from './planSicht';

/** Wie lange der Termin nach dem Erhöhen Zeit hat, neu zu laden, bevor die Sache als nicht bestätigt gilt. */
const WARTEZEIT_MS = 20_000;

interface Wartet {
  eventId: number;
  serviceId: number;
  dienst: string;
  /** So viele Plätze muss der Dienst am neu geladenen Termin haben. */
  anzahl: number;
  /** Wer eingetragen wird: eine Person oder ein Gast (P2d). */
  wer: Besetzung;
  /**
   * Neue Orte (`ortSchluessel`) der Entwürfe, die mit der Platzzahl umgetragen wurden (1 → 2: „ohne Nummer“ wird Platz 1):
   * Sie müssen in den geladenen Entwürfen stehen, bevor der neue Entwurf angelegt wird – sonst sähe Platz 1 frei aus.
   */
  erwartet: string[];
  fertig: () => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * **„Platz dazunehmen“ im Fenster „Dienst voll“** (P2c, Entwurf `e9-p2-eintragen.html` Fall 6): erst die Platzzahl in
 * ChurchTools um 1 erhöhen (sofort, `anzahl` = derselbe Weg wie der Regler: frisch lesen, schreiben, nachlesen, dabei gehen die Entwürfe des Dienstes mit),
 * dann den Entwurf für die Person (oder den Gast, P2d) anlegen – **aber erst, wenn der neue Platz nach dem Neuladen des Termins wirklich da ist**
 * (ein „ok“ des Aufrufs allein ist kein Beleg; der Entwurf braucht den neuen Platz samt seiner Nummer aus dem Plan). Den Entwurf
 * legt `personen.eintragen` an – derselbe Weg wie der normale Klick (Modus aus der Vorgabe, Konflikt-Schutz, Hinweis).
 *
 * - Scheitert das Erhöhen (Fehler, Konflikt, kein Recht): Meldung des Reglers, **kein Entwurf**.
 * - Scheitert erst der Entwurf: der Platz bleibt (so gewollt), die Meldung des Entwurfs erscheint.
 * - Gingen Entwürfe nicht mit (`mitnehmenText`): Meldung, kein neuer Entwurf, Plan und Entwürfe laden neu.
 * - Kommt der neue Platz (oder ein umgetragener Entwurf) nicht (Neuladen scheitert): nach `WARTEZEIT_MS` eine Meldung, kein Entwurf.
 *
 * Die Funktion löst sich erst auf, wenn alles durch ist – so bleibt „Personen“ solange gesperrt (kein zweiter Klick).
 * `undefined`, wo die Plätze nicht zu ändern sind (kein Anschluss).
 */
export function usePlatzDazu({
  plan,
  entwuerfe,
  daten,
  anzahl,
  personen,
  neuLaden,
  showToast,
  wartezeit = WARTEZEIT_MS,
}: {
  plan: Plan | null;
  /** Ohne Anschluss gibt es kein „Platz dazunehmen“. */
  entwuerfe: EntwurfAnschluss | undefined;
  /** Die geladenen Entwürfe (`null`, solange sie neu geladen werden). */
  daten: EntwuerfeDaten | null;
  /** Die Platzzahl ändern und die Entwürfe mitnehmen – lädt die Entwürfe neu, wenn welche umgezogen sind (`Planen`). */
  anzahl: EntwurfAnschluss['anzahl'];
  personen: PersonenEintragen;
  /** Die Termine leise neu laden (`leiseNeuLaden`) – danach kommt der Plan mit dem neuen Platz. */
  neuLaden: () => void;
  showToast: (text: string) => void;
  wartezeit?: number;
}): PersonenEintragen['dazunehmen'] {
  // Ein Ref statt State: Es kommt nichts Neues zum Zeichnen, der neue Plan löst das Zeichnen aus – und der Eintrag soll
  // genau einmal ausgeführt werden.
  const wartet = useRef<Wartet | null>(null);

  // Mit jedem Zeichnen schauen, ob der neue Platz und die umgetragenen Entwürfe da sind – ohne Abhängigkeiten, damit `personen` (und mit ihm `plan`) frisch ist.
  useEffect(() => {
    const w = wartet.current;
    if (!w || !plan) return;
    const i = plan.spalten.findIndex((s) => s.id === w.eventId);
    const zeile: PlanZeile | undefined = plan.gruppen
      .flatMap((g) => g.zeilen)
      .find((z) => z.dienst.id === w.serviceId);
    const zelle = i >= 0 && zeile ? zeile.zellen[i] : null;
    if (!zeile || !zelle || zelle.length < w.anzahl) return;
    // Auch die umgetragenen Entwürfe müssen da sein (neu geladen) – sonst zeigt Platz 1 sich frei, obwohl dort einer liegt.
    if (!w.erwartet.every((k) => daten?.entwuerfe.has(k))) return;
    wartet.current = null;
    clearTimeout(w.timer);
    // Noch einmal fragen, welcher Platz zu haben ist – wie der normale Klick (`eintragen` in „Personen“).
    const a =
      w.wer.art === 'person'
        ? personen.aktion(i, zeile, w.wer.personId, null)
        : personen.gastNeu(i, zeile);
    if (a?.art === 'eintragen') {
      void personen.eintragen(i, zeile, a.nr, w.wer, a.ersetzt).finally(w.fertig);
    } else {
      showToast(
        `${w.dienst} hat jetzt ${plaetzeText(w.anzahl)}, der Platz ist aber nicht mehr zu haben – ${w.wer.name} nicht eingetragen.`,
      );
      w.fertig();
    }
  });

  useEffect(
    () => () => {
      if (wartet.current) clearTimeout(wartet.current.timer);
    },
    [],
  );

  if (!entwuerfe) return undefined;

  return async (i, zeile, wer) => {
    if (!plan || wartet.current) return;
    const s = plan.spalten[i];
    const gesehen = zeile.zellen[i]?.length ?? 0;
    let r: AnzahlErgebnis;
    try {
      r = await anzahl(s.id, zeile.dienst.id, gesehen, gesehen + 1);
    } catch {
      r = { ok: false, grund: 'voruebergehend' };
    }
    if (!r.ok) {
      showToast(`${zeile.dienst.name}: ${anzahlFehlerText(r)}`);
      // Hat jemand die Zahl inzwischen geändert, zeigt der Plan gleich, was jetzt dasteht.
      if (r.jetzt !== undefined && r.jetzt !== gesehen) neuLaden();
      return;
    }
    const neu = r.anzahl;
    // Gingen Entwürfe nicht mit (oder ließ es sich nicht prüfen), legen wir nichts Neues darauf: Plan und Entwürfe laden neu.
    const offen = mitnehmenText(r);
    if (offen) {
      showToast(`${zeile.dienst.name}: ${offen} ${wer.name} wurde nicht eingetragen.`);
      neuLaden();
      return;
    }
    showToast(`${zeile.dienst.name}: jetzt ${plaetzeText(neu)}.`);
    await new Promise<void>((fertig) => {
      const timer = setTimeout(() => {
        if (wartet.current?.timer !== timer) return;
        wartet.current = null;
        showToast(
          `${zeile.dienst.name} hat jetzt ${plaetzeText(neu)} (in ChurchTools gespeichert), der Termin ließ sich aber nicht neu laden – ${wer.name} nicht eingetragen. Bitte die Seite neu laden.`,
        );
        fertig();
      }, wartezeit);
      wartet.current = {
        eventId: s.id,
        serviceId: zeile.dienst.id,
        dienst: zeile.dienst.name,
        anzahl: neu,
        wer,
        erwartet: r.entwuerfe?.umgetragen ?? [],
        fertig,
        timer,
      };
      neuLaden();
    });
  };
}
