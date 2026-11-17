import { useEffect, useMemo, useRef } from 'react';
import { Icon } from '@ui/icons/icons';
import { pfadVon } from '@shared/organigramm/ansichten';
import type { Knoten, OrgGruppe } from '@shared/organigramm/gruppen';
import type { FehlerFeld } from '@shared/organigramm/gruppenwechsel';
import type { Formular } from '@shared/organigramm/einrichtungFormular';
import { SpitzenAuswahl } from './SpitzenAuswahl';
import styles from './Einrichten.module.scss';

type Fehler = { feld: FehlerFeld | 'bereich'; text: string }[];

/** Die Gruppe am Ende eines Pfads („10/7/12“ → 12). */
const idAmPfad = (pfad: string): number => Number(pfad.split('/').pop());

/**
 * **Schritt „Stufen“** im Fenster „Gruppenwechsel einrichten / Stufen ändern“ (Entwurf `o9-5-einrichten-v1`): die
 * Bereichsgruppe, die Stufen (jüngste zuerst) und – zugeklappt – die weiteren Einstellungen. Die Gruppen werden mit der
 * vorhandenen Auswahl „Gruppe suchen“ gewählt (`SpitzenAuswahl`). Hier steht nur die Eingabe; was nicht stimmt, sagt
 * `einrichtungAusFormular` – die Fehler stehen am Feld bzw. über der Liste, sobald jemand weiter wollte.
 */
export function EinrichtenStufen({
  form,
  onForm,
  baum,
  gruppen,
  fehler,
  zeigeFehler,
  kalender,
  ferienBis,
  bereichGesperrt = false,
}: {
  form: Formular;
  onForm: (f: Formular) => void;
  baum: readonly Knoten[];
  gruppen: readonly OrgGruppe[];
  fehler: Fehler;
  /** Erst nach „Weiter“ – frisch geöffnet soll das Fenster nicht gleich schimpfen. */
  zeigeFehler: boolean;
  /** Die Kalender, die man sieht; `null`: ließen sich nicht lesen. */
  kalender: string[] | null;
  /** „Sommerferien gefunden bis 2029.“ – oder was stattdessen zu sagen ist. */
  ferienBis: string;
  /**
   * Beim Ändern (O9-F11, Alwin 17.11.2026): Die Bereichsgruppe lässt sich hier nicht wechseln – die Wechsel-Gruppen hängen
   * schon darunter, und „Einrichten“ hängt nichts um. Nur Anzeige; wechseln geht von Hand in ChurchTools.
   */
  bereichGesperrt?: boolean;
}) {
  const pfad = (id: number | null) => (id === null ? null : pfadVon(baum, id));
  const name = (id: number) => gruppen.find((g) => g.id === id)?.name ?? `Gruppe ${id}`;
  const je = (feld: Fehler[number]['feld']) =>
    zeigeFehler ? fehler.filter((f) => f.feld === feld) : [];

  const setStufe = (i: number, teil: Partial<Formular['stufen'][number]>) =>
    onForm({ ...form, stufen: form.stufen.map((s, j) => (j === i ? { ...s, ...teil } : s)) });
  const verschiebe = (i: number, richtung: -1 | 1) => {
    const stufen = [...form.stufen];
    [stufen[i], stufen[i + richtung]] = [stufen[i + richtung], stufen[i]];
    onForm({ ...form, stufen });
  };
  const hinzu = () => {
    const letzte = form.stufen[form.stufen.length - 1];
    const alter = Number(letzte?.abAlter);
    onForm({
      ...form,
      stufen: [
        ...form.stufen,
        {
          gruppeId: null,
          name: '',
          abAlter:
            letzte && letzte.abAlter.trim() !== '' && Number.isInteger(alter)
              ? String(alter + 3)
              : '',
        },
      ],
    });
  };

  // Der gespeicherte Kalender bleibt in der Liste, auch wenn er gerade nicht (mehr) zu sehen ist – sonst würde er
  // stillschweigend durch einen anderen ersetzt.
  const kalenderListe = useMemo(
    () =>
      kalender === null || kalender.includes(form.ferienkalender)
        ? (kalender ?? [form.ferienkalender])
        : [form.ferienkalender, ...kalender],
    [kalender, form.ferienkalender],
  );

  // Ein Fehler in den weiteren Einstellungen darf nicht hinter zugeklapptem Text stehen.
  const mehr = useRef<HTMLDetailsElement>(null);
  const mehrFehler = [
    'stichtag',
    'ankuendigung',
    'aufnahme',
    'aufraeumen',
    'ferienkalender',
    'ferienStichwort',
  ].some((f) => je(f as Fehler[number]['feld']).length > 0);
  useEffect(() => {
    if (mehrFehler && mehr.current) mehr.current.open = true;
  }, [mehrFehler]);

  const fehlerText = (id: string, feld: Fehler[number]['feld']) =>
    je(feld).map((f) => (
      <span key={f.text} id={id} className={styles.fehlerText}>
        {f.text}
      </span>
    ));

  return (
    <>
      <div className={styles.feld}>
        <span className={styles.label}>
          {bereichGesperrt ? 'Wechsel-Gruppen hängen unter' : 'Wechsel-Gruppen anlegen unter'}
        </span>
        {bereichGesperrt ? (
          <>
            <span className={styles.gesperrt}>
              <Icon name="lock" size={14} />
              {form.bereichGruppeId === null ? '–' : name(form.bereichGruppeId)}
            </span>
            <span className={styles.klein}>
              Lässt sich hier nicht ändern. Zum Wechseln in ChurchTools die Wechsel-Gruppen unter
              die neue Gruppe hängen. Wer diese Gruppe leitet, sieht alle Wechsel-Gruppen
              (Bereichsleitung).
            </span>
          </>
        ) : (
          <>
            <SpitzenAuswahl
              label="Wechsel-Gruppen anlegen unter"
              baum={baum}
              wert={pfad(form.bereichGruppeId)}
              onWahl={(p) => onForm({ ...form, bereichGruppeId: p === null ? null : idAmPfad(p) })}
              feldKlasse={styles.auswahl}
              leerName="Gruppe wählen …"
            />
            {fehlerText('fehler-bereich', 'bereich')}
            <span className={styles.klein}>
              Wer diese Gruppe leitet, sieht später alle Wechsel-Gruppen (Bereichsleitung).
            </span>
          </>
        )}
      </div>

      <div className={styles.feld}>
        <span className={styles.label} id="stufen-label">
          Stufen, jüngste zuerst
        </span>
        {fehlerText('fehler-stufen', 'stufen')}
        <ul className={styles.stufen} aria-labelledby="stufen-label">
          {form.stufen.map((s, i) => (
            <li key={i}>
              <span className={styles.nr} aria-hidden="true">
                {i + 1}
              </span>
              <SpitzenAuswahl
                label={`Gruppe der Stufe ${i + 1}`}
                baum={baum}
                wert={pfad(s.gruppeId)}
                onWahl={(p) => {
                  const id = p === null ? null : idAmPfad(p);
                  // Der Name der Stufe ist der der Gruppe – außer, die Gruppe bleibt (dann gilt der gespeicherte).
                  if (id !== s.gruppeId)
                    setStufe(i, { gruppeId: id, name: id === null ? '' : name(id) });
                }}
                feldKlasse={styles.auswahl}
                leerName="Gruppe wählen …"
              />
              <span className={styles.alter}>
                ab
                <input
                  className={styles.zahl}
                  type="number"
                  min={0}
                  max={25}
                  value={s.abAlter}
                  aria-label={`ab Alter, Stufe ${i + 1}`}
                  onChange={(e) => setStufe(i, { abAlter: e.target.value })}
                />
                Jahren
              </span>
              <span className={styles.knoepfe}>
                <button
                  type="button"
                  className={styles.ik}
                  aria-label={`Stufe ${i + 1} nach oben`}
                  disabled={i === 0}
                  onClick={() => verschiebe(i, -1)}
                >
                  <Icon name="chev-up" size={16} />
                </button>
                <button
                  type="button"
                  className={styles.ik}
                  aria-label={`Stufe ${i + 1} nach unten`}
                  disabled={i === form.stufen.length - 1}
                  onClick={() => verschiebe(i, 1)}
                >
                  <Icon name="chev-down" size={16} />
                </button>
                <button
                  type="button"
                  className={styles.ik}
                  aria-label={`Stufe ${i + 1} entfernen`}
                  disabled={form.stufen.length <= 2}
                  onClick={() => onForm({ ...form, stufen: form.stufen.filter((_, j) => j !== i) })}
                >
                  <Icon name="trash" size={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>
        <div>
          <button type="button" className={styles.neuKnopf} onClick={hinzu}>
            <Icon name="plus" size={14} /> Stufe hinzufügen
          </button>
        </div>
        <span className={styles.klein}>
          Ein Kind wechselt in die nächste Stufe, wenn es am Stichtag deren Alter erreicht hat.
        </span>
      </div>

      <details className={styles.mehr} ref={mehr}>
        <summary>Weitere Einstellungen</summary>
        <div className={styles.gitter}>
          <div className={styles.feld}>
            <label className={styles.label} htmlFor="e-stichtag">
              Stichtag fürs Alter
            </label>
            <input
              id="e-stichtag"
              className={styles.text}
              value={form.stichtag}
              placeholder="30.09."
              aria-invalid={je('stichtag').length > 0 || undefined}
              onChange={(e) => onForm({ ...form, stichtag: e.target.value })}
            />
            {fehlerText('fehler-stichtag', 'stichtag')}
          </div>
          <div className={styles.feld}>
            <label className={styles.label} htmlFor="e-ankuendigung">
              Ankündigung
            </label>
            <span className={styles.einheit}>
              <input
                id="e-ankuendigung"
                className={styles.zahl}
                type="number"
                min={1}
                value={form.ankuendigungWochen}
                aria-invalid={je('ankuendigung').length > 0 || undefined}
                onChange={(e) => onForm({ ...form, ankuendigungWochen: e.target.value })}
              />
              <span>Wochen vor dem Wechseltag</span>
            </span>
            {fehlerText('fehler-ankuendigung', 'ankuendigung')}
          </div>
          <div className={styles.feld}>
            <label className={styles.label} htmlFor="e-aufnahme">
              Neue Gruppe nimmt auf
            </label>
            <span className={styles.einheit}>
              <input
                id="e-aufnahme"
                className={styles.zahl}
                type="number"
                min={1}
                value={form.aufnahmeTage}
                aria-invalid={je('aufnahme').length > 0 || undefined}
                onChange={(e) => onForm({ ...form, aufnahmeTage: e.target.value })}
              />
              <span>Tage ab Wechseltag</span>
            </span>
            {fehlerText('fehler-aufnahme', 'aufnahme')}
          </div>
          <div className={styles.feld}>
            <label className={styles.label} htmlFor="e-aufraeumen">
              Wechsel-Gruppe räumt auf
            </label>
            <span className={styles.einheit}>
              <input
                id="e-aufraeumen"
                className={styles.zahl}
                type="number"
                min={1}
                value={form.aufraeumenTage}
                aria-invalid={je('aufraeumen').length > 0 || undefined}
                onChange={(e) => onForm({ ...form, aufraeumenTage: e.target.value })}
              />
              <span>Tage nach dem Wechsel</span>
            </span>
            {fehlerText('fehler-aufraeumen', 'aufraeumen')}
          </div>
          <div className={styles.feld}>
            <label className={styles.label} htmlFor="e-kalender">
              Ferien aus dem Kalender
            </label>
            <select
              id="e-kalender"
              className={styles.text}
              value={form.ferienkalender}
              onChange={(e) => onForm({ ...form, ferienkalender: e.target.value })}
            >
              {kalenderListe.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            {fehlerText('fehler-kalender', 'ferienkalender')}
            {fehlerText('fehler-stichwort', 'ferienStichwort')}
            <span className={styles.klein}>{ferienBis}</span>
          </div>
        </div>
      </details>
    </>
  );
}
