# CallSnap

Evolução do protótipo full-stack inspirado no tl;dv: agora o CallSnap ingere vídeos por link ou arquivo local, gera transcrição segmentada, cria resumos em múltiplos formatos/idiomas, divide o conteúdo em capítulos, libera busca contextual, exporta atas e mocka o envio para os participantes.

## Estrutura

```
CallSnap/
├─ server/   # API Express com rotas para ingestão de vídeo, transcrição segmentada, busca, capítulos, exportação e envio de atas
└─ client/   # Front-end React (Vite) com dashboard para busca textual, edição manual, capítulos, acessibilidade e exportações
```

## Pré-requisitos

- Node.js 18+ (testado com 20.x)
- npm 9+

## Como rodar

1. **Backend**
   ```bash
   cd server
   cp .env.example .env   # ajuste porta/origens se necessário
   npm install
   npm run dev
   ```
   A API sobe em `http://localhost:4000` com as rotas principais:
   - `GET /api/status`
   - `GET /api/meetings`
   - `POST /api/meetings` — recebe título, participantes, preferência de resumo, origem do vídeo (YouTube/Vimeo/upload/local) e flag de modo offline.
   - `POST /api/meetings/:id/transcribe` — gera transcrição segmentada, highlights, capítulos, análise de sentimento, legendas VTT e resumos multi-formato.
   - `GET /api/meetings/:id/search?q=` — busca palavra-chave dentro das falas e retorna trechos com timestamp.
   - `PATCH /api/meetings/:id/transcript` — salva edições manuais da transcrição.
   - `PATCH /api/meetings/:id/summary` — salva resumos customizados.
   - `POST /api/meetings/:id/resummarize` — alterna entre presets (`bullets`, `narrative`, `tldr`) e idiomas.
   - `POST /api/meetings/:id/export` — gera arquivo TXT/PDF/DOCX/MD com resumo, capítulos, ações e transcrição (retornado em base64 para download no front).
   - `POST /api/meetings/:id/minutes` — mock de disparo de ata para todos os participantes.

2. **Frontend**
   ```bash
   cd client
   cp .env.example .env   # opcional para apontar outra URL de API
   npm install
   npm run dev
   ```
   O Vite expõe o app em `http://localhost:5173`.

## Fluxo demo

1. Cadastre um vídeo/reunião informando participantes, link/caminho, formato de resumo e idioma.
2. Depois que a reunião aparecer no dashboard, clique em **Gerar pipeline completo** para simular ingestão, transcrição, capítulos, resumo inteligente, análise de sentimento e legendas.
3. Use **Busca dentro do vídeo** para localizar trechos por palavra-chave e salte entre capítulos.
4. Ajuste manualmente a transcrição ou o resumo pelas caixas de edição, troque o preset (TL;DR, tópicos ou narrativa) e veja o resultado em tempo real.
5. Exporte a ata nos formatos **TXT / PDF / DOCX** ou baixe apenas as legendas `.vtt`.
6. Clique em **Enviar ata** para visualizar o mock de e-mails enviados aos participantes.

## Próximos passos sugeridos

- Integrar provedores reais de ASR (Whisper/GCP/AWS) e LLMs para sumarização + análise de tópicos.
- Persistir dados em banco + storage de arquivos, controlar autenticação/OAuth e histórico por workspace.
- Adicionar player de vídeo com seek pelos capítulos/resultados de busca e sincronizar highlight em tempo real.
