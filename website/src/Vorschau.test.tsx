// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { htmlAttr } from '@shared/website/html';
import { cssFuerStyleTag } from '@shared/website/theme';
import { renderSeite } from '@shared/website/render';
import { baustein, einstellungen, seiteMit } from '@shared/website/website.testdaten';
import { schriftspeicher } from './schriftLader';
import { EBENE_WARTEZEIT_MS, Vorschau } from './Vorschau';
import {
  PLATZHALTER_ADRESSE,
  STYLESHEET_TEXT,
  VORSCHAU_SANDBOX,
  vorschauHtml,
  vorschauKontext,
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

  it('das Stylesheet steckt als `<style>` im Dokument – ChurchTools sperrt `data:`-Stylesheets und `<link>` (gemessen 20.11.2026)', () => {
    expect(html).toContain(`<style>${cssFuerStyleTag(STYLESHEET_TEXT)}</style>`);
    expect(html).not.toMatch(/<link\b/);
    expect(html).not.toContain('data:text/css');
    // Das ganze Blatt ist darin: eine Regel aus der Mitte.
    expect(STYLESHEET_TEXT).toContain('.w-abschnitt');
  });

  it('kein Seiten-Skript im Dokument (kein `data:`-Skript, das ChurchTools nur blockiert)', () => {
    expect(html).not.toMatch(/<script\b/);
    expect(html).not.toContain('data:text/javascript');
  });

  it('ein `</style>` im Stylesheet-Text bricht nicht aus dem `<style>` aus', () => {
    const doc = renderSeite(SEITE, {
      ...vorschauKontext(STAND, 'ECG', 'Europe/Berlin'),
      stylesheetText: 'a{color:red}</style><script>alert(1)</script><style>',
    });
    expect(doc).not.toContain('</style><script>');
    expect(doc).toContain('a{color:red}<\\/style>');
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

  describe('Hinweis, wenn die Ebene sich nicht meldet (ChurchTools blockiert das Skript)', () => {
    const HINWEIS = /ChurchTools hat das Bearbeiten-Skript blockiert/;
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('keine „bereit“-Meldung binnen 2 s: ruhiger Hinweis + console.warn', () => {
      vi.useFakeTimers();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      zeigen();
      expect(screen.queryByText(HINWEIS)).toBeNull();
      act(() => {
        vi.advanceTimersByTime(EBENE_WARTEZEIT_MS - 1);
      });
      expect(screen.queryByText(HINWEIS)).toBeNull();
      act(() => {
        vi.advanceTimersByTime(2);
      });
      expect(screen.getByText(HINWEIS)).toBeTruthy();
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('kommt „bereit“ rechtzeitig, bleibt der Hinweis aus – und eine späte Meldung nimmt ihn zurück', () => {
      vi.useFakeTimers();
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { fenster } = zeigen();
      schicke(M({ was: 'bereit' }), fenster);
      act(() => {
        vi.advanceTimersByTime(EBENE_WARTEZEIT_MS + 500);
      });
      expect(screen.queryByText(HINWEIS)).toBeNull();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('späte „bereit“-Meldung nach dem Hinweis lässt ihn wieder verschwinden', () => {
      vi.useFakeTimers();
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { fenster } = zeigen();
      act(() => {
        vi.advanceTimersByTime(EBENE_WARTEZEIT_MS + 1);
      });
      expect(screen.getByText(HINWEIS)).toBeTruthy();
      schicke(M({ was: 'bereit' }), fenster);
      expect(screen.queryByText(HINWEIS)).toBeNull();
    });

    it('ohne Bearbeiten-Ebene gibt es nichts zu warnen', () => {
      vi.useFakeTimers();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      zeigen(false);
      act(() => {
        vi.advanceTimersByTime(EBENE_WARTEZEIT_MS * 3);
      });
      expect(screen.queryByText(HINWEIS)).toBeNull();
      expect(warn).not.toHaveBeenCalled();
    });

    it('„bereit“ aus einem anderen Fenster zählt nicht', () => {
      vi.useFakeTimers();
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      zeigen();
      schicke(M({ was: 'bereit' }), window);
      act(() => {
        vi.advanceTimersByTime(EBENE_WARTEZEIT_MS + 1);
      });
      expect(screen.getByText(HINWEIS)).toBeTruthy();
    });
  });

  it('die Nonce der ChurchTools-Seite landet auf dem Skript der Ebene im srcdoc', () => {
    const s = document.createElement('script');
    s.nonce = 'NonceVonChurchTools123';
    document.head.append(s);
    const { rahmen } = zeigen();
    s.remove();
    expect(rahmen.getAttribute('srcdoc')).toContain('<script nonce="NonceVonChurchTools123">');
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

describe('Schriften in der Vorschau (W3a-3)', () => {
  const MIT_LORA = {
    seiten: [],
    menue: null,
    einstellungen: einstellungen({
      schriften: {
        text: { art: 'auswahl', name: 'Lora' },
        ueberschrift: { art: 'auswahl', name: 'Lora' },
      },
    }),
  };

  it('die gewählte Schrift kommt als data:-Adresse ins Dokument – nur sie, und erst, wenn sie geladen ist', async () => {
    render(<Vorschau seite={SEITE} stand={MIT_LORA} gemeinde="ECG" ansicht="computer" />);
    const srcdoc = () =>
      screen.getByTitle<HTMLIFrameElement>('Vorschau: Start').getAttribute('srcdoc') ?? '';
    await waitFor(() => expect(srcdoc()).toContain('url("data:font/woff2;base64,'));
    expect(srcdoc()).toContain("font-family:'Lora'");
    // Nur diese Datei wurde geladen – die anderen 13 nicht
    expect(schriftspeicher.adresse('lora-var.woff2')).toBeDefined();
    for (const andere of ['quicksand-var.woff2', 'inter-var.woff2', 'caveat-brush.woff2'])
      expect(schriftspeicher.adresse(andere)).toBeUndefined();
  });

  it('ohne gewählte Schrift (Systemschrift) steht keine @font-face-Regel im Dokument', () => {
    render(<Vorschau seite={SEITE} stand={STAND} gemeinde="ECG" ansicht="computer" />);
    expect(
      screen.getByTitle<HTMLIFrameElement>('Vorschau: Start').getAttribute('srcdoc'),
    ).not.toContain('@font-face');
  });

  it('eine eigene Schrift bekommt bis W4 keine Adresse: Ersatzschrift, kein Fehlerhinweis', () => {
    const eigene = {
      seiten: [],
      menue: null,
      einstellungen: einstellungen({
        schriften: {
          text: { art: 'eigene', name: 'Meine Schrift', datei: 'x.woff2' },
          ueberschrift: { art: 'eigene', name: 'Meine Schrift', datei: 'x.woff2' },
        },
      }),
    };
    render(<Vorschau seite={SEITE} stand={eigene} gemeinde="ECG" ansicht="computer" />);
    expect(screen.queryByText(/Schrift ließ sich gerade nicht laden/)).toBeNull();
    expect(
      screen.getByTitle<HTMLIFrameElement>('Vorschau: Start').getAttribute('srcdoc'),
    ).toContain('url("data:,")');
  });
});
