/**
 * **Was das Kind-Fenster zur Ausnahme sagt** (O9-3) – die Texte an EINER Stelle: warum es keinen Schalter gibt und was
 * bei einem Fehler dasteht. Wann es einen Schalter gibt, entscheidet `ausnahmeStand` in
 * `@shared/organigramm/gruppenwechselSicht`.
 */
import { tagPunkt } from '@shared/ct/datum';
import type { Wechseljahr } from '@shared/organigramm/gruppenwechsel';
import type { KeinSchalterGrund } from '@shared/organigramm/gruppenwechselSicht';
import { NichtUebernommen } from '@ui/ct/fehler';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';

export function keinSchalterText(grund: KeinSchalterGrund, jahr: Wechseljahr): string {
  switch (grund) {
    case 'abAnkuendigung':
      return `Eine Ausnahme kannst du ab dem ${tagPunkt(jahr.ankuendigung)} eintragen.`;
    case 'zuSpaet':
      return 'Der Wechsel läuft schon – eine Ausnahme käme jetzt zu spät. Vor dem Wechseltag geht das, danach nur noch von Hand in ChurchTools.';
    case 'rechtFehlt':
      return 'Dafür fehlt dir in ChurchTools das Recht an der Wechsel-Gruppe. Bitte die Bereichsleitung fragen.';
    case 'rechtUnbekannt':
      return 'Ob du eine Ausnahme eintragen darfst, ist gerade nicht lesbar. Bitte lade den Reiter neu.';
    case 'nichtLesbar':
      return 'Die Wechsel-Gruppe ist gerade nicht lesbar – eine Ausnahme lässt sich jetzt nicht eintragen.';
  }
}

/**
 * Was dasteht, wenn das Schreiben scheitert. „Nicht übernommen“ sagt genau das (ChurchTools hat 2xx gemeldet, das
 * Nachlesen zeigt etwas anderes); jeder andere Fehler beginnt mit „Gerade nicht gespeichert“ – der Zustand bleibt, wie er
 * war, und es wird nichts von selbst wiederholt.
 */
export function ausnahmeFehlerText(e: unknown): string {
  if (e instanceof NichtUebernommen) return e.message;
  return `Gerade nicht gespeichert. ${fehlerMeldung(e).text}`;
}
