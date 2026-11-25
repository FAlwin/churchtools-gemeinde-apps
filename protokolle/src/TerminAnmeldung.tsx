import { useMemo } from 'react';
import type { Eintrag } from '@shared/protokolle/termine';
import { einzeltermine } from '@shared/protokolle/terminReihe';
import {
  anmeldungErklaerung,
  anmeldungSchalterText,
  anmeldungTermine,
  anmeldungVorgabe,
  tageOptionen,
  vorschauText,
  type Anmeldung,
  type Gruppe,
  type Gruppentyp,
} from '@shared/protokolle/terminAnmeldung';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import type { Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { TerminSchalter } from './TerminSchalter';
import formular from './TerminFormular.module.scss';
import styles from './TerminAnmeldung.module.scss';

interface Props {
  e: Eintrag;
  onAendern: (neu: Eintrag) => void;
  /** Die Gruppentypen, in denen man Gruppen anlegen darf (mit Namen aus ChurchTools). */
  typen: readonly Gruppentyp[];
  typenLaedt: boolean;
  typenFehler: Fehlermeldung | null;
  onTypenNeu: () => void;
  /** Die Gruppen des gewählten Typs – die Auswahl „Gruppe als Kopiervorlage“. */
  gruppen: readonly Gruppe[];
  gruppenLaedt: boolean;
  gruppenFehler: Fehlermeldung | null;
  onGruppenNeu: () => void;
  /** Heute im Kalender der Gemeinde (`JJJJ-MM-TT`) – die Grenze der Vorschau. */
  heute: string;
  deaktiviert: boolean;
}

const tageText = (n: number) => (n === 1 ? '1 Tag' : `${n} Tage`);

/**
 * **Der Reiter „Anmeldung“ des ChurchTools-Dialogs „Termin erstellen“** (W15-5): der Schalter „Gruppen für Anmeldung
 * erstellen“ (aus = Vorgabe), darunter – wenn er an ist – **Gruppentyp**, **Tage im Voraus**, **Gruppe als Kopiervorlage**
 * (nur Gruppen des gewählten Typs – ein Typwechsel leert sie), **Tage nach dem Termin bis zum Beenden** und die Vorschau
 * der Gruppen, die ChurchTools beim Speichern **sofort** anlegt. Die Regeln (Vorgaben, Vorschau, Texte) stehen in
 * `@shared/protokolle/terminAnmeldung`; die Warnung „legt sofort N Gruppen an“ steht im Fuß des Fensters.
 */
export function TerminAnmeldung(p: Props) {
  const { e } = p;
  const a = e.anmeldung;
  const zahl = useMemo(() => einzeltermine(e).tage.length, [e]);
  const vorschau = useMemo(() => anmeldungTermine(e, a, p.heute), [e, a, p.heute]);
  const aus = p.deaktiviert;

  const aendern = (neu: Anmeldung) => p.onAendern({ ...e, anmeldung: neu });

  return (
    <div className={styles.anmeldung}>
      <TerminSchalter
        an={a !== null}
        onAn={(an) => p.onAendern({ ...e, anmeldung: an ? anmeldungVorgabe(p.typen) : null })}
        // Ohne wählbaren Gruppentyp gäbe es nichts zu speichern – und solange sie laden, wüsste die Vorgabe den Typ nicht.
        disabled={aus || p.typenLaedt || !p.typen.length}
      >
        {anmeldungSchalterText(zahl)}
      </TerminSchalter>
      <p className={styles.leise}>{anmeldungErklaerung(zahl)}</p>
      {p.typenLaedt && <p className={styles.leise}>Gruppentypen werden geladen …</p>}
      {p.typenFehler && (
        <p className={styles.leise} role="alert">
          {p.typenFehler.text} <TextKnopf onClick={p.onTypenNeu}>Noch einmal versuchen</TextKnopf>
        </p>
      )}
      {a && (
        <>
          <label className={styles.frage}>
            <span>Gruppentyp</span>
            <select
              className={formular.eingabe}
              value={a.typ ?? ''}
              disabled={aus}
              // Die Kopiervorlage gehört zu EINEM Typ: ein Wechsel leert sie.
              onChange={(ev) => aendern({ ...a, typ: Number(ev.target.value), vorlage: null })}
            >
              {a.typ !== null && !p.typen.some((t) => t.id === a.typ) && (
                <option value={a.typ}>{`Gruppentyp ${a.typ}`}</option>
              )}
              {p.typen.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.frage}>
            <span>
              Wie viele Tage im Voraus sollen Gruppen automatisch erstellt und aktiviert werden?
            </span>
            <select
              className={formular.eingabe}
              value={a.tage}
              disabled={aus}
              onChange={(ev) => aendern({ ...a, tage: Number(ev.target.value) })}
            >
              {tageOptionen(a.tage).map((n) => (
                <option key={n} value={n}>
                  {tageText(n)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.frage}>
            <span>Gruppe als Kopiervorlage</span>
            <select
              className={formular.eingabe}
              value={a.vorlage ?? ''}
              disabled={aus || p.gruppenLaedt}
              onChange={(ev) =>
                aendern({ ...a, vorlage: ev.target.value === '' ? null : Number(ev.target.value) })
              }
            >
              <option value="">{p.gruppenLaedt ? 'wird geladen …' : ''}</option>
              {a.vorlage !== null && !p.gruppen.some((g) => g.id === a.vorlage) && (
                <option value={a.vorlage}>{`Gruppe ${a.vorlage}`}</option>
              )}
              {p.gruppen.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          {p.gruppenFehler && (
            <p className={styles.leise} role="alert">
              {p.gruppenFehler.text}{' '}
              <TextKnopf onClick={p.onGruppenNeu}>Noch einmal versuchen</TextKnopf>
            </p>
          )}
          <p className={styles.leise}>
            Ohne Auswahl einer Kopiervorlage wird eine neue Gruppe erstellt und verknüpft. Sie ist
            standardmäßig unveröffentlicht und Gruppenmitgliedschafts-Anfragen sind deaktiviert. Die
            Einstellungen dazu kannst du in der neuen Gruppe unter Einstellungen &gt; Anmeldung zur
            Gruppe vornehmen.
          </p>
          <label className={styles.frage}>
            <span>Wie viele Tage nach dem Termin sollen Gruppen beendet werden?</span>
            <select
              className={formular.eingabe}
              value={a.beenden ?? ''}
              disabled={aus}
              onChange={(ev) =>
                aendern({ ...a, beenden: ev.target.value === '' ? null : Number(ev.target.value) })
              }
            >
              <option value="" />
              {tageOptionen(a.beenden).map((n) => (
                <option key={n} value={n}>
                  {tageText(n)}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.vorschau} role="status">
            {vorschau.length ? (
              <>
                <p>Folgende Gruppen werden direkt erstellt und mit dem Kalender verknüpft:</p>
                <ul>
                  {vorschau.map((t) => (
                    <li key={t.tag}>{vorschauText(t)}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Mit der aktuellen Konfiguration werden keine Gruppen erstellt.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
