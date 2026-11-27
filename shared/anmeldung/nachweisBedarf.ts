/**
 * **Wer braucht welchen Nachweis?** (N3b, Entscheidungsliste E20) – die Einstellung je Veranstaltung und die EINE Regel
 * `brauchtNachweis`, die N3c (Eintragen beim Öffnen) und N3d (Ampel „nicht nötig“, Hinweis) fragen.
 *
 * Keine zweite Vergleichslogik: „Nur wenn …“ wird in einen Filter der Tabelle (`SpaltenFilter`) übersetzt und von
 * `tabellenFilter.ts` gerechnet – Ankreuzen, Mehrfachauswahl, freie Antwort (ihre Beschriftung, nicht der getippte Text) und
 * die Frage „je Person“ gegen „an den Kontakt“ (E4) gelten hier genau wie in den Filtern der Anmeldungen.
 *
 * **Kaputte Bedingung** (Frage gelöscht, ausgeschaltet oder jetzt ohne Antworten): nie still auf „alle“ zurückfallen – das
 * wären echte Aufforderungsmails an Unbeteiligte –, nie still verschwinden. `brauchtNachweis` sagt dann `false`,
 * `nachweisProblem` nennt, was nicht stimmt (Karte und Fenster zeigen es; N3c/N3d fragen es ebenfalls). Eine **entfernte
 * Antwort** bleibt in der Regel stehen: Wer sie früher gegeben hat, steht mit ihr in ChurchTools. Eine **umbenannte** Antwort
 * zieht mit (`mitNachweisenUmbenannt`, wie `bedingungenUmbenennen`).
 *
 * **Wer zählt** (E21: Wartende nicht, nur Teilnehmer, nicht Leitung) entscheidet der Aufrufer – hier geht es nur um die
 * Bedingung.
 */
import {
  NACHWEISE_MAX,
  type NachweisBedarf,
  type OeffentlicheEinstellungen,
  type SpaltenFilter,
} from './formular';
import { frageSchluessel, fragen } from './druckliste';
import type { ListenAnmeldung, ListenPerson } from './liste';
import {
  filterAntworten,
  filterArt,
  filterName,
  passtPerson,
  personenSpalte,
} from './tabellenFilter';

export { NACHWEISE_MAX, type NachweisBedarf };

/** Der Eintrag dieser Nachweis-Art (die Gruppe in ChurchTools) – `undefined`: für diese Veranstaltung nicht eingeschaltet. */
export function nachweisBedarfVon(
  e: OeffentlicheEinstellungen,
  artGruppeId: number,
): NachweisBedarf | undefined {
  return (e.nachweise ?? []).find((b) => b.artGruppeId === artGruppeId);
}

/** Eine Frage, an der „Nur wenn …“ hängen kann – mit der Kennung, dem Namen und ob sie je Person gefragt wird. */
export interface NachweisFrage {
  feld: string;
  name: string;
  jePerson: boolean;
}

/** **Die Fragen zur Wahl** – die mit festen Antworten (Ja/Nein, Auswahl, Mehrfachauswahl, Ankreuzen), in der Reihenfolge des Formulars. */
export function nachweisFragen(e: OeffentlicheEinstellungen): NachweisFrage[] {
  return fragen(e)
    .map((f) => frageSchluessel(f))
    .filter((feld) => filterArt(e, feld) === 'antworten' && filterAntworten(e, feld).length > 0)
    .map((feld) => ({ feld, name: filterName(e, feld), jePerson: personenSpalte(e, feld) }));
}

/** Was an einer „Nur wenn“-Bedingung nicht mehr stimmt. */
export type NachweisProblem =
  /** Die Frage gibt es nicht mehr (gelöscht, ausgeschaltet oder keine Auswahl mehr) – die Bedingung greift nicht. */
  | { art: 'frage' }
  /** Diese Antworten bietet die Frage nicht mehr an – die Bedingung gilt für die übrigen und für frühere Anmeldungen. */
  | { art: 'antworten'; fehlen: string[] };

/** **Stimmt die Bedingung noch zum Formular?** `null`: ja (oder „alle“ – dort gibt es nichts, was brechen könnte). */
export function nachweisProblem(
  e: OeffentlicheEinstellungen,
  b: NachweisBedarf,
): NachweisProblem | null {
  if (b.fuer !== 'nurWenn') return null;
  if (!nachweisFragen(e).some((q) => q.feld === b.feld)) return { art: 'frage' };
  const da = new Set(filterAntworten(e, b.feld));
  const fehlen = b.antworten.filter((a) => !da.has(a));
  return fehlen.length ? { art: 'antworten', fehlen } : null;
}

/** Der Satz zum Problem – für Karte und Fenster. `null`, wenn alles stimmt. */
export function nachweisProblemText(
  e: OeffentlicheEinstellungen,
  b: NachweisBedarf,
): string | null {
  const p = nachweisProblem(e, b);
  if (!p || b.fuer !== 'nurWenn') return null;
  if (p.art === 'frage')
    return 'Die Frage, auf die „Nur wenn …“ schaut, gibt es nicht mehr. Bis du eine neue wählst, braucht niemand diesen Nachweis.';
  const liste = p.fehlen.map((a) => `„${a}“`).join(', ');
  return `${p.fehlen.length === 1 ? 'Die Antwort' : 'Die Antworten'} ${liste} gibt es bei „${filterName(e, b.feld)}“ nicht mehr. Wer früher so geantwortet hat, braucht den Nachweis weiter.`;
}

/** Der Filter der Tabelle zu „Nur wenn …“ – `null` bei „alle“. */
function filterZu(b: NachweisBedarf): SpaltenFilter | null {
  return b.fuer === 'nurWenn' ? { spalte: b.feld, werte: b.antworten } : null;
}

/**
 * **Braucht diese Person den Nachweis?** `bedarf` ist der Eintrag der Art (`undefined`: nicht eingeschaltet → nein).
 * „Alle“: ja. „Nur wenn …“: ja, wenn die Antwort (bei Fragen je Person die der Person, bei Fragen an den Kontakt die der
 * Anmeldung) eine der gewählten ist. Eine kaputte Frage → nein, siehe `nachweisProblem`.
 */
export function brauchtNachweis(
  e: OeffentlicheEinstellungen,
  bedarf: NachweisBedarf | undefined,
  zeile: { x: ListenAnmeldung; p: ListenPerson },
): boolean {
  if (!bedarf) return false;
  if (bedarf.fuer === 'alle') return true;
  if (nachweisProblem(e, bedarf)?.art === 'frage') return false;
  return passtPerson(e, [filterZu(bedarf)!], zeile);
}

/**
 * **Zählt diese Person für den Nachweis?** Die eine Regel „wer zählt“ (E21/E30) für das Eintragen beim Öffnen (N3c) und die Ampel
 * der Leitung (N3d): nur aktive Teilnehmer (Wartende nicht), und nur wer laut `brauchtNachweis` den Nachweis braucht.
 */
export function zaehltFuerNachweis(
  e: OeffentlicheEinstellungen,
  bedarf: NachweisBedarf | undefined,
  zeile: { x: ListenAnmeldung; p: ListenPerson },
): boolean {
  return zeile.p.status === 'aktiv' && brauchtNachweis(e, bedarf, zeile);
}

/** Der Satz hinter einer Art in der Karte: „alle Angemeldeten“, „nur wenn Bereich ist Gruppenleiter“. */
export function nachweisBedarfSatz(e: OeffentlicheEinstellungen, b: NachweisBedarf): string {
  if (b.fuer === 'alle') return 'alle Angemeldeten';
  return `nur wenn ${nachweisBedingungSatz(e, b)}`;
}

/** Die Bedingung als Satz: „Bereich ist Gruppenleiter oder Küche“ – bei einer gelöschten Frage „(Frage fehlt)“. */
export function nachweisBedingungSatz(
  e: OeffentlicheEinstellungen,
  b: Extract<NachweisBedarf, { fuer: 'nurWenn' }>,
): string {
  const q = nachweisFragen(e).find((x) => x.feld === b.feld);
  return `${q ? q.name : '(Frage fehlt)'} ist ${b.antworten.join(' oder ')}`;
}

/**
 * **Einen Eintrag setzen oder – mit `null` – die Art ausschalten.** Die Reihenfolge der übrigen bleibt, alle anderen Arten
 * bleiben stehen (auch die, die das Fenster gerade nicht zeigt). Wirft bei „Nur wenn“ ohne Antwort und bei zu vielen Arten
 * – das Fenster prüft vorher.
 */
export function mitNachweisBedarf(
  e: OeffentlicheEinstellungen,
  artGruppeId: number,
  neu: NachweisBedarf | null,
): OeffentlicheEinstellungen {
  const alt = e.nachweise ?? [];
  if (neu && neu.artGruppeId !== artGruppeId) throw new Error('Falsche Nachweis-Art.');
  if (neu?.fuer === 'nurWenn' && (!neu.feld || neu.antworten.length === 0))
    throw new Error('Bitte eine Frage und mindestens eine Antwort wählen.');
  const da = alt.some((b) => b.artGruppeId === artGruppeId);
  if (neu && !da && alt.length >= NACHWEISE_MAX)
    throw new Error(`Höchstens ${NACHWEISE_MAX} Nachweis-Arten je Veranstaltung.`);
  const liste = !neu
    ? alt.filter((b) => b.artGruppeId !== artGruppeId)
    : da
      ? alt.map((b) => (b.artGruppeId === artGruppeId ? neu : b))
      : [...alt, neu];
  const ergebnis: OeffentlicheEinstellungen = { ...e, nachweise: liste };
  if (liste.length === 0) delete ergebnis.nachweise;
  return ergebnis;
}

/**
 * **Antworten umbenannt** – „Nur wenn …“ zieht mit, wie die Bedingungen im Formular (`bedingungenUmbenennen`): `feldId` ist die
 * `Feld.id` der Frage, `umbenannt` alter Text → neuer Text (`umbenannteAntworten`). Ohne Änderung kommen dieselben
 * Einstellungen zurück.
 */
export function mitNachweisenUmbenannt(
  e: OeffentlicheEinstellungen,
  feldId: string,
  umbenannt: Record<string, string>,
): OeffentlicheEinstellungen {
  if (!e.nachweise?.length || !Object.keys(umbenannt).length) return e;
  const feld = frageSchluessel({ id: feldId });
  let geaendert = false;
  const liste = e.nachweise.map((b): NachweisBedarf => {
    if (b.fuer !== 'nurWenn' || b.feld !== feld) return b;
    const neu = [
      ...new Set(b.antworten.map((a) => (Object.hasOwn(umbenannt, a) ? umbenannt[a] : a))),
    ];
    if (neu.length === b.antworten.length && neu.every((a, i) => a === b.antworten[i])) return b;
    geaendert = true;
    return { ...b, antworten: neu };
  });
  return geaendert ? { ...e, nachweise: liste } : e;
}
