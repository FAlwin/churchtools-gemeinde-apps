import { describe, expect, it } from 'vitest';
import {
  darfTerminAendern,
  INFOS_MAX,
  INFOS_NICHT_ANGEKOMMEN,
  infosAus,
  infosSpeichern,
  type TerminInfosPort,
} from './terminInfos';
import type { SchreibAuftrag } from './schreibKern';

class Fehler extends Error {
  constructor(
    readonly status: number,
    meldung: string,
  ) {
    super(meldung);
  }
}

/**
 * Ein Termin in ChurchTools, nachgebaut wie gemessen (02.11.2026): `PUT /events/{id}` übernimmt `description`
 * (`null` leert) und setzt **`isCanceled` auf `false`, wenn es fehlt**; `adminIds` bleibt, wenn es fehlt.
 */
class CtTermin implements TerminInfosPort {
  description: string | null = null;
  isCanceled = false;
  adminIds = [1];
  schreiben: SchreibAuftrag[] = [];
  /** Schreiben meldet Erfolg, übernimmt aber nichts. */
  stumm = false;
  termin(): Promise<{ description?: unknown; isCanceled?: unknown }> {
    const d = {
      description: this.description,
      isCanceled: this.isCanceled,
      adminIds: this.adminIds,
    };
    return Promise.resolve(d);
  }
  schreibe(_pfad: string, a: SchreibAuftrag): Promise<unknown> {
    this.schreiben.push(a);
    if (this.stumm) return Promise.resolve(null);
    const json = a.json as {
      description?: string | null;
      isCanceled?: boolean;
      adminIds?: number[];
    };
    this.description = json.description ?? null;
    this.isCanceled = json.isCanceled === true;
    if (json.adminIds) this.adminIds = json.adminIds;
    return Promise.resolve(null);
  }
  fehler(status: number, meldung: string): Error {
    return new Fehler(status, meldung);
  }
}

describe('infosAus', () => {
  it('Text oder leer', () => {
    expect(infosAus({ description: 'Abendmahl' })).toBe('Abendmahl');
    expect(infosAus({ description: null })).toBe('');
    expect(infosAus({})).toBe('');
    expect(infosAus(null)).toBe('');
    expect(infosAus({ description: 5 })).toBe('');
  });
});

describe('infosSpeichern', () => {
  it('schreibt description und schickt isCanceled frisch mit – ein abgesagter Termin bleibt abgesagt', async () => {
    const ct = new CtTermin();
    ct.isCanceled = true;
    const r = await infosSpeichern(ct, 222, 'Zeile 1\nZeile 2 äöü', '');
    expect(r).toEqual({ ok: true, text: 'Zeile 1\nZeile 2 äöü' });
    expect(ct.isCanceled).toBe(true);
    expect(ct.schreiben[0]).toMatchObject({
      method: 'PUT',
      json: { description: 'Zeile 1\nZeile 2 äöü', isCanceled: true },
    });
    // Die Admins schickt der Dienstplaner nicht mit (ändern bräuchte „edit masterdata“) – sie bleiben.
    expect(ct.schreiben[0].json).not.toHaveProperty('adminIds');
    expect(ct.adminIds).toEqual([1]);
  });

  it('nicht abgesagt bleibt nicht abgesagt', async () => {
    const ct = new CtTermin();
    await infosSpeichern(ct, 222, 'x', '');
    expect(ct.schreiben[0].json).toMatchObject({ isCanceled: false });
  });

  it('leer oder nur Leerraum leert das Feld (null) – wie ChurchTools es speichert', async () => {
    const ct = new CtTermin();
    ct.description = 'alt';
    expect(await infosSpeichern(ct, 222, '  \n ', 'alt')).toEqual({ ok: true, text: '' });
    expect(ct.schreiben[0].json).toMatchObject({ description: null });
    expect(ct.description).toBeNull();
  });

  it('mehr als 4000 Zeichen: Fehler 400, nichts geschrieben', async () => {
    const ct = new CtTermin();
    await expect(infosSpeichern(ct, 222, 'x'.repeat(INFOS_MAX + 1), '')).rejects.toMatchObject({
      status: 400,
    });
    expect(ct.schreiben).toHaveLength(0);
    await expect(infosSpeichern(ct, 222, 'x'.repeat(INFOS_MAX), '')).resolves.toMatchObject({
      ok: true,
    });
  });

  it('jemand hat inzwischen anders gespeichert: kein Schreiben, der neue Text kommt zurück – mit „trotzdem“ wird geschrieben', async () => {
    const ct = new CtTermin();
    ct.description = 'von David';
    expect(await infosSpeichern(ct, 222, 'meins', 'alt')).toEqual({
      ok: false,
      aktuell: 'von David',
    });
    expect(ct.schreiben).toHaveLength(0);
    expect(await infosSpeichern(ct, 222, 'meins', 'alt', true)).toEqual({
      ok: true,
      text: 'meins',
    });
  });

  it('steht dort schon genau mein Text, ist das kein Konflikt', async () => {
    const ct = new CtTermin();
    ct.description = 'meins';
    expect(await infosSpeichern(ct, 222, 'meins', 'alt')).toEqual({ ok: true, text: 'meins' });
  });

  it('gemeldet, aber nicht übernommen → Fehler 502 („nicht angekommen“), kein zweites Schreiben', async () => {
    const ct = new CtTermin();
    ct.stumm = true;
    await expect(infosSpeichern(ct, 222, 'neu', '')).rejects.toMatchObject({
      status: 502,
      message: INFOS_NICHT_ANGEKOMMEN,
    });
    expect(ct.schreiben).toHaveLength(1);
  });

  it('verweigert-Meldung für den Schreiber', async () => {
    const ct = new CtTermin();
    await infosSpeichern(ct, 222, 'x', '');
    expect(ct.schreiben[0].verweigert).toMatch(/nicht, die Infos dieses Termins zu ändern/);
  });
});

describe('darfTerminAendern – gemessen 02.11.2026 mit Spike', () => {
  const termin = (kalenderId: number | null, terminAdminIds: number[] = []) => ({
    kalenderId,
    terminAdminIds,
  });
  it('„edit events“ für den Kalender des Termins', () => {
    expect(darfTerminAendern({ isAdmin: false, terminKalender: [3] }, termin(3), 19)).toBe(true);
    expect(darfTerminAendern({ isAdmin: false, terminKalender: [3] }, termin(2), 19)).toBe(false);
  });
  it('Admin dieses Termins – auch ohne das Recht', () => {
    expect(darfTerminAendern({ isAdmin: false, terminKalender: [3] }, termin(2, [19]), 19)).toBe(
      true,
    );
    expect(darfTerminAendern({ isAdmin: false, terminKalender: [] }, termin(2, [19]), null)).toBe(
      false,
    );
  });
  it('Admin oder Recht für alle Kalender', () => {
    expect(darfTerminAendern({ isAdmin: true, terminKalender: [] }, termin(2), 1)).toBe(true);
    expect(darfTerminAendern({ isAdmin: false, terminKalender: null }, termin(2), 1)).toBe(true);
  });
});
