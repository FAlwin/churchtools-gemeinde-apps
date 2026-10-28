import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import s from './Startseite.module.scss';

/**
 * **Erst einrichten** (A6-2, Alwin 14.10.2026): Nutzbar ist die Erweiterung erst, wenn die Gemeinde das öffentliche
 * Formular auf ihre eigene Adresse gelegt und diese eingetragen hat – „Voraussetzung für diese Extension, auf keinen
 * Fall soll unsere Domain da sichtbar werden“. Bis dahin steht hier, was zu tun ist.
 */
export function ErstEinrichten({
  admin,
  onEinstellungen,
}: {
  admin: boolean;
  onEinstellungen: () => void;
}) {
  return (
    <section className={s.karte} aria-labelledby="einrichten">
      <div className={s.kopf}>
        <h2 id="einrichten">Erst einrichten</h2>
      </div>
      {admin ? (
        <div className={s.einrichten}>
          <p>
            Das Anmeldeformular braucht eine eigene Adresse eurer Gemeinde, z. B.
            <b> anmeldung.eure-gemeinde.de</b>. Einmalig:
          </p>
          <ol>
            <li>
              Beim Anbieter eurer Website eine Subdomain anlegen und das Formular-Paket (
              <code>anmeldungen-formular-….zip</code> vom Release) entpackt dorthin hochladen.
            </li>
            <li>
              In ChurchTools die Adresse als <b>erlaubte Herkunft</b> eintragen – sonst darf das
              Formular nicht mit ChurchTools sprechen.
            </li>
            <li>Hier unter „Einstellungen“ die Adresse eintragen.</li>
          </ol>
          <FensterKnopf onClick={onEinstellungen}>Einstellungen öffnen</FensterKnopf>
        </div>
      ) : (
        <p className={s.einrichten}>
          Die Anmeldungen sind noch nicht eingerichtet. Ein Gruppen-Admin muss zuerst die Adresse
          des Anmeldeformulars festlegen.
        </p>
      )}
    </section>
  );
}
