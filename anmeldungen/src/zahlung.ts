/**
 * **Zahlung schreiben** (A7-2) – bezahlt mit Zahlart und Tag, Betrag von Hand. Alles bei der ersten Person der Anmeldung
 * (`ListenAnmeldung.zahlungBei`). Gemessen 19.10.2026: `PATCH /groups/{id}/members/{personId}` mit
 * `{fields: {<Nummer>: Wert}}` ändert nur die geschickten Felder, keine Mail. **Jeder Schreibschritt wird nachgelesen**
 * – ein 200 beweist nichts (`NichtUebernommen`).
 */
import { ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { euroText } from '@shared/anmeldung/preis';
import { aufschluesselungMitHand } from '@shared/anmeldung/zahlung';
import { NichtUebernommen, einstellungenVon, systemfelderNachziehen } from './einrichten';

interface MitgliedFelder {
  fields?: { id?: unknown; value?: unknown }[];
}

/** Schreiben und nachlesen: Steht danach in jedem Feld, was geschickt wurde? Auch für Nachrücken/Absagen (A7-3). */
export async function felderSchreiben(
  id: number,
  personId: number,
  felder: Record<number, string | boolean | null>,
  was: string,
): Promise<void> {
  await ctAnfrage(`/groups/${id}/members/${personId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: felder }),
  });
  const m = await ctDaten<MitgliedFelder>(`/groups/${id}/members/${personId}`);
  const steht = new Map((m.fields ?? []).map((f) => [Number(f.id), f.value]));
  for (const [feld, soll] of Object.entries(felder)) {
    const ist = steht.get(Number(feld));
    const gleich =
      typeof soll === 'boolean'
        ? (ist === '1' || ist === true) === soll
        : soll === null
          ? ist === null || ist === undefined || ist === ''
          : (typeof ist === 'string' || typeof ist === 'number' ? String(ist) : '') === soll;
    if (!gleich) throw new NichtUebernommen(was);
  }
}

/**
 * **Bezahlt oder zurücksetzen.** Fehlt der Veranstaltung das Feld „Zahlart“ (vor A7-2 angelegt), wird es zuerst angelegt.
 */
export async function zahlungSpeichern(
  id: number,
  personId: number,
  z: { bezahlt: boolean; am: string | null; zahlart: string | null },
): Promise<void> {
  let e = await einstellungenVon(id);
  if (
    e.ctFelder.bezahlt === undefined ||
    e.ctFelder.bezahltAm === undefined ||
    (z.zahlart && e.ctFelder.zahlart === undefined)
  )
    e = await systemfelderNachziehen(id);
  const { bezahlt, bezahltAm, zahlart } = e.ctFelder;
  if (bezahlt === undefined || bezahltAm === undefined)
    throw new NichtUebernommen('das Feld „Bezahlt“');
  const felder: Record<number, string | boolean | null> = {
    [bezahlt]: z.bezahlt,
    [bezahltAm]: z.bezahlt ? z.am : null,
  };
  if (zahlart !== undefined) felder[zahlart] = z.bezahlt ? z.zahlart : null;
  await felderSchreiben(id, personId, felder, 'die Zahlung');
}

/**
 * **Betrag von Hand ändern** – neuer Betrag, dazu eine Zeile in der Aufschlüsselung („Von Hand geändert am …“), damit
 * man in ChurchTools sieht, woher er kommt, und die Nachprüfung ihn nicht mehr als abweichend meldet.
 */
export async function betragAendern(
  id: number,
  personId: number,
  cent: number,
  aufschluesselung: string | null,
  heute: string,
): Promise<void> {
  const e = await einstellungenVon(id);
  const { betrag, aufschluesselung: aufFeld } = e.ctFelder;
  if (betrag === undefined || aufFeld === undefined)
    throw new NichtUebernommen('das Feld „Betrag“');
  await felderSchreiben(
    id,
    personId,
    {
      [betrag]: euroText(cent),
      [aufFeld]: aufschluesselungMitHand(aufschluesselung, cent, heute),
    },
    'den Betrag',
  );
}

/** **Rückgängig für „Betrag ändern“** – Betrag und Aufschlüsselung, wie sie vorher dastanden (auch leer). */
export async function betragWiederherstellen(
  id: number,
  personId: number,
  vorher: { betrag: string | null; aufschluesselung: string | null },
): Promise<void> {
  const e = await einstellungenVon(id);
  const { betrag, aufschluesselung } = e.ctFelder;
  if (betrag === undefined || aufschluesselung === undefined)
    throw new NichtUebernommen('den Betrag');
  await felderSchreiben(
    id,
    personId,
    { [betrag]: vorher.betrag, [aufschluesselung]: vorher.aufschluesselung },
    'den Betrag',
  );
}
