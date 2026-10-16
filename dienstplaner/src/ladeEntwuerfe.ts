/**
 * **Entwürfe laden und speichern** (Bauplan E4-3-2) – der Browser-Teil zu `@shared/dienstplan/entwuerfe`
 * (Regeln und Messwerte dort). Eine Schublade (Kategorie) je Dienstgruppe im Speicher des Dienstplaners.
 *
 * Geladen wird beim Öffnen von „Planen“ für die Gruppen, die man planen darf: einmal die Liste der
 * Kategorien, dann je sichtbarer Schublade ihre Werte. Nie aus einem Zwischenspeicher – vor dem Speichern
 * liest der Kern ohnehin frisch.
 */
import {
  kategorieAusListe,
  kategorienLesen,
  kategorieSicherstellen,
  modulSuchen,
} from '@shared/ct/modulDaten';
import { merkeVersprechen } from '@shared/ct/versprechenMerker';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import {
  entwurfEntfernen,
  entwurfSpeichern,
  ortSchluessel,
  schublade,
  schubladeLesen,
  modulRechteAus,
  schubladenStand,
  type Entwurf,
  type EntwurfEingabe,
  type EntwurfErgebnis,
  type EntwurfGrund,
  type SchubladenStand,
} from '@shared/dienstplan/entwuerfe';
import type { PlatzOrt } from '@shared/dienstplan/einteilen';
import { entwurfPortFuer } from '@ui/ct/modulPort';
import { MODUL_KUERZEL, type Start } from './start';
import { sende, type SendeEintrag, type SendeErgebnis } from '@shared/dienstplan/senden';
import { dienstPort } from './dienstPort';
import { anzahlAendern, type AnzahlErgebnis } from '@shared/dienstplan/anzahl';
import { ladeSendeHinweise, type SendeHinweis } from './sendeHinweise';
import { ladeTerminStaende, type TerminStand } from './terminStand';
import { ladeVorliebe, speichereVorliebe } from './ladeVorlieben';
import type { Vorliebe, VorliebenGrund } from '@shared/dienstplan/vorlieben';

const port = entwurfPortFuer(() => MODUL_KUERZEL);

/** Die ID des eigenen Moduls – je Sitzung einmal gesucht; ein Fehlschlag wird nicht gemerkt. */
const modulSuche = merkeVersprechen<number>();
function modulId(): Promise<number> {
  return modulSuche.hole('modul', () => modulSuchen(port, 'Der Dienstplaner'));
}

/** Nur für Tests. */
export function _vergissModul(): void {
  modulSuche.vergiss();
}

export interface Schublade {
  gruppe: Dienstgruppe;
  /** `null` = nicht zu sehen (fehlt oder kein Recht – ChurchTools unterscheidet das nicht). */
  kategorie: number | null;
  stand: SchubladenStand;
  /** Laden der Werte ging schief (vorübergehend) – dann ist für diese Gruppe kein Eintragen möglich. */
  fehler?: EntwurfGrund;
}

export interface EntwuerfeDaten {
  modul: number;
  /** Je Dienstgruppe (ID) ihre Schublade. */
  schubladen: Map<number, Schublade>;
  /** Je Platz (`ortSchluessel`) der Entwurf. */
  entwuerfe: Map<string, Entwurf>;
  /** Je Platz die Dienstgruppe, in deren Schublade der Entwurf liegt – zum Verwerfen auch ohne Matrix-Zeile. */
  gruppeJe: Map<string, number>;
}

/**
 * Schubladen und Entwürfe der Gruppen, die man planen darf. **Wirft**, wenn schon das Modul oder die Liste
 * der Kategorien nicht lesbar ist – dann weiß niemand, welche Entwürfe es gibt. Scheitert nur eine Schublade,
 * steht das an ihr (`fehler`), die anderen gehen.
 */
export async function ladeEntwuerfe(gruppen: Dienstgruppe[]): Promise<EntwuerfeDaten> {
  const modul = await modulId();
  // Die Rechte jedes Mal frisch: Wer eine Schublade gerade eingerichtet hat, hat erst JETZT Rechte darauf
  // (gemessen) – ein Stand vom Start der App kennt sie nicht (im Browser-Check gefunden, 14.10.2026).
  const [rechteRoh, liste] = await Promise.all([
    port.daten<Record<string, unknown> | null>('/permissions/global'),
    kategorienLesen(port, modul),
  ]);
  const rechte = modulRechteAus(rechteRoh?.[MODUL_KUERZEL]);
  const schubladen = new Map<number, Schublade>();
  const entwuerfe = new Map<string, Entwurf>();
  const gruppeJe = new Map<string, number>();
  await Promise.all(
    gruppen.map(async (gruppe) => {
      const kategorie = kategorieAusListe(liste, schublade(gruppe).kuerzel);
      const stand = schubladenStand(rechte, kategorie);
      const s: Schublade = { gruppe, kategorie, stand };
      schubladen.set(gruppe.id, s);
      if (kategorie === null || stand === 'fehlt') return;
      const l = await schubladeLesen(port, modul, kategorie);
      if (!l.ok) {
        s.fehler = l.grund;
        return;
      }
      for (const [k, { entwurf }] of l.inhalt.je) {
        entwuerfe.set(k, entwurf);
        gruppeJe.set(k, gruppe.id);
      }
    }),
  );
  return { modul, schubladen, entwuerfe, gruppeJe };
}

/** Einen Entwurf speichern (frisch lesen, Version vergleichen, schreiben, nachlesen – im Kern). */
export function speichereEntwurf(
  daten: EntwuerfeDaten,
  gruppeId: number,
  eingabe: EntwurfEingabe,
  erwartet: number | null,
): Promise<EntwurfErgebnis> {
  const kategorie = daten.schubladen.get(gruppeId)?.kategorie;
  if (kategorie == null) return Promise.resolve({ ok: false, grund: 'kein-recht' });
  return entwurfSpeichern(port, daten.modul, kategorie, eingabe, erwartet);
}

/** Einen Entwurf entfernen – nur, wenn noch die gesehene Version dasteht (im Kern). */
export function entferneEntwurf(
  daten: EntwuerfeDaten,
  gruppeId: number,
  ort: PlatzOrt,
  erwartet: number,
): Promise<EntwurfErgebnis> {
  const kategorie = daten.schubladen.get(gruppeId)?.kategorie;
  if (kategorie == null) return Promise.resolve({ ok: false, grund: 'kein-recht' });
  return entwurfEntfernen(port, daten.modul, kategorie, ort, erwartet);
}

/** Entwürfe senden (E4-4) – einer nach dem anderen, im Kern (`senden.ts`). */
export function sendeEntwuerfe(
  daten: EntwuerfeDaten,
  eintraege: readonly SendeEintrag[],
  melde: (index: number, ergebnis: SendeErgebnis) => void,
): Promise<SendeErgebnis[]> {
  return sende(eintraege, { dienst: dienstPort, entwurf: port, modul: daten.modul }, melde);
}

const VERWEIGERT_ANLEGEN =
  'ChurchTools erlaubt dir nicht, Kategorien anzulegen. Das kann die Gemeinde-Verwaltung einrichten.';

/**
 * Die Schublade einer Gruppe einrichten (Alwin, 14.10.2026: per Knopf, nur wer Kategorien anlegen darf).
 * Wer sie anlegt, bekommt sofort alle Rechte darauf (gemessen) – danach neu laden. `kategorieSicherstellen`
 * legt nur an, wenn es sie (sichtbar) noch nicht gibt, und sieht danach nach, ob sie dasteht.
 */
export async function richteSchubladeEin(gruppe: Dienstgruppe): Promise<number> {
  const modul = await modulId();
  return kategorieSicherstellen(port, modul, schublade(gruppe), VERWEIGERT_ANLEGEN);
}

/**
 * Was „Planen“ zum Eintragen braucht – die App reicht es herein (Tests reichen eine Attrappe). Ohne
 * Anschluss bleibt „Wer kann?“ nur zum Ansehen.
 */
export interface EntwurfAnschluss {
  ich: { personId: number; name: string };
  laden(): Promise<EntwuerfeDaten>;
  speichern(
    daten: EntwuerfeDaten,
    gruppeId: number,
    eingabe: EntwurfEingabe,
    erwartet: number | null,
  ): Promise<EntwurfErgebnis>;
  entfernen(
    daten: EntwuerfeDaten,
    gruppeId: number,
    ort: PlatzOrt,
    erwartet: number,
  ): Promise<EntwurfErgebnis>;
  einrichten(gruppe: Dienstgruppe): Promise<void>;
  senden(
    daten: EntwuerfeDaten,
    eintraege: readonly SendeEintrag[],
    melde: (index: number, ergebnis: SendeErgebnis) => void,
  ): Promise<SendeErgebnis[]>;
  hinweise(
    zeilen: readonly { entwurf: Entwurf; tag: string }[],
  ): Promise<Map<string, SendeHinweis>>;
  /** Gibt es diese Termine noch, und wann waren sie? (Entwürfe ohne Platz, #582) */
  termine(ids: readonly number[]): Promise<Map<number, TerminStand>>;
  /** Anzahl der Plätze eines Dienstes am Termin sofort ändern (E4-5-3) – im Kern `anzahl.ts`. */
  anzahl(eventId: number, serviceId: number, gesehen: number, neu: number): Promise<AnzahlErgebnis>;
  /** Vorlieben einer Person je Dienstgruppe – der Stift (E5-3), sofort in ChurchTools; im Kern `vorlieben.ts`. */
  vorlieben: {
    lesen(
      gruppeId: number,
      personId: number,
    ): Promise<{ ok: true; vorliebe: Vorliebe } | { ok: false; grund: VorliebenGrund }>;
    speichern(
      gruppeId: number,
      personId: number,
      v: Vorliebe,
    ): Promise<{ ok: true } | { ok: false; grund: VorliebenGrund }>;
  };
}

/** Der echte Anschluss für die App. */
export function entwurfAnschluss(start: Start, gruppen: () => Dienstgruppe[]): EntwurfAnschluss {
  return {
    ich: { personId: start.ichId, name: start.vorname },
    laden: () => ladeEntwuerfe(gruppen()),
    speichern: speichereEntwurf,
    entfernen: entferneEntwurf,
    senden: sendeEntwuerfe,
    hinweise: ladeSendeHinweise,
    termine: (ids) => ladeTerminStaende(ids),
    anzahl: (eventId, serviceId, gesehen, neu) =>
      anzahlAendern(dienstPort, eventId, serviceId, gesehen, neu),
    vorlieben: { lesen: ladeVorliebe, speichern: speichereVorliebe },
    einrichten: async (gruppe) => {
      await richteSchubladeEin(gruppe);
    },
  };
}

/** Der Entwurf an einem Platz, wenn es einen gibt. */
export function entwurfAm(
  daten: EntwuerfeDaten | null,
  ort: { eventId: number; serviceId: number; index: number | null },
): Entwurf | null {
  return daten?.entwuerfe.get(ortSchluessel(ort)) ?? null;
}

/** Für die Anzeige: Was ein `EntwurfGrund` für den Planer heißt. */
export function grundText(grund: EntwurfGrund): string {
  switch (grund) {
    case 'abgemeldet':
      return 'Du bist bei ChurchTools nicht mehr angemeldet. Bitte die Seite neu laden.';
    case 'kein-recht':
      return 'ChurchTools erlaubt dir nicht, die Entwürfe dieser Dienstgruppe zu ändern.';
    case 'voruebergehend':
      return 'ChurchTools antwortet gerade nicht. Nichts verloren – bitte gleich noch einmal versuchen.';
    case 'nicht-angekommen':
      return 'ChurchTools hat den Entwurf nicht übernommen. Bitte noch einmal versuchen.';
    case 'zu-gross':
      return 'Der Name ist zu lang.';
    case 'konflikt':
      return 'Jemand anderes hat diesen Platz eben geändert.';
  }
}
