// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WEBSITE_LEITUNG, WEBSITE_REDAKTEUR, sichtbareSeiten } from '@shared/website/zugang';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { _vergissModul } from '@ui/ct/modulPort';
import { neueLeereSeite } from '@shared/website/seitenListe';
import { freigabeListe, freigabeZaehler } from '@shared/website/freigabe';
import {
  beginneBearbeiten,
  beginneEinstellungen,
  gebeFrei,
  ladeFreigaben,
  ladeWebsite,
  speichereEinstellungen,
  speichereSeite,
} from './daten';
import { demoStarten } from './demo';
import { ladeStart } from './start';
import {
  ladeRollen,
  ladeWerDarfWas,
  pruefeRechte,
  rechteSetzen,
  untergruppeRechteSetzen,
} from './rechte';

/**
 * `?demo` spielt ChurchTools nach – ohne dass eine Anfrage ins Netz geht (W3a-2). Die Tests laufen über dieselben Wege wie die
 * Oberfläche (`ladeStart`, `ladeWebsite`, `speichereSeite`, `beginneBearbeiten`), nicht über handgebaute Antworten.
 */
const ICH = { person: 1, name: 'Helene Wiebe', fenster: 'f1' };
const echtesFetch = vi.fn<typeof fetch>(() =>
  Promise.reject(new Error('echtes Netz – das darf der Demo-Modus nie berühren')),
);
const vorher = window.fetch;

beforeEach(() => {
  vi.stubEnv('BASE_URL', '/ccm/website/');
  _vergissCsrf();
  _bremseLoesen();
  _vergissModul();
  (window as { settings?: { base_url?: string } }).settings = { base_url: 'https://ct.test/' };
  window.fetch = echtesFetch;
  echtesFetch.mockClear();
});
afterEach(() => {
  window.fetch = vorher;
  delete (window as { settings?: unknown }).settings;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function ort(fall: string) {
  demoStarten(fall);
  const start = await ladeStart();
  return { start, ort: { modul: start.modul, kategorie: start.einrichtung!.entwuerfe! } };
}

describe('Demo ohne echte Anfragen', () => {
  it('Start, Lesen, Speichern, Sperre nehmen, Kalender: keine einzige Anfrage geht an das echte `fetch`, keine ist unbekannt', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { start, ort: o } = await ort('seiten');
    expect(start.zugang).toEqual(WEBSITE_LEITUNG);
    const stand = await ladeWebsite(o);
    expect(stand.seiten.map((s) => s.titel).sort()).toEqual([
      'Impressum',
      'Startseite',
      'Unsere Gruppen',
    ]);
    const neu = neueLeereSeite('Jugend', stand.seiten, () => 'n1');
    await speichereSeite(o, neu);
    expect((await ladeWebsite(o)).seiten.map((s) => s.id)).toContain('n1');
    expect((await beginneBearbeiten(o, 'n1', ICH)).art).toBe('ok');
    const kalender = await window.fetch('https://ct.test/api/calendars');
    expect(kalender.status).toBe(200);
    expect(echtesFetch).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('eine unbekannte Anfrage geht auch nicht ins Netz: 404 und eine Warnung', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    demoStarten('seiten');
    const r = await window.fetch('https://ct.test/api/gibt-es-nicht');
    expect(r.status).toBe(404);
    expect(warn).toHaveBeenCalledWith('Demo: unbekannte Anfrage', 'GET', '/gibt-es-nicht');
    expect(echtesFetch).not.toHaveBeenCalled();
  });

  it('der Demo-Speicher behält, was gespeichert wird, für die Sitzung (zweites Lesen zeigt es)', async () => {
    const { ort: o } = await ort('seiten');
    const stand = await ladeWebsite(o);
    const start = stand.seiten.find((s) => s.startseite)!;
    await speichereSeite(o, { ...start, titel: 'Neu benannt' });
    expect((await ladeWebsite(o)).seiten.find((s) => s.id === start.id)?.titel).toBe('Neu benannt');
  });
});

describe('Demo: fremd gesperrt', () => {
  it('die Startseite bearbeitet gerade Jonas Peters – beim Lesen und beim Nehmen', async () => {
    const { ort: o } = await ort('gesperrt');
    const stand = await ladeWebsite(o);
    const start = stand.seiten.find((s) => s.startseite)!;
    expect(stand.sperren[start.id]).toMatchObject({ von: 2, name: 'Jonas Peters' });
    expect(await beginneBearbeiten(o, start.id, ICH)).toMatchObject({
      art: 'gesperrt',
      sperre: { name: 'Jonas Peters' },
    });
    // andere Seiten sind frei
    const andere = stand.seiten.find((s) => !s.startseite)!;
    expect((await beginneBearbeiten(o, andere.id, ICH)).art).toBe('ok');
  });
});

describe('Demo: Speichern scheitert vorübergehend', () => {
  it('das ERSTE Speichern einer Seite wirft (503) – das zweite klappt, der Stand ist dann da', async () => {
    const { ort: o } = await ort('wackelt');
    const stand = await ladeWebsite(o);
    const start = stand.seiten.find((s) => s.startseite)!;
    const neu = { ...start, titel: 'Nach dem Wackeln' };
    await expect(speichereSeite(o, neu)).rejects.toMatchObject({ status: 503 });
    expect((await ladeWebsite(o)).seiten.find((s) => s.id === start.id)?.titel).toBe(start.titel); // nichts halb geschrieben
    await speichereSeite(o, neu);
    expect((await ladeWebsite(o)).seiten.find((s) => s.id === start.id)?.titel).toBe(
      'Nach dem Wackeln',
    );
  });

  it('andere Fälle wackeln nicht', async () => {
    const { ort: o } = await ort('seiten');
    const start = (await ladeWebsite(o)).seiten.find((s) => s.startseite)!;
    await expect(speichereSeite(o, { ...start, titel: 'Gleich klar' })).resolves.toBeUndefined();
  });
});

describe('Demo: Aussehen', () => {
  it('die Fälle mit Seiten haben gespeicherte Einstellungen (Farben, Schriften) – der Reiter zeigt etwas', async () => {
    const { ort: o } = await ort('seiten');
    const stand = await ladeWebsite(o);
    expect(stand.probleme).toEqual([]);
    expect(stand.einstellungen?.farben?.haupt).toBe('#00434c');
    expect(stand.einstellungen?.schriften?.akzent).toEqual({
      art: 'auswahl',
      name: 'Caveat Brush',
    });
    expect(stand.einstellungenSperre).toBeNull();
  });

  it('der Demo-Speicher behält neue Einstellungen für die Sitzung', async () => {
    const { ort: o } = await ort('seiten');
    const e = (await ladeWebsite(o)).einstellungen!;
    await speichereEinstellungen(o, { ...e, name: 'Neu benannt' });
    expect((await ladeWebsite(o)).einstellungen?.name).toBe('Neu benannt');
  });

  it('`aussehen-gesperrt`: Jonas Peters bearbeitet das Aussehen – beim Lesen und beim Nehmen; die Seiten sind frei', async () => {
    const { ort: o } = await ort('aussehen-gesperrt');
    const stand = await ladeWebsite(o);
    expect(stand.einstellungenSperre).toMatchObject({ von: 2, name: 'Jonas Peters' });
    expect(stand.sperren).toEqual({});
    expect(await beginneEinstellungen(o, ICH)).toMatchObject({ art: 'gesperrt' });
    const start = stand.seiten.find((s) => s.startseite)!;
    expect((await beginneBearbeiten(o, start.id, ICH)).art).toBe('ok');
  });

  it('in den anderen Fällen ist das Aussehen frei', async () => {
    const { ort: o } = await ort('seiten');
    expect((await beginneEinstellungen(o, ICH)).art).toBe('ok');
  });
});

describe('Demo: Rollen und „Wer darf was“ (W3b-1)', () => {
  it('Admin, Leitung, Redakteur: der Zugang kommt aus den Rechten der Demo-Person', async () => {
    expect((await ort('seiten')).start).toMatchObject({
      zugang: WEBSITE_LEITUNG,
      darfRechteSetzen: true,
    });
    expect((await ort('leitung')).start).toMatchObject({
      zugang: WEBSITE_LEITUNG,
      darfRechteSetzen: false,
    });
    expect((await ort('redakteur')).start).toMatchObject({
      zugang: WEBSITE_REDAKTEUR,
      darfRechteSetzen: false,
    });
  });

  it('Leitung ohne Rechte und Mitglied: kein Zugang – nur die Leitung bekommt den Hinweis', async () => {
    expect((await ort('leitung-ohne-rechte')).start).toMatchObject({
      zugang: null,
      leitungOhneRechte: true,
    });
    expect((await ort('mitglied')).start).toMatchObject({
      zugang: null,
      leitungOhneRechte: false,
    });
  });

  it('`seiten`: Leiter = Leitung, Mitarbeiter = Redakteur, Coach = kein Zugriff – aus den Rechten abgeleitet', async () => {
    const { start } = await ort('seiten');
    const kat = {
      entwuerfe: start.einrichtung!.entwuerfe!,
      veroeffentlicht: start.einrichtung!.veroeffentlicht!,
    };
    const w = await ladeWerDarfWas(start.einrichtung!.gruppe, kat);
    expect(w.rollen.map((r) => [r.name, r.leitung])).toEqual([
      ['Leiter', true],
      ['Mitarbeiter', false],
      ['Coach', false],
    ]);
    expect(w.ist.map((r) => r.stufe)).toEqual(['leitung', 'redakteur', 'keine']);
    // W3b-4a: „Website – Technik“ ist noch nicht eingerichtet – das ist der einzige Hinweis.
    expect(await pruefeRechte(start.einrichtung!.gruppe, kat)).toEqual({
      art: 'untergruppen',
      untergruppen: [{ name: 'Website – Technik', art: 'nicht-eingerichtet' }],
    });
  });

  it('`rechte-leer` → Hinweis „nichts“; Rechte setzen → alles stimmt; `rechte-abweicht` → Hinweis, setzen nimmt es zurück', async () => {
    const leer = await ort('rechte-leer');
    const g = leer.start.einrichtung!.gruppe;
    const kat = {
      entwuerfe: leer.start.einrichtung!.entwuerfe!,
      veroeffentlicht: leer.start.einrichtung!.veroeffentlicht!,
    };
    // W3b-4a: „Website – Technik“ (nicht eingerichtet) steht in jedem Fall dabei.
    const technik = { untergruppen: [{ name: 'Website – Technik', art: 'nicht-eingerichtet' }] };
    expect(await pruefeRechte(g, kat)).toEqual({ art: 'nichts', ...technik });
    await rechteSetzen(g, kat, [
      { rolle: 2, stufe: 'leitung' },
      { rolle: 3, stufe: 'redakteur' },
    ]);
    expect(await pruefeRechte(g, kat)).toEqual({ art: 'untergruppen', ...technik });

    const ab = await ort('rechte-abweicht');
    expect(await pruefeRechte(g, kat)).toEqual({
      art: 'abweicht',
      rollen: ['Mitarbeiter'],
      ...technik,
    });
    await rechteSetzen(g, kat, [{ rolle: 3, stufe: 'redakteur' }]);
    expect(await pruefeRechte(g, kat)).toEqual({ art: 'untergruppen', ...technik });
    expect(ab.start.zugang).toEqual(WEBSITE_LEITUNG);
  });

  it('W3b-4a: „Website – Technik“ einrichten → Kategorie, Rechte, Website-Rollen nachgezogen, kein Hinweis mehr; nichts geht ins Netz', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { start } = await ort('seiten');
    const g = start.einrichtung!.gruppe;
    const kat = {
      entwuerfe: start.einrichtung!.entwuerfe!,
      veroeffentlicht: start.einrichtung!.veroeffentlicht!,
    };
    const vorher = await ladeWerDarfWas(g, kat);
    expect(vorher.untergruppen.map((u) => [u.name, u.kategorie !== null])).toEqual([
      ['Website – Jugend', true],
      ['Website – Technik', false],
    ]);
    await untergruppeRechteSetzen(g, kat, { id: 22, name: 'Website – Technik' }, [
      { rolle: 2201, stufe: 'leitung' },
      { rolle: 2202, stufe: 'redakteur' },
    ]);
    expect(await pruefeRechte(g, kat)).toBeNull();
    const nachher = await ladeWerDarfWas(g, kat);
    expect(nachher.ist.map((r) => r.stufe)).toEqual(['leitung', 'redakteur', 'keine']);
    expect(nachher.untergruppen.map((u) => u.ist.map((r) => r.stufe))).toEqual([
      ['leitung', 'redakteur'],
      ['leitung', 'redakteur'],
    ]);
    expect(warn).not.toHaveBeenCalled();
    expect(echtesFetch).not.toHaveBeenCalled();
  });

  it('nicht eingerichtet: Rollen jeder Gruppe lesbar, nichts geht ins Netz', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    demoStarten('');
    expect((await ladeRollen(9)).map((r) => r.name)).toEqual(['Leiter', 'Mitarbeiter', 'Coach']);
    expect(warn).not.toHaveBeenCalled();
    expect(echtesFetch).not.toHaveBeenCalled();
  });
});

describe('Demo: Freigabe (W3b-2)', () => {
  it('`leitung`: drei Dinge warten (Impressum und Jugend eingereicht, „Alte Seite“ Löschen angefragt), „Unsere Gruppen“ ist geändert', async () => {
    const { start, ort: o } = await ort('leitung');
    const kat = {
      modul: start.modul,
      entwuerfe: o.kategorie,
      veroeffentlicht: start.einrichtung!.veroeffentlicht!,
    };
    const { entwurf, online } = await ladeFreigaben(kat);
    const liste = freigabeListe(entwurf, online, start.zugang!, start.ichId);
    expect(liste.map((e) => `${e.art}:${e.titel}`)).toEqual([
      'eingereicht:Jugend',
      'eingereicht:Impressum',
      'loeschenAngefragt:Alte Seite',
      'geaendert:Unsere Gruppen',
    ]);
    expect(freigabeZaehler(liste, start.zugang!)).toBe(3);
  });

  it('`redakteur`: eine zurückgegebene Seite mit Anmerkung, Zähler 1; kein Menü, keine Einstellungen', async () => {
    const { start, ort: o } = await ort('redakteur');
    const kat = {
      modul: start.modul,
      entwuerfe: o.kategorie,
      veroeffentlicht: start.einrichtung!.veroeffentlicht!,
    };
    const { entwurf, online } = await ladeFreigaben(kat);
    const liste = freigabeListe(entwurf, online, start.zugang!, start.ichId);
    expect(liste.map((e) => `${e.art}:${e.titel}`)).toEqual(['zurueck:Impressum']);
    expect(liste[0].status?.anmerkung).toMatch(/Hausnummer/);
    expect(freigabeZaehler(liste, start.zugang!)).toBe(1);
  });
});

describe('Demo: Bereiche (W3b-4b)', () => {
  const kategorienAus = (start: Awaited<ReturnType<typeof ladeStart>>, entwuerfe: number) => ({
    modul: start.modul,
    entwuerfe,
    veroeffentlicht: start.einrichtung!.veroeffentlicht!,
    untergruppen: (start.untergruppen ?? []).map((u) => ({
      gruppe: u.gruppe,
      kategorie: u.kategorie,
    })),
  });

  it('`jugend-redakteur`: Redakteur nur der Untergruppe – sieht die drei Jugend-Seiten, „Freizeit 2027“ muss verschoben werden', async () => {
    const { start, ort: o } = await ort('jugend-redakteur');
    expect(start.zugang).toEqual({ sieht: [21], leitet: [] });
    expect(start.untergruppen).toEqual([{ gruppe: 21, kategorie: 203, name: 'Website – Jugend' }]);
    const { entwurf, online } = await ladeFreigaben(kategorienAus(start, o.kategorie));
    expect(
      sichtbareSeiten(entwurf.seiten, start.zugang)
        .map((s) => s.titel)
        .sort(),
    ).toEqual(['Freizeit 2027', 'Jugend-Team', 'Jugendabend']);
    expect([...online.falsch]).toEqual(['demo-freizeit']);
  });

  it('`jugend-leitung`: gibt ihre Seiten frei; „Freizeit 2027“ geht nach Jugend, aus der Website-Kategorie darf sie sie nicht nehmen', async () => {
    const { start, ort: o } = await ort('jugend-leitung');
    expect(start.zugang).toEqual({ sieht: [21], leitet: [21] });
    const kat = kategorienAus(start, o.kategorie);
    const vorher = await ladeFreigaben(kat);
    const liste = freigabeListe(vorher.entwurf, vorher.online, start.zugang!, start.ichId);
    expect(liste.map((e) => `${e.art}:${e.titel}`)).toEqual([
      'eingereicht:Jugendabend',
      'geaendert:Freizeit 2027',
    ]);
    expect(freigabeZaehler(liste, start.zugang!)).toBe(1);
    const r = await gebeFrei(kat, { einheit: 'seite', id: 'demo-freizeit' });
    expect(r.bleibtIn).toEqual([null]);
    const nachher = await ladeFreigaben(kat);
    expect(nachher.online.liegtIn.get('demo-freizeit')).toEqual([null, 21]);
  });

  it('`bereiche`: Leitung der Website – Verschieben gelingt ganz', async () => {
    const { start, ort: o } = await ort('bereiche');
    expect(start.zugang).toEqual(WEBSITE_LEITUNG);
    const kat = kategorienAus(start, o.kategorie);
    const r = await gebeFrei(kat, { einheit: 'seite', id: 'demo-freizeit' });
    expect(r.bleibtIn).toBeUndefined();
    const nachher = await ladeFreigaben(kat);
    expect(nachher.online.liegtIn.get('demo-freizeit')).toEqual([21]);
    expect(nachher.online.falsch.size).toBe(0);
  });
});
