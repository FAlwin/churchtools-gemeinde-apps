/**
 * **Das Plan-Blatt** (Bauplan E8-2/E8-4, Entwürfe `e8-teilen.html`, `e8-4-ansichten.html`) – was aus „Planen“ aufs geteilte
 * PDF kommt: **was** (der ganze Plan mit je einem Abschnitt je Gruppe, oder nur eine Gruppe, z. B. für den Gruppenchat) in
 * welcher **Ansicht** (Knöpfe „Termine“ · „Personen“ · „Je Person“): „Termine“ = Termine × Dienste (je Gruppe eine Tabelle),
 * „Personen“ = Personen × Termine (E8-4b: eine Tabelle über alle gewählten Gruppen, je Eingeteilter eine Zeile, je nicht
 * abgesagtem Termin eine Spalte, höchstens acht Termine je Tabelle) und „Je Person“ (E8-4c: je Eingeteilter ein Abschnitt
 * mit seinen Terminen, auf einer eigenen Seite oder alle untereinander). Gezählt wird in beiden Personen-Ansichten mit
 * `werWieOft`, abgesagte Termine fehlen in beiden (`personenTermine`) – nichts nachgebaut. Geteilt werden die
 * Termine und Gruppen, die „Planen“ gerade zeigt; Entwürfe stehen nicht im Plan, aufs Blatt kommt also nur Gesendetes. Gezeichnet wird in `ui/teilen/planBlattPdf.ts` – mit
 * denselben Zellen wie das Termin-Blatt (`terminBlatt.ts`).
 */
import { datumText, MONATE, tagKurz, tagMonat, tagPunkt } from '../ct/datum';
import type { Lauf, Zelle } from '../ct/terminBlatt';
import { zaehleFrei } from './platzNachEntwurf';
import { gruppenName, type Plan, type PlanGruppe, type PlanPlatz, type PlanSpalte } from './plan';
import { werWieOft, type Einsatz, type PersonEinsaetze } from './werWieOft';

/** Die Ansichten des Blatts: „Termine“ (Termine × Dienste), „Personen“ (Personen × Termine) und „Je Person“ (E8-4c). */
export type PlanBlattAnsicht = 'termine' | 'personen' | 'person';

/** „Je Person“: jede Person auf einer eigenen Seite (`seite`) oder alle untereinander (`alle`). */
export type PlanBlattSeiten = 'seite' | 'alle';

/** **Was** geteilt wird – der ganze Plan oder eine Gruppe. */
export type PlanBlattWas =
  | { was: 'plan' }
  /** Eine Gruppe – Schlüssel wie im Filter von „Planen“ (`id` oder `null` für „Weitere Dienste“). */
  | { was: 'gruppe'; gruppe: number | null };

/**
 * Die Wahl im Fenster „Plan teilen“: **was** (erste Reihe) in welcher **Ansicht** (zweite Reihe); bei „Je Person“ dazu die
 * **Seiten** (dritte Reihe) – sie bleiben Teil der Wahl, auch wenn gerade eine andere Ansicht steht.
 */
export type PlanBlattWahl = PlanBlattWas & { ansicht: PlanBlattAnsicht; seiten: PlanBlattSeiten };

export const PLAN_BLATT_STANDARD: PlanBlattWahl = {
  was: 'plan',
  ansicht: 'termine',
  seiten: 'seite',
};

/** Der Hinweis, wenn in den Personen-Ansichten niemand eingeteilt ist – eine Stelle für beide. */
const NIEMAND_EINGETEILT = 'In diesem Zeitraum ist niemand eingeteilt.';

/**
 * **Die gemerkte Wahl lesen** (`leseImGeraet`): nur bekannte Formen, sonst der ganze Plan. Bis E8-2 stand dort
 * `{ art: 'plan' | 'gruppe' | 'suchen', gruppe }` – `plan` und `gruppe` (mit der Gruppe) werden übernommen, „Wir suchen
 * noch …“ gibt es nicht mehr und wird zum ganzen Plan. Die Ansicht: `personen` und `person` bleiben, alles andere ist
 * „Termine“; die Seiten: `alle` bleibt, alles andere (auch fehlend, ältere Wahl) ist `seite`.
 */
export function planBlattWahlAus(roh: unknown): PlanBlattWahl {
  const r = (roh && typeof roh === 'object' ? roh : {}) as {
    was?: unknown;
    art?: unknown;
    gruppe?: unknown;
    ansicht?: unknown;
    seiten?: unknown;
  };
  const was = r.was ?? r.art;
  const ansicht: PlanBlattAnsicht =
    r.ansicht === 'personen' || r.ansicht === 'person' ? r.ansicht : 'termine';
  const seiten: PlanBlattSeiten = r.seiten === 'alle' ? 'alle' : 'seite';
  if (was === 'gruppe' && (typeof r.gruppe === 'number' || r.gruppe === null))
    return { was: 'gruppe', gruppe: r.gruppe, ansicht, seiten };
  return { ...PLAN_BLATT_STANDARD, ansicht, seiten };
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
  /** „Personen“: die erste Spalte ist der Name, die letzte die schmale Summe (`planSpalten`). */
  personen?: true;
  /** „Je Person“: Datum · Uhrzeit · Termin · Dienst (`planSpalten`); der Titel ist der Name. */
  person?: true;
  /** Grauer Text hinter dem Titel im Band („8 Dienste“). */
  zusatz?: string;
  /** „Je Person“ mit „Eine Seite je Person“: dieser Abschnitt beginnt auf einer neuen Seite (der erste nicht). */
  neueSeite?: true;
  /** „Je Person“ mit „Untereinander“: der Abschnitt wird nicht über eine Seite geteilt, solange er auf eine Seite passt. */
  zusammen?: true;
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
  const personen = eingeteilte(plan, spalten, gruppen);
  if (personen.length === 0) return null;
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

/**
 * Die Termine der Personen-Ansichten („Personen“ und „Je Person“): die gezeigten ohne abgesagte. **Die eine Stelle für
 * diese Regel.** Spalten sind nach Zeit sortiert (`planAus`).
 */
function personenTermine(q: PlanBlattQuelle): number[] {
  return q.spalten.filter((i) => !q.plan.spalten[i].abgesagt);
}

/** Die Eingeteilten in den gegebenen Terminen und Gruppen – gezählt von `werWieOft`, alphabetisch („deutsch“ sortiert). */
function eingeteilte(
  plan: Plan,
  spalten: readonly number[],
  gruppen: readonly PlanGruppe[],
): PersonEinsaetze[] {
  const { personen } = werWieOft(plan, { spalten: [...spalten], gruppen });
  return personen.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** „Je Person“: ein Abschnitt mit den Terminen einer Person – ein Termin eine Zeile, mehrere Dienste darin untereinander. */
function personAbschnitt(p: PersonEinsaetze, mitGruppe: boolean): PlanBlattAbschnitt {
  const nachTermin = new Map<PlanSpalte, Einsatz[]>();
  // Die Einsätze sind schon nach Zeit sortiert (`werWieOft`).
  for (const e of p.einsaetze) nachTermin.set(e.spalte, [...(nachTermin.get(e.spalte) ?? []), e]);
  const einfach = (laeufe: Lauf[]): Zelle => ({ absaetze: [{ laeufe }] });
  return {
    titel: p.name,
    person: true,
    zusatz: `${p.einsaetze.length} ${p.einsaetze.length === 1 ? 'Dienst' : 'Dienste'}`,
    kopf: ['Datum', 'Uhrzeit', 'Termin', 'Dienst'],
    zeilen: [...nachTermin].map(([s, eins]) => [
      einfach([{ text: datumText(s.tag), stil: 'fett' }]),
      einfach([{ text: s.uhrzeit }]),
      einfach([{ text: s.name }]),
      {
        absaetze: eins.map((e) => ({
          laeufe: [
            { text: e.dienst },
            ...(e.zugesagt ? [] : [{ text: ' (angefragt)', stil: 'grau' as const }]),
            ...(mitGruppe ? [{ text: ` · ${e.gruppe}`, stil: 'grau' as const }] : []),
          ],
        })),
      },
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
  if (wahl.ansicht === 'person') {
    const personen = eingeteilte(q.plan, personenTermine(q), gruppen);
    const abschnitte = personen.map((p, k): PlanBlattAbschnitt => {
      const a = personAbschnitt(p, wahl.was === 'plan');
      if (wahl.seiten === 'alle') a.zusammen = true;
      else if (k > 0) a.neueSeite = true;
      return a;
    });
    return {
      ...kopf,
      untertitel: untertitel ? `${untertitel} · Je Person` : '',
      titel: dienstTitel,
      quer: false,
      abschnitte,
      leer: abschnitte.length > 0 ? null : NIEMAND_EINGETEILT,
      dateiname: `${dienstTitel} je Person ${datei}`.trim(),
    };
  }
  if (wahl.ansicht === 'personen') {
    // Abgesagte Termine gibt es in dieser Ansicht nicht.
    const termine = personenTermine(q);
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
      leer: tabellen.length > 0 ? null : NIEMAND_EINGETEILT,
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
