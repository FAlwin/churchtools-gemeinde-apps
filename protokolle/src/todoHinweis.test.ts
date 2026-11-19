import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { istTodoHinweis, neuerHinweis, STANDARD_VORLAUF } from '@shared/protokolle/hinweis';
import { ladeVorlauf, ladeVorlaufOderStandard, vorlaufSpeichern } from './todoHinweis';
import { ladeVorlagen } from './vorlagen';
import {
  MODUL,
  nachbauEnde,
  nachbauStarten,
  type Nachbau,
  werteVon,
  kategorieVon,
} from './nachbau.testhilfe';

/** Die Einstellung „Hinweis auf fällige To-Dos“ gegen die nachgestellte ChurchTools-Instanz (`nachbau.testhilfe.ts`). */
let ct: Nachbau;
beforeEach(() => {
  ct = nachbauStarten();
});
afterEach(nachbauEnde);

const hinweisWerte = () =>
  werteVon(ct, kategorieVon(ct, 'vorlagen')).filter((w) => istTodoHinweis(JSON.parse(w.value)));

describe('Vorlauf lesen', () => {
  it('noch keine Kategorie: der Standard (3 Tage)', async () => {
    expect(await ladeVorlauf(MODUL)).toBe(STANDARD_VORLAUF);
  });

  it('Kategorie da, aber kein Wert: der Standard', async () => {
    await vorlaufSpeichern(MODUL, 7);
    ct.werte.set(
      kategorieVon(ct, 'vorlagen'),
      werteVon(ct, kategorieVon(ct, 'vorlagen')).filter(
        (w) => !istTodoHinweis(JSON.parse(w.value)),
      ),
    );
    expect(await ladeVorlauf(MODUL)).toBe(3);
  });

  it('ein vorübergehender Fehler wird geworfen (nicht zu „Standard“ gemacht)', async () => {
    ct.kategorienLesenFehler = 503;
    await expect(ladeVorlauf(MODUL)).rejects.toBeInstanceOf(ApiError);
  });

  it('der Leser für die Seiten wirft nie: Netzfehler → Standard, nicht „Aus“ (Grund im Log)', async () => {
    await vorlaufSpeichern(MODUL, 'aus');
    ct.kategorienLesenFehler = 503;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await ladeVorlaufOderStandard(MODUL)).toBe(3);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('Status 503');
    warn.mockRestore();
  });

  it('kein Recht (ChurchTools liefert leer): der Standard', async () => {
    await vorlaufSpeichern(MODUL, 14);
    ct.werteLesenFehlerFuer.set(kategorieVon(ct, 'vorlagen'), 403);
    expect(await ladeVorlaufOderStandard(MODUL)).toBe(3);
  });
});

describe('Vorlauf speichern', () => {
  it('erstes Speichern legt Kategorie (samt Standard-Vorlagen) und genau einen Wert an', async () => {
    await vorlaufSpeichern(MODUL, 7);
    expect(await ladeVorlauf(MODUL)).toBe(7);
    expect(hinweisWerte()).toHaveLength(1);
    expect((await ladeVorlagen(MODUL)).vorlagen).toHaveLength(3);
  });

  it('ändern: derselbe Wert, kein zweiter – auch „Aus“ und „Nur überfällig“', async () => {
    await vorlaufSpeichern(MODUL, 7);
    const id = hinweisWerte()[0].id;
    await vorlaufSpeichern(MODUL, 'aus');
    expect(await ladeVorlauf(MODUL)).toBe('aus');
    await vorlaufSpeichern(MODUL, 'ueberfaellig');
    expect(await ladeVorlauf(MODUL)).toBe('ueberfaellig');
    expect(hinweisWerte().map((w) => w.id)).toEqual([id]);
    expect(JSON.parse(hinweisWerte()[0].value)).toEqual(neuerHinweis('ueberfaellig'));
  });

  it('der Wert stört die Vorlagen nicht (Liste, Anzahl)', async () => {
    await vorlaufSpeichern(MODUL, 1);
    expect((await ladeVorlagen(MODUL)).vorlagen.map((g) => g.vorlage.name)).toEqual([
      'Klausur',
      'Leitungssitzung',
      'Teamtreffen',
    ]);
  });

  it('ChurchTools sagt 200 und ändert nichts: NichtUebernommen (kein stilles Erfolgssignal)', async () => {
    await vorlaufSpeichern(MODUL, 7);
    ct.schlucken.add('PUT WERT');
    await expect(vorlaufSpeichern(MODUL, 14)).rejects.toBeInstanceOf(NichtUebernommen);
    expect(await ladeVorlauf(MODUL)).toBe(7);
  });

  it('ein neuer Wert, den ChurchTools verschluckt: NichtUebernommen', async () => {
    await vorlaufSpeichern(MODUL, 7);
    ct.werte.set(
      kategorieVon(ct, 'vorlagen'),
      werteVon(ct, kategorieVon(ct, 'vorlagen')).filter(
        (w) => !istTodoHinweis(JSON.parse(w.value)),
      ),
    );
    ct.schluckeWert = (v) => istTodoHinweis(JSON.parse(v));
    await expect(vorlaufSpeichern(MODUL, 14)).rejects.toBeInstanceOf(NichtUebernommen);
  });

  it('vorübergehender Fehler beim Schreiben wirft ApiError; der alte Wert bleibt', async () => {
    await vorlaufSpeichern(MODUL, 7);
    ct.fehlerBei = { methode: 'PUT', status: 503 };
    await expect(vorlaufSpeichern(MODUL, 14)).rejects.toBeInstanceOf(ApiError);
    ct.fehlerBei = null;
    expect(await ladeVorlauf(MODUL)).toBe(7);
  });

  it('ein kaputter vorhandener Wert wird überschrieben, nicht verdoppelt', async () => {
    await vorlaufSpeichern(MODUL, 7);
    const w = hinweisWerte()[0];
    w.value = JSON.stringify({ art: 'todo-hinweis', fassung: 1, vorlauf: 99 });
    expect(await ladeVorlauf(MODUL)).toBe(3);
    await vorlaufSpeichern(MODUL, 14);
    expect(await ladeVorlauf(MODUL)).toBe(14);
    expect(
      werteVon(ct, kategorieVon(ct, 'vorlagen')).filter((x) => x.value.includes('todo-hinweis')),
    ).toHaveLength(1);
  });
});
