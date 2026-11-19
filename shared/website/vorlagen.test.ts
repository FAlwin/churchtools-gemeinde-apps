import { describe, expect, it } from 'vitest';
import {
  abschnittSchema,
  bausteineDerSeite,
  pruefeWebsite,
  seiteSchema,
  spaltenAnzahl,
} from './modell';
import { renderAbschnitt, renderSeite } from './render';
import { findeVorlage, PLATZHALTER_BILD, PLATZHALTER_LINK, VORLAGEN } from './vorlagen';
import { einstellungen, idZaehler, kontext, menue, seite } from './website.testdaten';

const ERWARTET = [
  'start-schriftzug',
  'start-foto-flaeche',
  'start-foto-hintergrund',
  'text',
  'text-bild',
  'bild-text',
  'drei-spalten',
  'termine',
  'beitraege',
  'slider',
  'livestream',
  'kontakt',
  'gruppen',
  'galerie',
  'html',
];

describe('Abschnitt-Vorlagen', () => {
  it('alle geforderten Vorlagen sind da, mit Titel und Beschreibung auf Deutsch', () => {
    expect(VORLAGEN.map((v) => v.name)).toEqual(ERWARTET);
    expect(new Set(VORLAGEN.map((v) => v.name)).size).toBe(VORLAGEN.length);
    for (const v of VORLAGEN) {
      expect(v.titel.length, v.name).toBeGreaterThan(2);
      expect(v.beschreibung.length, v.name).toBeGreaterThan(10);
      expect(findeVorlage(v.name)).toBe(v);
    }
    expect(findeVorlage('gibt-es-nicht')).toBeUndefined();
  });

  it('jede Vorlage erzeugt einen schema-gültigen Abschnitt mit passender Spaltenzahl', () => {
    for (const v of VORLAGEN) {
      const a = v.erzeugen(idZaehler());
      const r = abschnittSchema.safeParse(a);
      expect(r.success, `${v.name}: ${r.success ? '' : JSON.stringify(r.error.issues)}`).toBe(true);
      expect(a.spalten, v.name).toHaveLength(spaltenAnzahl(a.aufteilung));
      expect(a.vorlage, v.name).toBe(v.name);
    }
  });

  it('jede Vorlage lässt sich in eine gültige Seite setzen, und die Seite rendert', () => {
    const neueId = idZaehler();
    const s = seite({ abschnitte: VORLAGEN.map((v) => v.erzeugen(neueId)) });
    expect(seiteSchema.safeParse(s).success).toBe(true);
    const k = kontext({ seiten: [s] });
    for (const a of s.abschnitte) expect(() => renderAbschnitt(a, k), a.vorlage).not.toThrow();
    expect(renderSeite(s, k)).toContain('<section class="w-abschnitt');
  });

  it('alle IDs eines Abschnitts sind verschieden – auch über viele Abschnitte hinweg (pruefeWebsite)', () => {
    const neueId = idZaehler(); // EIN Zähler für die ganze Seite, wie in der Erweiterung
    const s = seite({ abschnitte: VORLAGEN.map((v) => v.erzeugen(neueId)) });
    expect(pruefeWebsite([s], menue(), einstellungen({ datenschutz: PLATZHALTER_LINK }))).toEqual(
      [],
    );
    for (const v of VORLAGEN) {
      const a = v.erzeugen(idZaehler());
      const ids = [a.id, ...a.spalten.flatMap((sp) => [sp.id, ...sp.bausteine.map((b) => b.id)])];
      expect(new Set(ids).size, v.name).toBe(ids.length);
    }
  });

  it('zwei Aufrufe mit demselben Zähler liefern verschiedene IDs, mit frischem Zähler gleiche (rein)', () => {
    const v = VORLAGEN[0];
    const n = idZaehler();
    const a = v.erzeugen(n);
    const b = v.erzeugen(n);
    expect(a.id).not.toBe(b.id);
    expect(v.erzeugen(idZaehler())).toEqual(v.erzeugen(idZaehler()));
  });

  it('Platzhalter statt Inhalt: neutrale Texte, Platzhalter-Bild und -Link, keine Gemeinde-Daten', () => {
    const verboten = /ECG|Donrath|Lohmar|Gemeinde|Gottesdienst|Pastor|Sonntag|Jesus|Gott\b|Kirche/i;
    for (const v of VORLAGEN) {
      const json = JSON.stringify(v.erzeugen(idZaehler()));
      expect(json, v.name).not.toMatch(verboten);
      // Bilder: nur die Platzhalter-Kennung; Links: nur der Platzhalter-Link
      for (const m of json.matchAll(/"bild":\{"id":"([^"]*)"/g))
        expect(m[1], v.name).toBe(PLATZHALTER_BILD.id);
      for (const m of json.matchAll(/"url":"([^"]*)"/g))
        expect(m[1], v.name).toBe(PLATZHALTER_LINK.url);
    }
    expect(PLATZHALTER_BILD.id).toBe('platzhalter');
  });

  it('start-schriftzug (Entwurf A): mittig, Akzentzeile, riesige Überschrift mit Punkt, Leitsatz, zwei Knöpfe', () => {
    const a = findeVorlage('start-schriftzug')!.erzeugen(idZaehler());
    expect(a.aufteilung).toBe('1');
    expect(a.gestaltung.ausrichtung).toBe('mitte');
    const typen = a.spalten[0].bausteine.map((b) => b.typ);
    expect(typen).toEqual(['akzentzeile', 'ueberschrift', 'text', 'knoepfe']);
    const u = a.spalten[0].bausteine[1];
    expect(u.typ === 'ueberschrift' && [u.ebene, u.groesse, u.punkt]).toEqual([1, 'riesig', true]);
    const k = a.spalten[0].bausteine[3];
    expect(k.typ === 'knoepfe' && k.knoepfe.map((x) => x.art)).toEqual(['haupt', 'neben']);
  });

  it('start-foto-flaeche (Entwurf B): voll breit, ohne Abstand, links Haupt-Fläche mit Text, rechts füllendes Bild', () => {
    const a = findeVorlage('start-foto-flaeche')!.erzeugen(idZaehler());
    expect(a.gestaltung.breite).toBe('voll');
    expect(a.gestaltung.abstand).toBe('kein');
    expect(a.aufteilung).toBe('1-1');
    expect(a.spalten[0].hintergrund).toEqual({ art: 'haupt' });
    expect(a.spalten[0].bausteine.map((b) => b.typ)).toEqual([
      'akzentzeile',
      'ueberschrift',
      'text',
      'knoepfe',
    ]);
    const bild = a.spalten[1].bausteine[0];
    expect(bild.typ === 'bild' && bild.fuellen).toBe(true);
    expect(a.spalten[1].handyZuerst).toBe(true);
    const html = renderAbschnitt(a, kontext());
    expect(html).toContain('w-abschnitt--voll');
    expect(html).toContain('w-abschnitt--abstand-kein');
    expect(html).toContain('w-spalte--haupt');
    expect(html).toContain('w-bild--fuellen');
  });

  it('start-foto-hintergrund: Bild als Hintergrund, abgedunkelt, Text links (helle Schrift)', () => {
    const a = findeVorlage('start-foto-hintergrund')!.erzeugen(idZaehler());
    const h = a.gestaltung.hintergrund;
    expect(h.art).toBe('bild');
    expect(h.art === 'bild' && h.abdunkeln).toBe(55);
    expect(a.gestaltung.ausrichtung).toBe('links');
    const html = renderAbschnitt(a, kontext());
    expect(html).toContain('w-abschnitt--foto');
    expect(html).toContain('w-abschnitt--text-hell');
    expect(html).toContain('class="w-hintergrund"');
  });

  it('die übrigen Vorlagen enthalten, was ihr Name sagt', () => {
    const typen = (n: string) =>
      bausteineDerSeite(seite({ abschnitte: [findeVorlage(n)!.erzeugen(idZaehler())] })).map(
        (b) => b.typ,
      );
    expect(typen('termine')).toContain('termine');
    expect(typen('beitraege')).toContain('beitraege');
    expect(typen('slider')).toContain('slider');
    expect(typen('livestream')).toContain('livestream');
    expect(typen('kontakt')).toContain('kontaktformular');
    expect(typen('gruppen')).toContain('gruppenliste');
    expect(typen('galerie')).toContain('galerie');
    expect(typen('html')).toEqual(['html']);
    expect(findeVorlage('drei-spalten')!.erzeugen(idZaehler()).spalten).toHaveLength(3);
    expect(findeVorlage('text-bild')!.erzeugen(idZaehler()).spalten[1].bausteine[0].typ).toBe(
      'bild',
    );
    expect(findeVorlage('bild-text')!.erzeugen(idZaehler()).spalten[0].bausteine[0].typ).toBe(
      'bild',
    );
  });
});
