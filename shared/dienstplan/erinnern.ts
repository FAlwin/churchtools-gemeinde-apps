/**
 * **„Erinnern“ – wer hat noch nicht geantwortet?** (Bauplan E5c-5, Entwurf `e5c-5-erinnern.html`, Variante B): Der Planer
 * erinnert Mitglieder einer Dienstgruppe, die für Termine im gezeigten Zeitraum noch keine Antwort aus „Wann kann ich?“
 * eingetragen haben. Nur Rechnen und Texte – geladen wird in `dienstplaner/src`, verschickt in `erinnernSenden.ts`.
 *
 * **Fehlend** (Alwin, 19.11.2026): Mitglied einer Dienstgruppe, das für **mindestens einen** Termin weder Ja/Vielleicht noch
 * Nein hat. Termine: die gezeigten, **nicht in der Vergangenheit** (`tag >= heute`), nicht abgesagt, und nur solche, an denen
 * die Dienstgruppe Dienste hat. Dazu:
 * - **Eine „nur bestimmte Dienste“-Antwort zählt als beantwortet** (Ja/Vielleicht, auch wenn sie den Dienst nicht nennt).
 * - **Nein = Abwesenheit** aus ChurchTools (`decktTermin`, im Raster `RasterZelle.abwesend`) – dieselbe Regel wie überall.
 * - **Wer an dem Termin in dieser Gruppe schon eingeteilt ist** (zugesagt oder angefragt, in irgendeinem Dienst der
 *   Gruppe), zählt dort nicht als fehlend – er wird ja eingeplant (Vorgabe Alwins Hauptchat, 19.11.2026).
 * - **Pause (PL-3):** Wer in der **Personenliste dieser Dienstgruppe** an dem Termin pausiert (`pauseAm`, „bis“ einschließlich),
 *   zählt dort nicht als fehlend – ist dadurch nichts mehr offen, gibt es keine Mail. Eine Pause einer **anderen** Dienstgruppe
 *   wirkt hier nicht. Wie viele Personen deshalb ausgelassen werden, steht in `GruppenErgebnis.pausiert`. Antworten kann die
 *   Person trotzdem selbst – es wird nur nicht nachgefragt.
 *
 * **Nichts neu erfunden, nichts nachgebaut:** Mitglieder, Antworten und Abwesenheiten kommen aus `personenRaster` – derselben
 * Rechnung wie die Ansicht „Personen“, die die Zellen färbt. Was dort „Antwort“ oder „abwesend“ heißt, heißt es hier.
 *
 * **Unsichere Lage sperrt die Gruppe, statt zu raten** (`gruppeGrund`): Sind die Antworten oder die Abwesenheiten nicht
 * lesbar, die Mitglieder verborgen oder ein Laden gescheitert, wüsste man nicht, wer geantwortet hat – „keine Antwort“ wäre
 * dann geraten, und die Mail ginge an Leute, die längst geantwortet haben. Die Gruppe bleibt gesperrt, mit einem kurzen Grund.
 */
import { monatName, tagKurz } from '../ct/datum';
import { antwortenSichtbar, type PersonenAntworten } from './personenAntworten';
import type { PersonenDaten } from './personenDaten';
import { pauseAm, type Personenliste } from './personenliste';
import { istVorgesehen, personenRaster, rasterDienste } from './personenRaster';
import type { Plan, PlanGruppe, PlanSpalte } from './plan';

/** Ein Termin, wie die Mail ihn aufführt. */
export interface OffenerTermin {
  terminId: number;
  /** `YYYY-MM-DD` */
  tag: string;
  name: string;
  /** `HH:MM` */
  uhrzeit: string;
}

/** Eine Person, der in einer Dienstgruppe Antworten fehlen – mit ihren offenen Terminen in der Reihenfolge der Spalten. */
export interface Fehlende {
  personId: number;
  name: string;
  termine: OffenerTermin[];
}

/** Das Ergebnis je Dienstgruppe: gesperrt (mit Grund) oder die Fehlenden. */
export type GruppenErgebnis =
  | { art: 'gesperrt'; grund: string; nochmal: boolean }
  | {
      art: 'ok';
      personen: Fehlende[];
      /** Wer ohne Pause eine Mail bekäme (PL-3): `personId`s, denen **alle** offenen Termine wegen Pause entfallen. */
      pausiert: number[];
    };

/** Ein Empfänger über alle gewählten Gruppen: einmal, mit den vereinigten offenen Terminen und den Gruppen, in denen er fehlt. */
export interface Empfaenger {
  personId: number;
  name: string;
  /** Namen der Dienstgruppen, in denen die Person fehlt (Reihenfolge der Auswahl). */
  gruppen: string[];
  termine: OffenerTermin[];
}

const offenerTermin = (s: PlanSpalte): OffenerTermin => ({
  terminId: s.id,
  tag: s.tag,
  name: s.name,
  uhrzeit: s.uhrzeit,
});

/**
 * Die Spalten, an denen erinnert werden kann: aus den gezeigten (`spalten`) die, die nicht in der Vergangenheit liegen
 * (`tag >= heute` – ein Termin von heute zählt) und nicht abgesagt sind. In der Reihenfolge von `spalten`.
 */
export function erinnerSpalten(plan: Plan, spalten: readonly number[], heute: string): number[] {
  return spalten.filter((i) => {
    const s = plan.spalten[i];
    return s !== undefined && !s.abgesagt && s.tag >= heute;
  });
}

/**
 * Die Gruppe mit nur den Diensten, die an den gezeigten Terminen vorgesehen sind. `planAus` führt seit 20.11.2026 auch
 * planbare Dienste ohne einen Platz (zum Einschalten in „Planen“); „Erinnern“ fragt aber nur dort nach Antworten, wo
 * wirklich Dienste gebraucht werden – die Mitglieder eines Dienstes, den niemand vorgesehen hat, bekommen keine Mail.
 */
export function nurVorgesehene(plan: Plan, spalten: readonly number[], g: PlanGruppe): PlanGruppe {
  const zeilen = g.zeilen.filter((z) => istVorgesehen(plan, spalten, z));
  return zeilen.length === g.zeilen.length ? g : { ...g, zeilen };
}

/**
 * **Warum man diese Gruppe nicht beurteilen kann** – `null`, wenn die Lage klar ist. Der erste Grund gewinnt. Geprüft wird
 * für die Dienste, die an den Terminen vorkommen (`rasterDienste`, dieselben, für die „Personen“ lädt). `nochmal`: der Grund
 * ist vorübergehend (noch nicht geladen, ChurchTools hat nicht geantwortet) – „Erneut versuchen“ lohnt; die anderen sind
 * dauerhaft (Rechte).
 */
export function gruppeGrund(o: {
  plan: Plan;
  spalten: readonly number[];
  gruppe: PlanGruppe;
  daten: PersonenDaten;
  antworten: PersonenAntworten | null | undefined;
}): { grund: string; nochmal: boolean } | null {
  const id = o.gruppe.gruppe?.id ?? null;
  if (!antwortenSichtbar(o.antworten, id))
    return { grund: 'Antworten nicht sichtbar', nochmal: false };
  const dienste = rasterDienste(
    o.plan,
    [...o.spalten],
    [nurVorgesehene(o.plan, o.spalten, o.gruppe)],
  );
  const staende = dienste.flatMap((x) => x.zeile.dienst.gruppenIds.map((g) => o.daten.get(g)));
  if (staende.some((s) => s === undefined))
    return { grund: 'Mitglieder noch nicht geladen', nochmal: true };
  if (staende.some((s) => s?.art === 'fehler'))
    return { grund: 'ChurchTools hat nicht geantwortet', nochmal: true };
  if (staende.some((s) => s?.art === 'da' && s.mitglieder === 'verborgen'))
    return { grund: 'Mitglieder nicht sichtbar', nochmal: false };
  if (staende.some((s) => s?.art === 'da' && s.abwesenheiten === 'nichtSichtbar'))
    return { grund: 'Abwesenheiten nicht sichtbar', nochmal: false };
  return null;
}

/**
 * **Wem in dieser Dienstgruppe Antworten fehlen** (Regel oben). `spalten` sind die gezeigten Spalten (Indizes in
 * `plan.spalten`); gefiltert nach Zukunft und abgesagt wird hier (`erinnerSpalten`). `gruppe` ist die ganze Gruppe des Plans
 * (auch ausgeblendete Dienste – wer dort eingeteilt ist, ist eingeteilt).
 */
export function fehlendeInGruppe(o: {
  plan: Plan;
  spalten: readonly number[];
  gruppe: PlanGruppe;
  daten: PersonenDaten;
  antworten: PersonenAntworten | null | undefined;
  /** Heute, `YYYY-MM-DD` (Ortszeit der Gemeinde). */
  heute: string;
  /** Die Personenlisten je Dienstgruppe (PL-3: Pause). Ohne Angabe oder ohne Liste dieser Gruppe gilt keine Pause. */
  personenlisten?: ReadonlyMap<number, Personenliste>;
}): GruppenErgebnis {
  const spalten = erinnerSpalten(o.plan, o.spalten, o.heute);
  const grund = gruppeGrund({ ...o, spalten });
  if (grund !== null) return { art: 'gesperrt', ...grund };
  if (spalten.length === 0) return { art: 'ok', personen: [], pausiert: [] };
  // Die Liste dieser Dienstgruppe – eine Pause gilt nur für sie.
  const liste = o.gruppe.gruppe ? o.personenlisten?.get(o.gruppe.gruppe.id) : undefined;

  const raster = personenRaster({
    plan: o.plan,
    spalten,
    gruppen: [nurVorgesehene(o.plan, spalten, o.gruppe)],
    daten: o.daten,
    antworten: o.antworten ?? undefined,
  });

  const namen = new Map<number, string>();
  const mitglieder = new Set<number>();
  /** Je Spalte (Position in `spalten`): wer dort geantwortet hat (Antwort oder Abwesenheit) bzw. eingeteilt ist. */
  const beantwortet = spalten.map(() => new Set<number>());
  const eingeteilt = spalten.map(() => new Set<number>());
  for (const b of raster.blocks) {
    for (const r of b.zeilen) {
      if (r.mitglied) {
        mitglieder.add(r.personId);
        namen.set(r.personId, r.name);
      }
      r.zellen.forEach((z, pos) => {
        // „Nur bestimmte Dienste“ zählt als beantwortet: `antwort` ist da, auch wenn sie diesen Dienst nicht nennt.
        if (z.antwort !== null || z.abwesend !== null) beantwortet[pos].add(r.personId);
        if (z.zustand === 'zugesagt' || z.zustand === 'angefragt') eingeteilt[pos].add(r.personId);
      });
    }
  }
  // Die Gruppe hat an einem Termin Dienste, wenn dort mindestens ein Dienst Plätze hat (sonst „nicht vorgesehen“).
  const hatDienste = spalten.map((_, pos) => raster.blocks.some((b) => b.plaetze[pos].anzahl > 0));

  const personen: Fehlende[] = [];
  const pausiert: number[] = [];
  for (const personId of mitglieder) {
    const ohnePause = spalten.flatMap((i, pos) =>
      hatDienste[pos] && !beantwortet[pos].has(personId) && !eingeteilt[pos].has(personId)
        ? [offenerTermin(o.plan.spalten[i])]
        : [],
    );
    const termine = ohnePause.filter((t) => pauseAm(liste, personId, t.tag) === null);
    if (termine.length > 0)
      personen.push({ personId, name: namen.get(personId) ?? `Person ${personId}`, termine });
    else if (ohnePause.length > 0) pausiert.push(personId);
  }
  personen.sort((a, b) => a.name.localeCompare(b.name, 'de') || a.personId - b.personId);
  return { art: 'ok', personen, pausiert };
}

/**
 * **Die Empfänger über mehrere Gruppen**: jede Person einmal, mit den vereinigten offenen Terminen (ein Termin einmal,
 * nach Tag und Uhrzeit sortiert) und den Gruppen, in denen sie fehlt. Sortiert nach Name.
 */
export function empfaengerAus(
  ergebnisse: readonly { gruppe: string; personen: readonly Fehlende[] }[],
): Empfaenger[] {
  const je = new Map<number, Empfaenger>();
  for (const { gruppe, personen } of ergebnisse) {
    for (const p of personen) {
      const e = je.get(p.personId);
      if (!e) {
        je.set(p.personId, {
          personId: p.personId,
          name: p.name,
          gruppen: [gruppe],
          termine: [...p.termine],
        });
        continue;
      }
      if (!e.gruppen.includes(gruppe)) e.gruppen.push(gruppe);
      for (const t of p.termine)
        if (!e.termine.some((x) => x.terminId === t.terminId)) e.termine.push(t);
    }
  }
  return [...je.values()]
    .map((e) => ({
      ...e,
      termine: [...e.termine].sort(
        (a, b) =>
          a.tag.localeCompare(b.tag) ||
          a.uhrzeit.localeCompare(b.uhrzeit) ||
          a.terminId - b.terminId,
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de') || a.personId - b.personId);
}

/**
 * **Wie viele Personen wegen Pause keine Mail bekommen** (PL-3): wer in einer der gewählten Gruppen wegen Pause ausgelassen
 * wird, aber über eine andere Gruppe doch eine Mail bekommt, zählt nicht (er wird ja erinnert). Jede Person einmal.
 */
export function pausiertAusgelassen(
  ergebnisse: readonly { pausiert: readonly number[] }[],
  empfaenger: readonly Pick<Empfaenger, 'personId'>[],
): number {
  const bekommen = new Set(empfaenger.map((e) => e.personId));
  return new Set(ergebnisse.flatMap((e) => e.pausiert).filter((id) => !bekommen.has(id))).size;
}

// ── Die Mail ────────────────────────────────────────────────────────────────

/** Was vorgeschlagen wird – der Planer kann es im Fenster ändern. */
export const BETREFF_ALLGEMEIN = 'Wann kannst du? Bitte trag dich im Dienstplaner ein';

/**
 * Der Betreff-Vorschlag: liegen alle gemeinsamen offenen Termine in einem Monat, „Wann kannst du im Dezember?“ – sonst der
 * allgemeine.
 */
export function betreffStandard(termine: readonly Pick<OffenerTermin, 'tag'>[]): string {
  const monate = new Set(termine.map((t) => t.tag.slice(0, 7)));
  return monate.size === 1 ? `Wann kannst du im ${monatName(termine[0].tag)}?` : BETREFF_ALLGEMEIN;
}
export const EINLEITUNG_STANDARD =
  'für diese Termine fehlt noch deine Antwort. Bitte trag kurz ein, ob du kannst – Ja, Vielleicht oder Nein. Danke!';

/** Der Vorname aus „Vorname Nachname“ (ChurchTools `title`) – das erste Wort; ohne Namen „du“. */
export function vorname(name: string): string {
  return name.trim().split(/\s+/)[0] || 'du';
}

/** Text für HTML: `& < > " '` ersetzt – der Planer darf alles schreiben. */
export function htmlText(t: string): string {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** „So, 06.12. · Gottesdienst · 10:00 Uhr“ – eine Zeile der Terminliste (Mail und Fenster). */
export const terminZeile = (t: OffenerTermin): string =>
  `${tagKurz(t.tag)} · ${t.name} · ${t.uhrzeit} Uhr`;

/**
 * „So, 06.12. · Mi, 09.12.“ – die kurze Form im Fenster (Tag ohne Titel). Liegen zwei Termine am selben Tag (9 und 10:30 Uhr),
 * steht die Uhrzeit dabei – sonst stünde „So, 06.12. · So, 06.12.“ da (Probe Test-Instanz 19.11.2026).
 */
export const offenKurz = (termine: readonly OffenerTermin[]): string =>
  termine
    .map((t) =>
      termine.some((u) => u !== t && u.tag === t.tag)
        ? `${tagKurz(t.tag)} ${t.uhrzeit}`
        : tagKurz(t.tag),
    )
    .join(' · ');

/**
 * Der Knopf in der Mail – **inline gestylt** (Mailprogramme kennen kein CSS der App), wie in der Probe vom 19.11.2026.
 */
const KNOPF_STIL = [
  'display:inline-block',
  'background:#155dfc',
  'color:#ffffff',
  'padding:10px 16px',
  'border-radius:6px', // bewusst fest: Mail-Knopf, inline – dort gibt es keine App-Variablen
  'font-weight:bold',
  'text-decoration:none',
].join(';');

/** Der Knopf in einer Mail (HTML): `link` ist die volle Adresse – eine Stelle für „Erinnern“ und „Vertretung suchen“. */
export function mailKnopf(link: string, text: string): string {
  return `<a href="${htmlText(link)}" style="${KNOPF_STIL}">${htmlText(text)}</a>`;
}

/**
 * **Der Inhalt der Mail an eine Person** (HTML für `body` von `/events/send`): „Hallo <Vorname>,“, die Einleitung des
 * Planers (Zeilenumbrüche bleiben, HTML ist maskiert), ihre offenen Termine als Liste und der **eigene Knopf**
 * „Im Dienstplaner eintragen“ auf `link` (volle Adresse). ChurchTools hängt je Termin noch eigene Knöpfe an. **Dieselbe
 * Funktion für die Vorschau im Fenster und für den Versand** – was man sieht, wird verschickt.
 */
export function mailInhalt(o: {
  name: string;
  einleitung: string;
  termine: readonly OffenerTermin[];
  link: string;
}): string {
  const einleitung = o.einleitung
    .trim()
    .split(/\r?\n/)
    .map((z) => htmlText(z))
    .join('<br>');
  return [
    `<p>Hallo ${htmlText(vorname(o.name))},</p>`,
    einleitung ? `<p>${einleitung}</p>` : '',
    `<ul>${o.termine.map((t) => `<li>${htmlText(terminZeile(t))}</li>`).join('')}</ul>`,
    `<p>${mailKnopf(o.link, 'Im Dienstplaner eintragen')}</p>`,
  ].join('');
}

/** Der Betreff; ein leeres Feld fällt auf den allgemeinen Vorschlag zurück (ChurchTools verlangt einen). */
export const betreffAus = (betreff: string): string => betreff.trim() || BETREFF_ALLGEMEIN;
