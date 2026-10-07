import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEFAULT_SITE_CONFIG, type SiteConfig } from '@shared/types/index';
import { einstellungenZusammensetzen } from '@shared/ct/einstellungen';
import { _bremseLoesen, _vergissCsrf, KeinSpeicherRecht } from './ctRuntime';
import { einstellungenSpeichern, KATEGORIE_KUERZEL } from './ctEinstellungen';
import { _vergissModul } from './ctModulDaten';
import { gemeindeKonfiguration } from './ctLesen';
import { _zuruecksetzen } from './personenAblage';
import { FakeCt } from './ctFake.testutil';

/**
 * Die Gemeinde-Einstellungen der Erweiterung (#335, 3b-4) – im Datenbereich des eigenen Moduls, gegen
 * das nachgebaute ChurchTools mit dem gemessenen Verhalten (Plan §2c).
 */
vi.mock('./modus', async (original) => ({
  ...(await original<typeof import('./modus')>()),
  erweiterungsKuerzel: () => 'musik-app',
}));

let ct: FakeCt;

const EINGABE: SiteConfig = {
  ...DEFAULT_SITE_CONFIG,
  orgName: 'BG Korntal',
  links: [{ id: 'w', label: 'Website', url: 'https://example.org', showOnLogin: false }],
  standardAnsicht: 'dokument',
};

beforeEach(() => {
  _zuruecksetzen();
  _vergissCsrf();
  _bremseLoesen();
  _vergissModul();
  ct = new FakeCt();
  ct.installieren();
  ct.liefere('/api/info', { siteName: 'BG Korntal' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function gespeichert(): Record<string, unknown> {
  expect(ct.werte).toHaveLength(1);
  return JSON.parse(ct.werte[0].value) as Record<string, unknown>;
}

describe('Lesen', () => {
  it('nichts gespeichert → Vorgaben mit dem Namen aus ChurchTools', async () => {
    // Gegen den Erzeuger, nicht gegen ein Literal: dieselben Vorgaben wie im Server.
    expect(await gemeindeKonfiguration()).toEqual(
      einstellungenZusammensetzen({ orgName: 'BG Korntal' }),
    );
  });

  it('Kategorie unsichtbar (kein Recht „Kategorien sehen") → Vorgaben, kein Fehler', async () => {
    await einstellungenSpeichern(EINGABE);
    ct.kategorienUnsichtbar = true;
    expect((await gemeindeKonfiguration()).standardAnsicht).toBe('akkorde');
  });

  it('ein vorübergehender Fehler beim Lesen WIRFT – statt die Wahl der Gemeinde zu ersetzen', async () => {
    await einstellungenSpeichern(EINGABE);
    const kat = ct.kategorien[0].id;
    ct.liefere(`/api/custommodules/10/customdatacategories/${kat}/customdatavalues`, {}, 500);
    await expect(gemeindeKonfiguration()).rejects.toMatchObject({ status: 500 });
  });

  it('kein Modul mit dem Kürzel → Vorgaben', async () => {
    ct.module = [{ id: 10, shorty: 'etwas-anderes' }];
    expect((await gemeindeKonfiguration()).orgName).toBe('BG Korntal');
  });

  it('prüft auch beim Lesen: ein von Hand eingetragener javascript:-Link kommt nicht durch', async () => {
    await einstellungenSpeichern(EINGABE);
    const roh = gespeichert() as { config: { links: { url: string }[] } };
    roh.config.links[0].url = 'javascript:alert(1)';
    ct.werte[0].value = JSON.stringify(roh);
    const cfg = await gemeindeKonfiguration();
    expect(cfg.links).toEqual([]);
  });

  it('ein Gemeindename über 80 Zeichen lässt die Einstellungen NICHT durchfallen', async () => {
    await einstellungenSpeichern(EINGABE);
    const lang = 'Evangelische Brüdergemeinde '.repeat(4);
    ct.liefere('/api/info', { siteName: lang });
    const cfg = await gemeindeKonfiguration();
    expect(cfg.orgName).toBe(lang.trim());
    expect(cfg.standardAnsicht).toBe('dokument');
  });
});

describe('Speichern', () => {
  it('legt beim ersten Mal Kategorie und Wert an – und die App liest es zurück', async () => {
    const zurueck = await einstellungenSpeichern(EINGABE);
    expect(ct.kategorien).toMatchObject([{ customModuleId: 10, shorty: KATEGORIE_KUERZEL }]);
    expect(zurueck.standardAnsicht).toBe('dokument');
    const cfg = await gemeindeKonfiguration();
    expect(cfg.standardAnsicht).toBe('dokument');
    expect(cfg.links).toEqual(EINGABE.links);
  });

  it('der Name steht nicht im Wert – er kommt aus ChurchTools', async () => {
    await einstellungenSpeichern(EINGABE);
    const roh = gespeichert() as { config: Record<string, unknown> };
    expect(roh.config).not.toHaveProperty('orgName');
    expect(roh.config).not.toHaveProperty('appName');
    expect(roh.config.standardAnsicht).toBe('dokument');
  });

  it('beim zweiten Mal wird derselbe Wert geändert – keine zweite Kategorie, kein zweiter Wert', async () => {
    await einstellungenSpeichern(EINGABE);
    await einstellungenSpeichern({ ...EINGABE, standardAnsicht: 'akkorde' });
    expect(ct.kategorien).toHaveLength(1);
    expect((gespeichert() as { config: { standardAnsicht: string } }).config.standardAnsicht).toBe(
      'akkorde',
    );
    const schreibend = ct.aufrufe.filter((a) => !a.startsWith('GET')).map((a) => a.split(' ')[0]);
    expect(schreibend).toEqual(['POST', 'POST', 'PUT']);
  });

  it('ein fremder Wert in der Kategorie wird weder gelesen noch überschrieben', async () => {
    await einstellungenSpeichern(EINGABE);
    const kat = ct.kategorien[0].id;
    // Vollständig aufgebaut, nur mit anderer Art – sonst fiele er schon an Fassung/Inhalt durch, und
    // der Test bewachte die Prüfung der Art gar nicht (Gegenprobe 07.10.2026).
    const fremd = JSON.stringify({
      art: 'etwas-anderes',
      fassung: 1,
      config: { standardAnsicht: 'dokument' },
    });
    ct.werte.unshift({ id: 1, dataCategoryId: kat, value: fremd });
    await einstellungenSpeichern({ ...EINGABE, standardAnsicht: 'akkorde' });
    expect(ct.werte.find((w) => w.id === 1)?.value).toBe(fremd);
    expect((await gemeindeKonfiguration()).standardAnsicht).toBe('akkorde');
  });

  it('ein Erfolg, der nichts geschrieben hat, wird als Fehler gemeldet', async () => {
    ct.wertSchreibenVerschwindet = true;
    await expect(einstellungenSpeichern(EINGABE)).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('nicht übernommen') as unknown,
    });
  });

  it('fehlendes Recht → verständliche Meldung, kein „Sitzung abgelaufen"', async () => {
    ct.datenSchreibenVerboten = true;
    const fehler = await einstellungenSpeichern(EINGABE).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(KeinSpeicherRecht);
    expect((fehler as Error).message).toMatch(/erlaubt dir nicht/);
  });

  it('prüft vor dem Schreiben – ein javascript:-Link wird abgelehnt, nichts geht raus', async () => {
    const boese = { ...EINGABE, links: [{ ...EINGABE.links[0], url: 'javascript:alert(1)' }] };
    await expect(einstellungenSpeichern(boese)).rejects.toMatchObject({ status: 400 });
    expect(ct.aufrufe).toEqual([]);
  });

  it('ein Gemeindename über 80 Zeichen hindert das Speichern nicht', async () => {
    const lang = 'x'.repeat(120);
    const zurueck = await einstellungenSpeichern({ ...EINGABE, orgName: lang });
    expect(zurueck.orgName).toBe(lang);
  });
});
