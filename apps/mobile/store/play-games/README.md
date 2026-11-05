# Play Games: achievements and leaderboards

Icons are 512×512 PNG (SVG sources alongside). Each `ids.ts` key is where the ID from Play Console goes
(`src/games/ids.ts`). Points total 400 of the 1,000 allowed.

## Achievements

| Order | `ids.ts` key | Name | Description | Type | Points | Icon |
|---|---|---|---|---|---|---|
| 1 | `firstSentence` | Primeiras palavras | Ouça sua primeira frase. | Standard | 5 | 01-primeira-frase.png |
| 2 | `firstSave` | Guardei essa | Salve uma frase nos favoritos. | Standard | 5 | 09-primeira-frase-salva.png |
| 3 | `sentences100` | Ouvido atento | Ouça 100 frases. | Incremental, 100 steps | 20 | 02-100-frases.png |
| 4 | `bothLanguages` | Bilíngue | Ouça frases em francês e em espanhol. | Standard | 20 | 06-dois-idiomas.png |
| 5 | `streak7` | Uma semana inteira | Pratique 7 dias seguidos. | Incremental, 7 steps | 30 | 04-sequencia-7.png |
| 6 | `levelC1` | No topo | Ouça uma frase de nível C1. | Standard | 30 | 07-nivel-c1.png |
| 7 | `allTopics` | Assunto não falta | Ouça frases dos 12 temas em um mesmo idioma. | Standard | 40 | 08-todos-os-temas.png |
| 8 | `sentences1000` | Mil vozes | Ouça 1.000 frases. | Incremental, 1000 steps | 100 | 03-1000-frases.png |
| 9 | `streak30` | Hábito de verdade | Pratique 30 dias seguidos. | Incremental, 30 steps | 150 | 05-sequencia-30.png |

All revealed (not hidden).

## Leaderboards

| `ids.ts` key | Name | Icon | Format | Order | Limits |
|---|---|---|---|---|---|
| `sentences` | Frases ouvidas | ranking-frases-ouvidas.png | Numeric, 0 decimals | Larger is better | 1 – 1,000,000 |
| `bestStreak` | Maior sequência de dias | ranking-maior-sequencia.png | Numeric, 0 decimals | Larger is better | 1 – 3,650 |
