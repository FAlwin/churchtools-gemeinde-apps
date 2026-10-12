/**
 * Platzhalter des öffentlichen Formulars (#474, A1). Das Formular selbst entsteht in A4, „Deine
 * Anmeldung" (ändern, absagen) in A5 – beide mit den Regeln aus `shared/anmeldung/`.
 */
export function Platzhalter() {
  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '48px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Anmeldung</h1>
      <p style={{ marginTop: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
        Hier entsteht das Anmeldeformular für Veranstaltungen. Den Link zur Anmeldung bekommst du
        von deiner Gemeinde.
      </p>
    </main>
  );
}
