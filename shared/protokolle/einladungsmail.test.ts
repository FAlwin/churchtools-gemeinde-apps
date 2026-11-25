import { describe, expect, it } from 'vitest';
import { mailsAnAndere } from './einladungsmail';

describe('mailsAnAndere', () => {
  it('ich bekomme keine Mail, jeder andere eine', () => {
    expect(mailsAnAndere([1, 19, 20], 1)).toBe(2);
    expect(mailsAnAndere([1], 1)).toBe(0);
    expect(mailsAnAndere([], 1)).toBe(0);
  });

  it('jede Person zählt einmal', () => {
    expect(mailsAnAndere([19, 19, 1], 1)).toBe(1);
  });
});
