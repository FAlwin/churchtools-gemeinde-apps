import { afterEach, describe, expect, it, vi } from 'vitest';
import { KEINE_SCHRIFT, Schriftspeicher, ladeTabelle, SCHRIFT_LADER, type Lader } from './schriftLader';

/** Ein Lader, den der Test von Hand auflöst oder scheitern lässt – so lässt sich „lädt gerade“ festhalten. */
function steuerbar() {
  const aufrufe: { ok: (a: string) => void; fehl: (e: Error) => void }[] = [];
  const lader: Lader = () =>
    new Promise<string>((ok, fehl) => {
      aufrufe.push({ ok, fehl });
    });
  return { lader, aufrufe };
}
const warte = () => new Promise<void>((r) => setTimeout(r, 0));

afterEach(() => vi.restoreAllMocks());

describe('ladeTabelle: aus dem Ordner wird die Tabelle', () => {
  it('der Schlüssel ist der Dateiname, der Lader liefert die data:-Adresse', async () => {
    const t = ladeTabelle({
      '/x/y/lora-var.woff2': () => Promise.resolve('data:font/woff2;base64,AAAA'),
    });
    expect(Object.keys(t)).toEqual(['lora-var.woff2']);
    expect(await t['lora-var.woff2']()).toBe('data:font/woff2;base64,AAAA');
  });

  it('kommt etwas anderes als eine data:-Adresse an (z. B. eine Datei-Adresse), ist das ein Fehler – nie eine Adresse, die im Vorschau-Fenster ins Leere läuft', async () => {
    const t = ladeTabelle({ '/a.woff2': () => Promise.resolve('/assets/a.woff2') });
    await expect(t['a.woff2']()).rejects.toThrow(/data:-Adresse/);
  });

  it('die echte Tabelle: jede Datei kommt als data:font/woff2 an (`?inline` wirkt)', async () => {
    const adresse = await SCHRIFT_LADER['quicksand-var.woff2']();
    expect(adresse.startsWith('data:font/woff2;base64,')).toBe(true);
    // das ist wirklich eine WOFF2-Datei: Base64 von „wOF2“
    expect(adresse.slice('data:font/woff2;base64,'.length)).toMatch(/^d09GMg/);
  });
});

describe('Schriftspeicher', () => {
  it('lädt nur, was angefordert wird – die anderen Lader werden nie aufgerufen', async () => {
    const a = vi.fn(() => Promise.resolve('data:a'));
    const b = vi.fn(() => Promise.resolve('data:b'));
    const s = new Schriftspeicher({ 'a.woff2': a, 'b.woff2': b });
    s.anfordern(['a.woff2']);
    await warte();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    expect(s.adresse('a.woff2')).toBe('data:a');
    expect(s.adresse('b.woff2')).toBeUndefined();
  });

  it('Doppel-Ladeschutz: wird eine Schrift angefordert, während sie lädt, gibt es nur einen Versuch', async () => {
    const { lader, aufrufe } = steuerbar();
    const s = new Schriftspeicher({ 'a.woff2': lader });
    s.anfordern(['a.woff2']);
    s.anfordern(['a.woff2', 'a.woff2']);
    s.anfordern(['a.woff2']);
    expect(aufrufe).toHaveLength(1);
    aufrufe[0].ok('data:a');
    await warte();
    // …und ist sie da, wird auch nicht noch einmal geladen
    s.anfordern(['a.woff2']);
    expect(aufrufe).toHaveLength(1);
    expect(s.adresse('a.woff2')).toBe('data:a');
  });

  it('eine unbekannte Datei (eigene Schrift) wird übergangen: kein Fehler, keine Adresse', async () => {
    const s = new Schriftspeicher({});
    s.anfordern(['meine-schrift']);
    await warte();
    expect(s.adresse('meine-schrift')).toBeUndefined();
    expect(s.gescheitertFuer('meine-schrift')).toBe(false);
  });

  it('LADEFEHLER: keine Adresse (Ersatzschrift), Hinweis möglich – und der nächste Bedarf versucht es WIEDER', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let versuch = 0;
    const lader: Lader = () =>
      ++versuch === 1 ? Promise.reject(new Error('Netz weg')) : Promise.resolve('data:a');
    const s = new Schriftspeicher({ 'a.woff2': lader });
    s.anfordern(['a.woff2']);
    await warte();
    expect(s.adresse('a.woff2')).toBeUndefined();
    expect(s.gescheitertFuer('a.woff2')).toBe(true);
    expect(warn).toHaveBeenCalledOnce();

    s.anfordern(['a.woff2']); // nächster Bedarf
    await warte();
    expect(versuch).toBe(2);
    expect(s.adresse('a.woff2')).toBe('data:a');
    expect(s.gescheitertFuer('a.woff2')).toBe(false);
  });

  it('ein Fehler bei einer Schrift hindert die andere nicht', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = new Schriftspeicher({
      'a.woff2': () => Promise.reject(new Error('x')),
      'b.woff2': () => Promise.resolve('data:b'),
    });
    s.anfordern(['a.woff2', 'b.woff2']);
    await warte();
    expect(s.adresse('b.woff2')).toBe('data:b');
    expect(s.gescheitertFuer('a.woff2')).toBe(true);
  });

  it('Hörer werden benachrichtigt, wenn etwas fertig oder gescheitert ist – und der Schnappschuss ändert sich', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = new Schriftspeicher({
      'a.woff2': () => Promise.resolve('data:a'),
      'b.woff2': () => Promise.reject(new Error('x')),
    });
    const hoerer = vi.fn();
    const ab = s.abonnieren(hoerer);
    const vorher = s.schnappschuss();
    s.anfordern(['a.woff2', 'b.woff2']);
    await warte();
    expect(hoerer).toHaveBeenCalledTimes(2);
    expect(s.schnappschuss()).not.toBe(vorher);
    ab();
    s.anfordern(['b.woff2']);
    await warte();
    expect(hoerer).toHaveBeenCalledTimes(2);
  });

  it('die Vorgabe-Adresse ist leer – der Browser nimmt die Ersatzschrift', () => {
    expect(KEINE_SCHRIFT).toBe('data:,');
  });
});
