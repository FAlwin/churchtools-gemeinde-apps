/**
 * **Das Plan-Blatt** (Bauplan E8-2, Entwurf `e8-teilen.html`) – was aus „Planen“ aufs geteilte PDF kommt: der ganze Plan
 * (je Gruppe ein Abschnitt), nur eine Gruppe (z. B. für den Gruppenchat) oder „Wir suchen noch …“ (nur die offenen
 * Dienste, ohne Namen – zum Rumschicken). Geteilt werden die Termine und Gruppen, die „Planen“ gerade zeigt; Entwürfe
 * stehen nicht im Plan, aufs Blatt kommt also nur Gesendetes. Gezeichnet wird in `ui/teilen/planBlattPdf.ts` – mit
 * denselben Zellen wie das Termin-Blatt (`terminBlatt.ts`).
 */
import { MONATE, tagKurz } from '../ct/datum';
import type { Lauf, Zelle } from '../ct/terminBlatt';
import { gruppenName, type Plan, type PlanGruppe, type PlanPlatz, type PlanSpalte } from './plan';

export type PlanBlattWahl =
  | { art: 'plan' }
  /** Eine Gruppe – Schlüssel wie im Filter von „Planen“ (`id` oder `null` für „Weitere Dienste“). */
  | { art: 'gruppe'; gruppe: number | null }
  | { art: 'suchen' };

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
}

export interface PlanBlatt {
  titel: string;
  untertitel: string;
  gemeinde: string | null;
  app: string;
  stand: string;
  quer: boolean;
  /** Eine Zeile über der Tabelle („Offene Dienste in …“). */
  oben: string | null;
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
  const frei = plaetze.filter((p) => p.art === 'frei').length;
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

/** „Wir suchen noch …“: je Termin die Dienste mit freien Plätzen („Gesang ×2“) – ohne Namen. */
function suchenAbschnitt(plan: Plan, spalten: readonly number[], gruppen: readonly PlanGruppe[]) {
  const zeilen: Zelle[][] = [];
  for (const i of spalten) {
    const gesucht = gruppen.flatMap((g) =>
      g.zeilen.flatMap((z) => {
        const frei = (z.zellen[i] ?? []).filter((p) => p.art === 'frei').length;
        return frei > 0 ? [`${z.dienst.name}${frei > 1 ? ` ×${frei}` : ''}`] : [];
      }),
    );
    if (gesucht.length === 0 || plan.spalten[i].abgesagt) continue;
    zeilen.push([
      terminZelle(plan.spalten[i]),
      { absaetze: [{ laeufe: [{ text: gesucht.join(', ') }] }] },
    ]);
  }
  return zeilen;
}

/** **Das Blatt bauen** – alles, was gezeichnet wird, steht danach fest. */
export function planBlatt(q: PlanBlattQuelle, wahl: PlanBlattWahl): PlanBlatt {
  const tage = q.spalten.map((i) => q.plan.spalten[i].tag).sort();
  const von = tage[0] ?? '';
  const bis = tage[tage.length - 1] ?? '';
  const untertitel = von ? spanneLang(von, bis) : '';
  const datei = von
    ? `${von.slice(8, 10)}.${von.slice(5, 7)}.-${bis.slice(8, 10)}.${bis.slice(5, 7)}.${bis.slice(0, 4)}`
    : '';
  const kopf = { untertitel, gemeinde: q.gemeinde, app: q.app, stand: q.stand };

  if (wahl.art === 'suchen') {
    const zeilen = suchenAbschnitt(q.plan, q.spalten, q.gruppen);
    return {
      ...kopf,
      titel: 'Wir suchen noch …',
      quer: false,
      oben: `Offene Dienste in ${q.gruppen.map(gruppenName).join(', ')} – wer kann? Bitte bei der Gruppenleitung melden.`,
      abschnitte: zeilen.length > 0 ? [{ titel: null, kopf: ['Termin', 'Gesucht'], zeilen }] : [],
      leer: zeilen.length > 0 ? null : 'Alles besetzt – in diesem Zeitraum ist kein Dienst frei.',
      dateiname: `Wir suchen noch ${datei}`.trim(),
    };
  }

  const gruppen =
    wahl.art === 'gruppe' ? q.gruppen.filter((g) => gruppenId(g) === wahl.gruppe) : q.gruppen;
  const mitTitel = wahl.art === 'plan' && gruppen.length > 1;
  const abschnitte = gruppen.flatMap((g) => {
    const a = gruppenAbschnitt(q.plan, q.spalten, g, mitTitel ? gruppenName(g) : null);
    return a ? [a] : [];
  });
  const titel =
    wahl.art === 'gruppe' && gruppen[0] ? `Dienstplan ${gruppenName(gruppen[0])}` : 'Dienstplan';
  return {
    ...kopf,
    titel,
    quer: abschnitte.some((a) => a.kopf.length >= QUER_AB),
    oben: null,
    abschnitte,
    leer: abschnitte.length > 0 ? null : 'In diesem Zeitraum sind keine Dienste vorgesehen.',
    dateiname: `${titel} ${datei}`.trim(),
  };
}
