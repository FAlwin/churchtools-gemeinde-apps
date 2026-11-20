import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Segment } from '@ui/bedienung/Segment';
import { LeisesPlus } from '@ui/bedienung/LeisesPlus';
import { ZeilenKnopf } from '@ui/bedienung/ZeilenKnopf';
import {
  TAG_KUERZEL_MAX,
  TAG_NAME_MAX,
  type PersonenTag,
  type TagEingabe,
} from '@shared/dienstplan/personenliste';
import werKann from './WerKann.module.scss';
import styles from './PersonFenster.module.scss';

/** Eine Dienstgruppe, deren Tags man hier ändern darf, mit ihrer jetzigen Tag-Liste. */
export interface TagsGruppe {
  id: number;
  name: string;
  tags: PersonenTag[];
}

/** Eine Zeile im Fenster: ein vorhandener Tag (mit ID) oder ein neuer (ohne). */
type Zeile = TagEingabe & { schluessel: number };

const gleich = (a: readonly Zeile[], tags: readonly PersonenTag[]): boolean =>
  a.length === tags.length &&
  a.every(
    (z, i) => z.id === tags[i].id && z.name === tags[i].name && z.kuerzel === tags[i].kuerzel,
  );

/**
 * **„Tags verwalten“** (PL-2, Entwurf `personenliste.html`): die feste Tag-Liste **einer Dienstgruppe** – Name und Kürzel
 * (1–2 Zeichen, das Kürzel steht am Personenbild, der Name in der Legende). Oben wählt man die Dienstgruppe (nur die, die man
 * ändern darf). Jede Gruppe hat ihre eigene Arbeitskopie; „Speichern“ speichert alle geänderten, eine nach der anderen – beim
 * ersten Fehler bleibt das Fenster mit allem, was noch fehlt, offen. Ein gelöschter Tag verschwindet bei allen Personen.
 */
export function TagsVerwaltenFenster({
  gruppen,
  start,
  speichern,
  onClose,
}: {
  gruppen: TagsGruppe[];
  /** Die Dienstgruppe, mit der das Fenster aufgeht. */
  start: number;
  /** Speichert die Tag-Liste einer Gruppe; `null` = geklappt, sonst der Text für den Planer. */
  speichern: (gruppeId: number, tags: TagEingabe[]) => Promise<string | null>;
  onClose: () => void;
}) {
  const [gruppeId, setGruppeId] = useState(
    gruppen.some((g) => g.id === start) ? start : gruppen[0]?.id,
  );
  // Die Arbeitskopien: nur Gruppen, an denen etwas angefasst wurde, stehen hier.
  const [kopien, setKopien] = useState<Map<number, Zeile[]>>(new Map());
  const [naechste, setNaechste] = useState(1);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const gruppe = gruppen.find((g) => g.id === gruppeId) ?? gruppen[0];
  const vonGruppe = (g: TagsGruppe): Zeile[] =>
    kopien.get(g.id) ?? g.tags.map((t, i) => ({ ...t, schluessel: -(i + 1) }));
  const zeilen = gruppe ? vonGruppe(gruppe) : [];
  const setZeilen = (neu: Zeile[]) => {
    if (gruppe) setKopien(new Map(kopien).set(gruppe.id, neu));
  };
  const geaendert = gruppen.filter((g) => kopien.has(g.id) && !gleich(vonGruppe(g), g.tags));

  const los = async () => {
    if (laeuft || geaendert.length === 0) return onClose();
    setLaeuft(true);
    setFehler(null);
    for (const g of geaendert) {
      const text = await speichern(
        g.id,
        vonGruppe(g).map(({ id, name, kuerzel }) => ({ id, name, kuerzel })),
      );
      if (text !== null) {
        setLaeuft(false);
        setFehler(gruppen.length > 1 ? `${g.name}: ${text}` : text);
        return;
      }
      // Gespeichert: diese Gruppe zeigt wieder, was in ChurchTools steht.
      setKopien((alt) => {
        const neu = new Map(alt);
        neu.delete(g.id);
        return neu;
      });
    }
    setLaeuft(false);
    onClose();
  };

  if (!gruppe) return null;
  return (
    <Sheet
      title="Tags verwalten"
      onClose={onClose}
      onHintergrund={geaendert.length > 0 ? () => {} : onClose}
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf disabled={laeuft} onClick={() => void los()}>
          Speichern
        </FensterKnopf>
      }
    >
      {gruppen.length > 1 ? (
        <div className={styles.gruppenWahl}>
          <Segment<string>
            value={String(gruppe.id)}
            options={gruppen.map((g) => ({ value: String(g.id), label: g.name }))}
            onChange={(v) => setGruppeId(Number(v))}
            ariaLabel="Dienstgruppe"
            verbunden
          />
        </div>
      ) : (
        <p className={werKann.unter}>{gruppe.name}</p>
      )}
      <p className={werKann.hinweis}>
        Name und Kürzel (1–2 Zeichen). Das Kürzel steht in der Liste am Bild der Person, der Name in
        der Legende. Die Tags gelten für die ganze Dienstgruppe {gruppe.name}.
      </p>
      <ul className={styles.liste} aria-label={`Tags der Dienstgruppe ${gruppe.name}`}>
        {zeilen.map((z, i) => (
          <li key={z.schluessel} className={styles.tag}>
            <input
              className={styles.name}
              value={z.name}
              maxLength={TAG_NAME_MAX}
              aria-label="Name"
              autoFocus={z.schluessel > 0 && z.schluessel === naechste - 1}
              onChange={(e) =>
                setZeilen(zeilen.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
              }
            />
            <input
              className={styles.kuerzelFeld}
              value={z.kuerzel}
              maxLength={TAG_KUERZEL_MAX}
              aria-label="Kürzel"
              onChange={(e) =>
                setZeilen(
                  zeilen.map((x, j) =>
                    j === i
                      ? {
                          ...x,
                          kuerzel: [...e.target.value.toLocaleUpperCase('de')]
                            .slice(0, TAG_KUERZEL_MAX)
                            .join(''),
                        }
                      : x,
                  ),
                )
              }
            />
            <ZeilenKnopf
              label={`Tag ${z.name || 'ohne Namen'} löschen`}
              title="Löschen – nimmt ihn allen Personen weg"
              onClick={() => setZeilen(zeilen.filter((_, j) => j !== i))}
            >
              <Icon name="x" size={16} />
            </ZeilenKnopf>
          </li>
        ))}
      </ul>
      <div className={styles.neu}>
        <LeisesPlus
          label="Tag"
          title="Neuen Tag anlegen"
          onClick={() => {
            setZeilen([...zeilen, { name: '', kuerzel: '', schluessel: naechste }]);
            setNaechste(naechste + 1);
          }}
        />
      </div>
      {zeilen.length > 0 && (
        <p className={werKann.hinweis}>
          Ein gelöschter Tag verschwindet bei allen Personen. Zeilen ohne Namen werden nicht
          gespeichert.
        </p>
      )}
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}
