# Nel mondo: come aggiungere un testo

Questa cartella è tua. Ogni testo della sezione **Nel mondo** è un file qui dentro, scritto da te. Il sito non aggiunge niente di suo: né titoli, né frasi, né fatti. Mostra solo quello che scrivi tu, la data, il luogo e, se le metti, una foto e le fonti.

Finché qui non c'è nessun testo, la pagina dice soltanto «Presto, con le parole di Imad.».

## Il modo più semplice: mandalo in chat

Scrivi il testo dove ti viene comodo e mandamelo in chat, con il titolo, la data e, se vuoi, il luogo, la foto e i link alle fonti. Lo metto io in un file come quello qui sotto, senza cambiare una parola, e lo pubblico.

## Dal telefono, su GitHub

1. Apri `github.com/imadchatraoui/imad.chat` nel browser del telefono (o nell'app GitHub) ed entra nella cartella `content/mondo`.
2. Tocca **Add file** → **Create new file**.
3. Come nome scrivi il luogo o l'argomento, tutto minuscolo, con i trattini al posto degli spazi, e alla fine `.md`. Per esempio `sudan.md` oppure `bosnia-erzegovina.md`. Il nome diventa l'ultima parte dell'indirizzo della pagina (per esempio `.../mondo/sudan`).
4. Copia il modello qui sotto, incollalo e cambia quello che c'è dopo i due punti. Poi scrivi il testo sotto la seconda riga `---`.
5. Tocca **Commit changes** e conferma.
6. Scrivimi in chat «ho aggiunto un testo»: per ora il sito non si aggiorna da solo, lo pubblico io.

Per correggere un testo: apri il file, tocca la matita, cambia e fai di nuovo **Commit changes**. Per toglierlo: apri il file, menu `...`, **Delete file**.

## Il modello da copiare

Il più corto possibile:

```
---
titolo: Il titolo del testo
data: 2026-11-20
---
Qui scrivi il testo.

Lascia una riga vuota tra un paragrafo e l'altro.
```

Con tutte le righe facoltative (togli quelle che non ti servono):

```
---
titolo: Il titolo del testo
data: 2026-11-20
luogo: Il luogo
immagine: foto.jpg
didascalia: Cosa si vede nella foto e di chi è
fonti:
  - https://indirizzo-di-una-fonte.org/articolo
  - [Il nome di una fonte](https://indirizzo.org)
---
Qui scrivi il testo.
```

Cosa vuol dire ogni riga:

- **titolo**: obbligatorio. È il titolo grande della pagina e la voce nell'elenco.
- **data**: obbligatoria, sempre così: anno-mese-giorno, per esempio `2026-11-20`. L'elenco mette in cima il testo con la data più recente, e la casa mostra la data dell'ultimo.
- **luogo**: facoltativo. Compare piccolo sopra il titolo, accanto alla data.
- **immagine**: facoltativa. Il nome di una foto che carichi nella cartella `content/mondo/media` (Add file → Upload files), oppure un indirizzo che comincia con `https://`. Usa solo foto che puoi usare: tue, o con una licenza che lo permette.
- **didascalia**: facoltativa. Va sotto la foto; serve anche a chi non vede la foto.
- **fonti**: facoltative. Una riga per fonte, che comincia con due spazi, un trattino e uno spazio. Vanno in fondo alla pagina, numerate.
- **bozza: sì**: se aggiungi questa riga il testo resta fuori dal sito finché non la togli.

## Come si scrive il testo

- **Paragrafi**: una riga vuota tra l'uno e l'altro. Se vai a capo senza riga vuota, sul sito resta un a capo.
- **Titoletti**: una riga che comincia con `## ` (per uno più piccolo `### `).
- **Elenchi**: righe che cominciano con `- ` oppure con `1. `, `2. `...
- **Citazioni**: righe che cominciano con `> `.
- **Parole in evidenza**: `**così**` diventa più marcato. Anche `*così*` diventa solo un po' più marcato: sul sito non c'è il corsivo.
- **Link**: `[le parole da toccare](https://indirizzo.org)`, oppure l'indirizzo così com'è.
- Una riga con soltanto `---` traccia una linea sottile.

Il codice HTML non passa: se ne scrivi, si vede come testo normale. I link funzionano solo se cominciano con `http://` o `https://`.

## Se qualcosa non va

Se manca il titolo, se la data non è scritta come `2026-11-20` o se la foto indicata non c'è, il sito non si pubblica e il messaggio dice il nome del file e cosa correggere. Te lo dico io e lo sistemiamo insieme.
