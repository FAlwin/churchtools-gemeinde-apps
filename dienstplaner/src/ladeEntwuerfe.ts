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
import type { ListeInhalt, Personenliste } from '@shared/dienstplan/personenliste';
import {
  personenlisteSpeichern,
  type PersonenlisteErgebnis,
} from '@shared/dienstplan/personenlisteSpeichern';
import { entwurfPortFuer } from '@ui/ct/modulPort';
import { MODUL_KUERZEL, type Start } from './start';
import { sende, type SendeEintrag, type SendeErgebnis } from '@shared/dienstplan/senden';
import { dienstPort } from './dienstPort';
import { anzahlAendern, type AnzahlErgebnis } from '@shared/dienstplan/anzahl';
import { entwuerfeMitnehmen } from '@shared/dienstplan/umnummerieren';
import { ladeSendeHinweise, type SendeHinweis } from './sendeHinweise';
import { ladeTerminStaende, type TerminStand } from './terminStand';
import { ladeVorliebe, speichereVorliebe } from './ladeVorlieben';
import type { Vorliebe, VorliebenGrund } from '@shared/dienstplan/vorlieben';

/** Der Anschluss an den Speicher des Dienstplaners – auch „Verfügbarkeit“ (`ladeVerfuegbarkeit`) liest und schreibt darüber. */
export const port = entwurfPortFuer(() => MODUL_KUERZEL);

/** Die ID des eigenen Moduls – je Sitzung einmal gesucht; ein Fehlschlag wird nicht gemerkt. */
const modulSuche = merkeVersprechen<number>();
export function modulId(): Promise<number> {
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
  /**
   * Die Personenliste je Dienstgruppe (ID) – aus denselben Werten der Schublade, ohne weitere Anfrage (PL-1). Gruppen
   * ohne sichtbare Schublade oder ohne Liste fehlen hier; dann gilt alles wie bisher.
   */
  personenlisten: Map<number, Personenliste>;
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
  const personenlisten = new Map<number, Personenliste>();
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
      if (l.inhalt.personenliste) personenlisten.set(gruppe.id, l.inhalt.personenliste);
    }),
  );
  return { modul, schubladen, entwuerfe, gruppeJe, personenlisten };
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

/**
 * Die Personenliste einer Dienstgruppe ändern (PL-2): frisch lesen, Version vergleichen, schreiben, nachlesen – im Kern
 * (`personenlisteSpeichern`). Ohne sichtbare Schublade gibt es hier nichts zu schreiben (`kein-recht`).
 */
export function speicherePersonenliste(
  daten: EntwuerfeDaten,
  gruppeId: number,
  aendern: (alt: Personenliste | null) => ListeInhalt,
  erwartet: number | null,
): Promise<PersonenlisteErgebnis> {
  const kategorie = daten.schubladen.get(gruppeId)?.kategorie;
  if (kategorie == null) return Promise.resolve({ ok: false, grund: 'kein-recht' });
  return personenlisteSpeichern(port, daten.modul, kategorie, aendern, erwartet);
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

/**
 * **Die Platzzahl ändern – und die Entwürfe dieses Termins und Dienstes mitnehmen** (Alwin, 19.11.2026: „Alles bleibt in
 * der Planung anpassbar“). ChurchTools nummeriert die Plätze eines Dienstes beim Ändern neu, ein Entwurf merkt sich seinen
 * Platz über die Nummer (`ortSchluessel`) – also trägt der Dienstplaner ihn danach selbst auf die neue Nummer um (Regel
 * `umzuegeRechnen`, Ablauf `entwuerfeMitnehmen`; die Platz-ID vorher/nachher liefert `anzahlAendern`).
 *
 * Die Platzzahl IST nach `ok` geändert, was mit den Entwürfen geschah, steht in `entwuerfe` (`offen`/`unklar` → der Aufrufer
 * meldet es und lädt Plan UND Entwürfe neu). Die Schublade der Dienstgruppe wird dafür **frisch** gelesen – samt Rechten
 * (nur „bereit“ darf umtragen). Gibt es keine Schublade (oder sie ist nicht zu sehen), gibt es hier keine Entwürfe.
 */
export async function anzahlMitEntwuerfen(
  start: Start,
  eventId: number,
  serviceId: number,
  gesehen: number,
  neu: number,
): Promise<AnzahlErgebnis> {
  const r = await anzahlAendern(dienstPort, eventId, serviceId, gesehen, neu);
  if (!r.ok || !r.plaetze) return r;
  const gruppe = start.dienstgruppen.find(
    (g) => g.id === start.dienste.get(serviceId)?.dienstgruppeId,
  );
  if (!gruppe) return r;
  const unklar = { ...r, entwuerfe: { umgetragen: [], offen: 0, unklar: true } };
  try {
    const modul = await modulId();
    const [rechteRoh, liste] = await Promise.all([
      port.daten<Record<string, unknown> | null>('/permissions/global'),
      kategorienLesen(port, modul),
    ]);
    const kategorie = kategorieAusListe(liste, schublade(gruppe).kuerzel);
    const stand = schubladenStand(modulRechteAus(rechteRoh?.[MODUL_KUERZEL]), kategorie);
    // Nicht zu sehen: Dann kennen wir hier keine Entwürfe. Nur zu lesen: Es gäbe vielleicht welche, wir dürften sie aber nicht umtragen.
    if (kategorie === null || stand === 'fehlt') return r;
    if (stand !== 'bereit') return unklar;
    const entwuerfe = await entwuerfeMitnehmen(port, modul, kategorie, {
      eventId,
      serviceId,
      ...r.plaetze,
    });
    return { ...r, entwuerfe };
  } catch {
    // Vorübergehend (Netz, Drosselung): die Platzzahl steht – ob Entwürfe mitgehen müssen, ist offen.
    return unklar;
  }
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
  /**
   * Die Personenliste einer Dienstgruppe ändern (PL-2: Reihenfolge, Tags, Pause) – im Kern `personenlisteSpeichern`; `erwartet`
   * ist die Version, die der Planer gesehen hat (`null`: es gab keine Liste).
   */
  personenliste(
    daten: EntwuerfeDaten,
    gruppeId: number,
    aendern: (alt: Personenliste | null) => ListeInhalt,
    erwartet: number | null,
  ): Promise<PersonenlisteErgebnis>;
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
  /**
   * Anzahl der Plätze eines Dienstes am Termin sofort ändern (E4-5-3) – im Kern `anzahl.ts`; die Entwürfe des Dienstes an
   * diesem Termin gehen mit (`anzahlMitEntwuerfen`). Danach muss der Aufrufer Plan und Entwürfe neu laden.
   */
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
    personenliste: speicherePersonenliste,
    senden: sendeEntwuerfe,
    hinweise: ladeSendeHinweise,
    termine: (ids) => ladeTerminStaende(ids),
    anzahl: (eventId, serviceId, gesehen, neu) =>
      anzahlMitEntwuerfen(start, eventId, serviceId, gesehen, neu),
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

/**
 * Für die Anzeige: Was ein `EntwurfGrund` beim Ändern der **Personenliste** für den Planer heißt (PL-2). Wie `grundText`,
 * nur über die Liste statt über einen Platz – und mit dem Satz, was mit der Eingabe ist.
 */
export function listeGrundText(grund: EntwurfGrund): string {
  switch (grund) {
    case 'abgemeldet':
      return 'Du bist bei ChurchTools nicht mehr angemeldet. Bitte die Seite neu laden.';
    case 'kein-recht':
      return 'ChurchTools erlaubt dir nicht, die Personenliste dieser Dienstgruppe zu ändern.';
    case 'voruebergehend':
      return 'ChurchTools antwortet gerade nicht. Nichts verloren – bitte gleich noch einmal versuchen.';
    case 'nicht-angekommen':
      return 'ChurchTools hat die Änderung nicht übernommen. Bitte noch einmal versuchen.';
    case 'zu-gross':
      return 'Die Liste wäre zu lang. Bitte ein paar Tags weniger oder kürzere Namen.';
    case 'konflikt':
      return 'Ein anderer Planer hat die Liste inzwischen geändert. Sie ist neu geladen – bitte prüfen und noch einmal versuchen.';
  }
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
