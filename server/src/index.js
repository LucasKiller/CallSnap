require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { v4: uuid } = require("uuid");

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsOptions = {};
if (allowedOrigins?.length) {
  corsOptions.origin = allowedOrigins;
}

app.use(cors(corsOptions));
app.use(express.json());

const meetings = new Map();

const buildMeeting = ({ title, scheduledAt, participants = [] }) => ({
  id: uuid(),
  title: title?.trim() || "Reunião sem título",
  scheduledAt: scheduledAt || new Date().toISOString(),
  participants,
  status: "scheduled",
  transcript: "",
  summary: "",
  highlights: [],
  actionItems: [],
  emailsSentAt: null,
});

const mockTranscriptChunks = [
  "Discussão sobre roadmap do produto e prioridades do trimestre.",
  "Alinhamento com time de vendas sobre feedback dos clientes enterprise.",
  "Definição de próximos passos e responsáveis por cada tarefa chave.",
  "Detalhes técnicos sobre a integração com Google Meet e compliance.",
];

const mockActions = [
  "Preparar protótipo da extensão Chrome até sexta-feira.",
  "Validar API de transcrição com amostra bilingue.",
  "Criar template de ata em Português e Inglês.",
  "Agendar testes com usuários beta na próxima semana.",
];

app.get("/api/status", (req, res) => {
  res.json({ service: "CallSnap API", status: "ok", meetings: meetings.size });
});

app.get("/api/meetings", (req, res) => {
  res.json({ meetings: Array.from(meetings.values()) });
});

app.post("/api/meetings", (req, res) => {
  const { title, scheduledAt, participants } = req.body || {};
  if (
    !participants ||
    !Array.isArray(participants) ||
    participants.length === 0
  ) {
    return res
      .status(400)
      .json({ message: "Informe ao menos um participante (nome + email)." });
  }

  const meeting = buildMeeting({ title, scheduledAt, participants });
  meetings.set(meeting.id, meeting);
  res.status(201).json({ meeting });
});

app.get("/api/meetings/:id", (req, res) => {
  const meeting = meetings.get(req.params.id);
  if (!meeting)
    return res.status(404).json({ message: "Reunião não encontrada." });
  res.json({ meeting });
});

app.post("/api/meetings/:id/transcribe", (req, res) => {
  const meeting = meetings.get(req.params.id);
  if (!meeting)
    return res.status(404).json({ message: "Reunião não encontrada." });

  const now = new Date();
  meeting.status = "processed";
  meeting.transcript = mockTranscriptChunks
    .map((chunk, index) => `Falante ${index + 1}: ${chunk}`)
    .join("\n");
  meeting.summary = `${meeting.title} — Foram discutidos roadmap, feedbacks de clientes e próximos passos. A CallSnap gerou uma ata automática.`;
  meeting.highlights = mockTranscriptChunks.slice(0, 3);
  meeting.actionItems = mockActions;
  meeting.processedAt = now.toISOString();

  meetings.set(meeting.id, meeting);
  res.json({ meeting });
});

app.post("/api/meetings/:id/minutes", (req, res) => {
  const meeting = meetings.get(req.params.id);
  if (!meeting)
    return res.status(404).json({ message: "Reunião não encontrada." });
  if (!meeting.summary)
    return res
      .status(400)
      .json({ message: "Transcrição/resumo ainda não gerados." });

  meeting.emailsSentAt = new Date().toISOString();
  const emailPreview = meeting.participants.map((p) => ({
    to: p.email,
    subject: `Ata: ${meeting.title}`,
    body: `Olá ${p.name},\nSegue a ata com os principais tópicos: ${
      meeting.summary
    }\nAções: ${meeting.actionItems.join(" | ")}`,
  }));

  res.json({ meeting, emailPreview });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error", err);
  res.status(500).json({ message: "Erro inesperado" });
});

app.listen(PORT, () => {
  console.log(`CallSnap API rodando na porta ${PORT}`);
});
