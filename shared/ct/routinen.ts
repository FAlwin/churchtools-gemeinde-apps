/**
 * **Schritte einer ChurchTools-Routine**, wie `PATCH /routines/{id}` sie nimmt – geteilt von Anmeldungen (Bestätigung,
 * Erinnerung, Löschen) und Organigramm (Gruppenwechsel: nach einer Frist austragen). Lag bis O9-1 (11.11.2026) in
 * `shared/anmeldung/ablaeufe.ts`.
 *
 * Gemessen: Warten „bis“ (`untilDate`) in A9 (24.10.2026), Warten „nach Dauer“ (`duration.numDays`) in M13
 * (09.–11.11.2026, läuft von selbst weiter), `remove-member` in beiden. Die OpenAPI erlaubt bei `remove-member` auch
 * `actionData: null`; geschrieben wird überall `{}` wie seit A9.
 */
export type RoutinenSchritt =
  | {
      id?: number;
      actionKey: 'send-member-email';
      isEnabled: boolean;
      actionData: { subject: string; body: string; addSignOutUrl: false; senderId: number };
    }
  | { id?: number; actionKey: 'special:wait'; isEnabled: true; actionData: { untilDate: string } }
  | {
      id?: number;
      actionKey: 'special:wait';
      isEnabled: true;
      actionData: { duration: { numDays: number } };
    }
  | { id?: number; actionKey: 'remove-member'; isEnabled: true; actionData: Record<string, never> };
