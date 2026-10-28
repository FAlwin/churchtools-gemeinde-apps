import { describe, expect, it } from 'vitest';
import { terminZeile } from './terminZeile';

describe('terminZeile – wann ein Termin ist, in einer Schreibweise', () => {
  it('„Sonntag, 01. Nov · 10:00“ – wie im Kopf des Ablaufs und im Titel des Liedblatts', () => {
    expect(terminZeile({ weekday: 'Sonntag', day: '01', month: 'Nov', time: '10:00' })).toBe(
      'Sonntag, 01. Nov · 10:00',
    );
  });
});
