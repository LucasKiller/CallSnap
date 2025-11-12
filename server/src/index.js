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

const summaryPresets = {
  bullets: (title) =>
    `Resumo em tópicos de ${title}:\n- Decisões-chave alinhadas com roadmap.\n- Feedbacks de clientes enterprise priorizados.\n- Próximos passos com responsáveis definidos.`,
  narrative: (title) =>
    `${title}: a discussão percorreu o estado atual do produto, desafios da integração e compromissos assumidos para o próximo ciclo.`,
  tldr: (title) =>
    `TL;DR ${title}: alinhar roadmap, garantir qualidade da integração e reforçar experiência do cliente.`,
};

const mockTranscriptChunks = [
  "Discussão sobre roadmap do produto e prioridades do trimestre.",
  "Alinhamento com time de vendas sobre feedback dos clientes enterprise.",
  "Definição de próximos passos e responsáveis por cada tarefa chave.",
  "Detalhes técnicos sobre a integração com Google Meet e compliance.",
  "Sincronização sobre iniciativas de acessibilidade e legendas automáticas.",
];

const mockActions = [
  "Preparar protótipo da extensão Chrome até sexta-feira.",
  "Validar API de transcrição com amostra bilingue.",
  "Criar template de ata em Português e Inglês.",
  "Agendar testes com usuários beta na próxima semana.",
];

const keywordBank = [
  "roadmap",
  "clientes enterprise",
  "integração",
  "dados",
  "acessibilidade",
  "legendas",
  "exportação",
];

const defaultParticipants = (participants = []) =>
  participants.map((participant) => ({
    name: participant?.name?.trim() || "Participante",
    email: participant?.email?.trim() || "email@dominio.com",
  }));

const buildMeeting = ({
  title,
  scheduledAt,
  participants = [],
  videoSource = {},
  summaryStyle = "bullets",
  summaryLanguage = "pt-BR",
}) => ({
  id: uuid(),
  title: title?.trim() || "Reunião sem título",
  scheduledAt: scheduledAt || new Date().toISOString(),
  participants: defaultParticipants(participants),
  status: "scheduled",
  transcript: {
    segments: [],
    fullText: "",
    editableText: "",
    lastEditedAt: null,
    lastGeneratedAt: null,
  },
  summary: "",
  summaries: {
    default: "",
    styles: {},
    lastEditedAt: null,
    language: summaryLanguage,
  },
  highlights: [],
  actionItems: [],
  chapters: [],
  analysis: {
    sentiment: null,
    score: null,
    topics: [],
    keywords: [],
  },
  searchIndex: [],
  accessibility: {
    captionsVtt: "",
    readabilityScore: null,
  },
  exports: [],
  settings: {
    preferredSummaryStyle: summaryStyle,
    preferredLanguage: summaryLanguage,
  },
  videoSource: {
    type: videoSource?.type || "upload",
    value: videoSource?.value || "",
    offlineMode: Boolean(videoSource?.offlineMode),
    durationSeconds: videoSource?.durationSeconds || null,
    platform: videoSource?.platform || null,
  },
  emailsSentAt: null,
});

const buildSegments = () =>
  mockTranscriptChunks.map((text, index) => {
    const start = index * 95;
    const end = start + 80;
    const keywords = keywordBank.filter((keyword) =>
      text.toLowerCase().includes(keyword.split(" ")[0]),
    );
    return {
      id: uuid(),
      speaker: `Falante ${index + 1}`,
      start,
      end,
      duration: end - start,
      text,
      sentiment: index % 2 === 0 ? "positivo" : "neutro",
      keywords,
    };
  });

const buildChapters = (segments = []) =>
  segments.map((segment, index) => ({
    id: uuid(),
    title: `Capítulo ${index + 1}`,
    summary: segment.text,
    start: segment.start,
    end: segment.end,
  }));

const buildAnalysis = (segments = []) => {
  const joined = segments.map((segment) => segment.text).join(" ");
  return {
    sentiment: "positivo",
    score: 0.82,
    topics: ["roadmap", "feedbacks", "integração", "acessibilidade"],
    keywords: keywordBank.filter((keyword) => joined.toLowerCase().includes(keyword.split(" ")[0])),
  };
};

const secondsToTimestamp = (seconds) => {
  const date = new Date(seconds * 1000);
  return date.toISOString().substring(11, 23).replace(".", ",");
};

const buildVtt = (segments = []) =>
  ["WEBVTT", ""].concat(
    segments.map((segment, index) =>
      `${index + 1}\n${secondsToTimestamp(segment.start)} --> ${secondsToTimestamp(segment.end)}\n${segment.speaker}: ${segment.text}\n`,
    ),
  ).join("\n");

const buildSummaryStyles = (meeting, requestedStyle, language) => {
  const baseTitle = meeting.title;
  const styles = Object.entries(summaryPresets).reduce((acc, [key, fn]) => {
    acc[key] = fn(baseTitle);
    return acc;
  }, {});

  if (requestedStyle && !styles[requestedStyle]) {
    styles[requestedStyle] = `${requestedStyle} • ${baseTitle}`;
  }

  return {
    default: styles[requestedStyle] || styles[meeting.settings.preferredSummaryStyle] || styles.bullets,
    styles,
    language,
  };
};

const slugify = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "callsnap";

app.get("/api/status", (req, res) => {
  res.json({ service: "CallSnap API", status: "ok", meetings: meetings.size });
});

app.get("/api/meetings", (req, res) => {
  res.json({ meetings: Array.from(meetings.values()) });
});

app.post("/api/meetings", (req, res) => {
  const { title, scheduledAt, participants, videoSource, summaryStyle, summaryLanguage } = req.body || {};
  if (
    !participants ||
    !Array.isArray(participants) ||
    participants.length === 0
  ) {
    return res
      .status(400)
      .json({ message: "Informe ao menos um participante (nome + email)." });
  }

  const meeting = buildMeeting({
    title,
    scheduledAt,
    participants,
    videoSource,
    summaryStyle,
    summaryLanguage,
  });
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

  const { summaryStyle, summaryLanguage } = req.body || {};

  const now = new Date();
  meeting.status = "processed";
  const segments = buildSegments();
  meeting.transcript.segments = segments;
  meeting.transcript.fullText = segments
    .map((segment) => `${segment.speaker}: ${segment.text}`)
    .join("\n");
  meeting.transcript.editableText = meeting.transcript.editableText || meeting.transcript.fullText;
  meeting.transcript.lastGeneratedAt = now.toISOString();

  const summaries = buildSummaryStyles(
    meeting,
    summaryStyle || meeting.settings.preferredSummaryStyle,
    summaryLanguage || meeting.settings.preferredLanguage,
  );

  meeting.summaries = {
    ...meeting.summaries,
    default: summaries.default,
    language: summaries.language,
    styles: { ...meeting.summaries.styles, ...summaries.styles },
    lastEditedAt: meeting.summaries.lastEditedAt,
  };
  meeting.summary = summaries.default;
  meeting.settings.preferredSummaryStyle = summaryStyle || meeting.settings.preferredSummaryStyle;
  meeting.settings.preferredLanguage = summaryLanguage || meeting.settings.preferredLanguage;

  meeting.highlights = segments.slice(0, 3).map((segment) => segment.text);
  meeting.actionItems = mockActions;
  meeting.processedAt = now.toISOString();
  meeting.chapters = buildChapters(segments);
  meeting.analysis = buildAnalysis(segments);
  meeting.searchIndex = segments.map((segment) => ({
    segmentId: segment.id,
    text: segment.text.toLowerCase(),
    start: segment.start,
    end: segment.end,
  }));
  meeting.accessibility.captionsVtt = buildVtt(segments);
  meeting.accessibility.readabilityScore = 71;

  meetings.set(meeting.id, meeting);
  res.json({ meeting });
});

app.get("/api/meetings/:id/search", (req, res) => {
  const meeting = meetings.get(req.params.id);
  if (!meeting)
    return res.status(404).json({ message: "Reunião não encontrada." });

  const query = req.query.q?.toString().trim();
  if (!query) {
    return res.status(400).json({ message: "Informe uma palavra-chave para busca." });
  }

  const normalized = query.toLowerCase();
  const matches = meeting.transcript.segments
    .filter((segment) => segment.text.toLowerCase().includes(normalized))
    .map((segment) => ({
      segmentId: segment.id,
      speaker: segment.speaker,
      start: segment.start,
      end: segment.end,
      text: segment.text,
    }));

  res.json({ matches });
});

app.patch("/api/meetings/:id/transcript", (req, res) => {
  const meeting = meetings.get(req.params.id);
  if (!meeting)
    return res.status(404).json({ message: "Reunião não encontrada." });

  const { editableText } = req.body || {};
  if (!editableText?.trim()) {
    return res.status(400).json({ message: "Texto editado é obrigatório." });
  }

  meeting.transcript.editableText = editableText;
  meeting.transcript.lastEditedAt = new Date().toISOString();
  meetings.set(meeting.id, meeting);
  res.json({ meeting });
});

app.patch("/api/meetings/:id/summary", (req, res) => {
  const meeting = meetings.get(req.params.id);
  if (!meeting)
    return res.status(404).json({ message: "Reunião não encontrada." });

  const { style = "custom", text } = req.body || {};
  if (!text?.trim()) {
    return res.status(400).json({ message: "Texto do resumo é obrigatório." });
  }

  meeting.summaries.styles[style] = text;
  meeting.summaries.lastEditedAt = new Date().toISOString();
  meeting.summary = text;
  meetings.set(meeting.id, meeting);
  res.json({ meeting });
});

app.post("/api/meetings/:id/resummarize", (req, res) => {
  const meeting = meetings.get(req.params.id);
  if (!meeting)
    return res.status(404).json({ message: "Reunião não encontrada." });

  const { style = "bullets", language = "pt-BR" } = req.body || {};
  const summaries = buildSummaryStyles(meeting, style, language);

  meeting.summaries = {
    ...meeting.summaries,
    styles: { ...meeting.summaries.styles, ...summaries.styles },
    default: summaries.default,
    language,
  };
  meeting.summary = summaries.default;
  meeting.settings.preferredSummaryStyle = style;
  meeting.settings.preferredLanguage = language;
  meetings.set(meeting.id, meeting);

  res.json({ meeting });
});

app.post("/api/meetings/:id/export", (req, res) => {
  const meeting = meetings.get(req.params.id);
  if (!meeting)
    return res.status(404).json({ message: "Reunião não encontrada." });
  if (!meeting.summary)
    return res
      .status(400)
      .json({ message: "Transcrição/resumo ainda não gerados." });

  const { format = "txt", includeChapters = true, includeActionItems = true } = req.body || {};
  const now = new Date();
  const fileName = `${slugify(meeting.title)}.${format}`;
  const mimeMap = {
    txt: "text/plain",
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    md: "text/markdown",
  };
  const mimeType = mimeMap[format] || "text/plain";

  const exportLines = [
    `Ata de ${meeting.title}`,
    `Data: ${meeting.scheduledAt}`,
    "",
    "Resumo:",
    meeting.summary,
    "",
    "Participantes:",
    ...meeting.participants.map((p) => `- ${p.name} <${p.email}>`),
    "",
  ];

  if (includeChapters && meeting.chapters.length) {
    exportLines.push("Capítulos:");
    meeting.chapters.forEach((chapter) => {
      exportLines.push(`- [${secondsToTimestamp(chapter.start)}] ${chapter.title}: ${chapter.summary}`);
    });
    exportLines.push("");
  }

  if (includeActionItems && meeting.actionItems.length) {
    exportLines.push("Ações:");
    meeting.actionItems.forEach((action) => exportLines.push(`- ${action}`));
    exportLines.push("");
  }

  exportLines.push("Transcrição:");
  exportLines.push(meeting.transcript.editableText || meeting.transcript.fullText);

  const exportBuffer = Buffer.from(exportLines.join("\n"), "utf8");
  const exportEntry = {
    id: uuid(),
    createdAt: now.toISOString(),
    format,
    fileName,
    mimeType,
    size: exportBuffer.byteLength,
  };
  meeting.exports.push(exportEntry);
  meetings.set(meeting.id, meeting);

  res.json({
    export: {
      ...exportEntry,
      base64: exportBuffer.toString("base64"),
    },
  });
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
    }\nCapítulos: ${meeting.chapters.map((chapter) => chapter.title).join(", ")}\nAções: ${meeting.actionItems.join(
      " | ",
    )}`,
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
