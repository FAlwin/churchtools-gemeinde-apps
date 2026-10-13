import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import type { MeineGruppe } from '@shared/ct/gruppen';
import { STATUS, setzeStatus, umbenennen, verschieben } from './einrichten';
import { Fehler } from './Bearbeiten';
import { useSpeichern } from './useSpeichern';
import type { Aenderung } from './Rueckgaengig';
import f from './Formular.module.scss';

/**
 * **Eine Veranstaltung verwalten** (A4-Nachtrag, Alwin 13.10.2026: „alles muss möglich sein – Name, Freigabe,
 * Gruppenzugehörigkeit, Löschen … immer mit Warnungen und Rückgängig-Knöpfen“). Jede Aktion sagt vorher, was
 * passiert, und meldet danach eine `Aenderung` mit dem Weg zurück.
 *
 * Gemessen (13.10.2026): Umbenennen, Freigabe zurücknehmen und Archivieren darf, wer einrichten darf;
 * Verschieben (und endgültig Löschen, im Archiv) nur Gruppen-Admins. **Löschen heißt hier: ins Archiv**
 * (Alwin: „erst Archiv“) – dort lässt es sich wiederherstellen.
 */

type Ansicht = 'auswahl' | 'name' | 'zurueck' | 'verschieben' | 'archiv';

export function VerwaltenFenster({
  id,
  name,
  statusId,
  team,
  teams,
  admin,
  anmeldungen,
  onClose,
  onGeaendert,
}: {
  id: number;
  name: string;
  statusId: number;
  team: { id: number; name: string } | null;
  /** Teams, in die man verschieben kann (die eigenen Gruppen). */
  teams: MeineGruppe[];
  /** Gruppen-Admin: darf verschieben. */
  admin: boolean;
  anmeldungen: number | null;
  onClose: () => void;
  /** `zurUebersicht`: Die Veranstaltung ist nicht mehr zu sehen (archiviert) → zur Übersicht. */
  onGeaendert: (a: Aenderung, zurUebersicht: boolean) => void;
}) {
  const [ansicht, setAnsicht] = useState<Ansicht>('auswahl');
  const [neuerName, setNeuerName] = useState(name);
  const ziele = teams.filter((t) => t.id !== team?.id);
  const [ziel, setZiel] = useState(ziele[0]?.id ?? 0);
  const { arbeitet, fehler, speichern } = useSpeichern(onClose);
  const tun = (aktion: () => Promise<void>, a: Aenderung, weg = false) =>
    speichern(aktion, () => onGeaendert(a, weg));

  const angemeldet =
    anmeldungen && anmeldungen > 0
      ? ` Die ${anmeldungen === 1 ? 'eine Anmeldung bleibt' : `${anmeldungen} Anmeldungen bleiben`} erhalten.`
      : '';

  if (ansicht === 'name') {
    const sauber = neuerName.trim();
    return (
      <Sheet title="Umbenennen" onClose={onClose}>
        <label className={f.feld}>
          <span>Name der Veranstaltung</span>
          <input
            className={f.eingabe}
            value={neuerName}
            maxLength={100}
            onChange={(e) => setNeuerName(e.target.value)}
          />
        </label>
        <p className={f.hinweis}>
          Der Termin im Kalender und der Verwendungszweck behalten ihren Text – bei Bedarf dort
          anpassen.
        </p>
        <Fehler text={fehler} />
        <button
          type="button"
          className={f.knopf}
          disabled={!sauber || sauber === name || arbeitet}
          onClick={() =>
            tun(() => umbenennen(id, sauber), {
              text: `Umbenannt in „${sauber}“.`,
              rueckgaengig: () => umbenennen(id, name),
            })
          }
        >
          {arbeitet ? 'Wird gespeichert …' : 'Umbenennen'}
        </button>
      </Sheet>
    );
  }

  if (ansicht === 'zurueck') {
    return (
      <Sheet title="Freigabe zurücknehmen?" onClose={onClose}>
        <p className={f.hinweis}>
          Die Veranstaltung wird wieder zum Entwurf: Gäste sehen sie nicht mehr und können sich
          nicht mehr anmelden.{angemeldet}
        </p>
        <Fehler text={fehler} />
        <button
          type="button"
          className={f.knopf}
          disabled={arbeitet}
          onClick={() =>
            tun(() => setzeStatus(id, STATUS.entwurf), {
              text: 'Freigabe zurückgenommen – Gäste können sich nicht mehr anmelden.',
              rueckgaengig: () => setzeStatus(id, STATUS.freigegeben),
            })
          }
        >
          {arbeitet ? 'Wird gespeichert …' : 'Freigabe zurücknehmen'}
        </button>
      </Sheet>
    );
  }

  if (ansicht === 'verschieben') {
    const zielName = ziele.find((t) => t.id === ziel)?.name ?? '';
    return (
      <Sheet title="In ein anderes Team" onClose={onClose}>
        {ziele.length === 0 || !team ? (
          <p className={f.hinweis}>Es gibt kein anderes Team, in das du verschieben kannst.</p>
        ) : (
          <>
            <label className={f.feld}>
              <span>Gehört künftig zu</span>
              <select
                className={f.eingabe}
                value={ziel}
                onChange={(e) => setZiel(Number(e.target.value))}
              >
                {ziele.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <p className={f.hinweis}>
              Danach richtet das neue Team die Veranstaltung ein; „{team.name}“ sieht sie nicht mehr
              (außer über ChurchTools-Rechte von oben).{angemeldet}
            </p>
            <Fehler text={fehler} />
            <button
              type="button"
              className={f.knopf}
              disabled={arbeitet}
              onClick={() =>
                tun(() => verschieben(id, team.id, ziel), {
                  text: `„${name}“ gehört jetzt zu „${zielName}“.`,
                  rueckgaengig: () => verschieben(id, ziel, team.id),
                })
              }
            >
              {arbeitet ? 'Wird verschoben …' : `Zu „${zielName}“ verschieben`}
            </button>
          </>
        )}
      </Sheet>
    );
  }

  if (ansicht === 'archiv') {
    return (
      <Sheet title="Löschen?" onClose={onClose}>
        <p className={f.hinweis}>
          Die Veranstaltung kommt ins <b>Archiv</b>: Sie verschwindet aus der Übersicht, Gäste
          können sich nicht mehr anmelden.{angemeldet} Wiederherstellen kannst du sie jederzeit
          unter „Archiv“ auf der Startseite.
        </p>
        <Fehler text={fehler} />
        <button
          type="button"
          className={f.entfernen}
          disabled={arbeitet}
          onClick={() =>
            tun(
              () => setzeStatus(id, STATUS.archiviert),
              {
                text: `„${name}“ ist im Archiv.`,
                rueckgaengig: () => setzeStatus(id, statusId),
              },
              true,
            )
          }
        >
          {arbeitet ? 'Wird archiviert …' : 'Ins Archiv verschieben'}
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet title="Veranstaltung verwalten" onClose={onClose}>
      <div className={f.optionen} style={{ marginBottom: 14 }}>
        <button type="button" className={f.option} onClick={() => setAnsicht('name')}>
          Umbenennen
          <small>Jetzt: „{name}“</small>
        </button>
        {statusId === STATUS.freigegeben && (
          <button type="button" className={f.option} onClick={() => setAnsicht('zurueck')}>
            Freigabe zurücknehmen
            <small>Wieder Entwurf – Gäste können sich nicht mehr anmelden</small>
          </button>
        )}
        <button
          type="button"
          className={f.option}
          disabled={!admin}
          onClick={() => setAnsicht('verschieben')}
        >
          In ein anderes Team
          <small>
            {admin
              ? `Jetzt: ${team?.name ?? '–'}`
              : 'Nur Gruppen-Admins – ChurchTools erlaubt es sonst nicht.'}
          </small>
        </button>
        <button type="button" className={f.option} onClick={() => setAnsicht('archiv')}>
          Löschen
          <small>Kommt ins Archiv und lässt sich dort wiederherstellen</small>
        </button>
      </div>
    </Sheet>
  );
}
