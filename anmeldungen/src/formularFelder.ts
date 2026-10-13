/**
 * **Die Formularfelder in ChurchTools** (A5) – jedes Feld des Formulars ist ein Gruppenfeld, also eine Spalte
 * der Mitgliederliste (außer Name, E-Mail, Geburtsdatum: die stehen an der Person). Gemessen an der
 * Test-Instanz (`docs/messung-a5-2026-10-13.md`):
 *
 * - Feld und Antworten umbenennen lässt vorhandene Antworten stehen (die ID bleibt).
 * - Eine gewählte Antwort entfernen oder das Feld löschen **löscht die Antworten still** → entfernen heißt bei
 *   vorhandenen Antworten **ausblenden** (Alwin, 13.10.2026), gelöscht wird nur, was noch niemand beantwortet hat.
 * - Antworten ohne ID legt ChurchTools neu an → immer die IDs mitschicken.
 *
 * Reihenfolge jedes Schreibens: erst prüfen (`pruefeFormular`), dann ChurchTools (nachgelesen), dann die
 * Einstellungen. Scheitert der letzte Schritt, bleibt höchstens eine überzählige Spalte – nie ein Feld im
 * Formular ohne Spalte.
 */
import { ctAlleSeiten, ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import {
  SYSTEMFELDER,
  ctAblage,
  pruefeFormular,
  type Feld,
  type Formular,
  type OeffentlicheEinstellungen,
} from '@shared/anmeldung/formular';
import {
  ctFeldName,
  feldDefinition,
  optionenPlanen,
  type CtOption,
} from '@shared/anmeldung/felder';
import { NichtUebernommen, aendereEinstellungen, einstellungenVon } from './einrichten';

export type Bereich = keyof Formular;

interface CtFeld {
  id: number;
  name: string;
  note?: string | null;
  fieldTypeCode?: string;
  options?: { id: string | number; name: string }[];
  useInRegistrationForm?: boolean;
  requiredInRegistrationForm?: boolean;
}

const json = (body: unknown) => JSON.stringify(body);

/** Die Gruppenfelder der Veranstaltung, je Nummer. */
export async function ctFelderLesen(id: number): Promise<Map<number, CtFeld>> {
  const roh = await ctDaten<{ type?: string; field?: CtFeld }[]>(`/groups/${id}/memberfields`);
  const m = new Map<number, CtFeld>();
  for (const f of roh) if (f.type === 'group' && f.field) m.set(f.field.id, f.field);
  return m;
}

const optionenVon = (f: CtFeld | undefined) =>
  (f?.options ?? []).map((o) => ({ id: String(o.id), name: o.name }));

/** Wie oft ein Feld beantwortet ist – gesamt und je Antwortmöglichkeit (ID). */
export interface Beantwortet {
  gesamt: number;
  jeOption: Map<string, number>;
}

/**
 * **Wer hat was beantwortet?** – aus den Mitgliedern (angemeldet, Warteliste …). Ein nicht angekreuztes
 * Kästchen meldet ChurchTools als `'0'` (gemessen 12.10.2026) – das ist keine Antwort.
 */
export async function antwortenZaehlen(id: number): Promise<Map<number, Beantwortet>> {
  const mitglieder = await ctAlleSeiten<{ fields?: { id?: unknown; value?: unknown }[] }>(
    `/groups/${id}/members`,
    200,
  );
  const m = new Map<number, Beantwortet>();
  for (const p of mitglieder) {
    for (const f of p.fields ?? []) {
      const wert = f.value;
      if (wert === null || wert === undefined || wert === '' || wert === '0' || wert === 0)
        continue;
      const feldId = Number(f.id);
      const b = m.get(feldId) ?? { gesamt: 0, jeOption: new Map<string, number>() };
      // Auswahl: die ID der Antwort (Text oder Zahl); anderes zählt nur als „beantwortet“.
      const schluessel =
        typeof wert === 'string' || typeof wert === 'number' ? String(wert) : JSON.stringify(wert);
      b.gesamt++;
      b.jeOption.set(schluessel, (b.jeOption.get(schluessel) ?? 0) + 1);
      m.set(feldId, b);
    }
  }
  return m;
}

/** Ein neues Feld im Baukasten bekommt eine Kennung, die es im Formular noch nicht gibt. */
export function neueFeldKennung(formular: Formular): string {
  const vergeben = new Set([...formular.anmeldung, ...formular.person].map((f) => f.id));
  for (let i = 1; ; i++) if (!vergeben.has(`f${i}`)) return `f${i}`;
}

/** Wo ein neues Feld hinkommt: im Bereich „Anmeldung“ vor die Bemerkungen (dahinter Preis und Datenschutz). */
function einfuegeStelle(liste: Feld[], bereich: Bereich): number {
  if (bereich === 'person') return liste.length;
  const vor = liste.findIndex((f) => f.id === 'note' || f.typ === 'price' || f.typ === 'privacy');
  return vor < 0 ? liste.length : vor;
}

function ersetzen(formular: Formular, bereich: Bereich, feld: Feld): Formular {
  const liste = formular[bereich];
  const i = liste.findIndex((f) => f.id === feld.id);
  const neu =
    i >= 0
      ? liste.map((f) => (f.id === feld.id ? feld : f))
      : [
          ...liste.slice(0, einfuegeStelle(liste, bereich)),
          feld,
          ...liste.slice(einfuegeStelle(liste, bereich)),
        ];
  return { ...formular, [bereich]: neu };
}

/**
 * **Ein Feld speichern** – neu oder geändert. `antworten`: die Antworten im Fenster, je mit der ChurchTools-ID,
 * aus der sie hervorgegangen sind (bei neuen ohne). Ohne Angabe werden `feld.antworten` über den Namen den
 * vorhandenen IDs zugeordnet (Ausblenden, Anlegen). Gibt die gespeicherten Einstellungen zurück.
 */
export async function feldSpeichern(
  id: number,
  bereich: Bereich,
  feld: Feld,
  antworten?: { text: string; altId?: string }[],
): Promise<OeffentlicheEinstellungen> {
  const e = await einstellungenVon(id);
  const geplant = ersetzen(e.formular, bereich, feld);
  const fehler = pruefeFormular(geplant);
  if (fehler.length) throw new ApiError(422, fehler.join(' '));

  let ctId: number | undefined = e.ctFelder[feld.id];
  let verborgen: string[] | undefined;
  const ablage = ctAblage(feld);
  if (ablage.ort === 'gruppenfeld' && (ctId !== undefined || feld.zustand !== 'aus')) {
    const felder = await ctFelderLesen(id);
    const bisher = ctId !== undefined ? felder.get(ctId) : undefined;
    const andere = [...felder.values()].filter((f) => f.id !== bisher?.id).map((f) => f.name);
    const name = ctFeldName(feld.frage, [...andere, ...SYSTEMFELDER.map((s) => s.name)]);
    let optionen: CtOption[] | undefined;
    if (feld.typ === 'radio' || feld.typ === 'select') {
      const gewaehlt = bisher
        ? new Set((await antwortenZaehlen(id)).get(bisher.id)?.jeOption.keys() ?? [])
        : new Set<string>();
      const alt = optionenVon(bisher);
      const geplant =
        antworten ??
        feld.antworten.map((t) => ({ text: t, altId: alt.find((o) => o.name === t)?.id }));
      const plan = optionenPlanen(alt, geplant, gewaehlt);
      optionen = plan.senden;
      verborgen = plan.verborgen.length ? plan.verborgen : undefined;
    } else if (feld.typ === 'janein' && bisher) {
      // Ja/Nein: die vorhandenen IDs behalten (sonst entstünden neue und die Wahl wäre weg).
      optionen = optionenVon(bisher);
    }
    const definition = feldDefinition(feld, name, optionen)!;
    if (bisher) {
      await ctAnfrage(`/groups/${id}/memberfields/group/${bisher.id}`, {
        method: 'PATCH',
        body: json(definition),
      });
    } else {
      // Neu – oder die Spalte wurde inzwischen gelöscht (z. B. „Rückgängig“ nach dem Entfernen): neu anlegen.
      const neu = await ctAnfrage<{ data?: { id?: number } }>(`/groups/${id}/memberfields/group`, {
        method: 'POST',
        body: json(definition),
      });
      ctId = neu?.data?.id;
      if (typeof ctId !== 'number') throw new NichtUebernommen(`das Feld „${feld.frage}“`);
    }
    const nachher = (await ctFelderLesen(id)).get(ctId);
    const namenNachher = optionenVon(nachher).map((o) => o.name);
    if (
      !nachher ||
      nachher.name !== definition.name ||
      nachher.useInRegistrationForm !== definition.useInRegistrationForm ||
      nachher.requiredInRegistrationForm !== definition.requiredInRegistrationForm ||
      (definition.options && definition.options.some((o) => !namenNachher.includes(o.name)))
    )
      throw new NichtUebernommen(`das Feld „${feld.frage}“`);
  }

  const gespeichert: Feld = { ...feld, verborgen };
  if (!gespeichert.verborgen) delete gespeichert.verborgen;
  return aendereEinstellungen(id, (frisch) => ({
    ...frisch,
    formular: ersetzen(frisch.formular, bereich, gespeichert),
    ctFelder: ctId !== undefined ? { ...frisch.ctFelder, [feld.id]: ctId } : frisch.ctFelder,
  }));
}

/**
 * **Ein eigenes Feld entfernen.** Hat es schon jemand beantwortet, wird es nur **ausgeblendet** (Alwin:
 * „ausblenden“) – die Spalte und die Antworten bleiben, im Formular erscheint es nicht mehr. Sonst wird die
 * Spalte gelöscht. Gibt zurück, was passiert ist.
 */
export async function feldEntfernen(
  id: number,
  bereich: Bereich,
  feldId: string,
): Promise<{ art: 'geloescht' } | { art: 'ausgeblendet'; antworten: number }> {
  const e = await einstellungenVon(id);
  const feld = e.formular[bereich].find((f) => f.id === feldId);
  if (!feld) return { art: 'geloescht' };
  if (feld.art !== 'eigen')
    throw new ApiError(422, 'Vorgegebene Felder lassen sich nur ausschalten.');
  const ctId = e.ctFelder[feldId];
  const antworten = ctId !== undefined ? ((await antwortenZaehlen(id)).get(ctId)?.gesamt ?? 0) : 0;
  if (antworten > 0) {
    await feldSpeichern(id, bereich, { ...feld, zustand: 'aus' });
    return { art: 'ausgeblendet', antworten };
  }
  if (ctId !== undefined && (await ctFelderLesen(id)).has(ctId)) {
    await ctAnfrage(`/groups/${id}/memberfields/group/${ctId}`, { method: 'DELETE' });
    if ((await ctFelderLesen(id)).has(ctId)) throw new NichtUebernommen('das Löschen des Felds');
  }
  await aendereEinstellungen(id, (frisch) => {
    const ctFelder = { ...frisch.ctFelder };
    delete ctFelder[feldId];
    return {
      ...frisch,
      formular: {
        ...frisch.formular,
        [bereich]: frisch.formular[bereich].filter((f) => f.id !== feldId),
      },
      ctFelder,
    };
  });
  return { art: 'geloescht' };
}

/** **Reihenfolge** eines Bereichs speichern – nur die Einstellungen, ChurchTools kennt keine Formular-Reihenfolge. */
export async function reihenfolgeSpeichern(
  id: number,
  bereich: Bereich,
  ids: string[],
): Promise<void> {
  await aendereEinstellungen(id, (frisch) => {
    const nach = new Map(frisch.formular[bereich].map((f) => [f.id, f]));
    const sortiert = ids.map((x) => nach.get(x)).filter((f): f is Feld => !!f);
    const rest = frisch.formular[bereich].filter((f) => !ids.includes(f.id));
    return { ...frisch, formular: { ...frisch.formular, [bereich]: [...sortiert, ...rest] } };
  });
}

/**
 * **Alle eingeschalteten Felder in ChurchTools anlegen** – nach dem Anlegen einer Veranstaltung (die Vorlage
 * bringt Telefon, Bemerkungen, Allergien … mit; aufgerufen von „Neue Veranstaltung“). Was schon eine Spalte
 * hat, bleibt unberührt – mehrfach aufrufen schadet nicht.
 */
export async function felderAnlegen(id: number): Promise<void> {
  const e = await einstellungenVon(id);
  for (const bereich of ['anmeldung', 'person'] as const) {
    for (const f of e.formular[bereich]) {
      if (f.zustand === 'aus' || e.ctFelder[f.id] !== undefined) continue;
      if (ctAblage(f).ort !== 'gruppenfeld') continue;
      await feldSpeichern(id, bereich, f);
    }
  }
}
