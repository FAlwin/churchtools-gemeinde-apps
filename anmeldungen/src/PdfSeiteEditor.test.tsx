// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  pdfFeldStil,
  pdfHintergrundStil,
  pdfSeitenStil,
  pdfVorgabeFelder,
  stilText,
  type PdfFeld,
  type PdfSeite,
} from '@shared/anmeldung/nachweisAntrag';
import { PdfSeiteEditor } from './PdfSeiteEditor';

/**
 * Die Seite der eigenen PDF mit ziehbaren Platzhaltern (N1d): Pointer-Events ändern die Position in Prozent der Seite, die
 * Pfeiltasten verschieben, Entf entfernt. jsdom hat keine Maße – die Seite bekommt per `getBoundingClientRect` 1000 × 2000 px.
 */
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////';
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const START: PdfSeite = {
  breiteMm: 210,
  hoeheMm: 297,
  felder: [
    { id: 'f1', art: 'NachnameVorname', x: 36, y: 17.6, pt: 11 },
    { id: 'f2', art: 'Heute', x: 36, y: 40.2, pt: 11, vorsatz: 'Lohmar, ' },
    { id: 'f3', art: 'Unterschrift', x: 36, y: 50, pt: 11, breiteMm: 50 },
  ],
};

let stand: PdfSeite;
function Huelle({
  start = START,
  unterschrift = PNG,
}: {
  start?: PdfSeite;
  unterschrift?: string | null;
}) {
  const [seite, setSeite] = useState(start);
  stand = seite;
  return (
    <PdfSeiteEditor
      seite={seite}
      hintergrund={JPG}
      unterschrift={unterschrift}
      heute="19. November 2026"
      onFelder={(felder) => setSeite({ ...seite, felder })}
    />
  );
}

const SEITE = { width: 1000, height: 2000 };
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const gross = this.dataset.testid === 'pdf-seite';
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: gross ? SEITE.width : 0,
      bottom: gross ? SEITE.height : 0,
      width: gross ? SEITE.width : 0,
      height: gross ? SEITE.height : 0,
      toJSON: () => ({}),
    };
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const chip = (id: string) => document.querySelector<HTMLElement>(`[data-feld="${id}"]`)!;
const feld = (id: string): PdfFeld => stand.felder.find((f) => f.id === id)!;
// jsdom kennt kein `PointerEvent` (clientX ginge verloren): ein MouseEvent mit dem Namen des Pointer-Ereignisses tut es – React hört
// auf den Namen und liest `clientX`/`clientY` aus dem Ereignis.
const maus = (
  el: Element,
  typ: 'pointerDown' | 'pointerMove' | 'pointerUp',
  x: number,
  y: number,
) =>
  fireEvent(
    el,
    new MouseEvent(typ.toLowerCase(), { bubbles: true, cancelable: true, clientX: x, clientY: y }),
  );

describe('Darstellung: dieselben Stile wie das HTML für ChurchTools', () => {
  it('Platzhalter liegen mit dem Stil des Erzeugers auf der Seite (Anker links oben, Prozent)', () => {
    render(<Huelle />);
    for (const f of START.felder) {
      const el = chip(f.id);
      const soll = pdfFeldStil(f);
      expect(el.style.left).toBe(soll.left);
      expect(el.style.top).toBe(soll.top);
      expect(el.style.position).toBe('absolute');
      expect(el.style.transform).toBe('');
    }
    expect(chip('f1').style.fontSize).toBe('11pt');
    expect(chip('f3').style.width).toBe('50mm');
  });

  it('die Seite hat das Format der PDF in mm, der Hintergrund füllt sie – wie im HTML', () => {
    const quer: PdfSeite = { ...START, breiteMm: 297, hoeheMm: 210 };
    render(<Huelle start={quer} />);
    const seite = screen.getByTestId('pdf-seite');
    expect(seite.style.width).toBe(pdfSeitenStil(quer).width);
    expect(seite.style.height).toBe(pdfSeitenStil(quer).height);
    const bild = seite.querySelector('img')!;
    expect(bild.getAttribute('src')).toBe(JPG);
    expect(bild.style.width).toBe(pdfHintergrundStil(quer).width);
    expect(bild.style.height).toBe(pdfHintergrundStil(quer).height);
    expect(stilText(pdfHintergrundStil(quer))).toContain('297mm');
  });

  it('zeigt Beispielwerte statt Platzhalter-Code; die Unterschrift als Bild, ohne Bild als leere Fläche', () => {
    const { unmount } = render(<Huelle />);
    expect(chip('f1').textContent).toBe('Probst, Lena');
    expect(chip('f2').textContent).toBe('Lohmar, 19. November 2026');
    expect(chip('f3').querySelector('img')?.getAttribute('src')).toBe(PNG);
    unmount();
    render(<Huelle unterschrift={null} />);
    expect(chip('f3').querySelector('img')).toBeNull();
    expect(chip('f3').textContent).toBe('Unterschrift');
  });

  it('am Handy: kein Querscrollen – die Seite ist in einen Rahmen mit transform: scale eingepasst', () => {
    render(<Huelle />);
    const rahmen = screen.getByTestId('pdf-rahmen');
    expect(rahmen.style.height).not.toBe('');
    expect(screen.getByTestId('pdf-seite').style.transform).toMatch(/^scale\(/);
  });
});

describe('Ziehen mit Pointer-Events', () => {
  it('Maus/Finger bewegt den Platzhalter – Position in Prozent der Seite, Anker bleibt links oben', () => {
    render(<Huelle />);
    const el = chip('f1');
    maus(el, 'pointerDown', 360, 352);
    // 100 px nach rechts = 10 % der Seitenbreite (1000), 200 px nach unten = 10 % der Seitenhöhe (2000)
    maus(el, 'pointerMove', 460, 552);
    expect(feld('f1')).toMatchObject({ x: 46, y: 27.6 });
    expect(chip('f1').style.left).toBe('46%');
    expect(chip('f1').style.top).toBe('27.6%');
    maus(el, 'pointerUp', 460, 552);
    // nach dem Loslassen wirkt weiteres Bewegen nicht mehr
    maus(el, 'pointerMove', 900, 900);
    expect(feld('f1')).toMatchObject({ x: 46, y: 27.6 });
  });

  it('bleibt innerhalb der Seite', () => {
    render(<Huelle />);
    const el = chip('f2');
    maus(el, 'pointerDown', 360, 800);
    maus(el, 'pointerMove', -5000, -5000);
    expect(feld('f2')).toMatchObject({ x: 0, y: 0 });
    maus(el, 'pointerMove', 9000, 9000);
    expect(feld('f2')).toMatchObject({ x: 100, y: 100 });
  });

  it('andere Platzhalter bleiben, wo sie sind', () => {
    render(<Huelle />);
    maus(chip('f1'), 'pointerDown', 0, 0);
    maus(chip('f1'), 'pointerMove', 50, 0);
    expect(feld('f2')).toMatchObject({ x: 36, y: 40.2 });
    expect(feld('f3')).toMatchObject({ x: 36, y: 50 });
  });

  it('ein Zug wählt den Platzhalter aus (Werkzeugleiste erscheint)', () => {
    render(<Huelle />);
    expect(screen.queryByRole('group', { name: 'Ausgewählter Platzhalter' })).toBeNull();
    maus(chip('f1'), 'pointerDown', 0, 0);
    expect(screen.getByRole('group', { name: 'Ausgewählter Platzhalter' })).toBeTruthy();
  });
});

describe('Tastatur (Barrierefreiheit)', () => {
  it('Pfeiltasten verschieben um 0,5 %, mit Umschalt um 2 %', () => {
    render(<Huelle />);
    const el = chip('f1');
    fireEvent.keyDown(el, { key: 'ArrowRight' });
    expect(feld('f1').x).toBe(36.5);
    fireEvent.keyDown(el, { key: 'ArrowLeft' });
    fireEvent.keyDown(el, { key: 'ArrowLeft' });
    expect(feld('f1').x).toBe(35.5);
    fireEvent.keyDown(el, { key: 'ArrowDown', shiftKey: true });
    expect(feld('f1').y).toBe(19.6);
    fireEvent.keyDown(el, { key: 'ArrowUp' });
    expect(feld('f1').y).toBe(19.1);
  });

  it('die Position bleibt zwischen 0 und 100 %', () => {
    render(<Huelle start={{ ...START, felder: [{ ...START.felder[0], x: 0.2, y: 99.9 }] }} />);
    fireEvent.keyDown(chip('f1'), { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyDown(chip('f1'), { key: 'ArrowDown', shiftKey: true });
    expect(feld('f1')).toMatchObject({ x: 0, y: 100 });
  });

  it('Entf und Rücktaste entfernen den Platzhalter', () => {
    render(<Huelle />);
    fireEvent.keyDown(chip('f2'), { key: 'Delete' });
    expect(stand.felder.map((f) => f.id)).toEqual(['f1', 'f3']);
    fireEvent.keyDown(chip('f1'), { key: 'Backspace' });
    expect(stand.felder.map((f) => f.id)).toEqual(['f3']);
  });

  it('andere Tasten tun nichts', () => {
    render(<Huelle />);
    fireEvent.keyDown(chip('f1'), { key: 'a' });
    expect(stand).toEqual(START);
  });

  it('jeder Platzhalter ist ein bedienbares Element mit Namen', () => {
    render(<Huelle />);
    const knopf = screen.getByRole('button', { name: /\[Nachname\], \[Vorname\] – mit Maus/ });
    expect(knopf.getAttribute('tabindex')).toBe('0');
  });
});

describe('Platzhalter dazu, Schrift, Breite, Entfernen', () => {
  it('die Pillen setzen neue Platzhalter mit eigener Kennung; die Unterschrift nur einmal', () => {
    render(<Huelle />);
    const unterschrift = screen.getByRole('button', { name: 'Unterschrift' });
    expect(unterschrift.hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '[E-Mail]' }));
    fireEvent.click(screen.getByRole('button', { name: '[Adresse]' }));
    expect(stand.felder.map((f) => [f.id, f.art])).toEqual([
      ['f1', 'NachnameVorname'],
      ['f2', 'Heute'],
      ['f3', 'Unterschrift'],
      ['f4', 'Email'],
      ['f5', 'Adresse'],
    ]);
    expect(feld('f4')).toMatchObject({ pt: 11, x: 10 });
    // der neue ist ausgewählt
    expect(screen.getByRole('group', { name: 'Ausgewählter Platzhalter' }).textContent).toContain(
      '[Adresse]',
    );
  });

  it('wer die Unterschrift entfernt, kann sie wieder dazunehmen (50 mm)', () => {
    render(<Huelle />);
    fireEvent.keyDown(chip('f3'), { key: 'Delete' });
    const pille = screen.getByRole('button', { name: 'Unterschrift' });
    expect(pille.hasAttribute('disabled')).toBe(false);
    fireEvent.click(pille);
    expect(stand.felder.at(-1)).toMatchObject({ art: 'Unterschrift', breiteMm: 50 });
  });

  it('Schriftgröße 9/11/13 pt für den gewählten Platzhalter', () => {
    render(<Huelle />);
    maus(chip('f1'), 'pointerDown', 0, 0);
    const werkzeug = screen.getByRole('group', { name: 'Ausgewählter Platzhalter' });
    fireEvent.click(within(werkzeug).getByRole('button', { name: '13 pt' }));
    expect(feld('f1').pt).toBe(13);
    expect(chip('f1').style.fontSize).toBe('13pt');
    fireEvent.click(within(werkzeug).getByRole('button', { name: '9 pt' }));
    expect(feld('f1').pt).toBe(9);
  });

  it('Unterschrift: Breite in mm', () => {
    render(<Huelle />);
    maus(chip('f3'), 'pointerDown', 0, 0);
    const werkzeug = screen.getByRole('group', { name: 'Ausgewählter Platzhalter' });
    fireEvent.click(within(werkzeug).getByRole('button', { name: '70 mm' }));
    expect(feld('f3').breiteMm).toBe(70);
    expect(chip('f3').style.width).toBe('70mm');
    expect(within(werkzeug).queryByRole('button', { name: '9 pt' })).toBeNull();
  });

  it('Heute: Text davor ändern, leer lassen entfernt ihn', () => {
    render(<Huelle />);
    maus(chip('f2'), 'pointerDown', 0, 0);
    const eingabe = screen.getByLabelText('Text vor dem Datum');
    fireEvent.change(eingabe, { target: { value: 'Donrath, ' } });
    expect(feld('f2').vorsatz).toBe('Donrath, ');
    expect(chip('f2').textContent).toBe('Donrath, 19. November 2026');
    fireEvent.change(eingabe, { target: { value: '' } });
    expect(feld('f2').vorsatz).toBeUndefined();
  });

  it('„Entfernen“ in der Leiste entfernt den gewählten Platzhalter', () => {
    render(<Huelle />);
    maus(chip('f1'), 'pointerDown', 0, 0);
    fireEvent.click(screen.getByRole('button', { name: '[Nachname], [Vorname] entfernen' }));
    expect(stand.felder.map((f) => f.id)).toEqual(['f2', 'f3']);
    expect(screen.queryByRole('group', { name: 'Ausgewählter Platzhalter' })).toBeNull();
  });

  it('ein Klick auf die leere Seite hebt die Auswahl auf', () => {
    render(<Huelle />);
    maus(chip('f1'), 'pointerDown', 0, 0);
    maus(screen.getByTestId('pdf-seite'), 'pointerDown', 5, 5);
    expect(screen.queryByRole('group', { name: 'Ausgewählter Platzhalter' })).toBeNull();
  });

  it('bei 20 Platzhaltern sind die Pillen aus', () => {
    const viele: PdfFeld[] = Array.from({ length: 20 }, (_, i) => ({
      id: `f${i + 1}`,
      art: 'Vorname' as const,
      x: 1,
      y: 1,
      pt: 11,
    }));
    render(<Huelle start={{ ...START, felder: viele }} />);
    expect(screen.getByRole('button', { name: '[Adresse]' }).hasAttribute('disabled')).toBe(true);
  });

  it('die Vorgabe-Platzhalter der ersten PDF sind alle bedienbar', () => {
    render(<Huelle start={{ ...START, felder: pdfVorgabeFelder('Lohmar') }} />);
    expect(document.querySelectorAll('[data-feld]')).toHaveLength(5);
  });
});
