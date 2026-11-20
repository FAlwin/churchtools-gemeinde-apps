import { describe, expect, it } from 'vitest';
import { Speicherschlange, type SchlangenStand, type SpeicherAusgang } from './schlange';

/** Ein Versprechen, das der Test von Hand erfüllt oder ablehnt. */
function offen<T>() {
  let ja!: (v: T) => void;
  let nein!: (e: unknown) => void;
  const p = new Promise<T>((a, b) => {
    ja = a;
    nein = b;
  });
  return { p, ja, nein };
}

/** Eine Schlange, deren Speichern der Test steuert; `gleichzeitig` zählt, wie viele Speicherungen gerade laufen. */
function aufbau() {
  const wartende: { wert: string; ende: ReturnType<typeof offen<SpeicherAusgang>> }[] = [];
  const stand: SchlangenStand[] = [];
  const zaehler = { gleichzeitig: 0, hoechstens: 0, gestartet: [] as string[] };
  const schlange = new Speicherschlange<string>(
    (wert) => {
      zaehler.gleichzeitig++;
      zaehler.hoechstens = Math.max(zaehler.hoechstens, zaehler.gleichzeitig);
      zaehler.gestartet.push(wert);
      const ende = offen<SpeicherAusgang>();
      wartende.push({ wert, ende });
      return ende.p.finally(() => zaehler.gleichzeitig--);
    },
    (s) => stand.push(s),
  );
  return { schlange, wartende, stand, zaehler };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('Speicherschlange: nie zwei Speicherungen gleichzeitig', () => {
  it('eine Änderung während einer laufenden Speicherung wartet – danach geht nur der NEUESTE Stand hinaus', async () => {
    const { schlange, wartende, zaehler } = aufbau();
    schlange.anfordern('A');
    await tick();
    schlange.anfordern('B');
    schlange.anfordern('C');
    await tick();
    expect(zaehler.gestartet).toEqual(['A']); // B und C warten
    wartende[0].ende.ja({ art: 'ok' });
    await tick();
    expect(zaehler.gestartet).toEqual(['A', 'C']); // B ist überholt, C enthält B
    wartende[1].ende.ja({ art: 'ok' });
    await tick();
    expect(zaehler.hoechstens).toBe(1);
  });

  it('der Zustand: speichert … → gespeichert; `offen` ist wahr, bis alles angekommen ist', async () => {
    const { schlange, wartende, stand } = aufbau();
    expect(schlange.offen).toBe(false);
    schlange.anfordern('A');
    expect(schlange.offen).toBe(true);
    await tick();
    expect(stand).toEqual([{ art: 'speichert' }]);
    wartende[0].ende.ja({ art: 'ok' });
    await tick();
    expect(stand.at(-1)).toEqual({ art: 'gespeichert' });
    expect(schlange.offen).toBe(false);
  });
});

describe('Speicherschlange: ein Fehler zerstört nichts', () => {
  it('scheitert die Speicherung (503), bleibt der Stand erhalten – „Erneut versuchen“ schickt DENSELBEN Stand noch einmal', async () => {
    const { schlange, wartende, stand, zaehler } = aufbau();
    schlange.anfordern('A');
    await tick();
    wartende[0].ende.nein(new Error('503'));
    await tick();
    expect(stand.at(-1)).toMatchObject({ art: 'fehler' });
    expect(schlange.offen).toBe(true); // nichts verloren, nichts als „gespeichert“ verbucht
    schlange.nochmal();
    await tick();
    expect(zaehler.gestartet).toEqual(['A', 'A']);
    wartende[1].ende.ja({ art: 'ok' });
    await tick();
    expect(stand.at(-1)).toEqual({ art: 'gespeichert' });
    expect(schlange.offen).toBe(false);
  });

  it('kam während des fehlgeschlagenen Speicherns ein neuerer Stand, gilt der – der ältere wird nicht wieder hervorgeholt', async () => {
    const { schlange, wartende, zaehler } = aufbau();
    schlange.anfordern('A');
    await tick();
    schlange.anfordern('B');
    wartende[0].ende.nein(new Error('504'));
    await tick();
    schlange.nochmal();
    await tick();
    expect(zaehler.gestartet).toEqual(['A', 'B']);
  });

  it('eine weitere Änderung nach dem Fehler versucht es von selbst wieder (mit dem neuen, vollständigen Stand)', async () => {
    const { schlange, wartende, zaehler } = aufbau();
    schlange.anfordern('A');
    await tick();
    wartende[0].ende.nein(new Error('Netz'));
    await tick();
    schlange.anfordern('A+B');
    await tick();
    expect(zaehler.gestartet).toEqual(['A', 'A+B']);
  });

  it('ein Wurf BEVOR irgendetwas läuft (Funktion wirft sofort) wird ebenso gemeldet statt verschluckt', async () => {
    const stand: SchlangenStand[] = [];
    const schlange = new Speicherschlange<string>(
      () => Promise.reject(new Error('sofort')),
      (s) => stand.push(s),
    );
    schlange.anfordern('A');
    await tick();
    expect(stand.at(-1)).toMatchObject({ art: 'fehler' });
    expect(schlange.offen).toBe(true);
  });
});

describe('Speicherschlange: abgewiesen (gesperrt, verändert)', () => {
  it('gesperrt: nichts gilt als gespeichert, der Stand bleibt, der Zustand sagt es', async () => {
    const { schlange, wartende, stand } = aufbau();
    schlange.anfordern('A');
    await tick();
    wartende[0].ende.ja({ art: 'gesperrt' });
    await tick();
    expect(stand.at(-1)).toEqual({ art: 'gesperrt' });
    expect(schlange.offen).toBe(true);
  });

  it('verändert: derselbe Weg, anderer Grund', async () => {
    const { schlange, wartende, stand } = aufbau();
    schlange.anfordern('A');
    await tick();
    wartende[0].ende.ja({ art: 'veraendert' });
    await tick();
    expect(stand.at(-1)).toEqual({ art: 'veraendert' });
  });

  it('„Neu laden“ (`verwerfen`) wirft den wartenden Stand bewusst weg – und nur dann', async () => {
    const { schlange, wartende, zaehler } = aufbau();
    schlange.anfordern('A');
    await tick();
    wartende[0].ende.ja({ art: 'gesperrt' });
    await tick();
    schlange.verwerfen();
    expect(schlange.offen).toBe(false);
    schlange.nochmal();
    await tick();
    expect(zaehler.gestartet).toEqual(['A']);
  });
});
