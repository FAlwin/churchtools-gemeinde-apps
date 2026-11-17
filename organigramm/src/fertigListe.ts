/**
 * **Die Liste im Schritt „Fertig“** (Bauplan O9-5d, Entwurf `o9-5-einrichten-v1`, `schritt3()`): aus den Ergebnissen des
 * Schreibens eine Zeile je Baustein – ✓ mit „nachgelesen“, ✗ mit dem Grund, „offen“, wo es nicht mehr dazu kam. Gleiche
 * Schritte hintereinander (vier Wechsel-Gruppen, neun Regelsätze) stehen als EINE Zeile mit Zahl; ein Fehler steht
 * immer allein und mit dem Namen der Gruppe. Reine Rechnung, ohne Oberfläche.
 */
import type { PlanSchritt, SchrittArt } from '@shared/organigramm/einrichtungPlan';
import type { Ausgang, Lauf, SchrittErgebnis } from './einrichtenSchreiben';

export interface FertigZeile {
  zeichen: 'ok' | 'fehler' | 'offen';
  titel: string;
  text: string;
}

const mehr = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;

/** Der Titel einer erledigten Zeile mit `n` Schritten. */
const FERTIG: Record<SchrittArt, (n: number) => string> = {
  typ: () => 'Gruppentyp „Gruppenwechsel“ angelegt',
  rechte: () => 'Rechte der Leitung gesetzt',
  wechselGruppe: (n) => `${mehr(n, 'Wechsel-Gruppe', 'Wechsel-Gruppen')} angelegt`,
  routine: (n) => `${mehr(n, 'Routine', 'Routinen')} eingerichtet`,
  regelnWechselGruppe: (n) =>
    `Regeln in ${mehr(n, 'Wechsel-Gruppe', 'Wechsel-Gruppen')} geschrieben`,
  statusWechselGruppe: (n) => `${mehr(n, 'Wechsel-Gruppe', 'Wechsel-Gruppen')} eingeschaltet`,
  regelnStufe: (n) => `Regeln in ${mehr(n, 'Kindergruppe', 'Kindergruppen')} geschrieben`,
  statusStufe: (n) => `${mehr(n, 'Kindergruppe', 'Kindergruppen')} eingeschaltet`,
  regelnEntfernen: (n) =>
    `Unsere Regeln in ${mehr(n, 'Gruppe', 'Gruppen')} entfernt, die nicht mehr dazugehört`,
  neuBerechnen: () => 'Neu berechnet',
  speichern: () => 'Einrichtung gespeichert',
};

/** Der Titel einer offenen Zeile mit `n` Schritten. */
const OFFEN: Record<SchrittArt, (n: number) => string> = {
  typ: () => 'Gruppentyp „Gruppenwechsel“',
  rechte: () => 'Rechte der Leitung',
  wechselGruppe: (n) => mehr(n, 'Wechsel-Gruppe', 'Wechsel-Gruppen'),
  routine: (n) => mehr(n, 'Routine', 'Routinen'),
  regelnWechselGruppe: (n) => `Regeln in ${mehr(n, 'Wechsel-Gruppe', 'Wechsel-Gruppen')}`,
  statusWechselGruppe: (n) => `${mehr(n, 'Wechsel-Gruppe', 'Wechsel-Gruppen')} einschalten`,
  regelnStufe: (n) => `Regeln in ${mehr(n, 'Kindergruppe', 'Kindergruppen')}`,
  statusStufe: (n) => `${mehr(n, 'Kindergruppe', 'Kindergruppen')} einschalten`,
  regelnEntfernen: (n) => `Unsere Regeln in ${mehr(n, 'alten Gruppe', 'alten Gruppen')} entfernen`,
  neuBerechnen: () => 'Neu berechnen',
  speichern: () => 'Einrichtung speichern',
};

const name = (s: PlanSchritt): string =>
  'name' in s.ziel ? `„${(s.ziel as { name: string }).name}“` : '';

/** Der Titel einer Fehlerzeile – mit dem Namen der Gruppe, damit man weiß, wo es hakt. */
function fehlerTitel(s: PlanSchritt): string {
  switch (s.art) {
    case 'typ':
      return 'Gruppentyp „Gruppenwechsel“';
    case 'rechte':
      return 'Rechte der Leitung';
    case 'wechselGruppe':
      return `Wechsel-Gruppe ${name(s)}`;
    case 'routine':
      return `Routine in ${name(s)}`;
    case 'regelnWechselGruppe':
    case 'regelnStufe':
    case 'regelnEntfernen':
      return `Regeln in ${name(s)}`;
    case 'statusWechselGruppe':
    case 'statusStufe':
      return `Einschalten von ${name(s)}`;
    case 'neuBerechnen':
      return `Neu berechnen: ${name(s)}`;
    case 'speichern':
      return 'Einrichtung speichern';
  }
}

/** Was ChurchTools beim Neuberechnen gemeldet hat – für die Zeile „Neu berechnet“. */
function zahlenText(ergebnisse: readonly SchrittErgebnis[]): string {
  let neu = 0;
  let geaendert = 0;
  let ausgetragen = 0;
  for (const e of ergebnisse)
    if (e.ausgang.art === 'ok' && e.ausgang.zahlen) {
      neu += e.ausgang.zahlen.created;
      geaendert += e.ausgang.zahlen.updated;
      ausgetragen += e.ausgang.zahlen.deleted;
    }
  if (neu + geaendert + ausgetragen === 0)
    return 'niemand aufgenommen, verschoben oder ausgetragen';
  return [
    neu > 0 ? `${mehr(neu, 'Person', 'Personen')} aufgenommen` : null,
    geaendert > 0 ? `${geaendert} geändert` : null,
    ausgetragen > 0 ? `${ausgetragen} ausgetragen` : null,
  ]
    .filter(Boolean)
    .join(', ');
}

/** Die Zeilen im Schritt „Fertig“ – in der Reihenfolge der Schritte. */
export function fertigListe(ergebnisse: readonly SchrittErgebnis[]): FertigZeile[] {
  const arten = [...new Set(ergebnisse.map((e) => e.schritt.art))];
  const zeilen: FertigZeile[] = [];
  for (const art of arten) {
    const alle = ergebnisse.filter((e) => e.schritt.art === art);
    const ok = alle.filter(
      (e): e is SchrittErgebnis & { ausgang: Ausgang & { art: 'ok' } } => e.ausgang.art === 'ok',
    );
    if (ok.length > 0)
      zeilen.push({
        zeichen: 'ok',
        titel: FERTIG[art](ok.length),
        text: art === 'neuBerechnen' ? zahlenText(ok) : ok[ok.length - 1].ausgang.text,
      });
    for (const f of alle)
      if (f.ausgang.art === 'fehler')
        zeilen.push({ zeichen: 'fehler', titel: fehlerTitel(f.schritt), text: f.ausgang.text });
    const offen = alle.filter((e) => e.ausgang.art === 'offen');
    if (offen.length > 0)
      zeilen.push({
        zeichen: 'offen',
        titel: OFFEN[art](offen.length),
        text: 'noch nicht geschrieben',
      });
  }
  return zeilen;
}

export interface FertigKopf {
  art: 'ok' | 'fehler';
  titel: string;
  text: string;
}

/** Der Kasten über der Liste: „Fertig.“ oder „Nicht ganz fertig.“ – im zweiten Fall mit dem, was jetzt zu tun ist. */
export function fertigKopf(lauf: Extract<Lauf, { art: 'gelaufen' }>): FertigKopf {
  if (lauf.ok)
    return lauf.ergebnisse.length === 0
      ? {
          art: 'ok',
          titel: 'Fertig.',
          text: 'Es gab nichts zu schreiben – alles steht schon richtig da.',
        }
      : { art: 'ok', titel: 'Fertig.', text: 'Alles ist in ChurchTools nachgelesen.' };
  const fehler = lauf.ergebnisse.find((e) => e.ausgang.art === 'fehler')?.ausgang;
  const grund = fehler && fehler.art === 'fehler' ? fehler.grund : 'anderer';
  return {
    art: 'fehler',
    titel: 'Nicht ganz fertig.',
    text:
      grund === 'abgelehnt'
        ? 'Es fehlt ein Recht oder die Anmeldung. Was schon steht, bleibt stehen. Erst klären, dann „Nochmal versuchen“ – es schreibt nur, was noch fehlt.'
        : '„Nochmal versuchen“ schreibt nur, was noch fehlt. Was schon steht, bleibt stehen; es wurde nichts gelöscht.',
  };
}

/** Der Satz über Wechsel-Gruppen, die nicht mehr gebraucht werden – `null`, wenn es keine gibt. */
export function nichtMehrGebrauchtText(
  gruppen: readonly { gruppeId: number; name: string }[],
): string | null {
  if (gruppen.length === 0) return null;
  return `Nicht mehr gebraucht, aber nicht gelöscht: ${gruppen.map((g) => `„${g.name}“`).join(', ')}. ${
    gruppen.length === 1 ? 'Die Gruppe bleibt' : 'Die Gruppen bleiben'
  } in ChurchTools unverändert stehen (mit Kindern, Ausnahmen und Routine) – bitte dort ansehen.`;
}
