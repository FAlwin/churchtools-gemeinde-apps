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
  ctZusatzSpalten,
  pruefeFormular,
  type Feld,
  type Formular,
  type OeffentlicheEinstellungen,
} from '@shared/anmeldung/formular';
import {
  ctFeldName,
  feldDefinition,
  optionenPlanen,
  type CtFeldDefinition,
  type CtOption,
} from '@shared/anmeldung/felder';
import { bereichVon, einordnen, type Bereich } from '@shared/anmeldung/baukasten';
import { NichtUebernommen, aendereEinstellungen, einstellungenVon } from './einrichten';

export type { Bereich };

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

/**
 * Das Feld ins Formular übernehmen: ein vorhandenes an Ort und Stelle ersetzen, ein neues einordnen (`einordnen`,
 * dieselbe Regel wie beim Ziehen im Baukasten). Mit `vorId` (auch `null` = ans Ende) wird zusätzlich dorthin
 * verschoben – auch in den anderen Bereich.
 */
function ersetzen(
  formular: Formular,
  bereich: Bereich,
  feld: Feld,
  vorId: string | null | undefined,
): Formular {
  const da = bereichVon(formular, feld.id);
  if (!da) return einordnen(formular, feld.id, bereich, vorId ?? null, feld);
  const ersetzt = { ...formular, [da]: formular[da].map((f) => (f.id === feld.id ? feld : f)) };
  return vorId === undefined ? ersetzt : einordnen(ersetzt, feld.id, bereich, vorId);
}

/**
 * **Ein Feld speichern** – neu oder geändert. `antworten`: die Antworten im Baukasten, je mit der ChurchTools-ID,
 * aus der sie hervorgegangen sind (bei neuen ohne). Ohne Angabe werden `feld.antworten` über den Namen den
 * vorhandenen IDs zugeordnet (Ausblenden, Anlegen). `vorId`: wohin es kommt (vor dieses Feld, `null` = ans Ende
 * des Bereichs) – ohne Angabe bleibt ein vorhandenes Feld, wo es ist, und ein neues kommt ans Ende.
 * Gibt die gespeicherten Einstellungen zurück.
 */
export async function feldSpeichern(
  id: number,
  bereich: Bereich,
  feld: Feld,
  antworten?: { text: string; altId?: string }[],
  vorId?: string | null,
): Promise<OeffentlicheEinstellungen> {
  const e = await einstellungenVon(id);
  const geplant = ersetzen(e.formular, bereich, feld, vorId);
  const fehler = pruefeFormular(geplant);
  if (fehler.length) throw new ApiError(422, fehler.join(' '));

  let ctId: number | undefined = e.ctFelder[feld.id];
  let verborgen: string[] | undefined;
  const ablage = ctAblage(feld);
  if (ablage.ort === 'gruppenfeld' && (ctId !== undefined || feld.zustand !== 'aus')) {
    const { bisher, name } = await spalteUndName(id, ctId, feld.frage);
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
    ctId = await spalteSpeichern(
      id,
      bisher,
      feldDefinition(feld, bereich, name, optionen)!,
      feld.frage,
    );
  }

  // Weitere Spalten des Felds (A6-2b: die Striche der Unterschrift) – angelegt, sobald das Feld eingeschaltet ist,
  // danach mit ihm ein- und ausgeschaltet. Dieselbe Regel wie oben (`spalteSpeichern`).
  const zusatz: Record<string, number> = {};
  for (const z of ctZusatzSpalten(feld)) {
    const zId = e.ctFelder[z.schluessel];
    if (zId === undefined && feld.zustand === 'aus') continue;
    const { bisher, name } = await spalteUndName(id, zId, z.name);
    const definition = feldDefinition({ ...feld, typ: 'textarea' }, bereich, name)!;
    zusatz[z.schluessel] = await spalteSpeichern(id, bisher, definition, z.name);
  }

  const gespeichert: Feld = { ...feld, verborgen };
  if (!gespeichert.verborgen) delete gespeichert.verborgen;
  return aendereEinstellungen(id, (frisch) => ({
    ...frisch,
    formular: ersetzen(frisch.formular, bereich, gespeichert, vorId),
    ctFelder: {
      ...frisch.ctFelder,
      ...(ctId !== undefined ? { [feld.id]: ctId } : {}),
      ...zusatz,
    },
  }));
}

/**
 * Die vorhandene Spalte (falls es sie noch gibt) und ein Name, den keine andere Spalte und kein Systemfeld trägt –
 * ChurchTools unterscheidet Spalten in Listen und Mails nur am Namen.
 */
async function spalteUndName(
  id: number,
  ctId: number | undefined,
  wunsch: string,
): Promise<{ bisher: CtFeld | undefined; name: string }> {
  const felder = await ctFelderLesen(id);
  const bisher = ctId !== undefined ? felder.get(ctId) : undefined;
  const andere = [...felder.values()].filter((f) => f.id !== bisher?.id).map((f) => f.name);
  return { bisher, name: ctFeldName(wunsch, [...andere, ...SYSTEMFELDER.map((x) => x.name)]) };
}

/**
 * **Eine Spalte anlegen oder ändern – und nachlesen**: Vorhanden → `PATCH`, sonst (neu oder inzwischen gelöscht,
 * z. B. „Rückgängig“ nach dem Entfernen) `POST`. Danach muss dastehen, was geschickt wurde (Name, im
 * Anmeldeformular, Pflicht, Antworten) – ein 200 allein beweist das nicht. Gibt die Nummer der Spalte zurück.
 */
async function spalteSpeichern(
  id: number,
  bisher: CtFeld | undefined,
  definition: CtFeldDefinition,
  was: string,
): Promise<number> {
  let ctId = bisher?.id;
  if (bisher) {
    await ctAnfrage(`/groups/${id}/memberfields/group/${bisher.id}`, {
      method: 'PATCH',
      body: json(definition),
    });
  } else {
    const neu = await ctAnfrage<{ data?: { id?: number } }>(`/groups/${id}/memberfields/group`, {
      method: 'POST',
      body: json(definition),
    });
    ctId = neu?.data?.id;
    if (typeof ctId !== 'number') throw new NichtUebernommen(`das Feld „${was}“`);
  }
  const nachher = (await ctFelderLesen(id)).get(ctId!);
  const namenNachher = optionenVon(nachher).map((o) => o.name);
  if (
    !nachher ||
    nachher.name !== definition.name ||
    nachher.useInRegistrationForm !== definition.useInRegistrationForm ||
    nachher.requiredInRegistrationForm !== definition.requiredInRegistrationForm ||
    (definition.options && definition.options.some((o) => !namenNachher.includes(o.name)))
  )
    throw new NichtUebernommen(`das Feld „${was}“`);
  return ctId!;
}

/**
 * **Ein Feld aus dem Formular nehmen.** Empfohlene Felder (Telefon, Geburtsdatum …) werden nur ausgeschaltet –
 * ihre Kachel bietet sie wieder an. Eigene Felder: Hat sie schon jemand beantwortet, werden sie nur
 * **ausgeblendet** (Alwin: „ausblenden“) – die Spalte und die Antworten bleiben, im Formular erscheint das Feld
 * nicht mehr. Sonst wird die Spalte gelöscht. Gibt zurück, was passiert ist.
 */
export async function feldEntfernen(
  id: number,
  feldId: string,
): Promise<{ art: 'geloescht' } | { art: 'ausgeblendet'; antworten: number }> {
  const e = await einstellungenVon(id);
  const bereich = bereichVon(e.formular, feldId);
  const feld = bereich ? e.formular[bereich].find((f) => f.id === feldId) : undefined;
  if (!bereich || !feld) return { art: 'geloescht' };
  if (feld.art === 'fest' || feld.art === 'preis')
    throw new ApiError(422, 'Name, E-Mail, Datenschutz und Preise gehören immer dazu.');
  const ctId = e.ctFelder[feldId];
  const antworten = ctId !== undefined ? ((await antwortenZaehlen(id)).get(ctId)?.gesamt ?? 0) : 0;
  if (feld.art === 'standard' || antworten > 0) {
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
        anmeldung: frisch.formular.anmeldung.filter((f) => f.id !== feldId),
        person: frisch.formular.person.filter((f) => f.id !== feldId),
      },
      ctFelder,
    };
  });
  return { art: 'geloescht' };
}

/**
 * **Den Fragetyp eines Felds ändern** (Feinheiten A5). ChurchTools ändert den Typ einer Spalte nicht: `PATCH` mit
 * neuem `fieldTypeCode` antwortet 200 und lässt den Typ, wie er ist (gemessen 13.10.2026). Also: alte Spalte
 * löschen, neue anlegen – das geht nur, solange niemand geantwortet hat (sonst wären die Antworten weg).
 * `feld` ist das Feld mit dem neuen Typ (und allem, was gerade im Baukasten daran geändert ist).
 */
export async function feldTypAendern(id: number, feld: Feld): Promise<OeffentlicheEinstellungen> {
  const e = await einstellungenVon(id);
  const bereich = bereichVon(e.formular, feld.id);
  if (!bereich) throw new ApiError(404, `Das Feld „${feld.frage}“ gibt es nicht mehr.`);
  if (feld.art !== 'eigen')
    throw new ApiError(422, 'Nur bei eigenen Fragen lässt sich der Fragetyp ändern.');
  const ctId = e.ctFelder[feld.id];
  if (ctId !== undefined) {
    const antworten = (await antwortenZaehlen(id)).get(ctId)?.gesamt ?? 0;
    if (antworten > 0)
      throw new ApiError(
        409,
        `Bei „${feld.frage}“ haben schon ${antworten === 1 ? 'eine Anmeldung' : `${antworten} Anmeldungen`} geantwortet – der Fragetyp lässt sich nicht mehr ändern. Lege dafür ein neues Feld an.`,
      );
    if ((await ctFelderLesen(id)).has(ctId)) {
      await ctAnfrage(`/groups/${id}/memberfields/group/${ctId}`, { method: 'DELETE' });
      if ((await ctFelderLesen(id)).has(ctId))
        throw new NichtUebernommen('das Ändern des Fragetyps');
    }
  }
  // Ohne Spalte legt `feldSpeichern` eine neue an (wie nach „Rückgängig“ eines Entfernens).
  return feldSpeichern(id, bereich, { ...feld, verborgen: undefined });
}

/**
 * **Ein Feld verschieben** – vor `vorId` in `bereich` (`null` = ans Ende), auch in den anderen Bereich. Nur die
 * Einstellungen: ChurchTools kennt keine Formular-Reihenfolge, und die Spalte gehört zur Gruppe, nicht zum Bereich.
 */
export async function feldEinordnen(
  id: number,
  feldId: string,
  bereich: Bereich,
  vorId: string | null,
): Promise<void> {
  await aendereEinstellungen(id, (frisch) => ({
    ...frisch,
    formular: einordnen(frisch.formular, feldId, bereich, vorId),
  }));
}

/**
 * **Ältere Veranstaltungen nachziehen** (#597): Felder der Anmeldung, deren Spalte (oder weitere Spalte) in
 * ChurchTools noch „Pflicht“ ist, neu speichern – über `feldSpeichern`, also mit der Regel aus `feldDefinition` und
 * nachgelesen. Was schon stimmt, bleibt unberührt. Aufgerufen beim Freigeben (`anmeldenVorbereiten`).
 */
export async function pflichtNachziehen(id: number): Promise<void> {
  const e = await einstellungenVon(id);
  const felder = await ctFelderLesen(id);
  for (const f of e.formular.anmeldung) {
    const spalten = [f.id, ...ctZusatzSpalten(f).map((z) => z.schluessel)];
    const pflicht = (s: string) => {
      const ctId = e.ctFelder[s];
      return ctId !== undefined && felder.get(ctId)?.requiredInRegistrationForm === true;
    };
    if (spalten.some(pflicht)) await feldSpeichern(id, 'anmeldung', f);
  }
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
