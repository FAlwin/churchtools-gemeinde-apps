/**
 * **Abfragen mit Frist + Erinnerungsplan** (Bauplan R-1, Kern ohne Oberfläche, Alwin 25.11.2026): Ein Planer startet je
 * Dienstgruppe eine **Abfrage** – Zeitraum (`von`–`bis`), **Frist**, an der die Antworten da sein sollen, und ein Tag, an
 * dem sie **öffnet**. Mitarbeitende antworten bis zur Frist in „Wann kann ich?“; erinnert wird nach einem je Dienstgruppe
 * einstellbaren **Erinnerungsplan**. Hier stehen nur Typen und Regeln – gespeichert wird in `abfragenSpeicher.ts`, „offen“
 * rechnet `offeneTermine` in `erinnern.ts`.
 *
 * **Tage** sind überall `YYYY-MM-DD` in der Ortszeit der Gemeinde; gerechnet wird mit `shared/ct/datum.ts`.
 *
 * **Zustand einer Abfrage** (`abfrageZustand`): geplant (vor „öffnen“) · offen (bis einschließlich Frist) · Frist vorbei
 * (bis der Zeitraum beginnt – die Karte bleibt rot) · beendet (Zeitraum beginnt, oder ein Planer hat sie beendet).
 *
 * **Eine Stelle für „Was passiert wann“: `erinnerungsTage`.** Aus ihr kommen die Vorschau für den Planer und – später – die
 * Schritte der ChurchTools-Routine; beide dürfen die Regeln nicht noch einmal rechnen.
 */
import { z } from 'zod';
import { plusTage } from '../ct/datum';

/** Eine Abfrage einer Dienstgruppe. Alle Tage `YYYY-MM-DD`. */
export interface Abfrage {
  id: string;
  /** Beginn des abgefragten Zeitraums. */
  von: string;
  /** Ende des abgefragten Zeitraums. */
  bis: string;
  /** Bis hierhin (einschließlich) sollen die Antworten da sein. Immer vor `von`. */
  frist: string;
  /** Ab hier ist die Abfrage offen (Karte, erste Mail). Höchstens die Frist. */
  oeffnen: string;
  /** Die Termin-IDs, die beim Start im Zeitraum lagen (`termineFuerAbfrage`) – später hinzugekommene gehören nicht dazu. */
  termine: number[];
  gestartet: { personId: number; name: string; zeit: string };
  /** Der Tag, an dem ein Planer sie beendet hat – `null`: läuft, bis der Zeitraum beginnt. */
  beendet: string | null;
}

/** Wann erinnert wird – ein Punkt je Regel; `erinnerungsTage` macht daraus Tage. */
export type Erinnerungspunkt =
  /** Am Tag, an dem die Abfrage öffnet. */
  | { art: 'oeffnen' }
  /** `tage` Tage vor der Frist. */
  | { art: 'vorFrist'; tage: number }
  /** Am Tag der Frist. */
  | { art: 'frist' }
  /** Nach der Frist alle `alleTage` Tage, insgesamt höchstens `hoechstens` Mal. */
  | { art: 'nachFrist'; alleTage: number; hoechstens: number };

/** Der Erinnerungsplan einer Dienstgruppe. `mail: null` = der Standardtext. */
export interface Erinnerungsplan {
  punkte: Erinnerungspunkt[];
  mail: { betreff: string; text: string } | null;
}

/** Beim Öffnen, 2 Tage vor der Frist, am Tag der Frist, danach jeden Tag höchstens 3-mal. */
export const STANDARD_PLAN: Erinnerungsplan = {
  punkte: [
    { art: 'oeffnen' },
    { art: 'vorFrist', tage: 2 },
    { art: 'frist' },
    { art: 'nachFrist', alleTage: 1, hoechstens: 3 },
  ],
  mail: null,
};

/**
 * Was die Einrichtung „Erinnerungen in ChurchTools“ (R-5a) angelegt hat: die Hilfsgruppe und die Routine daran. Beide
 * Nummern stehen hier, damit die App sie wiederfindet – gesucht wird nie nach dem Namen allein.
 */
export interface Einrichtung {
  gruppeId: number;
  routineId: number;
}

/**
 * Das Dokument je Dienstgruppe: der eigene Plan (`null` = `STANDARD_PLAN`), die Abfragen (Liste, anfangs höchstens eine) und
 * die Einrichtung in ChurchTools (`null` = noch nicht eingerichtet).
 */
export interface AbfragenInhalt {
  plan: Erinnerungsplan | null;
  abfragen: Abfrage[];
  einrichtung: Einrichtung | null;
}

/** Der Plan, der gilt: der eigene oder der Standard. */
export const geltenderPlan = (inhalt: Pick<AbfragenInhalt, 'plan'>): Erinnerungsplan =>
  inhalt.plan ?? STANDARD_PLAN;

// ── Lesen: streng, nie halb ─────────────────────────────────────────────────

/** Grenzen (auch für die Oberfläche in R-2/R-4): Wie oft und wie weit erinnert werden darf. */
export const GRENZEN = {
  /** `tage` (vor der Frist) und `alleTage` (nach der Frist). */
  tage: { min: 1, max: 60 },
  hoechstens: { min: 1, max: 14 },
  punkte: 10,
  /** Mehr als zehn Abfragen je Dienstgruppe sind keine Liste, sondern ein Fehler (beendete räumt die Oberfläche auf). */
  abfragen: 10,
  /** Termine einer Abfrage; die wirkliche Grenze ist `MAX_ZEICHEN` des Speichers (`zu-gross` beim Speichern). */
  termine: 300,
  betreff: 200,
  mailText: 2000,
  name: 200,
} as const;

/** Ein echter Kalendertag in der Form `YYYY-MM-DD` (nicht `2026-02-30`, nicht `2026-2-3`). */
const tagSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((t) => !Number.isNaN(Date.parse(`${t}T00:00:00Z`)) && plusTage(t, 0) === t);

const ganz = (g: { min: number; max: number }) => z.number().int().min(g.min).max(g.max);

const punktSchema = z.discriminatedUnion('art', [
  z.strictObject({ art: z.literal('oeffnen') }),
  z.strictObject({ art: z.literal('vorFrist'), tage: ganz(GRENZEN.tage) }),
  z.strictObject({ art: z.literal('frist') }),
  z.strictObject({
    art: z.literal('nachFrist'),
    alleTage: ganz(GRENZEN.tage),
    hoechstens: ganz(GRENZEN.hoechstens),
  }),
]);

const planSchema = z.strictObject({
  punkte: z.array(punktSchema).max(GRENZEN.punkte),
  mail: z
    .strictObject({
      betreff: z.string().trim().min(1).max(GRENZEN.betreff),
      text: z.string().trim().min(1).max(GRENZEN.mailText),
    })
    .nullable(),
});

/**
 * Eine Abfrage muss in sich stimmen: `von <= bis` (ein Zeitraum), `oeffnen <= frist` (sonst gäbe es nie „offen“) und
 * **`frist < von`** – die Antworten sollen da sein, bevor der Zeitraum beginnt. Mit `frist >= von` gäbe es keinen Zustand
 * „Frist vorbei“, und `abfrageZustand` hielte die Abfrage am Tag der Frist schon für beendet; so etwas legt die Oberfläche
 * nicht an, also ist es beim Lesen ein Zeichen für beschädigte Daten.
 */
const abfrageSchema = z
  .strictObject({
    id: z.string().min(1).max(64),
    von: tagSchema,
    bis: tagSchema,
    frist: tagSchema,
    oeffnen: tagSchema,
    termine: z.array(z.number().int().positive()).max(GRENZEN.termine),
    gestartet: z.strictObject({
      personId: z.number().int().positive(),
      name: z.string().max(GRENZEN.name),
      zeit: z.string().min(1).max(40),
    }),
    beendet: tagSchema.nullable(),
  })
  .refine((a) => a.von <= a.bis && a.oeffnen <= a.frist && a.frist < a.von);

const einrichtungSchema = z.strictObject({
  gruppeId: z.number().int().positive(),
  routineId: z.number().int().positive(),
});

const inhaltSchema = z
  .strictObject({
    plan: planSchema.nullable(),
    abfragen: z.array(abfrageSchema).max(GRENZEN.abfragen),
    // **Das einzige Feld, das beim Lesen fehlen darf** (R-5a, 25.11.2026): Dokumente aus R-1 bis R-4 (nur in Test-Instanzen,
    // nichts davon ist veröffentlicht) kennen es nicht und gelten als „nicht eingerichtet“. Fassung 1 bleibt; alles andere
    // – auch ein unbekanntes Feld, auch eines in `einrichtung` – macht den Wert weiter unlesbar. Geschrieben wird es immer.
    einrichtung: einrichtungSchema.nullable().default(null),
  })
  // Die ID macht eine Abfrage kenntlich (später je Abfrage eine Hilfsgruppe): doppelte gibt es nicht.
  .refine((i) => new Set(i.abfragen.map((a) => a.id)).size === i.abfragen.length);

/**
 * Ein gespeicherter Inhalt – `null`, wenn er nicht dieses Format hat (andere Fassung, beschädigt, von Hand geändert).
 * **Nie halb gelesen:** Ein einziger Fehler (auch ein unbekanntes Feld) macht den ganzen Wert unlesbar; der Speicher
 * meldet das als `unlesbar`, es gilt der Standard.
 */
export function abfragenAus(roh: unknown): AbfragenInhalt | null {
  const r = inhaltSchema.safeParse(roh);
  return r.success ? r.data : null;
}

// ── Zustand ─────────────────────────────────────────────────────────────────

export type AbfrageZustand = 'geplant' | 'offen' | 'fristVorbei' | 'beendet';

/**
 * Wo die Abfrage `heute` steht. **Beendet** zuerst: ab dem Tag, an dem der Zeitraum beginnt (`heute >= von`), oder wenn
 * sie beendet wurde. Sonst: vor `oeffnen` geplant, bis einschließlich `frist` offen, danach „Frist vorbei“.
 */
export function abfrageZustand(a: Abfrage, heute: string): AbfrageZustand {
  if (a.beendet !== null || heute >= a.von) return 'beendet';
  if (heute < a.oeffnen) return 'geplant';
  if (heute <= a.frist) return 'offen';
  return 'fristVorbei';
}

/**
 * Die eine Abfrage, die noch nicht beendet ist – `null`, wenn keine läuft. Anfangs gibt es höchstens eine je Dienstgruppe;
 * das Modell ist eine Liste, damit später mehrere gehen. Gäbe es doch mehrere, gilt die erste der Liste.
 */
export function laufendeAbfrage(
  inhalt: Pick<AbfragenInhalt, 'abfragen'>,
  heute: string,
): Abfrage | null {
  return inhalt.abfragen.find((a) => abfrageZustand(a, heute) !== 'beendet') ?? null;
}

// ── Erinnerungstage: DIE Regel für „Was passiert wann“ ──────────────────────

/**
 * **An welchen Tagen erinnert wird** – aufsteigend, jeder Tag einmal (`YYYY-MM-DD`).
 *
 * Aus jedem Punkt des Plans werden Tage:
 * - `oeffnen` → der Tag `oeffnen`;
 * - `vorFrist n` → `frist` − n Tage;
 * - `frist` → der Tag `frist`;
 * - `nachFrist k, m` → `frist` + k, + 2k, … – höchstens m Tage.
 *
 * Danach fallen weg:
 * - **Tage vor `oeffnen`** – vor dem Öffnen gibt es nichts zu beantworten (ein „2 Tage vor der Frist“ bei kurzer Laufzeit
 *   würde sonst vor der Öffnungs-Mail kommen);
 * - **Tage ab `von`** – dann beginnt der Zeitraum und die Abfrage endet; nur Tage **strikt davor** zählen;
 * - **Tage vor `heute`** – ChurchTools-Routinen lassen „warten bis heute oder früher“ sofort durchlaufen; blieben vergangene
 *   Tage stehen, gingen mehrere Mails auf einmal raus (gemessen A9). **Der Tag `heute` zählt mit**: Ist heute der
 *   Öffnen-Tag, geht die Mail beim Eintragen sofort raus.
 *
 * Eine beendete Abfrage (`beendet` gesetzt) erinnert nie. Der Plan kommt fertig herein (`geltenderPlan` macht aus „kein
 * eigener Plan“ den Standard); ein leerer Plan ergibt keine Tage.
 */
export function erinnerungsTage(plan: Erinnerungsplan, abfrage: Abfrage, heute: string): string[] {
  if (abfrage.beendet !== null) return [];
  const { frist, oeffnen, von } = abfrage;
  const tage = plan.punkte.flatMap((p): string[] => {
    switch (p.art) {
      case 'oeffnen':
        return [oeffnen];
      case 'vorFrist':
        return [plusTage(frist, -p.tage)];
      case 'frist':
        return [frist];
      case 'nachFrist':
        return Array.from({ length: p.hoechstens }, (_, i) =>
          plusTage(frist, (i + 1) * p.alleTage),
        );
    }
  });
  return [...new Set(tage)].filter((t) => t >= oeffnen && t < von && t >= heute).sort();
}
