import styles from './PersonBild.module.scss';

/**
 * **Eine Person als Kreis** – Profilbild aus ChurchTools oder, ohne Bild, die Initialen auf Grau, wie in der
 * ChurchTools-Weboberfläche (Mitgliederliste, gemessen 22.10.2026: Kreis slate-400, weiße fette Initialen).
 * Für alle Apps; die Größe kommt über `groesse` (px), alles andere aus `ui/design`.
 */
export function PersonBild({
  name,
  bild,
  initialen,
  groesse = 32,
}: {
  name: string;
  bild: string | null;
  initialen: string;
  groesse?: number;
}) {
  const stil = { width: groesse, height: groesse, fontSize: Math.round(groesse * 0.36) };
  return bild ? (
    <img className={styles.kreis} src={bild} alt="" title={name} style={stil} loading="lazy" />
  ) : (
    <span className={styles.kreis} title={name} style={stil} aria-hidden="true">
      {initialen}
    </span>
  );
}
