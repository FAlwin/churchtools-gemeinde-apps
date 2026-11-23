import { describe, expect, it, vi } from 'vitest';
import { seiteAlsText } from './modell';
import {
  alleFreigeben,
  freigabeListe,
  freigabeZaehler,
  gibFrei,
  kannEinreichen,
  menueOhneOnlineSeiten,
  onlineVergleich,
  seiteEntfernen,
  seitenLage,
  seitenStand,
  nurWebsite,
  onlineSicht,
  type OnlineSicht,
} from './freigabe';
import { WEBSITE_LEITUNG, WEBSITE_REDAKTEUR } from './zugang';
import {
  EINSTELLUNGEN_ID,
  MENUE_ID,
  einheitText,
  einstellungenSpeichern,
  menueSpeichern,
  seiteSpeichern,
  websiteAusWerten,
  type WebsiteStand,
} from './speicher';
import { statusSetzen } from './status';
import {
  ENTWUERFE,
  JUGEND,
  JUGEND_ONLINE,
  ONLINE,
  fakeFreigabeSpeicher,
  fehlerMit,
} from './freigabe.testutil';
import { baustein, einstellungen, menue, seiteMit } from './website.testdaten';

const JETZT = new Date('2026-11-20T10:00:00Z');
const SPAETER = new Date('2026-11-20T11:00:00Z');
const RITA = { person: 5, name: 'Rita Redakteurin', fenster: 'f1' };
const HELENE = { person: 1, name: 'Helene Wiebe', fenster: 'f2' };

const seiteA = () =>
  seiteMit([baustein('text', { id: 'ta', markdown: 'Hallo A' })], {
    id: 'a',
    pfad: 'a',
    titel: 'A',
  });
const seiteB = () =>
  seiteMit([baustein('text', { id: 'tb', markdown: 'Hallo B' })], {
    id: 'b',
    pfad: 'b',
    titel: 'B',
  });

async function lage() {
  const s = fakeFreigabeSpeicher();
  await seiteSpeichern(s.entwurfsOrt, seiteA(), JETZT);
  await seiteSpeichern(s.entwurfsOrt, seiteB(), JETZT);
  s.neuesLog();
  const lesen = (kategorie: number): WebsiteStand => websiteAusWerten(s.werte[kategorie]);
  return { s, lesen };
}

describe('Online-Vergleich: die vier Zustände', () => {
  it('nie veröffentlicht · online, unverändert · geändert seit der Freigabe · online, aber Entwurf gelöscht', async () => {
    const { s, lesen } = await lage();
    await seiteSpeichern(
      s.entwurfsOrt,
      seiteMit([baustein('text')], { id: 'c', pfad: 'c', titel: 'C' }),
      JETZT,
    );
    // a und c gehen online; danach ändert sich a im Entwurf, b war nie online; d war online, der Entwurf ist weg.
    await gibFrei(s.freigabeOrt, 'seite', 'a');
    await gibFrei(s.freigabeOrt, 'seite', 'c');
    await seiteSpeichern(
      s.onlineOrt,
      seiteMit([baustein('text')], { id: 'd', pfad: 'd', titel: 'D' }),
      JETZT,
    );
    await seiteSpeichern(
      s.entwurfsOrt,
      seiteMit([baustein('text', { id: 'ta', markdown: 'Hallo A, neu' })], {
        id: 'a',
        pfad: 'a',
        titel: 'A',
      }),
      SPAETER,
    );
    const v = onlineVergleich(lesen(ENTWUERFE).staende, lesen(ONLINE).staende);
    const lageVon = (id: string) => v.find((x) => x.id === id)?.lage;
    expect(lageVon('a')).toBe('geaendert');
    expect(lageVon('b')).toBe('nie');
    expect(lageVon('c')).toBe('gleich');
    expect(lageVon('d')).toBe('nurOnline');
  });

  it('dasselbe noch einmal speichern macht eine Seite nicht „geändert“ (die Prüfsumme zählt, nicht die Zeit)', async () => {
    const { s, lesen } = await lage();
    await gibFrei(s.freigabeOrt, 'seite', 'a');
    await seiteSpeichern(s.entwurfsOrt, seiteA(), SPAETER);
    const v = onlineVergleich(lesen(ENTWUERFE).staende, lesen(ONLINE).staende);
    expect(v.find((x) => x.id === 'a')?.lage).toBe('gleich');
  });

  it('seitenLage rechnet mit der Seite selbst – dieselbe Prüfsumme, die das Speichern schreibt', async () => {
    const { s, lesen } = await lage();
    expect(seitenStand(seiteA())).toBe(lesen(ENTWUERFE).staende.find((x) => x.id === 'a')!.stand);
    await gibFrei(s.freigabeOrt, 'seite', 'a');
    const online = lesen(ONLINE).staende;
    expect(seitenLage(seiteA(), online)).toBe('gleich');
    expect(seitenLage(seiteB(), online)).toBe('nie');
    expect(seitenLage({ ...seiteA(), titel: 'Anders' }, online)).toBe('geaendert');
    expect(seitenLage(seiteA(), null)).toBeNull();
  });
});

describe('gibFrei: schreibt exakt den Entwurf nach „Veröffentlicht“', () => {
  it('der Text online ist Zeichen für Zeichen der Text aus „Entwürfe“, derselbe Stand', async () => {
    const { s } = await lage();
    await gibFrei(s.freigabeOrt, 'seite', 'a');
    const e = einheitText(s.werte[ENTWUERFE], 'seite', 'a')!;
    const o = einheitText(s.werte[ONLINE], 'seite', 'a')!;
    expect(o.text).toBe(e.text);
    expect(o.text).toBe(seiteAlsText(seiteA()));
    expect(o.stand).toBe(e.stand);
  });

  it('Menü und Einstellungen sind eigene Einheiten und gehen ebenso', async () => {
    const { s } = await lage();
    await menueSpeichern(
      s.entwurfsOrt,
      menue([{ titel: 'A', ziel: { art: 'seite', seiteId: 'a' } }]),
      JETZT,
    );
    await einstellungenSpeichern(s.entwurfsOrt, einstellungen({ name: 'Meine Gemeinde' }), JETZT);
    await gibFrei(s.freigabeOrt, 'menue', MENUE_ID);
    await gibFrei(s.freigabeOrt, 'einstellungen', EINSTELLUNGEN_ID);
    const o = websiteAusWerten(s.werte[ONLINE]);
    expect(o.menue?.eintraege[0].titel).toBe('A');
    expect(o.einstellungen?.name).toBe('Meine Gemeinde');
  });

  it('der Status wird ERST nach dem Nachlesen entfernt', async () => {
    const { s } = await lage();
    await statusSetzen(s.entwurfsOrt, 'a', { zustand: 'eingereicht' }, RITA, JETZT);
    s.neuesLog();
    const r = await gibFrei(s.freigabeOrt, 'seite', 'a');
    expect(r.statusEntfernt).toBe(true);
    expect(websiteAusWerten(s.werte[ENTWUERFE]).status).toEqual({});
    // Reihenfolge der Zugriffe: das Löschen des Status (Entwürfe) kommt nach dem letzten LESEN von „Veröffentlicht“.
    const iNachlesen = s.log
      .map((z, i) => (z.kategorie === ONLINE && z.art === 'LESEN' ? i : -1))
      .filter((i) => i >= 0)
      .at(-1)!;
    const iStatusWeg = s.log.findIndex((z) => z.kategorie === ENTWUERFE && z.art === 'DELETE');
    expect(iStatusWeg).toBeGreaterThan(iNachlesen);
  });

  it('wird der Status NICHT entfernt, wenn der Nachlese-Beleg fehlt: die Zusage ohne Ergebnis (201, nichts angelegt) bricht ab', async () => {
    const { s } = await lage();
    await statusSetzen(s.entwurfsOrt, 'a', { zustand: 'eingereicht' }, RITA, JETZT);
    const echt = s.port.schreibe;
    s.port.schreibe = (pfad, a) =>
      pfad.includes(`/${ONLINE}/`) ? Promise.resolve() : echt(pfad, a);
    await expect(gibFrei(s.freigabeOrt, 'seite', 'a')).rejects.toMatchObject({ status: 502 });
    expect(websiteAusWerten(s.werte[ENTWUERFE]).status.a?.zustand).toBe('eingereicht');
    expect(s.werte[ONLINE]).toEqual([]);
  });

  it('wurde der Entwurf nach dem Lesen weitergeändert (E-W24), geht der Stand online – der Status BLEIBT', async () => {
    const { s } = await lage();
    await statusSetzen(s.entwurfsOrt, 'a', { zustand: 'eingereicht' }, RITA, JETZT);
    // Mitten in der Freigabe speichert die Redakteurin neu: gleich nach dem ersten Schreiben in „Veröffentlicht“.
    const echt = s.port.schreibe;
    let ersetzt = false;
    s.port.schreibe = async (pfad, a) => {
      await echt(pfad, a);
      if (!ersetzt && pfad.includes(`/${ONLINE}/`)) {
        ersetzt = true;
        await seiteSpeichern(
          s.entwurfsOrt,
          seiteMit([baustein('text', { id: 'ta', markdown: 'Nachträglich geändert' })], {
            id: 'a',
            pfad: 'a',
            titel: 'A',
          }),
          SPAETER,
        );
      }
    };
    const r = await gibFrei(s.freigabeOrt, 'seite', 'a');
    expect(r).toMatchObject({ statusEntfernt: false, grund: 'geaendert' });
    expect(websiteAusWerten(s.werte[ENTWUERFE]).status.a?.zustand).toBe('eingereicht');
  });

  it('hat zwischen Schreiben und Nachlesen jemand anderes online etwas anderes hingelegt, wird das gemeldet – der Status bleibt, es gilt nichts als erledigt', async () => {
    const { s } = await lage();
    await statusSetzen(s.entwurfsOrt, 'a', { zustand: 'eingereicht' }, RITA, JETZT);
    // Der erste Online-Lesezugriff NACH `einheitSpeichern` (dessen vier Lesezugriffe: vorher, nach Teilen, nach Kopf) ist das Nachlesen
    // der Freigabe: Genau davor legt jemand anderes einen anderen Stand ab.
    let lesen = 0;
    let gestoert = false;
    s.steuerung.ausfall = (z) => {
      if (z.kategorie === ONLINE && z.art === 'LESEN' && ++lesen === 4) {
        gestoert = true;
        const kopf = s.werte[ONLINE].find((w) => w.value.includes('"website-kopf"'))!;
        kopf.value = kopf.value.replace(/"stand":"[0-9a-f]+"/, '"stand":"fremd000"');
      }
      return undefined;
    };
    await expect(gibFrei(s.freigabeOrt, 'seite', 'a')).rejects.toMatchObject({ status: 502 });
    expect(gestoert).toBe(true);
    expect(websiteAusWerten(s.werte[ENTWUERFE]).status.a?.zustand).toBe('eingereicht');
  });

  it('ein Entwurf, der nicht gültig ist, geht nie nach „Veröffentlicht“', async () => {
    // Ein Stand, dessen Text kein gültiges Format hat (vollständig gespeichert, aber keine Seite).
    const ungueltig = fakeFreigabeSpeicher();
    const { einheitSpeichern } = await import('./speicher');
    await einheitSpeichern(ungueltig.entwurfsOrt, 'seite', 'x', 'kein gültiger Seitentext', JETZT);
    await expect(gibFrei(ungueltig.freigabeOrt, 'seite', 'x')).rejects.toMatchObject({
      status: 422,
    });
    expect(ungueltig.schreibzugriffe(ONLINE)).toEqual([]);
  });
});

describe('gibFrei: Fehlerzweige einzeln', () => {
  it('vorübergehend (503) beim Schreiben: nichts ist online, der Status bleibt, ein neuer Versuch klappt', async () => {
    const { s } = await lage();
    await statusSetzen(s.entwurfsOrt, 'a', { zustand: 'eingereicht' }, RITA, JETZT);
    s.steuerung.ausfall = (z) =>
      z.kategorie === ONLINE && z.art === 'POST' ? fehlerMit(503) : undefined;
    await expect(gibFrei(s.freigabeOrt, 'seite', 'a')).rejects.toMatchObject({ status: 503 });
    expect(websiteAusWerten(s.werte[ONLINE]).seiten).toEqual([]);
    expect(websiteAusWerten(s.werte[ENTWUERFE]).status.a?.zustand).toBe('eingereicht');
    s.steuerung.ausfall = () => undefined;
    await expect(gibFrei(s.freigabeOrt, 'seite', 'a')).resolves.toMatchObject({
      statusEntfernt: true,
    });
    expect(websiteAusWerten(s.werte[ONLINE]).seiten.map((x) => x.id)).toEqual(['a']);
  });

  it.each([401, 403])(
    '%i beim Schreiben nach „Veröffentlicht“: klare Meldung „dafür fehlt das Recht“, nichts verändert',
    async (status) => {
      const { s } = await lage();
      await statusSetzen(s.entwurfsOrt, 'a', { zustand: 'eingereicht' }, RITA, JETZT);
      s.steuerung.ausfall = (z) =>
        z.kategorie === ONLINE && z.art === 'POST' ? fehlerMit(status) : undefined;
      const e = await gibFrei(s.freigabeOrt, 'seite', 'a').catch((x: Error) => x);
      expect((e as Error).message).toMatch(/fehlt dir das Recht/);
      expect(websiteAusWerten(s.werte[ENTWUERFE]).status.a?.zustand).toBe('eingereicht');
    },
  );

  it('halb geschafft (Teile geschrieben, Kopf nicht): der alte Online-Stand bleibt gültig; der nächste Versuch räumt auf', async () => {
    const { s } = await lage();
    await gibFrei(s.freigabeOrt, 'seite', 'a');
    const alt = einheitText(s.werte[ONLINE], 'seite', 'a')!;
    await seiteSpeichern(
      s.entwurfsOrt,
      seiteMit([baustein('text', { id: 'ta', markdown: 'Version 2' })], {
        id: 'a',
        pfad: 'a',
        titel: 'A',
      }),
      SPAETER,
    );
    // Der Kopf (PUT in „Veröffentlicht“) scheitert.
    s.steuerung.ausfall = (z) =>
      z.kategorie === ONLINE && z.art === 'PUT' ? fehlerMit(503) : undefined;
    await expect(gibFrei(s.freigabeOrt, 'seite', 'a')).rejects.toMatchObject({ status: 503 });
    expect(einheitText(s.werte[ONLINE], 'seite', 'a')).toMatchObject({
      text: alt.text,
      stand: alt.stand,
    });
    expect(
      websiteAusWerten(s.werte[ONLINE]).seiten[0].abschnitte[0].spalten[0].bausteine[0],
    ).toMatchObject({ markdown: 'Hallo A' });
    s.steuerung.ausfall = () => undefined;
    await gibFrei(s.freigabeOrt, 'seite', 'a');
    const neu = einheitText(s.werte[ONLINE], 'seite', 'a')!;
    expect(neu.text).toBe(einheitText(s.werte[ENTWUERFE], 'seite', 'a')!.text);
    // keine liegengebliebenen Teile des alten Stands
    expect(
      s.werte[ONLINE].filter((w) => w.value.includes('"website-teil"')).every((w) =>
        w.value.includes(neu.stand),
      ),
    ).toBe(true);
  });

  it('kann der Status nach der Freigabe nicht entfernt werden, ist die Seite trotzdem online – gemeldet, nicht verschwiegen', async () => {
    const { s } = await lage();
    await statusSetzen(s.entwurfsOrt, 'a', { zustand: 'eingereicht' }, RITA, JETZT);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    s.steuerung.ausfall = (z) =>
      z.kategorie === ENTWUERFE && z.art === 'DELETE' ? fehlerMit(503) : undefined;
    const r = await gibFrei(s.freigabeOrt, 'seite', 'a');
    expect(r).toMatchObject({ statusEntfernt: false, grund: 'fehler' });
    expect(websiteAusWerten(s.werte[ONLINE]).seiten.map((x) => x.id)).toEqual(['a']);
  });
});

describe('seiteEntfernen (offline nehmen)', () => {
  it('erst offline, dann der Entwurf samt Status – beides weg', async () => {
    const { s } = await lage();
    await gibFrei(s.freigabeOrt, 'seite', 'a');
    await statusSetzen(s.entwurfsOrt, 'a', { zustand: 'loeschenAngefragt' }, RITA, JETZT);
    s.neuesLog();
    await seiteEntfernen(s.freigabeOrt, 'a');
    expect(websiteAusWerten(s.werte[ONLINE]).seiten).toEqual([]);
    const e = websiteAusWerten(s.werte[ENTWUERFE]);
    expect(e.seiten.map((x) => x.id)).toEqual(['b']);
    expect(e.status).toEqual({});
    const erstesOnline = s.log.findIndex((z) => z.kategorie === ONLINE && z.art === 'DELETE');
    const erstesEntwurf = s.log.findIndex((z) => z.kategorie === ENTWUERFE && z.art === 'DELETE');
    expect(erstesOnline).toBeLessThan(erstesEntwurf);
  });

  it('scheitert das Offline-Nehmen vorübergehend, bleiben Entwurf und „Löschen angefragt“ stehen', async () => {
    const { s } = await lage();
    await gibFrei(s.freigabeOrt, 'seite', 'a');
    await statusSetzen(s.entwurfsOrt, 'a', { zustand: 'loeschenAngefragt' }, RITA, JETZT);
    s.steuerung.ausfall = (z) =>
      z.kategorie === ONLINE && z.art === 'DELETE' ? fehlerMit(503) : undefined;
    await expect(seiteEntfernen(s.freigabeOrt, 'a')).rejects.toMatchObject({ status: 503 });
    const e = websiteAusWerten(s.werte[ENTWUERFE]);
    expect(e.seiten.map((x) => x.id).sort()).toEqual(['a', 'b']);
    expect(e.status.a?.zustand).toBe('loeschenAngefragt');
  });

  it('„online, aber Entwurf gelöscht“: nur online entfernen', async () => {
    const { s } = await lage();
    await seiteSpeichern(
      s.onlineOrt,
      seiteMit([baustein('text')], { id: 'z', pfad: 'z', titel: 'Z' }),
      JETZT,
    );
    await seiteEntfernen(s.freigabeOrt, 'z');
    expect(websiteAusWerten(s.werte[ONLINE]).seiten).toEqual([]);
  });

  it('401 beim Löschen in „Veröffentlicht“: klare Meldung, der Entwurf bleibt', async () => {
    const { s } = await lage();
    await gibFrei(s.freigabeOrt, 'seite', 'a');
    s.steuerung.ausfall = (z) =>
      z.kategorie === ONLINE && z.art === 'DELETE' ? fehlerMit(401) : undefined;
    await expect(seiteEntfernen(s.freigabeOrt, 'a')).rejects.toThrow(/fehlt dir das Recht/);
    expect(websiteAusWerten(s.werte[ENTWUERFE]).seiten.map((x) => x.id)).toContain('a');
  });
});

describe('alleFreigeben', () => {
  it('Seiten zuerst, dann Menü, dann Einstellungen – das Menü zeigt nie auf eine Seite, die noch nicht online ist', async () => {
    const { s } = await lage();
    await menueSpeichern(
      s.entwurfsOrt,
      menue([{ titel: 'A', ziel: { art: 'seite', seiteId: 'a' } }]),
      JETZT,
    );
    await einstellungenSpeichern(s.entwurfsOrt, einstellungen(), JETZT);
    s.neuesLog();
    const r = await alleFreigeben(s.freigabeOrt, [
      { einheit: 'einstellungen', id: EINSTELLUNGEN_ID },
      { einheit: 'menue', id: MENUE_ID },
      { einheit: 'seite', id: 'a' },
    ]);
    expect(r.fehler).toBeNull();
    expect(r.geschafft.map((z) => z.einheit)).toEqual(['seite', 'menue', 'einstellungen']);
  });

  it('bricht beim ersten Fehler ab und zeigt, was geschafft ist', async () => {
    const { s } = await lage();
    // b scheitert (Teile von b enthalten „Hallo B“ nicht lesbar – wir lassen jeden Schreibzugriff mit b scheitern)
    s.steuerung.ausfall = (z) =>
      z.kategorie === ONLINE && z.art === 'POST' && z.wert?.includes('"id":"b"')
        ? fehlerMit(503)
        : undefined;
    const r = await alleFreigeben(s.freigabeOrt, [
      { einheit: 'seite', id: 'a' },
      { einheit: 'seite', id: 'b' },
      { einheit: 'menue', id: MENUE_ID },
    ]);
    expect(r.geschafft).toEqual([{ einheit: 'seite', id: 'a' }]);
    expect(r.fehler?.ziel).toEqual({ einheit: 'seite', id: 'b' });
    expect(r.offen).toBe(1);
    expect(websiteAusWerten(s.werte[ONLINE]).seiten.map((x) => x.id)).toEqual(['a']);
  });
});

describe('Liste und Zähler je Rolle', () => {
  async function szenario() {
    const { s, lesen } = await lage();
    await menueSpeichern(
      s.entwurfsOrt,
      menue([{ titel: 'B', ziel: { art: 'seite', seiteId: 'b' } }]),
      JETZT,
    );
    await einstellungenSpeichern(s.entwurfsOrt, einstellungen(), JETZT);
    await seiteSpeichern(
      s.entwurfsOrt,
      seiteMit([baustein('text')], { id: 'c', pfad: 'c', titel: 'C' }),
      JETZT,
    );
    await seiteSpeichern(
      s.entwurfsOrt,
      seiteMit([baustein('text')], { id: 'd', pfad: 'd', titel: 'D' }),
      JETZT,
    );
    await seiteSpeichern(
      s.onlineOrt,
      seiteMit([baustein('text')], { id: 'weg', pfad: 'weg', titel: 'Weg' }),
      JETZT,
    );
    await statusSetzen(s.entwurfsOrt, 'a', { zustand: 'eingereicht' }, RITA, SPAETER);
    await statusSetzen(
      s.entwurfsOrt,
      'b',
      { zustand: 'zurueck', anmerkung: 'Bitte ändern', einreicher: { von: 5, name: RITA.name } },
      HELENE,
      SPAETER,
    );
    await statusSetzen(s.entwurfsOrt, 'c', { zustand: 'loeschenAngefragt' }, RITA, SPAETER);
    await statusSetzen(
      s.entwurfsOrt,
      'd',
      { zustand: 'eingereicht' },
      { person: 9, name: 'Anderer', fenster: 'f9' },
      JETZT,
    );
    return { e: lesen(ENTWUERFE), o: lesen(ONLINE) };
  }

  it('Leitung: eingereichte zuerst (älteste oben), Löschen angefragt, Zurückgegebenes, Menü, Aussehen, online-ohne-Entwurf', async () => {
    const { e, o } = await szenario();
    const l = freigabeListe(e, nurWebsite(e, o), WEBSITE_LEITUNG, 1);
    expect(l.map((x) => `${x.art}:${x.id}`)).toEqual([
      'eingereicht:d',
      'eingereicht:a',
      'loeschenAngefragt:c',
      'zurueck:b',
      `menue:${MENUE_ID}`,
      `einstellungen:${EINSTELLUNGEN_ID}`,
      'nurOnline:weg',
    ]);
    expect(freigabeZaehler(l, WEBSITE_LEITUNG)).toBe(3);
  });

  it('Leitung sieht auch eigene Änderungen ohne Status: geändert und neu', async () => {
    const { s, lesen } = await lage();
    await gibFrei(s.freigabeOrt, 'seite', 'a');
    await seiteSpeichern(
      s.entwurfsOrt,
      seiteMit([baustein('text', { id: 'ta', markdown: 'neu' })], {
        id: 'a',
        pfad: 'a',
        titel: 'A',
      }),
      SPAETER,
    );
    const l = freigabeListe(
      lesen(ENTWUERFE),
      nurWebsite(lesen(ENTWUERFE), lesen(ONLINE)),
      WEBSITE_LEITUNG,
      1,
    );
    expect(l.map((x) => `${x.art}:${x.id}`)).toEqual(['geaendert:a', 'neu:b']);
    expect(freigabeZaehler(l, WEBSITE_LEITUNG)).toBe(0);
  });

  it('Redakteur: nur die eigenen eingereichten, zurückgegebenen und angefragten Seiten – kein Menü, keine Einstellungen, kein Fremdes', async () => {
    const { e, o } = await szenario();
    const l = freigabeListe(e, nurWebsite(e, o), WEBSITE_REDAKTEUR, 5);
    expect(l.map((x) => `${x.art}:${x.id}`)).toEqual([
      'eingereicht:a',
      'loeschenAngefragt:c',
      'zurueck:b',
    ]);
    expect(l.some((x) => x.einheit !== 'seite')).toBe(false);
    expect(freigabeZaehler(l, WEBSITE_REDAKTEUR)).toBe(1);
    // Eine andere Redakteurin sieht davon nichts und hat keinen Zähler.
    const fremd = freigabeListe(e, nurWebsite(e, o), WEBSITE_REDAKTEUR, 77);
    expect(fremd).toEqual([]);
    expect(freigabeZaehler(fremd, WEBSITE_REDAKTEUR)).toBe(0);
  });

  it('das Menü warnt, wenn es auf Seiten verweist, die noch nicht online sind', async () => {
    const { e, o } = await szenario();
    const m = freigabeListe(e, nurWebsite(e, o), WEBSITE_LEITUNG, 1).find(
      (x) => x.einheit === 'menue',
    )!;
    expect(m.warnung).toMatch(/noch nicht online sind: B/);
    expect(menueOhneOnlineSeiten(e.menue, e.seiten, o.staende)).toEqual(['B']);
    expect(menueOhneOnlineSeiten(e.menue, e.seiten, e.staende)).toEqual([]);
    expect(menueOhneOnlineSeiten(null, [], [])).toEqual([]);
  });

  it('ein Status ohne Seite taucht in keiner Liste auf', async () => {
    const { s, lesen } = await lage();
    s.lege(
      ENTWUERFE,
      JSON.stringify({
        art: 'website-status',
        fassung: 1,
        id: 'geloescht',
        zustand: 'eingereicht',
        von: 5,
        name: 'X',
        zeit: JETZT.toISOString(),
      }),
    );
    const l = freigabeListe(
      lesen(ENTWUERFE),
      nurWebsite(lesen(ENTWUERFE), lesen(ONLINE)),
      WEBSITE_LEITUNG,
      1,
    );
    expect(l.some((x) => x.id === 'geloescht')).toBe(false);
  });
});

describe('Einreichen nur, wenn es etwas einzureichen gibt', () => {
  const st = (zustand: 'eingereicht' | 'zurueck' | 'loeschenAngefragt') => ({
    zustand,
    von: 5,
    name: 'R',
    zeit: JETZT.toISOString(),
  });
  it('nie online oder geändert: ja; unverändert online: nein', () => {
    expect(kannEinreichen('nie', null)).toBe(true);
    expect(kannEinreichen('geaendert', null)).toBe(true);
    expect(kannEinreichen('gleich', null)).toBe(false);
  });
  it('schon eingereicht oder Löschen angefragt: nein; zurückgegeben: erneut ja; Online-Stand unbekannt: ja', () => {
    expect(kannEinreichen('geaendert', st('eingereicht'))).toBe(false);
    expect(kannEinreichen('geaendert', st('loeschenAngefragt'))).toBe(false);
    expect(kannEinreichen('geaendert', st('zurueck'))).toBe(true);
    expect(kannEinreichen(null, null)).toBe(true);
  });
});

// ── Bereiche (W3b-4b) ──────────────────────────────────────────────────────────────────────────────────────────────────
// Website-Kategorie ONLINE (2), Jugend = Gruppe 347 mit Kategorie 117 – verschiedene Zahlen, damit Verwechslungen auffallen.

const jugendSeite = (id = 'j', titel = 'Jugendabend') => ({
  ...seiteMit([baustein('text', { id: `t${id}`, markdown: titel })], { id, pfad: id, titel }),
  bereich: JUGEND,
});

/** Die Sicht über beide Kategorien, wie die Oberfläche sie aus `ladeOnline` baut. */
function sichtAus(s: ReturnType<typeof fakeFreigabeSpeicher>): {
  e: WebsiteStand;
  sicht: OnlineSicht;
} {
  const e = websiteAusWerten(s.werte[ENTWUERFE]);
  return {
    e,
    sicht: onlineSicht(e, [
      { bereich: null, kategorie: ONLINE, stand: websiteAusWerten(s.werte[ONLINE]) },
      {
        bereich: JUGEND,
        kategorie: JUGEND_ONLINE,
        stand: websiteAusWerten(s.werte[JUGEND_ONLINE]),
      },
    ]),
  };
}
const liegtIn = (s: ReturnType<typeof fakeFreigabeSpeicher>, kategorie: number, id: string) =>
  einheitText(s.werte[kategorie], 'seite', id) !== null;

describe('Freigeben je Bereich (W3b-4b)', () => {
  it('eine Seite der Untergruppe geht in DEREN Kategorie – die der Website bleibt unberührt', async () => {
    const s = fakeFreigabeSpeicher();
    await seiteSpeichern(s.entwurfsOrt, jugendSeite(), JETZT);
    s.neuesLog();
    const r = await gibFrei(s.bereichsOrt, 'seite', 'j');
    expect(r.bleibtIn).toBeUndefined();
    expect(liegtIn(s, JUGEND_ONLINE, 'j')).toBe(true);
    expect(liegtIn(s, ONLINE, 'j')).toBe(false);
    expect(s.schreibzugriffe(ONLINE)).toEqual([]);
    expect(s.schreibzugriffe(JUGEND_ONLINE).length).toBeGreaterThan(0);
  });

  it('eine Seite ohne Bereich geht in die Kategorie der Website – auch wenn es Untergruppen gibt', async () => {
    const s = fakeFreigabeSpeicher();
    await seiteSpeichern(s.entwurfsOrt, seiteA(), JETZT);
    await gibFrei(s.bereichsOrt, 'seite', 'a');
    expect(liegtIn(s, ONLINE, 'a')).toBe(true);
    expect(liegtIn(s, JUGEND_ONLINE, 'a')).toBe(false);
  });

  it('Bereich nicht eingerichtet (keine Kategorie): klare Meldung, NICHTS geschrieben, Status bleibt', async () => {
    const s = fakeFreigabeSpeicher();
    await seiteSpeichern(s.entwurfsOrt, { ...jugendSeite(), bereich: 348 }, JETZT);
    await statusSetzen(s.entwurfsOrt, 'j', { zustand: 'eingereicht' }, RITA, JETZT);
    s.neuesLog();
    await expect(gibFrei(s.bereichsOrt, 'seite', 'j')).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(
        /Jugendabend“ gehört zu einer Untergruppe, die noch nicht eingerichtet ist/,
      ),
    });
    expect(s.schreibzugriffe()).toEqual([]);
    // Ohne die Kategorie der Untergruppe im Ort (Person sieht sie nicht) dasselbe.
    await seiteSpeichern(s.entwurfsOrt, jugendSeite(), JETZT);
    s.neuesLog();
    await expect(gibFrei(s.freigabeOrt, 'seite', 'j')).rejects.toMatchObject({ status: 409 });
    expect(s.schreibzugriffe()).toEqual([]);
  });

  it('Verschieben: erst in die neue Kategorie schreiben, nachlesen – ERST DANN aus der alten löschen', async () => {
    const s = fakeFreigabeSpeicher();
    // Freigegeben, als die Seite noch der Website gehörte …
    await seiteSpeichern(s.entwurfsOrt, { ...jugendSeite(), bereich: undefined }, JETZT);
    await gibFrei(s.bereichsOrt, 'seite', 'j');
    expect(liegtIn(s, ONLINE, 'j')).toBe(true);
    // … dann hat die Leitung der Website den Bereich auf Jugend gestellt.
    await seiteSpeichern(s.entwurfsOrt, jugendSeite(), SPAETER);
    s.neuesLog();
    const r = await gibFrei(s.bereichsOrt, 'seite', 'j');
    expect(r).toMatchObject({ statusEntfernt: true });
    expect(r.bleibtIn).toBeUndefined();
    expect(liegtIn(s, JUGEND_ONLINE, 'j')).toBe(true);
    expect(liegtIn(s, ONLINE, 'j')).toBe(false);
    // Reihenfolge: letzter Schreibzugriff in 117 und das Nachlesen dort liegen VOR dem ersten Löschen in der alten Kategorie.
    const i = (pred: (z: (typeof s.log)[number]) => boolean) => s.log.findIndex(pred);
    const ersteLoeschungAlt = i((z) => z.kategorie === ONLINE && z.art === 'DELETE');
    const letztesSchreibenNeu = s.log.reduce(
      (n, z, k) => (z.kategorie === JUGEND_ONLINE && z.art !== 'LESEN' ? k : n),
      -1,
    );
    const nachlesenNeu = s.log.findIndex(
      (z, k) => k > letztesSchreibenNeu && z.kategorie === JUGEND_ONLINE && z.art === 'LESEN',
    );
    expect(ersteLoeschungAlt).toBeGreaterThan(-1);
    expect(letztesSchreibenNeu).toBeLessThan(ersteLoeschungAlt);
    expect(nachlesenNeu).toBeGreaterThan(letztesSchreibenNeu);
    expect(nachlesenNeu).toBeLessThan(ersteLoeschungAlt);
  });

  it('scheitert das Schreiben in die neue Kategorie, wird in der alten nichts gelöscht', async () => {
    const s = fakeFreigabeSpeicher();
    await seiteSpeichern(s.entwurfsOrt, { ...jugendSeite(), bereich: undefined }, JETZT);
    await gibFrei(s.bereichsOrt, 'seite', 'j');
    await seiteSpeichern(s.entwurfsOrt, jugendSeite(), SPAETER);
    s.neuesLog();
    s.steuerung.ausfall = (z) =>
      z.kategorie === JUGEND_ONLINE && z.art !== 'LESEN' ? fehlerMit(503) : undefined;
    await expect(gibFrei(s.bereichsOrt, 'seite', 'j')).rejects.toBeTruthy();
    expect(s.schreibzugriffe(ONLINE)).toEqual([]);
    expect(liegtIn(s, ONLINE, 'j')).toBe(true);
  });

  it('alte Kategorie lässt sich nicht löschen (kein Recht): Seite ist in der neuen online, Ergebnis sagt „bleibt in Website“ – kein Fehler', async () => {
    const s = fakeFreigabeSpeicher();
    await seiteSpeichern(s.entwurfsOrt, { ...jugendSeite(), bereich: undefined }, JETZT);
    await gibFrei(s.bereichsOrt, 'seite', 'j');
    await seiteSpeichern(s.entwurfsOrt, jugendSeite(), SPAETER);
    await statusSetzen(s.entwurfsOrt, 'j', { zustand: 'eingereicht' }, RITA, SPAETER);
    s.steuerung.ausfall = (z) =>
      z.kategorie === ONLINE && z.art === 'DELETE' ? fehlerMit(403) : undefined;
    const r = await gibFrei(s.bereichsOrt, 'seite', 'j');
    expect(r.bleibtIn).toEqual([null]);
    expect(r.statusEntfernt).toBe(true);
    expect(liegtIn(s, JUGEND_ONLINE, 'j')).toBe(true);
    expect(liegtIn(s, ONLINE, 'j')).toBe(true);
    // Die Liste zeigt das: Die Seite steht weiter als „geändert“ (muss verschoben werden).
    const { e, sicht } = sichtAus(s);
    const eintrag = freigabeListe(e, sicht, WEBSITE_LEITUNG, 1).find((x) => x.id === 'j');
    expect(eintrag).toMatchObject({ art: 'geaendert', verschieben: true, bereich: JUGEND });
  });

  it('alte Kategorie ohne Leserecht: übersprungen, kein Fehler, nichts gemeldet', async () => {
    const s = fakeFreigabeSpeicher();
    await seiteSpeichern(s.entwurfsOrt, jugendSeite(), JETZT);
    s.steuerung.ausfall = (z) => (z.kategorie === ONLINE ? fehlerMit(401) : undefined);
    const r = await gibFrei(s.bereichsOrt, 'seite', 'j');
    expect(r.bleibtIn).toBeUndefined();
    expect(liegtIn(s, JUGEND_ONLINE, 'j')).toBe(true);
  });

  it('„Alles freigeben“: jede Seite in die Kategorie ihres Bereichs, „bleibt“ wird gesammelt', async () => {
    const s = fakeFreigabeSpeicher();
    await seiteSpeichern(s.entwurfsOrt, seiteA(), JETZT);
    await seiteSpeichern(s.entwurfsOrt, { ...jugendSeite(), bereich: undefined }, JETZT);
    await gibFrei(s.bereichsOrt, 'seite', 'j');
    await seiteSpeichern(s.entwurfsOrt, jugendSeite(), SPAETER);
    s.steuerung.ausfall = (z) =>
      z.kategorie === ONLINE && z.art === 'DELETE' ? fehlerMit(403) : undefined;
    const r = await alleFreigeben(s.bereichsOrt, [
      { einheit: 'seite', id: 'a' },
      { einheit: 'seite', id: 'j' },
    ]);
    expect(r.fehler).toBeNull();
    expect(liegtIn(s, ONLINE, 'a')).toBe(true);
    expect(liegtIn(s, JUGEND_ONLINE, 'j')).toBe(true);
    expect(r.bleibt).toEqual([{ ziel: { einheit: 'seite', id: 'j' }, bleibtIn: [null] }]);
  });
});

describe('Löschen und offline nehmen über alle Bereiche (W3b-4b)', () => {
  async function inBeiden() {
    const s = fakeFreigabeSpeicher();
    await seiteSpeichern(s.entwurfsOrt, { ...jugendSeite(), bereich: undefined }, JETZT);
    await gibFrei(s.bereichsOrt, 'seite', 'j');
    // Liegt jetzt in der Website-Kategorie; zusätzlich (z. B. nach einem halben Verschieben) in Jugend.
    await seiteSpeichern(s.jugendOrt, jugendSeite(), JETZT);
    await seiteSpeichern(s.entwurfsOrt, jugendSeite(), SPAETER);
    s.neuesLog();
    return s;
  }

  it('aus JEDER Veröffentlicht-Kategorie, in der die Seite steht – dann erst den Entwurf', async () => {
    const s = await inBeiden();
    const r = await seiteEntfernen(s.bereichsOrt, 'j', JUGEND);
    expect(r.bleibtIn).toEqual([]);
    expect(liegtIn(s, ONLINE, 'j')).toBe(false);
    expect(liegtIn(s, JUGEND_ONLINE, 'j')).toBe(false);
    expect(liegtIn(s, ENTWUERFE, 'j')).toBe(false);
    const letztesOnline = s.log.reduce(
      (n, z, k) => (z.kategorie !== ENTWUERFE && z.art === 'DELETE' ? k : n),
      -1,
    );
    const erstesEntwurf = s.log.findIndex((z) => z.kategorie === ENTWUERFE && z.art === 'DELETE');
    expect(letztesOnline).toBeLessThan(erstesEntwurf);
  });

  it('fremde Kategorie ohne Schreibrecht: die Seite bleibt dort (gemeldet), der Rest geschieht', async () => {
    const s = await inBeiden();
    s.steuerung.ausfall = (z) =>
      z.kategorie === ONLINE && z.art === 'DELETE' ? fehlerMit(403) : undefined;
    const r = await seiteEntfernen(s.bereichsOrt, 'j', JUGEND);
    expect(r.bleibtIn).toEqual([null]);
    expect(liegtIn(s, ONLINE, 'j')).toBe(true);
    expect(liegtIn(s, JUGEND_ONLINE, 'j')).toBe(false);
    expect(liegtIn(s, ENTWUERFE, 'j')).toBe(false);
  });

  it('EIGENE Kategorie ohne Schreibrecht: Fehler „kein Recht“, der Entwurf bleibt', async () => {
    const s = await inBeiden();
    s.steuerung.ausfall = (z) =>
      z.kategorie === JUGEND_ONLINE && z.art === 'DELETE' ? fehlerMit(403) : undefined;
    await expect(seiteEntfernen(s.bereichsOrt, 'j', JUGEND)).rejects.toMatchObject({
      status: 403,
      message: expect.stringMatching(/fehlt dir das Recht/),
    });
    expect(liegtIn(s, ENTWUERFE, 'j')).toBe(true);
  });

  it('ein vorübergehender Fehler wirft – der Entwurf bleibt (vorübergehend ist nicht ungültig)', async () => {
    const s = await inBeiden();
    s.steuerung.ausfall = (z) =>
      z.kategorie === ONLINE && z.art === 'DELETE' ? fehlerMit(503) : undefined;
    await expect(seiteEntfernen(s.bereichsOrt, 'j', JUGEND)).rejects.toBeTruthy();
    expect(liegtIn(s, ENTWUERFE, 'j')).toBe(true);
  });
});

describe('Online-Vergleich und Liste je Bereich (W3b-4b)', () => {
  /** Website-Seite A (eingereicht von Person 9), Jugend-Seite J (eingereicht von Rita), Jugend-Seite K online in Jugend. */
  async function bereiche() {
    const s = fakeFreigabeSpeicher();
    await seiteSpeichern(s.entwurfsOrt, seiteA(), JETZT);
    await seiteSpeichern(s.entwurfsOrt, jugendSeite('j', 'Jugendabend'), JETZT);
    await seiteSpeichern(s.entwurfsOrt, jugendSeite('k', 'Jugend-Team'), JETZT);
    await gibFrei(s.bereichsOrt, 'seite', 'k');
    await menueSpeichern(s.entwurfsOrt, menue([]), JETZT);
    await statusSetzen(
      s.entwurfsOrt,
      'a',
      { zustand: 'eingereicht' },
      { ...RITA, person: 9 },
      JETZT,
    );
    await statusSetzen(s.entwurfsOrt, 'j', { zustand: 'eingereicht' }, RITA, JETZT);
    return s;
  }

  it('der Online-Stand einer Seite kommt aus der Kategorie IHRES Bereichs; liegt sie (auch) woanders, ist sie „geändert“', async () => {
    const s = await bereiche();
    let { e, sicht } = sichtAus(s);
    expect(sicht.falsch.size).toBe(0);
    expect(
      onlineVergleich(e.staende, sicht.stand.staende, sicht.falsch).find((v) => v.id === 'k')?.lage,
    ).toBe('gleich');
    // K liegt zusätzlich in der Website-Kategorie (gleicher Text!) – trotzdem „geändert“: Sie muss dort weg.
    await seiteSpeichern(s.onlineOrt, jugendSeite('k', 'Jugend-Team'), JETZT);
    ({ e, sicht } = sichtAus(s));
    expect(sicht.falsch.has('k')).toBe(true);
    expect(sicht.liegtIn.get('k')).toEqual([null, JUGEND]);
    const k = e.seiten.find((x) => x.id === 'k')!;
    expect(seitenLage(k, sicht.stand.staende, sicht.falsch)).toBe('geaendert');
    expect(seitenLage(k, sicht.stand.staende)).toBe('gleich');
  });

  it('Leitung der Untergruppe: nur Seiten ihres Bereichs, kein Menü, keine Einstellungen; Zähler zählt nur ihren Bereich', async () => {
    const s = await bereiche();
    const { e, sicht } = sichtAus(s);
    const jugendLeitung = { sieht: [JUGEND], leitet: [JUGEND] };
    const l = freigabeListe(e, sicht, jugendLeitung, 1);
    expect(l.map((x) => `${x.art}:${x.id}`)).toEqual(['eingereicht:j']);
    expect(l.every((x) => x.einheit === 'seite' && x.bereich === JUGEND)).toBe(true);
    expect(freigabeZaehler(l, jugendLeitung)).toBe(1);
    // Die Website-Leitung sieht beides, dazu das Menü.
    const alle = freigabeListe(e, sicht, WEBSITE_LEITUNG, 1);
    expect(alle.map((x) => `${x.art}:${x.id}`)).toEqual([
      'eingereicht:a',
      'eingereicht:j',
      `menue:${MENUE_ID}`,
    ]);
    expect(freigabeZaehler(alle, WEBSITE_LEITUNG)).toBe(2);
  });

  it('Leitung der Untergruppe, die auch Mitglied der Website ist: Website-Seiten nur wie ein Redakteur (eigene), nicht freigebbar', async () => {
    const s = await bereiche();
    const { e, sicht } = sichtAus(s);
    const z = { sieht: 'alle' as const, leitet: [JUGEND] };
    // Person 9 hat A eingereicht: Sie sieht A (ihr eigener Status), aber A zählt nicht als „wartet auf mich“.
    const l = freigabeListe(e, sicht, z, 9);
    expect(l.map((x) => `${x.art}:${x.id}`)).toEqual(['eingereicht:a', 'eingereicht:j']);
    expect(freigabeZaehler(l, z)).toBe(1);
  });

  it('Redakteur der Untergruppe: nur eigene Einträge seines Bereichs', async () => {
    const s = await bereiche();
    const { e, sicht } = sichtAus(s);
    const l = freigabeListe(e, sicht, { sieht: [JUGEND], leitet: [] }, RITA.person);
    expect(l.map((x) => `${x.art}:${x.id}`)).toEqual(['eingereicht:j']);
    expect(freigabeZaehler(l, { sieht: [JUGEND], leitet: [] })).toBe(0);
    // Der Website-Redakteur Person 9 sieht seine Website-Seite, nicht die Jugend-Seite von Rita.
    expect(freigabeListe(e, sicht, WEBSITE_REDAKTEUR, 9).map((x) => x.id)).toEqual(['a']);
  });

  it('„nur noch online“ im Bereich Jugend: sieht und nimmt die Leitung von Jugend offline, nicht ein Redakteur', async () => {
    const s = await bereiche();
    await seiteSpeichern(s.jugendOrt, jugendSeite('weg', 'Weg'), JETZT);
    const { e, sicht } = sichtAus(s);
    const l = freigabeListe(e, sicht, { sieht: [JUGEND], leitet: [JUGEND] }, 1);
    expect(l.find((x) => x.id === 'weg')).toMatchObject({ art: 'nurOnline', bereich: JUGEND });
    expect(
      freigabeListe(e, sicht, { sieht: [JUGEND], leitet: [] }, 1).some((x) => x.id === 'weg'),
    ).toBe(false);
  });

  it('`nurWebsite` ist dasselbe wie die Sicht mit nur der Kategorie der Website (Gegenstück zu bis W3b-4a)', async () => {
    const s = await bereiche();
    const e = websiteAusWerten(s.werte[ENTWUERFE]);
    const o = websiteAusWerten(s.werte[ONLINE]);
    expect(nurWebsite(e, o).stand.staende).toEqual(
      onlineSicht(e, [{ bereich: null, kategorie: ONLINE, stand: o }]).stand.staende,
    );
  });
});
