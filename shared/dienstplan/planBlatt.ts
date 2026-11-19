/**
 * **Das Plan-Blatt** (Bauplan E8-2/E8-4, Entwürfe `e8-teilen.html`, `e8-4-ansichten.html`) – was aus „Planen“ aufs geteilte
 * PDF kommt: **was** (der ganze Plan mit je einem Abschnitt je Gruppe, oder nur eine Gruppe, z. B. für den Gruppenchat) in
 * welcher **Ansicht**: „Termine × Dienste“ (je Gruppe eine Tabelle) oder „Personen × Termine“ (E8-4b: eine Tabelle über alle
 * gewählten Gruppen, je Eingeteilter eine Zeile, je nicht abgesagtem Termin eine Spalte, höchstens acht Termine je Tabelle;
 * gezählt wird mit `werWieOft`, nichts nachgebaut); „Je Person“ folgt in E8-4c. Geteilt werden die
 * Termine und Gruppen, die „Planen“ gerade zeigt; Entwürfe stehen nicht im Plan, aufs Blatt kommt also nur Gesendetes. Gezeichnet wird in `ui/teilen/planBlattPdf.ts` – mit
 * denselben Zellen wie das Termin-Blatt (`terminBlatt.ts`).
 */
import { MONATE, tagKurz, tagMonat, tagPunkt } from '../ct/datum';
import type { Lauf, Zelle } from '../ct/terminBlatt';
import { zaehleFrei } from './platzNachEntwurf';
import { gruppenName, type Plan, type PlanGruppe, type PlanPlatz, type PlanSpalte } from './plan';
import { werWieOft, type PersonEinsaetze } from './werWieOft';

/** Die Ansichten des Blatts – E8-4c ergänzt „Je Person“. */
export type PlanBlattAnsicht = 'termine' | 'personen';

/** **Was** geteilt wird – der ganze Plan oder eine Gruppe. */
export type PlanBlattWas =
  | { was: 'plan' }
  /** Eine Gruppe – Schlüssel wie im Filter von „Planen“ (`id` oder `null` für „Weitere Dienste“). */
  | { was: 'gruppe'; gruppe: number | null };

/** Die Wahl im Fenster „Plan teilen“: **was** (erste Reihe) in welcher **Ansicht** (zweite Reihe). */
export type PlanBlattWahl = PlanBlattWas & { ansicht: PlanBlattAnsicht };

export const PLAN_BLATT_STANDARD: PlanBlattWahl = { was: 'plan', ansicht: 'termine' };

/**
 * **Die gemerkte Wahl lesen** (`leseImGeraet`): nur bekannte Formen, sonst der ganze Plan. Bis E8-2 stand dort
 * `{ art: 'plan' | 'gruppe' | 'suchen', gruppe }` – `plan` und `gruppe` (mit der Gruppe) werden übernommen, „Wir suchen
 * noch …“ gibt es nicht mehr und wird zum ganzen Plan. Die Ansicht: `personen` bleibt, alles andere ist „Termine × Dienste“.
 */
export function planBlattWahlAus(roh: unknown): PlanBlattWahl {
  const r = (roh && typeof roh === 'object' ? roh : {}) as {
    was?: unknown;
    art?: unknown;
    gruppe?: unknown;
    ansicht?: unknown;
  };
  const was = r.was ?? r.art;
  const ansicht: PlanBlattAnsicht = r.ansicht === 'personen' ? 'personen' : 'termine';
  if (was === 'gruppe' && (typeof r.gruppe === 'number' || r.gruppe === null))
    return { was: 'gruppe', gruppe: r.gruppe, ansicht };
  return { ...PLAN_BLATT_STANDARD, ansicht };
}

export interface PlanBlattQuelle {
  plan: Plan;
  /** Die gezeigten Termine – Stellen in `plan.spalten`. */
  spalten: readonly number[];
  /** Die eingeblendeten Gruppen. */
  gruppen: readonly PlanGruppe[];
  gemeinde: string | null;
  app: string;
  stand: string;
}

export interface PlanBlattAbschnitt {
  /** Name der Gruppe über der Tabelle – nur beim ganzen Plan mit mehreren Gruppen. */
  titel: string | null;
  kopf: string[];
  zeilen: Zelle[][];
  /** „Personen × Termine“: die erste Spalte ist der Name, die letzte die schmale Summe (`planSpalten`). */
  personen?: true;
}

export interface PlanBlatt {
  titel: string;
  untertitel: string;
  gemeinde: string | null;
  app: string;
  stand: string;
  quer: boolean;
  abschnitte: PlanBlattAbschnitt[];
  /** Statt einer leeren Tabelle. */
  leer: string | null;
  dateiname: string;
}

/** Ab so vielen Spalten wird quer gedruckt – dieselbe Grenze wie die Druckliste (`ui/teilen/listenPdf.ts`). */
const QUER_AB = 6;

const gruppenId = (g: PlanGruppe) => g.gruppe?.id ?? null;

/** „8. November – 20. Dezember 2026“, im selben Jahr ohne Jahr vorn; ein Tag: „8. November 2026“. */
export function spanneLang(von: string, bis: string): string {
  const lang = (t: string) => `${Number(t.slice(8, 10))}. ${MONATE[Number(t.slice(5, 7)) - 1]}`;
  if (von === bis) return `${lang(von)} ${von.slice(0, 4)}`;
  const jahr = von.slice(0, 4) === bis.slice(0, 4) ? '' : ` ${von.slice(0, 4)}`;
  return `${lang(von)}${jahr} – ${lang(bis)} ${bis.slice(0, 4)}`;
}

/** Die Termin-Zelle: „So, 08.11. 10:00 Gottesdienst“, Datum fett, Uhrzeit grau; abgesagt grau dahinter. */
function terminZelle(s: PlanSpalte): Zelle {
  const laeufe: Lauf[] = [
    { text: tagKurz(s.tag), stil: 'fett' },
    { text: ` ${s.uhrzeit} `, stil: 'grau' },
    { text: s.name },
  ];
  if (s.abgesagt) laeufe.push({ text: ' (abgesagt)', stil: 'grau' });
  return { absaetze: [{ laeufe }] };
}

/**
 * Eine Dienst-Zelle: die Namen (angefragte grau mit „(angefragt)“), dahinter freie Plätze rot; verborgene Namen als
 * „besetzt“; ist der Dienst an diesem Termin nicht vorgesehen, ein graues „–“.
 */
export function dienstZelle(plaetze: readonly PlanPlatz[] | null): Zelle {
  if (!plaetze) return { absaetze: [{ laeufe: [{ text: '–', stil: 'grau' }] }] };
  const teile: Lauf[][] = [];
  for (const p of plaetze) {
    if (p.art === 'frei') continue;
    if (p.verborgen || !p.name) teile.push([{ text: 'besetzt', stil: 'grau' }]);
    else if (p.art === 'angefragt')
      teile.push([{ text: p.name }, { text: ' (angefragt)', stil: 'grau' }]);
    else teile.push([{ text: p.name }]);
  }
  // Teilen/PDF: bewusst nur der Stand in ChurchTools – ein Entwurf ist noch nicht verbindlich (`platzNachEntwurf.ts`).
  const frei = zaehleFrei(plaetze);
  if (frei > 0) teile.push([{ text: frei > 1 ? `${frei} frei` : 'frei', stil: 'rot' }]);
  const laeufe = teile.flatMap((t, i) => (i === 0 ? t : [{ text: ', ' }, ...t]));
  return { absaetze: [{ laeufe }] };
}

/** Eine Gruppe als Tabelle: nur ihre Termine, nur Dienste, die an einem davon vorgesehen sind. */
function gruppenAbschnitt(
  plan: Plan,
  spalten: readonly number[],
  g: PlanGruppe,
  titel: string | null,
): PlanBlattAbschnitt | null {
  const termine = spalten.filter((i) => g.frei[i] !== null && g.frei[i] !== undefined);
  const dienste = g.zeilen.filter((z) => termine.some((i) => z.zellen[i]));
  if (termine.length === 0 || dienste.length === 0) return null;
  return {
    titel,
    kopf: ['Termin', ...dienste.map((z) => z.dienst.name)],
    zeilen: termine.map((i) => [
      terminZelle(plan.spalten[i]),
      ...dienste.map((z) => dienstZelle(z.zellen[i])),
    ]),
  };
}

/**
 * Höchstens so viele Termine je Tabelle der Ansicht „Personen × Termine“ – darüber wird in Blöcke geteilt. Bei zehn
 * stießen auf A4 quer die Köpfe mit Uhrzeit („SO, 13.12. 18:00“) aneinander (Probe 19.11.2026); bei acht bleiben je
 * Termin gut 25 mm.
 */
export const PERSONEN_TERMINE_MAX = 8;

/**
 * Die Termin-Köpfe der Personen-Tabelle: „So, 06.12.“; kommt derselbe Tag in DIESER Tabelle mehrfach vor, steht bei diesen
 * Spalten die Uhrzeit dahinter („So, 06.12. 18:00“). Der Kopf ist einzeilig – kein Terminname.
 */
function personenKoepfe(plan: Plan, spalten: readonly number[]): string[] {
  const proTag = new Map<string, number>();
  for (const i of spalten)
    proTag.set(plan.spalten[i].tag, (proTag.get(plan.spalten[i].tag) ?? 0) + 1);
  return spalten.map((i) => {
    const s = plan.spalten[i];
    return (proTag.get(s.tag) ?? 0) > 1 ? `${tagKurz(s.tag)} ${s.uhrzeit}` : tagKurz(s.tag);
  });
}

/** Die Zelle einer Person an einem Termin: ihre Dienste mit „, “, angefragte wie in `dienstZelle` grau; sonst leer. */
function personenZelle(p: PersonEinsaetze, spalte: PlanSpalte): Zelle {
  const teile = p.einsaetze
    .filter((e) => e.spalte === spalte)
    .map((e): Lauf[] =>
      e.zugesagt
        ? [{ text: e.dienst }]
        : [{ text: e.dienst }, { text: ' (angefragt)', stil: 'grau' }],
    );
  const laeufe = teile.flatMap((t, i) => (i === 0 ? t : [{ text: ', ' }, ...t]));
  return { absaetze: [{ laeufe }] };
}

/** Eine Personen-Tabelle für höchstens acht Termine; `null`, wenn in ihnen niemand eingeteilt ist. */
function personenAbschnitt(
  plan: Plan,
  spalten: readonly number[],
  gruppen: readonly PlanGruppe[],
  titel: string | null,
): PlanBlattAbschnitt | null {
  // Die Zählung ist die von „Wer wie oft?“ – hier nur auf die Termine dieser Tabelle begrenzt.
  const { personen } = werWieOft(plan, { spalten: [...spalten], gruppen });
  if (personen.length === 0) return null;
  personen.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return {
    titel,
    personen: true,
    kopf: ['Person', ...personenKoepfe(plan, spalten), 'Dienste'],
    zeilen: personen.map((p) => [
      { absaetze: [{ laeufe: [{ text: p.name, stil: 'fett' }] }] },
      ...spalten.map((i) => personenZelle(p, plan.spalten[i])),
      { absaetze: [{ laeufe: [{ text: String(p.einsaetze.length) }] }] },
    ]),
  };
}

/** **Das Blatt bauen** – alles, was gezeichnet wird, steht danach fest. */
export function planBlatt(q: PlanBlattQuelle, wahl: PlanBlattWahl): PlanBlatt {
  const tage = q.spalten.map((i) => q.plan.spalten[i].tag).sort();
  const von = tage[0] ?? '';
  const bis = tage[tage.length - 1] ?? '';
  const untertitel = von ? spanneLang(von, bis) : '';
  const datei = von ? `${tagMonat(von)}-${tagPunkt(bis)}` : '';
  const kopf = { untertitel, gemeinde: q.gemeinde, app: q.app, stand: q.stand };

  const gruppen =
    wahl.was === 'gruppe' ? q.gruppen.filter((g) => gruppenId(g) === wahl.gruppe) : q.gruppen;
  const dienstTitel =
    wahl.was === 'gruppe' && gruppen[0] ? `Dienstplan ${gruppenName(gruppen[0])}` : 'Dienstplan';
  if (wahl.ansicht === 'personen') {
    // Abgesagte Termine gibt es in dieser Ansicht nicht; Spalten sind nach Zeit sortiert (`planAus`).
    const termine = q.spalten.filter((i) => !q.plan.spalten[i].abgesagt);
    const bloecke: number[][] = [];
    for (let k = 0; k < termine.length; k += PERSONEN_TERMINE_MAX)
      bloecke.push(termine.slice(k, k + PERSONEN_TERMINE_MAX));
    const tabellen = bloecke.flatMap((b) => {
      const tage = b.map((i) => q.plan.spalten[i].tag);
      const a = personenAbschnitt(
        q.plan,
        b,
        gruppen,
        bloecke.length > 1 ? spanneLang(tage[0], tage[tage.length - 1]) : null,
      );
      return a ? [a] : [];
    });
    return {
      ...kopf,
      untertitel: untertitel ? `${untertitel} · Personen × Termine` : '',
      titel: dienstTitel,
      quer: tabellen.some((a) => a.kopf.length >= QUER_AB),
      abschnitte: tabellen,
      leer: tabellen.length > 0 ? null : 'In diesem Zeitraum ist niemand eingeteilt.',
      dateiname: `${dienstTitel} Personen ${datei}`.trim(),
    };
  }
  const mitTitel = wahl.was === 'plan' && gruppen.length > 1;
  const abschnitte = gruppen.flatMap((g) => {
    const a = gruppenAbschnitt(q.plan, q.spalten, g, mitTitel ? gruppenName(g) : null);
    return a ? [a] : [];
  });
  const titel = dienstTitel;
  return {
    ...kopf,
    titel,
    quer: abschnitte.some((a) => a.kopf.length >= QUER_AB),
    abschnitte,
    leer: abschnitte.length > 0 ? null : 'In diesem Zeitraum sind keine Dienste vorgesehen.',
    dateiname: `${titel} ${datei}`.trim(),
  };
}
