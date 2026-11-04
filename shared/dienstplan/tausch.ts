/**
 * **Dienste tauschen** (Bauplan E7-3, Entwurf `e7-3-tausch.html`, Alwin 04.11.2026): einen eigenen Dienst – zugesagt
 * oder noch offen – jemandem anbieten, der denselben Dienst an einem anderen Termin hat; Tausch-Anfragen an mich
 * annehmen oder ablehnen; eine eigene, unbeantwortete zurückziehen. Je Dienst **eine** Anfrage auf einmal.
 *
 * Gemessen 04.11.2026 als Spike (kein Admin, `dienstplaner-planung/docs/messung-e7.md`):
 * - Kandidaten `GET /persons/{ich}/events/{e}/services/{einteilung}/exchangerequests/candidates` – andere Einteilungen
 *   desselben Dienstes an anderen kommenden Terminen – auch **früheren** als dem eigenen (Test-Instanz 04.11.2026: zum
 *   08.11. kamen der 04.11. und der 07.11.) –, auch für eine offene Anfrage. `{einteilung}` ist die ID der eigenen
 *   Einteilung (nicht die Dienst-ID) – und die ändert sich bei jeder Antwort. Darum wird sie vor jedem Schreiben frisch
 *   aus `GET /persons/{ich}/servicerequests` gelesen (`einteilungAktuell`).
 * - Anfragen `POST …/exchangerequests {requestedServiceId}` → `UNANSWERED`; nichts an den Einteilungen ändert sich.
 * - Eingang `GET /persons/{ich}/exchangerequests` – nur beim **Partner**; der eigene Ausgang steht nur je Einteilung
 *   (`GET …/services/{einteilung}/exchangerequests`).
 * - Annehmen `PUT /persons/{ich}/exchangerequests/{id}` → `AGREED`: Personen getauscht, beide zugesagt, **neue IDs**.
 * - Ablehnen `DELETE /persons/{ich}/exchangerequests/{id}` → `DECLINED`. Zurückziehen `DELETE …/services/{einteilung}/
 *   exchangerequests/{id}` → 204, danach `CANCELLED`.
 *
 * Wie beim Einteilen: vor dem Schreiben frisch lesen (steht nicht mehr da, was man gesehen hat → nichts schreiben), nie
 * blind wiederholen, nach dem Schreiben nachlesen – ein Erfolgssignal allein zählt nicht.
 */

/** Der Weg zu ChurchTools – im Browser `tauschPort` (`dienstplaner/src/tauschPort.ts`), im Test ein Nachbau. */
export interface TauschPort {
  einteilungen(ich: number): Promise<unknown[]>;
  kandidaten(ich: number, eventId: number, einteilung: number): Promise<unknown[]>;
  ausgang(ich: number, eventId: number, einteilung: number): Promise<unknown[]>;
  eingang(ich: number): Promise<unknown[]>;
  anfragen(ich: number, eventId: number, einteilung: number, ziel: number): Promise<unknown>;
  zurueckziehen(ich: number, eventId: number, einteilung: number, id: number): Promise<void>;
  annehmen(ich: number, id: number): Promise<unknown>;
  ablehnen(ich: number, id: number): Promise<unknown>;
}

/** Eine eigene Einteilung, wie ChurchTools sie gerade führt (mit der flüchtigen ID). */
export interface Einteilung {
  id: number;
  eventId: number;
  /** Termin-Name und -Beginn (UTC), soweit geliefert. */
  termin: string;
  beginn: string;
  serviceId: number;
  index: number | null;
  dienst: string;
  zugesagt: boolean;
}

/** Wer tauschen könnte. */
export interface Kandidat {
  /** Die Einteilung der anderen Person – geht als `requestedServiceId` an ChurchTools. */
  einteilung: number;
  termin: string;
  beginn: string;
  personId: number | null;
  name: string;
}

/** Was an einer eigenen Einteilung gerade läuft: eine offene oder eine abgelehnte Anfrage – sonst nichts. */
export type Ausgang =
  | { art: 'offen'; id: number; name: string; beginn: string | null }
  | { art: 'abgelehnt'; id: number; name: string; beginn: string | null };

/** Eine Tausch-Anfrage an mich. */
export interface Eingang {
  id: number;
  von: string;
  /** Was ich bekäme (den Dienst der anfragenden Person) und was ich abgäbe (meine Einteilung). */
  bekomme: { eventId: number | null; termin: string; beginn: string };
  gebe: { einteilung: number; eventId: number | null; termin: string; beginn: string };
}

export type TauschGrund =
  /** Läuft an diesem Dienst schon eine unbeantwortete Anfrage – erst zurückziehen. */
  | 'schon-angefragt'
  /** Die eigene Einteilung gibt es nicht mehr (abgesagt, getauscht, umgeplant). */
  | 'weg'
  /** Die Anfrage ist inzwischen beantwortet oder zurückgezogen. */
  | 'beantwortet'
  /** Geschrieben, aber das Nachlesen zeigt nicht, was entstehen sollte – nicht einfach wiederholen. */
  | 'unklar';

export type TauschErgebnis = { ok: true } | { ok: false; grund: TauschGrund };

type Roh = Record<string, unknown>;
const zahl = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const obj = (v: unknown): Roh => (v && typeof v === 'object' ? (v as Roh) : {});

/** Name einer Person aus `{title}` oder `{firstName, lastName}`. */
function nameAus(p: unknown): string {
  const o = obj(p);
  return (
    text(o.title) || [text(o.firstName), text(o.lastName)].filter(Boolean).join(' ') || 'Jemand'
  );
}

/** Der Schlüssel einer Einteilung ohne flüchtige ID – Termin, Dienst, `index` (wie `antwortSchluessel`). */
export function einteilungSchluessel(e: {
  eventId: number;
  serviceId: number;
  index: number | null;
}) {
  return `${e.eventId}:${e.serviceId}:${e.index ?? '-'}`;
}

/** `GET /persons/{ich}/servicerequests` → die eigenen gültigen Einteilungen. */
export function einteilungenAus(roh: unknown[]): Einteilung[] {
  return roh.flatMap((x) => {
    const a = obj(x);
    const ev = obj(a.event);
    const id = zahl(a.id);
    const eventId = zahl(ev.id);
    const serviceId = zahl(a.serviceId);
    if (id === null || eventId === null || serviceId === null || a.isValid === false) return [];
    return [
      {
        id,
        eventId,
        termin: text(ev.name),
        beginn: text(ev.startDate),
        serviceId,
        index: zahl(a.index),
        dienst: text(a.serviceName) || 'Dienst',
        zugesagt: a.isAccepted === true,
      },
    ];
  });
}

/** Kandidaten, nach Beginn sortiert. */
export function kandidatenAus(roh: unknown[]): Kandidat[] {
  return roh
    .flatMap((x) => {
      const k = obj(x);
      const einteilung = zahl(k.eventServiceId);
      if (einteilung === null) return [];
      return [
        {
          einteilung,
          termin: text(k.eventTitle),
          beginn: text(k.eventDate),
          personId: zahl(obj(k.person).id),
          name: nameAus(k.person),
        },
      ];
    })
    .sort((a, b) => a.beginn.localeCompare(b.beginn));
}

/**
 * Der Stand an einer eigenen Einteilung aus deren Ausgang: die **jüngste** Anfrage zählt – offen (`UNANSWERED`) oder
 * abgelehnt (`DECLINED`, nicht archiviert). Zurückgezogen und angenommen sind erledigt (`null`).
 */
export function ausgangAus(roh: unknown[]): Ausgang | null {
  const juengste = roh
    .map(obj)
    .filter((a) => zahl(a.id) !== null)
    .sort((a, b) => (zahl(b.id) ?? 0) - (zahl(a.id) ?? 0))[0];
  if (!juengste) return null;
  const id = zahl(juengste.id)!;
  const name = nameAus(juengste.requestedPerson);
  const beginn = text(obj(juengste.requestedEvent).startDate) || null;
  if (juengste.status === 'UNANSWERED') return { art: 'offen', id, name, beginn };
  if (juengste.status === 'DECLINED' && juengste.isArchived !== true)
    return { art: 'abgelehnt', id, name, beginn };
  return null;
}

/** Der Eingang: nur unbeantwortete Anfragen an mich, nach meinem Termin sortiert. */
export function eingangAus(roh: unknown[]): Eingang[] {
  return roh
    .map(obj)
    .filter(
      (a) =>
        a.status === 'UNANSWERED' && zahl(a.id) !== null && zahl(a.requestedServiceId) !== null,
    )
    .map((a) => {
      const sein = obj(a.requestingEvent);
      const mein = obj(a.requestedEvent);
      return {
        id: zahl(a.id)!,
        von: nameAus(a.requestingPerson),
        bekomme: { eventId: zahl(sein.id), termin: text(sein.name), beginn: text(sein.startDate) },
        gebe: {
          einteilung: zahl(a.requestedServiceId)!,
          eventId: zahl(mein.id),
          termin: text(mein.name),
          beginn: text(mein.startDate),
        },
      };
    })
    .sort((a, b) => a.gebe.beginn.localeCompare(b.gebe.beginn));
}

/** Die eigene Einteilung zu diesem Schlüssel – frisch gelesen; `null`, wenn es sie nicht mehr gibt. */
export async function einteilungAktuell(
  port: TauschPort,
  ich: number,
  schluessel: string,
): Promise<Einteilung | null> {
  return (
    einteilungenAus(await port.einteilungen(ich)).find(
      (e) => einteilungSchluessel(e) === schluessel,
    ) ?? null
  );
}

/** Die möglichen Partner für eine eigene Einteilung (frisch gelesen). `null`: die Einteilung gibt es nicht mehr. */
export async function kandidatenFuer(
  port: TauschPort,
  ich: number,
  schluessel: string,
): Promise<Kandidat[] | null> {
  const e = await einteilungAktuell(port, ich, schluessel);
  if (!e) return null;
  return kandidatenAus(await port.kandidaten(ich, e.eventId, e.id));
}

/**
 * **Tausch anfragen.** Läuft an der Einteilung schon eine unbeantwortete Anfrage, wird nichts geschrieben
 * (`schon-angefragt`). Fertig ist es erst, wenn das Nachlesen die offene Anfrage an genau diese Einteilung zeigt.
 */
export async function tauschAnfragen(
  port: TauschPort,
  ich: number,
  schluessel: string,
  ziel: number,
): Promise<TauschErgebnis> {
  const e = await einteilungAktuell(port, ich, schluessel);
  if (!e) return { ok: false, grund: 'weg' };
  if (ausgangAus(await port.ausgang(ich, e.eventId, e.id))?.art === 'offen')
    return { ok: false, grund: 'schon-angefragt' };
  await port.anfragen(ich, e.eventId, e.id, ziel);
  const nach = (await port.ausgang(ich, e.eventId, e.id)).map(obj);
  const da = nach.some((a) => a.status === 'UNANSWERED' && zahl(a.requestedServiceId) === ziel);
  return da ? { ok: true } : { ok: false, grund: 'unklar' };
}

/**
 * **Zurückziehen** – nur, solange die Anfrage unbeantwortet ist (sonst `beantwortet`, nichts geschrieben). ChurchTools
 * antwortet mit 204 ohne Inhalt; fertig ist es, wenn das Nachlesen sie nicht mehr als offen zeigt.
 */
export async function tauschZurueckziehen(
  port: TauschPort,
  ich: number,
  schluessel: string,
  id: number,
): Promise<TauschErgebnis> {
  const e = await einteilungAktuell(port, ich, schluessel);
  if (!e) return { ok: false, grund: 'weg' };
  const vorher = (await port.ausgang(ich, e.eventId, e.id)).map(obj).find((a) => zahl(a.id) === id);
  if (!vorher || vorher.status !== 'UNANSWERED') return { ok: false, grund: 'beantwortet' };
  await port.zurueckziehen(ich, e.eventId, e.id, id);
  const nach = (await port.ausgang(ich, e.eventId, e.id)).map(obj).find((a) => zahl(a.id) === id);
  return nach && nach.status === 'UNANSWERED' ? { ok: false, grund: 'unklar' } : { ok: true };
}

/** Die Anfrage, wenn sie noch unbeantwortet im Eingang steht. */
async function nochOffen(port: TauschPort, ich: number, id: number): Promise<Eingang | null> {
  return eingangAus(await port.eingang(ich)).find((a) => a.id === id) ?? null;
}

/** Der Rumpf einer Antwort – mit oder ohne `{ data }`. */
const rumpf = (v: unknown): Roh => {
  const r = obj(v);
  return r.data && typeof r.data === 'object' ? obj(r.data) : r;
};

/**
 * **Annehmen** – nur, solange die Anfrage unbeantwortet im Eingang steht. Ein Tausch lässt sich nicht rückgängig machen;
 * fertig ist er erst, wenn ChurchTools `AGREED` meldet **und** das Nachlesen mich am Termin der anderen Person zeigt.
 * Sonst `unklar` – nicht wiederholen.
 */
export async function tauschAnnehmen(
  port: TauschPort,
  ich: number,
  id: number,
): Promise<TauschErgebnis> {
  const a = await nochOffen(port, ich, id);
  if (!a) return { ok: false, grund: 'beantwortet' };
  if (rumpf(await port.annehmen(ich, id)).status !== 'AGREED')
    return { ok: false, grund: 'unklar' };
  const jetzt = einteilungenAus(await port.einteilungen(ich));
  const da =
    a.bekomme.eventId === null || jetzt.some((e) => e.eventId === a.bekomme.eventId && e.zugesagt);
  return da ? { ok: true } : { ok: false, grund: 'unklar' };
}

/** **Ablehnen** – nur, solange die Anfrage unbeantwortet im Eingang steht; danach muss ChurchTools `DECLINED` melden. */
export async function tauschAblehnen(
  port: TauschPort,
  ich: number,
  id: number,
): Promise<TauschErgebnis> {
  if (!(await nochOffen(port, ich, id))) return { ok: false, grund: 'beantwortet' };
  return rumpf(await port.ablehnen(ich, id)).status === 'DECLINED'
    ? { ok: true }
    : { ok: false, grund: 'unklar' };
}
