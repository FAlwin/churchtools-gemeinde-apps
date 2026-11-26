/**
 * **„Vertretung suchen“ an ChurchTools anschließen** (Bauplan E5c-6): wen man fragen kann (`ladeLage`), und der Anschluss für
 * den Ablauf „Absagen und fragen“ (`vertretungAnschluss`). Die Regeln stehen in `@shared/dienstplan/vertretung`, der Ablauf in
 * `vertretungAblauf.ts` – hier nur das Holen und Verdrahten.
 *
 * **Laden – die Zweige einzeln, vorübergehend ist nicht „keine Daten“:**
 * - **401** wirft (abgemeldet). **Jede vorübergehende Störung wirft ebenfalls** (Mitglieder, Abwesenheiten, Antworten, Termine
 *   des Tages): Eine halbe Liste wäre „es fehlen Leute“ oder „alle ohne Antwort“ – gelogen. Das Fenster zeigt den Fehler mit
 *   „Nochmal versuchen“.
 * - **Dauerhaft nicht lesbar** (403 auf die Mitglieder, kein Recht auf die Antworten der Gruppe, Abwesenheiten nicht sichtbar)
 *   ist kein Fehler, sondern eine **Auskunft**: ohne Mitglieder gibt es niemanden zu fragen (`art: 'keineMitglieder'`); ohne
 *   lesbare Antworten steht nur das Team da (`Vorschlaege.art: 'ohneAntworten'`); ohne Abwesenheiten sagt ein Hinweis, dass
 *   nicht geprüft werden konnte, wer abwesend ist.
 * Keine Namen oder IDs von Personen in `console.*`.
 */
import { plusTage } from '@shared/ct/datum';
import { ApiError } from '@ui/ct/fehler';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { ctBasis, ctDaten } from '@ui/ct/verbindung';
import { erweiterungsLink } from '@ui/erweiterung/kuerzel';
import { heuteImKalender } from '@shared/ct/zeit';
import type { Dienst } from '@shared/ct/dienste';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import { absagenNachZusage } from '@shared/dienstplan/antworten';
import { KEINE_ANTWORTEN, type PersonenAntworten } from '@shared/dienstplan/personenAntworten';
import type { PersonenDaten } from '@shared/dienstplan/personenDaten';
import { terminEnde, type RohTermin } from '@shared/dienstplan/termine';
import { vertretungMarkieren, type Vertretung } from '@shared/dienstplan/verfuegbarkeit';
import {
  abwesendAm,
  eingeteiltAus,
  leitungAus,
  vorschlaege,
  type Vorschlaege,
} from '@shared/dienstplan/vertretung';
import { rollenAus, type Person, type RohRolle } from '@shared/organigramm/mitglieder';
import { dienstPort } from './dienstPort';
import { ctMailSenden } from './ladeErinnern';
import { ladeAntwortenMitArt } from './useAbfrageRegeln';
import { port } from './ladeEntwuerfe';
import { ladePersonen } from './ladePersonen';
import { grundSatz, ladeVerfuegbarkeit } from './ladeVerfuegbarkeit';
import { adresseFuer } from './reiter';
import { eigeneDienstgruppen, MODUL_KUERZEL, type Start } from './start';
import type { EigenerDienst } from './TauschTeile';
import {
  mailsErneut,
  vertretungSuchen,
  type AblaufErgebnis,
  type MailBericht,
  type VertretungsAuftrag,
} from './vertretungAblauf';

/** Was das Fenster über den Dienst wissen muss, um zu zeigen, wen man fragen kann. */
export type VertretungLage =
  /** Die Mitglieder der Teams am Dienst sind nicht zu sehen (403) oder es gibt keine – niemand zum Fragen. */
  | { art: 'keineMitglieder' }
  | {
      art: 'da';
      vorschlaege: Vorschlaege;
      /** Die Leitung der Teams am Dienst, ohne mich – bekommt die Kopie (der Ablauf nimmt die Gefragten heraus). */
      leitung: Person[];
      /** Wie das Team heißt – die Gruppen am Dienst, in denen ich bin; sonst die Dienstgruppe; sonst „Teams“. Für den Satz „… eine Kopie“. */
      teamName: string;
      /** Konnte man nicht lesen, wer abwesend ist? Dann steht ein Hinweis da (nicht geprüft ≠ niemand abwesend). */
      abwesenheitenUnbekannt: boolean;
    };

/**
 * Der Kern ohne Netz-Technik (Tests reichen die geladenen Daten herein): aus Stand, Antworten und den Terminen des Tages die
 * Lage. `daten` hat je CT-Gruppe des Dienstes einen Stand (`ladePersonen`); `tagesTermine` sind die Termine dieses Tages
 * mit Plätzen (wer dort schon eingeteilt ist, fehlt in der Liste).
 */
export function lageAus(o: {
  eventId: number;
  tag: string;
  serviceId: number;
  dienst: Pick<Dienst, 'gruppenIds' | 'dienstgruppeId'>;
  dienstName: (id: number) => string | undefined;
  ichId: number;
  daten: PersonenDaten;
  antworten: PersonenAntworten;
  tagesTermine: readonly RohTermin[];
  teamName: string;
}): VertretungLage {
  const termin = o.tagesTermine.find((t) => t.id === o.eventId);
  if (!termin) throw new ApiError(502, 'ChurchTools hat den Termin nicht geliefert.');
  const mitglieder = new Map<number, Person>();
  for (const id of new Set(o.dienst.gruppenIds)) {
    const s = o.daten.get(id);
    if (s?.art === 'da' && s.mitglieder !== 'verborgen')
      for (const p of s.mitglieder) mitglieder.set(p.id, p);
  }
  if (mitglieder.size === 0) return { art: 'keineMitglieder' };
  const abwesend = abwesendAm(o.daten, o.dienst.gruppenIds, {
    beginn: termin.startDate,
    ende: terminEnde(termin),
    tag: o.tag,
  });
  return {
    art: 'da',
    vorschlaege: vorschlaege({
      mitglieder: [...mitglieder.values()],
      antworten: o.antworten,
      gruppeId: o.dienst.dienstgruppeId,
      terminId: o.eventId,
      dienstId: o.serviceId,
      dienstName: o.dienstName,
      ichId: o.ichId,
      eingeteilt: eingeteiltAus(o.tagesTermine),
      abwesend: abwesend.personen,
    }),
    leitung: leitungAus(o.daten, o.dienst.gruppenIds, new Set([o.ichId])),
    teamName: o.teamName,
    abwesenheitenUnbekannt: !abwesend.bekannt,
  };
}

/** Der Dienst zu einem eigenen Platz – und seine Dienstgruppe. */
function dienstUndGruppe(
  start: Start,
  serviceId: number,
): { dienst: Dienst; gruppe: Dienstgruppe | null } {
  const dienst = start.dienste.get(serviceId);
  if (!dienst) throw new ApiError(404, 'Diesen Dienst gibt es nicht mehr.');
  return {
    dienst,
    gruppe: start.dienstgruppen.find((g) => g.id === dienst.dienstgruppeId) ?? null,
  };
}

/**
 * Lädt die Lage für einen eigenen Dienst: Mitglieder + Abwesenheiten (`ladePersonen`, mit den Rollen für die Leitung), die
 * Antworten der Dienstgruppe samt ihrer Art (`ladeAntwortenMitArt`, V-5) und die Termine des Tages. **Wirft** bei 401 und bei jeder vorübergehenden
 * Störung (s. oben).
 */
export async function ladeLage(start: Start, d: EigenerDienst): Promise<VertretungLage> {
  const { dienst, gruppe } = dienstUndGruppe(start, d.ort.serviceId);
  // Die Rollen zuerst: `ladePersonen` braucht sie für die Leitung. `/group/roles` ist ein Aufruf für die ganze Gemeinde.
  const rollen = rollenAus(await ctDaten<RohRolle[] | null>('/group/roles'));
  const [daten, antworten, tagesTermine] = await Promise.all([
    ladePersonen(dienst.gruppenIds, {
      von: d.tag,
      bis: d.tag,
      abwesenheitenAller: start.rechte.abwesenheitenAller,
      rollen,
    }),
    // Ohne Dienstgruppe gibt es keine Antworten zu lesen – dann steht nur das Team da.
    // Mit der Art (V-5): Bei „Nur abwesend“ ordnet das Fenster nicht nach Ja/Vielleicht, es steht das Team da.
    gruppe ? ladeAntwortenMitArt([gruppe], heuteImKalender()) : Promise.resolve(KEINE_ANTWORTEN),
    ctDaten<unknown>(`/events?from=${d.tag}&to=${plusTage(d.tag, 1)}&include=eventServices`),
  ]);
  if (!Array.isArray(tagesTermine))
    throw new ApiError(502, 'ChurchTools hat die Termine nicht vollständig geliefert.');
  // Eine Gruppe, die nur vorübergehend nicht antwortet, ist KEIN „niemand abwesend“ und kein „keine Mitglieder“ – werfen.
  for (const id of new Set(dienst.gruppenIds)) {
    const s = daten.get(id);
    if (s?.art === 'fehler') throw new ApiError(503, s.text);
  }
  return lageAus({
    eventId: d.terminId,
    tag: d.tag,
    serviceId: d.ort.serviceId,
    dienst,
    dienstName: (id) => start.dienste.get(id)?.name,
    ichId: start.ichId,
    daten,
    antworten,
    tagesTermine: tagesTermine as RohTermin[],
    teamName:
      start.gruppen
        .filter((g) => dienst.gruppenIds.includes(g.id))
        .map((g) => g.name)
        .join(' / ') ||
      gruppe?.name ||
      'Teams',
  });
}

// ── Der Anschluss für den Ablauf ─────────────────────────────────────────────

/** Was das Fenster braucht – im Browser `vertretungAnschluss(start)`, im Test ein Nachbau. */
export interface VertretungAnschluss {
  lage: (d: EigenerDienst) => Promise<VertretungLage>;
  suchen: (a: VertretungsAuftrag, d: EigenerDienst) => Promise<AblaufErgebnis>;
  erneut: (a: VertretungsAuftrag, bisher: MailBericht) => Promise<MailBericht>;
}

/**
 * Die Adresse des Knopfs in den Mails: **die Startseite des Dienstplaners** – dort steht unter „Für dich offen“ das
 * „Übernehmen“ (Entwurf Abschnitt 4). Die Termin-Ansicht hat keinen Übernehmen-Knopf, ein Link dorthin wäre eine Sackgasse.
 */
export const vertretungLink = (): string =>
  erweiterungsLink(ctBasis(), MODUL_KUERZEL, adresseFuer('start'));

/**
 * **Schritt 1 des Ablaufs: die Markierung in Annas eigenen Wert schreiben** – in alle bereiten Kategorien der eigenen
 * Dienstgruppen **und** der Dienstgruppe des Dienstes (die liest das Team). Gelingen muss die Kategorie des Dienstes: Nur sie
 * liest das Team (`ladeAntworten`); eine andere, die nicht ging, ändert nichts am Ergebnis.
 */
export async function markiereVertretung(
  start: Start,
  d: EigenerDienst,
  v: Vertretung,
): Promise<{ ok: true } | { ok: false; text: string }> {
  const NICHTS = ' Es wurde nichts abgesagt und niemand gefragt.';
  let gruppe: Dienstgruppe | null;
  try {
    gruppe = dienstUndGruppe(start, d.ort.serviceId).gruppe;
  } catch (e) {
    return { ok: false, text: fehlerMeldung(e).text + NICHTS };
  }
  if (!gruppe)
    return {
      ok: false,
      text:
        'Dieser Dienst gehört zu keiner Dienstgruppe – dafür lässt sich hier keine Vertretung suchen.' +
        NICHTS,
    };
  const gruppen = [
    ...new Map([...eigeneDienstgruppen(start), gruppe].map((g) => [g.id, g])).values(),
  ];
  try {
    const verf = await ladeVerfuegbarkeit(gruppen, start.ichId);
    if (verf.lesefehler) return { ok: false, text: grundSatz(verf.lesefehler) + NICHTS };
    const zeile = verf.gruppen.find((z) => z.gruppe.id === gruppe.id);
    if (!zeile || zeile.stand !== 'bereit' || zeile.kategorie === null)
      return {
        ok: false,
        text:
          `Für „${gruppe.name}“ ist der Speicher für die Antworten noch nicht eingerichtet – oder du darfst ihn nicht ändern. ` +
          'Ohne ihn sieht dein Team nicht, dass du eine Vertretung suchst. Bitte die Leitung fragen.' +
          NICHTS,
      };
    const r = await vertretungMarkieren(
      port,
      verf.modul,
      verf.bereit,
      start.ichId,
      { terminId: d.terminId, vertretung: v },
      heuteImKalender(),
    );
    if (!r.ok) return { ok: false, text: grundSatz(r.grund) + NICHTS };
    const e = r.ergebnisse.find((x) => x.kategorie === zeile.kategorie);
    if (!e || !e.ok)
      return { ok: false, text: grundSatz(e ? e.grund : 'nicht-angekommen') + NICHTS };
    return { ok: true };
  } catch (e) {
    // Nur die Rechte oder die Kategorien waren nicht lesbar (`ladeVerfuegbarkeit` wirft dann) – vorübergehend oder 401.
    return { ok: false, text: fehlerMeldung(e).text + NICHTS };
  }
}

/** Der Anschluss an ChurchTools für diesen Start (Person, Rechte, Dienste). */
export function vertretungAnschluss(start: Start): VertretungAnschluss {
  const schritte = (d: EigenerDienst) => ({
    markieren: (v: Vertretung) => markiereVertretung(start, d, v),
    absagen: (kommentar: string) =>
      absagenNachZusage(
        dienstPort,
        { eventId: d.terminId, serviceId: d.ort.serviceId, index: d.ort.index },
        start.ichId,
        kommentar,
      ),
    senden: ctMailSenden,
    link: vertretungLink,
    jetzt: () => new Date().toISOString(),
  });
  return {
    lage: (d) => ladeLage(start, d),
    suchen: (a, d) => vertretungSuchen(a, schritte(d)),
    erneut: (a, bisher) => mailsErneut(a, bisher, { senden: ctMailSenden, link: vertretungLink }),
  };
}
