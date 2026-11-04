import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import type { MeineGruppe } from '@shared/ct/gruppen';
import { archivStand } from '@shared/anmeldung/ablaeufe';
import { STATUS, setzeStatus, umbenennen, verschieben } from './einrichten';
import { insArchiv } from './archiv';
import { datumText } from './anzeige';
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
 *
 * A9-4 (D1/D2): Archivieren schaltet die Abläufe ab – mit Anmeldungen geht es darum erst, wenn ChurchTools sie gelöscht
 * hat (`archivStand`). Löscht ChurchTools gar nicht (kein Termin, keine Abläufe), geht es mit Hinweis.
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
  loeschDatum,
  heute,
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
  /**
   * Das Löschdatum, wie es in ChurchTools steht (A9-4) – `null`: es wird nicht gelöscht; `undefined`: ließ sich (noch)
   * nicht lesen, dann ist Löschen mit Anmeldungen vorsichtshalber gesperrt.
   */
  loeschDatum: string | null | undefined;
  heute: string;
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

  /**
   * Jede Unterseite führt mit „‹“ und „Abbrechen“ zurück zur Auswahl, das X schließt (Alwin, 02.11.2026). Bis dahin
   * gab es keinen Rückweg – „Abbrechen“ schloss das ganze Fenster.
   */
  const zurAuswahl = () => setAnsicht('auswahl');
  const archiv =
    loeschDatum === undefined
      ? anmeldungen === 0
        ? ({ art: 'frei' } as const)
        : ({ art: 'unbekannt' } as const)
      : archivStand(anmeldungen, loeschDatum, heute);

  if (ansicht === 'name') {
    const sauber = neuerName.trim();
    return (
      <Sheet
        title="Umbenennen"
        onClose={onClose}
        zurueck={zurAuswahl}
        onAbbrechen={zurAuswahl}
        beschaeftigt={arbeitet}
        knoepfe={
          <FensterKnopf
            disabled={!sauber || sauber === name || arbeitet}
            onClick={() =>
              tun(() => umbenennen(id, sauber), {
                text: `Umbenannt in „${sauber}“.`,
                rueckgaengig: () => umbenennen(id, name),
              })
            }
          >
            {arbeitet ? 'Wird gespeichert …' : 'Umbenennen'}
          </FensterKnopf>
        }
      >
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
          Steht der Name im Verwendungszweck, zieht er mit. Der Termin im Kalender behält seinen
          Titel – bei Bedarf dort anpassen.
        </p>
        <Fehler text={fehler} />
      </Sheet>
    );
  }

  if (ansicht === 'zurueck') {
    return (
      <Sheet
        title="Freigabe zurücknehmen?"
        onClose={onClose}
        zurueck={zurAuswahl}
        onAbbrechen={zurAuswahl}
        beschaeftigt={arbeitet}
        knoepfe={
          <FensterKnopf
            disabled={arbeitet}
            onClick={() =>
              tun(() => setzeStatus(id, STATUS.entwurf), {
                text: 'Freigabe zurückgenommen – Gäste können sich nicht mehr anmelden.',
                rueckgaengig: () => setzeStatus(id, STATUS.freigegeben),
              })
            }
          >
            {arbeitet ? 'Wird gespeichert …' : 'Freigabe zurücknehmen'}
          </FensterKnopf>
        }
      >
        <p className={f.hinweis}>
          Die Veranstaltung wird wieder zum Entwurf: Gäste sehen sie nicht mehr und können sich
          nicht mehr anmelden.{angemeldet}
        </p>
        <Fehler text={fehler} />
      </Sheet>
    );
  }

  if (ansicht === 'verschieben') {
    const zielName = ziele.find((t) => t.id === ziel)?.name ?? '';
    const moeglich = ziele.length > 0 && team;
    return (
      <Sheet
        title="In ein anderes Team"
        onClose={onClose}
        zurueck={zurAuswahl}
        onAbbrechen={zurAuswahl}
        beschaeftigt={arbeitet}
        knoepfe={
          moeglich ? (
            <FensterKnopf
              disabled={arbeitet}
              onClick={() =>
                tun(() => verschieben(id, team.id, ziel), {
                  text: `„${name}“ gehört jetzt zu „${zielName}“.`,
                  rueckgaengig: () => verschieben(id, ziel, team.id),
                })
              }
            >
              {arbeitet ? 'Wird verschoben …' : `Zu „${zielName}“ verschieben`}
            </FensterKnopf>
          ) : null
        }
      >
        {!moeglich ? (
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
          </>
        )}
      </Sheet>
    );
  }

  if (ansicht === 'archiv') {
    return (
      <Sheet
        title="Löschen?"
        onClose={onClose}
        zurueck={zurAuswahl}
        onAbbrechen={zurAuswahl}
        beschaeftigt={arbeitet}
        knoepfe={
          <FensterKnopf
            art="gefahr"
            disabled={arbeitet}
            onClick={() => {
              // „Rückgängig“ holt sie samt Abläufen zurück (`insArchiv`) – ChurchTools schaltet sie beim Archivieren ab.
              let a: Aenderung | null = null;
              void speichern(
                async () => {
                  a = await insArchiv(id, name, statusId);
                },
                () => a && onGeaendert(a, true),
              );
            }}
          >
            {arbeitet ? 'Wird archiviert …' : 'Ins Archiv verschieben'}
          </FensterKnopf>
        }
      >
        <p className={f.hinweis}>
          Die Veranstaltung kommt ins <b>Archiv</b>: Sie verschwindet aus der Übersicht, Gäste
          können sich nicht mehr anmelden.{angemeldet} Wiederherstellen kannst du sie jederzeit
          unter „Archiv“ auf der Startseite.
        </p>
        {archiv.art === 'ohneLoeschen' && (
          <p className={f.hinweis}>
            Ohne Löschdatum löscht ChurchTools die Anmeldungen <b>nicht von selbst</b> – im Archiv
            lassen sie sich endgültig löschen (das darf ein Admin).
          </p>
        )}
        <Fehler text={fehler} />
      </Sheet>
    );
  }

  return (
    <Sheet title="Veranstaltung verwalten" onClose={onClose} knoepfe={null}>
      <div className={f.optionen} style={{ marginBottom: 14 }}>
        <Aktion titel="Umbenennen" text={`Jetzt: „${name}“`} onClick={() => setAnsicht('name')} />
        {statusId === STATUS.freigegeben && (
          <Aktion
            titel="Freigabe zurücknehmen"
            text="Wieder Entwurf – Gäste können sich nicht mehr anmelden"
            onClick={() => setAnsicht('zurueck')}
          />
        )}
        <Aktion
          titel="In ein anderes Team"
          text={
            admin
              ? `Jetzt: ${team?.name ?? '–'}`
              : 'Nur Gruppen-Admins – ChurchTools erlaubt es sonst nicht.'
          }
          gesperrt={!admin}
          onClick={() => setAnsicht('verschieben')}
        />
        <Aktion
          titel="Löschen"
          text={
            archiv.art === 'gesperrt'
              ? archiv.faellig
                ? 'Geht, sobald ChurchTools die Anmeldungen gelöscht hat (in der Nacht)'
                : `Geht ab dem ${datumText(archiv.ab)} – dann sind die Anmeldungen gelöscht`
              : archiv.art === 'unbekannt'
                ? 'Das Löschdatum ließ sich nicht lesen – bitte die Seite neu laden'
                : 'Kommt ins Archiv und lässt sich dort wiederherstellen'
          }
          gesperrt={archiv.art === 'gesperrt' || archiv.art === 'unbekannt'}
          gefahr
          onClick={() => setAnsicht('archiv')}
        />
      </div>
      {archiv.art === 'gesperrt' && (
        <p className={f.hinweis}>
          Im Archiv löschte ChurchTools die Anmeldungen nicht mehr – darum erst nach dem Löschdatum.
          {statusId === STATUS.freigegeben &&
            ' Sollen sich keine weiteren anmelden: „Freigabe zurücknehmen“.'}
        </p>
      )}
    </Sheet>
  );
}

/** Eine Zeile im Fenster „Veranstaltung verwalten“ – eine Aktion, keine Wahl (siehe `.aktion`). */
function Aktion({
  titel,
  text,
  gesperrt = false,
  gefahr = false,
  onClick,
}: {
  titel: string;
  text: string;
  gesperrt?: boolean;
  gefahr?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={gefahr ? `${f.aktion} ${f.aktionGefahr}` : f.aktion}
      disabled={gesperrt}
      onClick={onClick}
    >
      <span>
        {titel}
        <small>{text}</small>
      </span>
      <Icon name="chev-right" size={18} />
    </button>
  );
}
