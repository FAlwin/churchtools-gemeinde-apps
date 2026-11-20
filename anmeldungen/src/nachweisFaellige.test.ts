import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { plusTage, tagPunkt } from '@shared/ct/datum';
import { _vergissGemeindeZeitzone, heuteImKalender, merkeGemeindeZeitzone } from '@shared/ct/zeit';
import { nachweisMail } from '@shared/anmeldung/nachweise';
import { vermerkText, type FaelligerEmpfaenger } from '@shared/anmeldung/nachweisFaellige';
import { FAELLIGE_VERWEIGERT, faelligeLaden, faelligeSenden } from './nachweisFaellige';
import * as Rundmail from './rundmail';
import { FalschesNachweisCt } from './nachweisArten.testutil';

/**
 * Fällige anschreiben – das Schreiben (N2c) gegen ein nachgestelltes ChurchTools. Die Mail geht über `rundmailSenden`
 * (dessen eigene Tests: `rundmail.test.ts`); hier wird sie ersetzt – nie eine echte Mail. Notizen schreibt die Attrappe
 * wie ChurchTools (204 ohne Inhalt, gemessen 20.11.2026) und liefert sie über `GET /notes/follow_up/{id}` zurück.
 */
vi.mock('@ui/ct/verbindung', () => ({
  ctAnfrage: vi.fn(),
  ctDaten: vi.fn(),
  ctAlleSeiten: vi.fn(),
  istUeberlastet: () => false,
}));
vi.mock('./rundmail', async (original) => ({
  ...(await original<typeof import('./rundmail')>()),
  rundmailSenden: vi.fn(),
}));
const ct = vi.mocked(V);
const senden = vi.mocked(Rundmail.rundmailSenden);

let falsch: FalschesNachweisCt;
const HEUTE = heuteImKalender();
const GRUPPE = 61;
const OTTO = 'Otto Messnull';

beforeEach(() => {
  merkeGemeindeZeitzone({ timezone: 'Europe/Berlin' });
  falsch = new FalschesNachweisCt().mitArt();
  falsch.serverHeute = HEUTE;
  falsch.ichId = 7;
  ct.ctDaten.mockReset().mockImplementation((pfad: string) => falsch.holen(pfad));
  ct.ctAlleSeiten.mockReset().mockImplementation((pfad: string) => falsch.alleSeiten(pfad));
  ct.ctAnfrage.mockReset().mockImplementation(async (pfad: string, opt?: unknown) => {
    const o = (opt ?? {}) as { method?: string; body?: string };
    const kopf = o.method ?? 'GET';
    if (kopf === 'GET') return { data: await falsch.holen(pfad) };
    return await falsch.schicken(
      pfad,
      kopf,
      typeof o.body === 'string' ? JSON.parse(o.body) : undefined,
    );
  });
  senden.mockReset().mockResolvedValue({ bestaetigt: 2 });
});
afterEach(() => _vergissGemeindeZeitzone());

/** Zwei Personen mit offener „Erneut einsehen“ – die Empfänger, wie das Fenster sie liefert. */
function empfaenger(): (FaelligerEmpfaenger & { email: string })[] {
  falsch.aufgabeSetzen(GRUPPE, { personId: 10, title: 'Erneut einsehen' });
  falsch.aufgabeSetzen(GRUPPE, { personId: 20, title: 'Erneut einsehen' });
  const [a, b] = falsch.aufgaben.get(GRUPPE)!;
  const e = (id: number, name: string, mail: string, aufgabe: number | null) => ({
    personId: id,
    name,
    email: mail,
    wann: 'läuft ab am 01.01.2027',
    abgelaufen: false,
    luecke: null,
    aufgabeId: aufgabe,
  });
  return [e(10, 'Mia Muster', 'mia@x.test', a.id), e(20, 'Ben Alt', 'ben@x.test', b.id)];
}
const eingabe = (
  an: (FaelligerEmpfaenger & { email: string })[],
  extra: Partial<Parameters<typeof faelligeSenden>[0]> = {},
) => ({
  gruppeId: GRUPPE,
  an,
  betreff: 'Dein Nachweis läuft ab',
  text: 'Hallo [Vorname],\n\nbitte besorge einen neuen.',
  vermerk: true,
  absenderName: OTTO,
  heute: HEUTE,
  ...extra,
});
const notizenPosts = () => falsch.schreibend('/notes');
const notizen = (aufgabe: number) => falsch.notizen.get(aufgabe)?.map((x) => x.text) ?? [];

describe('Senden → Vermerk: die Reihenfolge', () => {
  it('erst die Mail (an die Nachweis-Gruppe, mit der Adresse je Person), dann je Aufgabe die Notiz – und nachgelesen', async () => {
    const an = empfaenger();
    // Beim Senden steht noch keine Notiz da.
    senden.mockImplementation(() => {
      expect(notizenPosts()).toHaveLength(0);
      return Promise.resolve({ bestaetigt: 2 });
    });
    const r = await faelligeSenden(eingabe(an));
    expect(senden).toHaveBeenCalledTimes(1);
    const [gruppe, wohin, betreff, html, verweigert] = senden.mock.calls[0];
    expect(gruppe).toBe(GRUPPE);
    expect(wohin).toEqual([
      { personId: 10, email: 'mia@x.test' },
      { personId: 20, email: 'ben@x.test' },
    ]);
    // Aus dem Erzeuger: [Vorname] ist beim Senden schon der Platzhalter von ChurchTools.
    const mail = nachweisMail({ betreff: 'Dein Nachweis läuft ab', text: eingabe(an).text });
    expect(betreff).toBe(mail.betreff);
    expect(html).toBe(mail.html);
    expect(html).toContain('{{person.firstName}}');
    expect(verweigert).toBe(FAELLIGE_VERWEIGERT);
    // Die Notizen stehen wirklich da – gelesen aus ChurchTools, nicht aus der Antwort des POST.
    const text = vermerkText(HEUTE, OTTO);
    expect(notizen(an[0].aufgabeId!)).toEqual([text]);
    expect(notizen(an[1].aufgabeId!)).toEqual([text]);
    expect(notizenPosts().map((a) => a.json)).toEqual([{ comment: text }, { comment: text }]);
    expect(r).toMatchObject({ gesendet: 2, vermerkt: ['Mia Muster', 'Ben Alt'], vermerkFehlt: [] });
    expect(r.text).toBe('2 Mails verschickt, Vermerk an beiden Aufgaben.');
    expect(text).toBe(`Angeschrieben am ${tagPunkt(HEUTE)} von ${OTTO}`);
  });

  it('ohne Häkchen: die Mail geht raus, es wird keine Notiz geschrieben', async () => {
    const an = empfaenger();
    const r = await faelligeSenden(eingabe(an, { vermerk: false }));
    expect(senden).toHaveBeenCalledTimes(1);
    expect(notizenPosts()).toHaveLength(0);
    expect(r.text).toBe('2 Mails verschickt.');
  });
});

describe('Senden scheitert: kein Vermerk', () => {
  it('ChurchTools lehnt ab (oder es fehlt das Recht): wirft, keine Notiz', async () => {
    const an = empfaenger();
    senden.mockRejectedValue(new ApiError(422, 'ChurchTools hat die Mails nicht angenommen: nein'));
    await expect(faelligeSenden(eingabe(an))).rejects.toThrow(/nicht angenommen/);
    expect(notizenPosts()).toHaveLength(0);
  });

  it('unklar, ob verschickt (Zeitüberschreitung): wirft UnklarObVerschickt, keine Notiz, kein zweites Senden', async () => {
    const an = empfaenger();
    senden.mockRejectedValue(new Rundmail.UnklarObVerschickt());
    await expect(faelligeSenden(eingabe(an))).rejects.toBeInstanceOf(Rundmail.UnklarObVerschickt);
    expect(senden).toHaveBeenCalledTimes(1);
    expect(notizenPosts()).toHaveLength(0);
  });

  it('Verweigerung: die Meldung sagt verständlich, dass nichts verschickt wurde – nicht „antwortet nicht“', async () => {
    const an = empfaenger();
    senden.mockRejectedValue(new ApiError(403, FAELLIGE_VERWEIGERT));
    const x = await faelligeSenden(eingabe(an)).catch((e: unknown) => e);
    expect(fehlerMeldung(x).text).toBe(FAELLIGE_VERWEIGERT);
    expect(FAELLIGE_VERWEIGERT).toMatch(/Verschickt wurde nichts/);
    expect(FAELLIGE_VERWEIGERT).not.toMatch(/antwortet/);
    expect(notizenPosts()).toHaveLength(0);
  });

  it('ungültiger Betreff/Text oder niemand ausgewählt: 422, es geht nichts raus', async () => {
    const an = empfaenger();
    await expect(faelligeSenden(eingabe(an, { betreff: ' ' }))).rejects.toMatchObject({
      status: 422,
    });
    await expect(faelligeSenden(eingabe(an, { text: 'Hallo [Betrag]' }))).rejects.toMatchObject({
      status: 422,
    });
    await expect(faelligeSenden(eingabe([]))).rejects.toMatchObject({ status: 422 });
    expect(senden).not.toHaveBeenCalled();
  });
});

describe('Wie sicher die Mails raus sind', () => {
  it('Protokoll nicht lesbar (üblich ohne Admin): die Übergabe hat geklappt → Vermerk wird geschrieben, die Meldung sagt „nicht lesbar“', async () => {
    const an = empfaenger();
    senden.mockResolvedValue({ bestaetigt: null });
    const r = await faelligeSenden(eingabe(an));
    expect(notizenPosts()).toHaveLength(2);
    expect(r.text).toMatch(/2 Mails verschickt, die Bestätigung von ChurchTools war nicht lesbar/);
    expect(r.text).toMatch(/Vermerk an beiden Aufgaben/);
  });

  it('im Protokoll fehlt eine Adresse: unklar, wer keine bekam → kein Vermerk, die Meldung sagt es', async () => {
    const an = empfaenger();
    senden.mockResolvedValue({ bestaetigt: 1 });
    const r = await faelligeSenden(eingabe(an));
    expect(notizenPosts()).toHaveLength(0);
    expect(r.vermerkUnsicher).toBe(true);
    expect(r.text).toMatch(/nur 1 von 2 Adressen/);
    expect(r.text).toMatch(/Vermerk nicht geschrieben/);
  });

  it('dieselbe Adresse bei zwei Personen zählt einmal (das Protokoll zählt Adressen)', async () => {
    const an = empfaenger();
    an[1] = { ...an[1], email: 'MIA@x.test' };
    senden.mockResolvedValue({ bestaetigt: 1 });
    const r = await faelligeSenden(eingabe(an));
    expect(r.adressen).toBe(1);
    expect(notizenPosts()).toHaveLength(2);
  });
});

describe('Der Vermerk wird nachgelesen und scheitert einzeln', () => {
  it('204 ohne dass die Notiz entsteht: gilt als fehlend – die Mail bleibt „verschickt“', async () => {
    const an = empfaenger();
    falsch.ignoriere.push('POST /followups');
    const r = await faelligeSenden(eingabe(an));
    expect(r.vermerkt).toEqual([]);
    expect(r.vermerkFehlt.map((f) => f.name)).toEqual(['Mia Muster', 'Ben Alt']);
    expect(r.text).toMatch(/^2 Mails verschickt,/);
    expect(r.text).toMatch(/Vermerk bei Mia Muster \(.*\) fehlt/);
    expect(r.text).not.toMatch(/noch einmal/);
  });

  it('das Nachlesen scheitert (503): die Notiz zählt nicht als bewiesen', async () => {
    const an = empfaenger();
    falsch.notizenLesenScheitert = 503;
    const r = await faelligeSenden(eingabe(an));
    expect(r.vermerkt).toEqual([]);
    expect(r.vermerkFehlt).toHaveLength(2);
  });

  it('bei einer Person scheitert das Schreiben: die andere bekommt ihren Vermerk trotzdem', async () => {
    const an = empfaenger();
    falsch.scheitert.push({ muster: `/followups/${an[0].aufgabeId}/notes`, status: 503 });
    const r = await faelligeSenden(eingabe(an));
    expect(r.vermerkt).toEqual(['Ben Alt']);
    expect(r.vermerkFehlt).toEqual([{ name: 'Mia Muster', grund: 'ChurchTools antwortet nicht' }]);
    expect(notizen(an[1].aufgabeId!)).toHaveLength(1);
    expect(r.text).toBe(
      '2 Mails verschickt, Vermerk an der Aufgabe, Vermerk bei Mia Muster (ChurchTools antwortet nicht) fehlt.',
    );
  });

  it('die Aufgabe ist inzwischen weg (404) oder verboten (403): der Grund steht in der Meldung', async () => {
    const an = empfaenger();
    // Mias Aufgabe wurde in der Zwischenzeit erledigt und gelöscht.
    falsch.aufgaben.set(
      GRUPPE,
      falsch.aufgaben.get(GRUPPE)!.filter((x) => x.id !== an[0].aufgabeId),
    );
    falsch.scheitert.push({ muster: `/followups/${an[1].aufgabeId}/notes`, status: 403 });
    const r = await faelligeSenden(eingabe(an));
    expect(r.vermerkFehlt).toEqual([
      { name: 'Mia Muster', grund: 'die Aufgabe gibt es nicht mehr' },
      { name: 'Ben Alt', grund: 'dir fehlt das Recht an der Aufgabe' },
    ]);
  });

  it('eine Person ohne offene Aufgabe: ihre Mail geht raus, es gibt keinen Schreibaufruf für sie, die Meldung nennt sie', async () => {
    const an = empfaenger();
    an[1] = { ...an[1], aufgabeId: null };
    const r = await faelligeSenden(eingabe(an));
    expect(notizenPosts()).toHaveLength(1);
    expect(r.ohneAufgabe).toEqual(['Ben Alt']);
    expect(r.text).toMatch(/keine offene Aufgabe bei Ben Alt/);
  });
});

describe('Was das Fenster beim Öffnen liest', () => {
  it('die Adressen der Personen und den Namen der angemeldeten Person', async () => {
    falsch.personen.set(10, {
      id: 10,
      firstName: 'Mia',
      lastName: 'Muster',
      email: ' mia@x.test ',
      birthday: null,
      street: null,
      zip: null,
      city: null,
    });
    falsch.personen.set(20, {
      id: 20,
      firstName: 'Ben',
      lastName: 'Alt',
      email: '',
      birthday: null,
      street: null,
      zip: null,
      city: null,
    });
    const r = await faelligeLaden([10, 20, 30]);
    expect([...r.emails]).toEqual([
      [10, 'mia@x.test'],
      [20, null],
    ]);
    expect(r.ich).toEqual({ personId: 7, name: 'Anna Leitung' });
  });

  it('keine fälligen Personen: keine Anfrage an die Personen', async () => {
    await faelligeLaden([]);
    expect(ct.ctDaten.mock.calls.some(([p]) => String(p).startsWith('/persons'))).toBe(false);
  });

  it('Adressen nicht sichtbar (403): ein Fehler mit Erklärung – nicht „niemand hat eine Adresse“', async () => {
    falsch.ohnePersonenRecht = true;
    await expect(faelligeLaden([10])).rejects.toThrow(/Mailadressen sind für dich/);
  });

  it('ChurchTools antwortet nicht (503): der Fehler bleibt ein Fehler', async () => {
    ct.ctDaten.mockImplementation((p: string) =>
      p.startsWith('/persons') ? Promise.reject(new ApiError(503, 'weg')) : falsch.holen(p),
    );
    await expect(faelligeLaden([10])).rejects.toMatchObject({ status: 503 });
  });
});

describe('heute', () => {
  it('der Vermerk trägt den Tag, der hereingegeben wird – keine Uhr im Schreiben', async () => {
    const an = empfaenger();
    const gestern = plusTage(HEUTE, -1);
    await faelligeSenden(eingabe(an, { heute: gestern }));
    expect(notizen(an[0].aufgabeId!)[0]).toContain(tagPunkt(gestern));
  });
});
