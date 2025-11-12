# CallSnap

Protótipo full-stack inspirado no tl;dv: registra reuniões do Google Meet, simula geração de transcrições/resumos e envia atas mockadas para os participantes.

## Estrutura

```
CallSnap/
├─ server/   # API Express com rotas de reuniões, transcrição e envio de atas
└─ client/   # Front-end React (Vite) consumindo a API e exibindo dashboard
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
   A API sobe em `http://localhost:4000` com as rotas:
   - `GET /api/status`
   - `GET /api/meetings`
   - `POST /api/meetings`
   - `POST /api/meetings/:id/transcribe`
   - `POST /api/meetings/:id/minutes`

2. **Frontend**
   ```bash
   cd client
   cp .env.example .env   # opcional para apontar outra URL de API
   npm install
   npm run dev
   ```
   O Vite expõe o app em `http://localhost:5173`.

## Fluxo demo

1. Cadastre uma nova reunião informando participantes.
2. Clique em **Gerar transcrição & resumo** para simular o pipeline ASR + NLP.
3. Clique em **Enviar ata** para ver a prévia dos e-mails mockados.

## Próximos passos sugeridos

- Substituir mocks por serviços reais (captura de áudio, ASR e sumarização).
- Persistir dados em banco e autenticar usuários via OAuth Google.
- Criar extensão Chrome que aciona o backend automaticamente ao entrar no Meet.
