import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const buildParticipant = () => ({ name: '', email: '' })
const buildForm = () => ({
  title: '',
  scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
  participants: [buildParticipant()],
  videoSource: { type: 'youtube', value: '', offlineMode: false },
  summaryStyle: 'bullets',
  summaryLanguage: 'pt-BR',
})

const videoOptions = [
  { value: 'youtube', label: 'YouTube / live' },
  { value: 'vimeo', label: 'Vimeo / player embed' },
  { value: 'upload', label: 'Upload manual / API' },
  { value: 'local', label: 'Arquivo local (offline)' },
]

const summaryOptions = [
  { value: 'bullets', label: 'Tópicos' },
  { value: 'narrative', label: 'Narrativa' },
  { value: 'tldr', label: 'TL;DR' },
]

const languageOptions = [
  { value: 'pt-BR', label: 'Português' },
  { value: 'en-US', label: 'Inglês' },
]

const statusMap = {
  scheduled: { label: 'Agendada', tone: 'pending' },
  processed: { label: 'Processada', tone: 'done' },
}

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sem data'

const formatSeconds = (value = 0) => {
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

const request = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })

  let payload
  try {
    payload = await response.json()
  } catch {
    payload = { message: 'Erro inesperado' }
  }

  if (!response.ok) {
    throw new Error(payload?.message || 'Erro inesperado ao falar com o servidor')
  }

  return payload
}

const downloadBase64 = ({ fileName, mimeType, base64 }) => {
  const link = document.createElement('a')
  link.href = `data:${mimeType};base64,${base64}`
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function App() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(buildForm())
  const [submitting, setSubmitting] = useState(false)
  const [notification, setNotification] = useState(null)
  const [processingId, setProcessingId] = useState(null)
  const [emailingId, setEmailingId] = useState(null)
  const [resummarizingId, setResummarizingId] = useState(null)
  const [savingTranscriptId, setSavingTranscriptId] = useState(null)
  const [savingSummaryId, setSavingSummaryId] = useState(null)
  const [exporting, setExporting] = useState({})
  const [searchQueries, setSearchQueries] = useState({})
  const [searchResults, setSearchResults] = useState({})
  const [activeChapters, setActiveChapters] = useState({})
  const [transcriptDrafts, setTranscriptDrafts] = useState({})
  const [summaryDrafts, setSummaryDrafts] = useState({})
  const [emailPreview, setEmailPreview] = useState(null)

  const notify = useCallback((type, message) => {
    setNotification({ type, message })
    if (typeof window !== 'undefined') {
      window.clearTimeout(notify.timeoutId)
      notify.timeoutId = window.setTimeout(() => setNotification(null), 4000)
    }
  }, [])

  const syncEditorsFromMeeting = (meeting) => {
    setTranscriptDrafts((prev) => ({
      ...prev,
      [meeting.id]: meeting.transcript?.editableText || meeting.transcript?.fullText || '',
    }))
    setSummaryDrafts((prev) => ({
      ...prev,
      [meeting.id]: meeting.summary || '',
    }))
  }

  useEffect(() => {
    const loadMeetings = async () => {
      setLoading(true)
      try {
        const data = await request('/api/meetings')
        setMeetings(data.meetings || [])
        ;(data.meetings || []).forEach(syncEditorsFromMeeting)
      } catch (error) {
        notify('error', error.message)
      } finally {
        setLoading(false)
      }
    }

    loadMeetings()
  }, [notify])

  const handleParticipantChange = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      participants: prev.participants.map((participant, i) =>
        i === index ? { ...participant, [field]: value } : participant,
      ),
    }))
  }

  const addParticipant = () => {
    setForm((prev) => ({ ...prev, participants: [...prev.participants, buildParticipant()] }))
  }

  const removeParticipant = (indexToRemove) => {
    setForm((prev) => ({
      ...prev,
      participants: prev.participants.filter((_, index) => index !== indexToRemove),
    }))
  }

  const updateMeeting = (updatedMeeting) => {
    setMeetings((prev) => prev.map((meeting) => (meeting.id === updatedMeeting.id ? updatedMeeting : meeting)))
    syncEditorsFromMeeting(updatedMeeting)
  }

  const handleCreateMeeting = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setEmailPreview(null)

    const participants = form.participants.filter((person) => person.name.trim() && person.email.trim())
    if (participants.length === 0) {
      notify('error', 'Inclua ao menos um participante com nome e email')
      setSubmitting(false)
      return
    }

    try {
      const payload = await request('/api/meetings', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          scheduledAt: form.scheduledAt,
          participants,
          videoSource: form.videoSource,
          summaryStyle: form.summaryStyle,
          summaryLanguage: form.summaryLanguage,
        }),
      })
      setMeetings((prev) => [payload.meeting, ...prev])
      syncEditorsFromMeeting(payload.meeting)
      setForm(buildForm())
      notify('success', 'Reunião cadastrada!')
    } catch (error) {
      notify('error', error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleProcessMeeting = async (meetingId) => {
    const current = meetings.find((meeting) => meeting.id === meetingId)
    setProcessingId(meetingId)
    setEmailPreview(null)
    try {
      const payload = await request(`/api/meetings/${meetingId}/transcribe`, {
        method: 'POST',
        body: JSON.stringify({
          summaryStyle: current?.settings?.preferredSummaryStyle || form.summaryStyle,
          summaryLanguage: current?.settings?.preferredLanguage || form.summaryLanguage,
        }),
      })
      updateMeeting(payload.meeting)
      notify('success', 'Transcrição, capítulos e resumo prontos!')
    } catch (error) {
      notify('error', error.message)
    } finally {
      setProcessingId(null)
    }
  }

  const handleSendMinutes = async (meetingId) => {
    setEmailingId(meetingId)
    try {
      const payload = await request(`/api/meetings/${meetingId}/minutes`, { method: 'POST' })
      updateMeeting(payload.meeting)
      setEmailPreview({ meetingId, preview: payload.emailPreview })
      notify('success', 'Ata criada e e-mails encaminhados (mock)!')
    } catch (error) {
      notify('error', error.message)
    } finally {
      setEmailingId(null)
    }
  }

  const handleSummaryChange = async (meetingId, style) => {
    const current = meetings.find((meeting) => meeting.id === meetingId)
    setResummarizingId(meetingId)
    try {
      const payload = await request(`/api/meetings/${meetingId}/resummarize`, {
        method: 'POST',
        body: JSON.stringify({ style, language: current?.settings?.preferredLanguage || form.summaryLanguage }),
      })
      updateMeeting(payload.meeting)
      notify('success', 'Formato de resumo atualizado!')
    } catch (error) {
      notify('error', error.message)
    } finally {
      setResummarizingId(null)
    }
  }

  const handleSearch = async (meetingId) => {
    const query = searchQueries[meetingId]
    if (!query?.trim()) {
      notify('error', 'Digite um termo para busca')
      return
    }
    try {
      const payload = await request(`/api/meetings/${meetingId}/search?q=${encodeURIComponent(query.trim())}`)
      setSearchResults((prev) => ({ ...prev, [meetingId]: payload.matches || [] }))
    } catch (error) {
      notify('error', error.message)
    }
  }

  const handleSaveTranscript = async (meetingId) => {
    const editableText = transcriptDrafts[meetingId]
    if (!editableText?.trim()) {
      notify('error', 'Inclua texto antes de salvar a transcrição')
      return
    }
    setSavingTranscriptId(meetingId)
    try {
      const payload = await request(`/api/meetings/${meetingId}/transcript`, {
        method: 'PATCH',
        body: JSON.stringify({ editableText }),
      })
      updateMeeting(payload.meeting)
      notify('success', 'Transcrição ajustada!')
    } catch (error) {
      notify('error', error.message)
    } finally {
      setSavingTranscriptId(null)
    }
  }

  const handleSaveSummary = async (meetingId) => {
    const text = summaryDrafts[meetingId]
    if (!text?.trim()) {
      notify('error', 'Inclua texto antes de salvar o resumo')
      return
    }
    setSavingSummaryId(meetingId)
    try {
      const payload = await request(`/api/meetings/${meetingId}/summary`, {
        method: 'PATCH',
        body: JSON.stringify({ style: 'custom', text }),
      })
      updateMeeting(payload.meeting)
      notify('success', 'Resumo ajustado manualmente!')
    } catch (error) {
      notify('error', error.message)
    } finally {
      setSavingSummaryId(null)
    }
  }

  const handleExport = async (meetingId, format) => {
    const key = `${meetingId}-${format}`
    setExporting((prev) => ({ ...prev, [key]: true }))
    try {
      const payload = await request(`/api/meetings/${meetingId}/export`, {
        method: 'POST',
        body: JSON.stringify({ format }),
      })
      downloadBase64(payload.export)
      notify('success', `Arquivo ${format.toUpperCase()} pronto para download!`)
    } catch (error) {
      notify('error', error.message)
    } finally {
      setExporting((prev) => ({ ...prev, [key]: false }))
    }
  }

  const handleCaptionsDownload = (meeting) => {
    if (!meeting.accessibility?.captionsVtt) {
      notify('error', 'Gere a transcrição antes de baixar as legendas')
      return
    }
    downloadBase64({
      fileName: `${meeting.title || 'callsnap'}.vtt`,
      mimeType: 'text/vtt',
      base64: btoa(meeting.accessibility.captionsVtt),
    })
  }

  const summaryStats = useMemo(
    () => ({
      total: meetings.length,
      processed: meetings.filter((meeting) => meeting.status === 'processed').length,
      pendingEmails: meetings.filter((meeting) => meeting.status === 'processed' && !meeting.emailsSentAt).length,
      offline: meetings.filter((meeting) => meeting.videoSource?.offlineMode).length,
    }),
    [meetings],
  )

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">CallSnap • Companion para Google Meet</p>
          <h1>Grave, transcreva, resuma e navegue pelo vídeo</h1>
          <p className="subtitle">
            Evolução do protótipo: agora com ingestão por link, sumarização inteligente, capítulos automáticos, busca por palavra-chave,
            sentimento e exportações multi-formato, além de modo offline.
          </p>
        </div>
        <div className="hero-pill">
          <span className="dot" /> API: {API_URL}
        </div>
      </header>

      {notification && <div className={`toast ${notification.type}`}>{notification.message}</div>}

      <section className="grid">
        <form className="card" onSubmit={handleCreateMeeting}>
          <div className="card-header">
            <h2>Nova reunião / vídeo</h2>
            <p>Informe a origem do vídeo, preferências de resumo e quem receberá a ata.</p>
          </div>

          <label className="field">
            <span>Título</span>
            <input
              type="text"
              placeholder="Ex: Webinar sobre CallSnap AI"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              required
            />
          </label>

          <label className="field">
            <span>Data e horário</span>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(event) => setForm((prev) => ({ ...prev, scheduledAt: event.target.value }))}
              required
            />
          </label>

          <div className="field split">
            <label>
              <span>Origem do vídeo</span>
              <select
                value={form.videoSource.type}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    videoSource: { ...prev.videoSource, type: event.target.value },
                  }))
                }
              >
                {videoOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Link / caminho</span>
              <input
                type="text"
                placeholder="Cole o link do YouTube, Vimeo ou caminho local"
                value={form.videoSource.value}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    videoSource: { ...prev.videoSource, value: event.target.value },
                  }))
                }
              />
            </label>
          </div>

          <label className="field checkbox">
            <input
              type="checkbox"
              checked={form.videoSource.offlineMode}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  videoSource: { ...prev.videoSource, offlineMode: event.target.checked },
                }))
              }
            />
            <span>Processar no modo offline (apenas arquivos locais)</span>
          </label>

          <div className="field split">
            <label>
              <span>Formato preferido de resumo</span>
              <select
                value={form.summaryStyle}
                onChange={(event) => setForm((prev) => ({ ...prev, summaryStyle: event.target.value }))}
              >
                {summaryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Idioma alvo</span>
              <select
                value={form.summaryLanguage}
                onChange={(event) => setForm((prev) => ({ ...prev, summaryLanguage: event.target.value }))}
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="participants">
            <div className="participants-header">
              <span>Participantes / destinatários</span>
              <button type="button" className="ghost" onClick={addParticipant}>
                + Adicionar
              </button>
            </div>
            {form.participants.map((participant, index) => (
              <div key={index} className="participant-row">
                <input
                  type="text"
                  placeholder="Nome"
                  value={participant.name}
                  onChange={(event) => handleParticipantChange(index, 'name', event.target.value)}
                  required
                />
                <input
                  type="email"
                  placeholder="email@empresa.com"
                  value={participant.email}
                  onChange={(event) => handleParticipantChange(index, 'email', event.target.value)}
                  required
                />
                {form.participants.length > 1 && (
                  <button type="button" className="ghost" onClick={() => removeParticipant(index)}>
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>

          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Cadastrar reunião'}
          </button>
        </form>

        <div className="card stats">
          <div className="card-header">
            <h2>Radar rápido</h2>
            <p>Entenda o status do pipeline de reuniões.</p>
          </div>
          <div className="stat-grid">
            <div>
              <p>Total</p>
              <strong>{summaryStats.total}</strong>
            </div>
            <div>
              <p>Processadas</p>
              <strong>{summaryStats.processed}</strong>
            </div>
            <div>
              <p>Aguardando ata</p>
              <strong>{summaryStats.pendingEmails}</strong>
            </div>
            <div>
              <p>Modo offline</p>
              <strong>{summaryStats.offline}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="card meetings">
        <div className="card-header">
          <h2>Chamadas monitoradas</h2>
          <p>{loading ? 'Carregando...' : 'Clique em uma reunião para acompanhar análises, buscas e exportações.'}</p>
        </div>

        {meetings.length === 0 && !loading && (
          <div className="empty-state">
            <p>Nenhuma reunião cadastrada. Use o formulário acima para começar.</p>
          </div>
        )}

        <div className="meetings-grid">
          {meetings.map((meeting) => {
            const transcriptDraft = transcriptDrafts[meeting.id] ?? meeting.transcript?.editableText ?? ''
            const summaryDraft = summaryDrafts[meeting.id] ?? meeting.summary ?? ''
            const availableSummaryStyles = Object.keys(meeting.summaries?.styles || {})
            const searchMatchList = searchResults[meeting.id]

            return (
              <article key={meeting.id} className="meeting-card">
                <header>
                  <div>
                    <p className="eyebrow">{formatDateTime(meeting.scheduledAt)}</p>
                    <h3>{meeting.title}</h3>
                  </div>
                  <span className={`status ${statusMap[meeting.status]?.tone || 'pending'}`}>
                    {statusMap[meeting.status]?.label || 'Em andamento'}
                  </span>
                </header>

                {meeting.videoSource?.value && (
                  <div className="video-meta">
                    <span className="pill">{meeting.videoSource.type}</span>
                    {meeting.videoSource.offlineMode && <span className="pill success">Offline</span>}
                    <p>{meeting.videoSource.value}</p>
                  </div>
                )}

                <div className="participants-list">
                  {meeting.participants.map((participant) => (
                    <span key={participant.email} className="pill">
                      {participant.name} · {participant.email}
                    </span>
                  ))}
                </div>

                {meeting.summary && (
                  <div className="summary-block">
                    <div className="summary-header">
                      <strong>Resumo automático</strong>
                      {availableSummaryStyles.length > 0 && (
                        <select
                          value={meeting.settings?.preferredSummaryStyle}
                          onChange={(event) => handleSummaryChange(meeting.id, event.target.value)}
                          disabled={resummarizingId === meeting.id}
                        >
                          {availableSummaryStyles.map((style) => (
                            <option key={style} value={style}>
                              {style.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <p>{meeting.summary}</p>
                    <div className="summary-tags">
                      <span>Idioma: {meeting.summaries?.language}</span>
                      <span>Última edição: {meeting.summaries?.lastEditedAt ? formatDateTime(meeting.summaries.lastEditedAt) : 'Automático'}</span>
                    </div>
                  </div>
                )}

                {meeting.chapters?.length > 0 && (
                  <div className="summary-block">
                    <strong>Capítulos automáticos</strong>
                    <div className="chapter-grid">
                      {meeting.chapters.map((chapter) => (
                        <button
                          key={chapter.id}
                          type="button"
                          className={`chapter ${activeChapters[meeting.id] === chapter.id ? 'active' : ''}`}
                          onClick={() => setActiveChapters((prev) => ({ ...prev, [meeting.id]: chapter.id }))}
                        >
                          <span>{formatSeconds(chapter.start)}</span>
                          <strong>{chapter.title}</strong>
                          <p>{chapter.summary}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {meeting.analysis?.sentiment && (
                  <div className="summary-block">
                    <strong>Análise inteligente</strong>
                    <div className="analysis-grid">
                      <div>
                        <span>Sentimento</span>
                        <p className={`sentiment ${meeting.analysis.sentiment}`}>{meeting.analysis.sentiment}</p>
                      </div>
                      <div>
                        <span>Score</span>
                        <p>{meeting.analysis.score}</p>
                      </div>
                      <div>
                        <span>Tópicos</span>
                        <p>{meeting.analysis.topics.join(', ')}</p>
                      </div>
                      <div>
                        <span>Keywords</span>
                        <p>{meeting.analysis.keywords.join(', ')}</p>
                      </div>
                    </div>
                  </div>
                )}

                {meeting.highlights?.length > 0 && (
                  <div className="summary-block">
                    <strong>Highlights</strong>
                    <ul>
                      {meeting.highlights.map((highlight, index) => (
                        <li key={`${meeting.id}-highlight-${index}`}>{highlight}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {meeting.actionItems?.length > 0 && (
                  <div className="summary-block">
                    <strong>Ações</strong>
                    <ul>
                      {meeting.actionItems.map((action, index) => (
                        <li key={`${meeting.id}-action-${index}`}>{action}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {meeting.transcript?.segments?.length > 0 && (
                  <div className="summary-block transcript">
                    <strong>Transcrição detalhada</strong>
                    <ul>
                      {meeting.transcript.segments.map((segment) => (
                        <li key={segment.id}>
                          <span>
                            {formatSeconds(segment.start)} · {segment.speaker}
                          </span>
                          <p>{segment.text}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="summary-block search">
                  <strong>Busca dentro do vídeo</strong>
                  <div className="search-row">
                    <input
                      type="text"
                      placeholder="Buscar palavra-chave"
                      value={searchQueries[meeting.id] || ''}
                      onChange={(event) =>
                        setSearchQueries((prev) => ({
                          ...prev,
                          [meeting.id]: event.target.value,
                        }))
                      }
                    />
                    <button type="button" className="secondary" onClick={() => handleSearch(meeting.id)}>
                      Encontrar
                    </button>
                  </div>
                  {Array.isArray(searchMatchList) && (
                    <div className="search-results">
                      {searchMatchList.length === 0 && <p>Nenhum trecho encontrado.</p>}
                      {searchMatchList.length > 0 && (
                        <ul>
                          {searchMatchList.map((match) => (
                            <li key={match.segmentId}>
                              <span>
                                {formatSeconds(match.start)} • {match.speaker}
                              </span>
                              <p>{match.text}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {meeting.summary && (
                  <div className="editor">
                    <div>
                      <strong>Ajustar resumo manualmente</strong>
                      <textarea
                        value={summaryDraft}
                        onChange={(event) =>
                          setSummaryDrafts((prev) => ({
                            ...prev,
                            [meeting.id]: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleSaveSummary(meeting.id)}
                        disabled={savingSummaryId === meeting.id}
                      >
                        {savingSummaryId === meeting.id ? 'Salvando...' : 'Salvar resumo customizado'}
                      </button>
                    </div>
                    <div>
                      <strong>Ajustar transcrição manualmente</strong>
                      <textarea
                        value={transcriptDraft}
                        onChange={(event) =>
                          setTranscriptDrafts((prev) => ({
                            ...prev,
                            [meeting.id]: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleSaveTranscript(meeting.id)}
                        disabled={savingTranscriptId === meeting.id}
                      >
                        {savingTranscriptId === meeting.id ? 'Salvando...' : 'Salvar transcrição'}
                      </button>
                    </div>
                  </div>
                )}

                {meeting.summary && (
                  <div className="export-actions">
                    <strong>Exportar conteúdo</strong>
                    <div>
                      {['txt', 'pdf', 'docx'].map((format) => (
                        <button
                          key={format}
                          type="button"
                          className="ghost"
                          onClick={() => handleExport(meeting.id, format)}
                          disabled={exporting[`${meeting.id}-${format}`]}
                        >
                          {exporting[`${meeting.id}-${format}`] ? 'Gerando...' : format.toUpperCase()}
                        </button>
                      ))}
                      <button type="button" className="ghost" onClick={() => handleCaptionsDownload(meeting)}>
                        Baixar VTT
                      </button>
                    </div>
                  </div>
                )}

                <footer>
                  <button
                    className="secondary"
                    onClick={() => handleProcessMeeting(meeting.id)}
                    disabled={processingId === meeting.id}
                  >
                    {processingId === meeting.id ? 'Processando...' : 'Gerar pipeline completo'}
                  </button>
                  <button
                    className="primary"
                    onClick={() => handleSendMinutes(meeting.id)}
                    disabled={emailingId === meeting.id || !meeting.summary}
                  >
                    {emailingId === meeting.id ? 'Enviando...' : meeting.emailsSentAt ? 'Reenviar ata' : 'Enviar ata'}
                  </button>
                </footer>
              </article>
            )
          })}
        </div>
      </section>

      {emailPreview && (
        <section className="card email-preview">
          <div className="card-header">
            <h2>Prévia dos e-mails enviados</h2>
            <p>Conteúdo mockado retornado pelo backend.</p>
          </div>
          <div className="email-grid">
            {emailPreview.preview.map((email, index) => (
              <div key={`${email.to}-${index}`} className="email-card">
                <p className="eyebrow">Para: {email.to}</p>
                <strong>{email.subject}</strong>
                <pre>{email.body}</pre>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default App
