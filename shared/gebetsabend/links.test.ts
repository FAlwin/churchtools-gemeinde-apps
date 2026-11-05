import { describe, expect, it } from 'vitest';
import { BITRATE, SENDER_NAME, senderLink, VDO_BASIS, zuhoererLink } from './links';
import { neuerZugang } from './zugang';

/** Geprüft wird gegen einen erzeugten Zugang, nicht gegen handgeschriebene Werte. */
const zugang = neuerZugang(true, '2026-11-05T19:30:00.000Z');
const parameter = (link: string) => new URL(link).searchParams;

describe('senderLink', () => {
  it('Mikro und Kamera ohne Auswahl, sofort senden (S0b), Name „Technik“', () => {
    const link = senderLink(zugang);
    expect(link.startsWith(VDO_BASIS)).toBe(true);
    const p = parameter(link);
    expect(p.get('push')).toBe(zugang.streamId);
    expect(p.get('password')).toBe(zugang.passwort);
    expect(p.get('audiodevice')).toBe('1');
    expect(p.get('videodevice')).toBe('1');
    expect(p.has('autostart')).toBe(true);
    expect(p.get('label')).toBe(SENDER_NAME);
  });

  it('„Nur Ton“ schaltet die Kamera ab', () => {
    expect(parameter(senderLink({ ...zugang, mitBild: false })).get('videodevice')).toBe('0');
  });
});

describe('zuhoererLink', () => {
  it('ohne VDO.Ninja-Bedienung außer dem Wiedergabe-Knopf, Bild begrenzt, Name aus ChurchTools', () => {
    const p = parameter(zuhoererLink(zugang, 'Helene Wiebe'));
    expect(p.get('view')).toBe(zugang.streamId);
    expect(p.get('password')).toBe(zugang.passwort);
    // `cleanish`, nicht `cleanoutput`: Der Wiedergabe-Knopf muss bleiben, sonst sieht man am iPhone nur Schwarz.
    expect(p.has('cleanish')).toBe(true);
    expect(p.has('cleanoutput')).toBe(false);
    expect(p.get('bitrate')).toBe(String(BITRATE));
    expect(p.has('novideo')).toBe(false);
    expect(p.get('label')).toBe('Helene Wiebe');
  });

  it('„Nur Ton“: kein Bild anfordern', () => {
    const p = parameter(zuhoererLink({ ...zugang, mitBild: false }, 'Helene Wiebe'));
    expect(p.has('novideo')).toBe(true);
    expect(p.has('bitrate')).toBe(false);
  });

  it('Sonderzeichen im Namen bleiben heil, leerer Name wird „Gast“', () => {
    expect(parameter(zuhoererLink(zugang, 'Jörg & Anna')).get('label')).toBe('Jörg & Anna');
    expect(parameter(zuhoererLink(zugang, '  ')).get('label')).toBe('Gast');
  });
});
