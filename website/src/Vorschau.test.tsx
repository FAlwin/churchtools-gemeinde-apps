// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
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
    const rahmen = screen.getByTitle<HTMLIFrameElement>('Vorschau: Start');
    expect(rahmen.getAttribute('sandbox')).toBe('allow-scripts');
    expect(rahmen.getAttribute('sandbox')).not.toContain('allow-same-origin');
    // Auch nicht über die Konstante hereingeschmuggelt:
    expect(VORSCHAU_SANDBOX).not.toMatch(/same-origin|top-navigation|popups|forms/);
  });

  it('der Inhalt kommt als `srcdoc` (kein Laden von außen) und zeigt die Seite, wie der Renderer sie ausgibt', () => {
    render(<Vorschau seite={SEITE} stand={STAND} gemeinde="ECG" ansicht="computer" />);
    const rahmen = screen.getByTitle<HTMLIFrameElement>('Vorschau: Start');
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

describe('Bearbeiten-Ebene: Nachrichten nur aus dem eigenen iframe', () => {
  const EDITOR = seiteMit([baustein('text', { id: 'b0' })], { titel: 'Start' });
  const M = (rest: Record<string, unknown>) => ({ websiteEditor: true, ...rest });

  /** Eine Nachricht an die Erweiterung – `von` ist das Fenster, das sie angeblich schickt. */
  const schicke = (daten: unknown, von: Window | null) =>
    act(() => {
      window.dispatchEvent(new MessageEvent('message', { data: daten, source: von }));
    });

  function zeigen(mit = true) {
    const onAktion = vi.fn();
    const r = render(
      <Vorschau
        seite={EDITOR}
        stand={STAND}
        gemeinde="ECG"
        ansicht="computer"
        bearbeiten={mit ? { onAktion } : undefined}
      />,
    );
    const rahmen = screen.getByTitle<HTMLIFrameElement>('Vorschau: Start');
    return { onAktion, rahmen, fenster: rahmen.contentWindow!, ...r };
  }

  it('eine gültige Nachricht aus dem iframe kommt an', () => {
    const { onAktion, fenster } = zeigen();
    schicke(M({ was: 'gestalten', i: 0 }), fenster);
    expect(onAktion).toHaveBeenCalledWith(M({ was: 'gestalten', i: 0 }));
  });

  it('dieselbe Nachricht aus einem ANDEREN Fenster (Erweiterung selbst, anderes iframe, ohne Quelle) wird ignoriert', () => {
    const { onAktion } = zeigen();
    const anderes = document.createElement('iframe');
    document.body.append(anderes);
    schicke(M({ was: 'gestalten', i: 0 }), window);
    schicke(M({ was: 'gestalten', i: 0 }), anderes.contentWindow);
    schicke(M({ was: 'gestalten', i: 0 }), null);
    expect(onAktion).not.toHaveBeenCalled();
    anderes.remove();
  });

  it('eine Nachricht aus dem iframe mit einer Stelle, die es nicht gibt, oder in falscher Form, wird ignoriert', () => {
    const { onAktion, fenster } = zeigen();
    schicke(M({ was: 'gestalten', i: 1 }), fenster);
    schicke(M({ was: 'baustein', i: 0, j: 0, k: 1 }), fenster);
    schicke(M({ was: 'loeschen', i: -1 }), fenster);
    schicke({ was: 'gestalten', i: 0 }, fenster);
    schicke('gestalten', fenster);
    expect(onAktion).not.toHaveBeenCalled();
  });

  it('ohne Bearbeiten-Ebene hört die Vorschau gar nicht zu – und das iframe bekommt keine Ebene', () => {
    const { onAktion, fenster, rahmen } = zeigen(false);
    schicke(M({ was: 'gestalten', i: 0 }), fenster);
    expect(onAktion).not.toHaveBeenCalled();
    expect(rahmen.getAttribute('srcdoc')).not.toMatch(/websiteEditor/);
  });

  it('mit Bearbeiten-Ebene steckt sie im srcdoc – und das iframe bleibt abgeschottet', () => {
    const { rahmen } = zeigen();
    expect(rahmen.getAttribute('srcdoc')).toMatch(/websiteEditor/);
    expect(rahmen.getAttribute('sandbox')).toBe('allow-scripts');
  });

  it('die Scrollposition aus dem iframe bleibt beim Neuzeichnen erhalten – eine andere Seite beginnt oben', () => {
    const onAktion = vi.fn();
    const { rerender } = render(
      <Vorschau
        seite={EDITOR}
        stand={STAND}
        gemeinde="ECG"
        ansicht="computer"
        bearbeiten={{ onAktion }}
      />,
    );
    const fenster = screen.getByTitle<HTMLIFrameElement>('Vorschau: Start').contentWindow!;
    schicke(M({ was: 'scroll', y: 420 }), fenster);
    const geaendert = { ...EDITOR, titel: 'Start', beschreibung: 'neu' };
    rerender(
      <Vorschau
        seite={geaendert}
        stand={STAND}
        gemeinde="ECG"
        ansicht="computer"
        bearbeiten={{ onAktion }}
      />,
    );
    expect(screen.getByTitle('Vorschau: Start').getAttribute('srcdoc')).toMatch(/"scroll":420/);
    const andere = { ...EDITOR, id: 'andere', titel: 'Andere' };
    rerender(
      <Vorschau
        seite={andere}
        stand={STAND}
        gemeinde="ECG"
        ansicht="computer"
        bearbeiten={{ onAktion }}
      />,
    );
    expect(screen.getByTitle('Vorschau: Andere').getAttribute('srcdoc')).toMatch(/"scroll":0/);
  });

  it('kann der Renderer etwas Unfertiges nicht zeichnen, steht ein Hinweis statt eines Absturzes', () => {
    // Ein Stand, bei dem `seiten` fehlt, lässt die Ausgabe der Menülinks scheitern.
    const kaputt = { seiten: undefined, menue: null, einstellungen: null } as never;
    const { rahmen } = (() => {
      render(<Vorschau seite={EDITOR} stand={kaputt} gemeinde="ECG" ansicht="computer" />);
      return { rahmen: screen.getByTitle('Vorschau: Start') };
    })();
    expect(rahmen.getAttribute('srcdoc')).toContain('gerade nicht zeichnen');
  });
});
