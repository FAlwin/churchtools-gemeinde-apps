// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { htmlAttr } from '@shared/website/html';
import { baustein, seiteMit } from '@shared/website/website.testdaten';
import { Vorschau } from './Vorschau';
import {
  PLATZHALTER_ADRESSE,
  STYLESHEET_ADRESSE,
  VORSCHAU_SANDBOX,
  vorschauHtml,
} from './vorschauHtml';

const STAND = { seiten: [], menue: null, einstellungen: null };
const SEITE = seiteMit([baustein('ueberschrift', { text: 'Willkommen' }), baustein('bild')], {
  titel: 'Start',
});

describe('Vorschau-Fenster: Sandkasten', () => {
  it('das iframe ist abgeschottet: `sandbox="allow-scripts"` – OHNE `allow-same-origin`', () => {
    render(<Vorschau seite={SEITE} stand={STAND} gemeinde="ECG" ansicht="computer" />);
    const rahmen = screen.getByTitle('Vorschau: Start');
    expect(rahmen.getAttribute('sandbox')).toBe('allow-scripts');
    expect(rahmen.getAttribute('sandbox')).not.toContain('allow-same-origin');
    // Auch nicht über die Konstante hereingeschmuggelt:
    expect(VORSCHAU_SANDBOX).not.toMatch(/same-origin|top-navigation|popups|forms/);
  });

  it('der Inhalt kommt als `srcdoc` (kein Laden von außen) und zeigt die Seite, wie der Renderer sie ausgibt', () => {
    render(<Vorschau seite={SEITE} stand={STAND} gemeinde="ECG" ansicht="computer" />);
    const rahmen = screen.getByTitle('Vorschau: Start');
    expect(rahmen.getAttribute('src')).toBeNull();
    const doc = rahmen.getAttribute('srcdoc') ?? '';
    expect(doc).toContain('<!doctype html>');
    expect(doc).toContain('Willkommen');
    expect(doc).toBe(vorschauHtml(SEITE, STAND, 'ECG', 'Europe/Berlin'));
  });

  it('Handy-Ansicht: der Rahmen bekommt die Handy-Klasse, am Computer nicht', () => {
    const { container, rerender } = render(
      <Vorschau seite={SEITE} stand={STAND} gemeinde={null} ansicht="computer" />,
    );
    const buehne = container.firstElementChild as HTMLElement;
    const computerKlasse = buehne.className;
    rerender(<Vorschau seite={SEITE} stand={STAND} gemeinde={null} ansicht="handy" />);
    expect((container.firstElementChild as HTMLElement).className).not.toBe(computerKlasse);
  });
});

describe('vorschauHtml: nichts wird nachgeladen', () => {
  const html = vorschauHtml(SEITE, STAND, 'ECG', 'Europe/Berlin');

  it('das Stylesheet steckt als `data:`-Adresse im Dokument (das iframe hat keinen Ursprung für eine Datei)', () => {
    expect(STYLESHEET_ADRESSE.startsWith('data:text/css')).toBe(true);
    expect(html).toContain(`<link rel="stylesheet" href="${htmlAttr(STYLESHEET_ADRESSE)}">`);
    // Das ganze Blatt ist darin: eine Regel aus der Mitte, kodiert.
    expect(decodeURIComponent(STYLESHEET_ADRESSE)).toContain('.w-abschnitt');
  });

  it('Bilder sind das Platzhalter-Bild als `data:` – keine Adresse auf ChurchTools oder ins Netz', () => {
    expect(html).toContain(htmlAttr(PLATZHALTER_ADRESSE));
    expect(html).not.toMatch(/src="(?:https?:)?\/\//);
  });

  it('keine Schriftdatei: `schriftAdresse` ist leer, die Seite fällt auf die Ersatzschrift zurück', () => {
    expect(html).not.toMatch(/\.woff2?|\/schriften\//);
  });

  it('Links auf andere Seiten führen nirgendwohin (`#/pfad`), nicht aus dem Dokument heraus', () => {
    const mitMenue = vorschauHtml(
      SEITE,
      {
        seiten: [SEITE],
        menue: { eintraege: [{ titel: 'Start', ziel: { art: 'seite', seiteId: SEITE.id } }] },
        einstellungen: null,
      },
      'ECG',
      'Europe/Berlin',
    );
    expect(mitMenue).toContain(`href="#/${SEITE.pfad}"`);
  });

  it('ohne gespeicherte Einstellungen trägt die Seite den Namen der Gemeinde und ist noindex', () => {
    expect(html).toContain('Start – ECG');
    expect(html).toContain('noindex');
  });
});
