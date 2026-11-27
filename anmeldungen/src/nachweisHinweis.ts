/**
 * **Der Hinweis „n ohne gültigen Nachweis“ auf der Startseite** (N3d, E25) – je Veranstaltung der Leitung, ab sechs Wochen vor
 * dem Beginn. Gezählt wird aus derselben Lage wie die Spalte im Reiter „Anmeldungen“ (`nachweisLageBauen`), nicht neu.
 *
 * Die Mitglieder hat `ladeUebersicht` schon gelesen; hier kommen nur der Stand aus der Ablage (einmal für alle Arten) und –
 * bei „Nur wenn …“ – die Gruppenfelder (sonst stünde eine Auswahl als Nummer da und niemand „bräuchte“ den Nachweis).
 *
 * **Ehrlich statt falsch:** Nicht lesbar (kein Recht an der Ablage oder an den Antworten) → kein Hinweis für diese
 * Veranstaltung; ein vorübergehender Fehler → Konsole und kein Hinweis, die Startseite bleibt heil.
 */
import { ApiError } from '@ui/ct/fehler';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { anmeldungenAus, mitgliederstandAus, type MitgliedRoh } from '@shared/anmeldung/liste';
import { nachweisLageBauen, ohneGueltigenNachweis } from '@shared/anmeldung/nachweisAmpelLage';
import { gruppenfelderLaden } from './mitglieder';
import { nachweisAblageFuerLeitung } from './nachweisStandAblage';

/** Eine Veranstaltung, für die der Hinweis in Frage kommt (Leitung, anstehend, im Fenster, Nachweis eingeschaltet). */
export interface HinweisKandidat {
  id: number;
  e: OeffentlicheEinstellungen;
  mitglieder: MitgliedRoh[];
}

/** Veranstaltung → Zahl der Personen ohne gültigen Nachweis (nur > 0). Wirft nie. */
export async function nachweisHinweiseLesen(
  kandidaten: readonly HinweisKandidat[],
  leitung: ReadonlySet<number>,
  heute: string,
): Promise<Map<number, number>> {
  const ergebnis = new Map<number, number>();
  if (kandidaten.length === 0) return ergebnis;
  try {
    const arten = [
      ...new Set(kandidaten.flatMap((k) => (k.e.nachweise ?? []).map((b) => b.artGruppeId))),
    ];
    const ablage = await nachweisAblageFuerLeitung(arten);
    if (ablage.art === 'nichtLesbar') return ergebnis;
    for (const k of kandidaten) {
      try {
        const mitBedingung = (k.e.nachweise ?? []).some((b) => b.fuer === 'nurWenn');
        const felder = mitBedingung ? await gruppenfelderLaden(k.id) : new Map();
        const liste = anmeldungenAus(
          k.e,
          mitgliederstandAus(k.mitglieder, [], felder, leitung, new Map()),
          heute,
        );
        const n = ohneGueltigenNachweis(nachweisLageBauen(k.e, liste, ablage, heute));
        if (n > 0) ergebnis.set(k.id, n);
      } catch (e) {
        // Ohne Recht an den Antworten (403) weiß die Leitung nicht, wer den Nachweis braucht – dann sagen wir nichts.
        if (!(e instanceof ApiError && e.status === 403))
          console.warn(`Nachweise von ${k.id} nicht gezählt`, e);
      }
    }
  } catch (e) {
    console.warn('Nachweis-Stand für den Hinweis nicht gelesen', e);
  }
  return ergebnis;
}
