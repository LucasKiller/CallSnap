import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const buildParticipant = () => ({ name: '', email: '' })
const buildForm = () => ({
  title: '',
  scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
  participants: [buildParticipant()],
})

const statusMap = {
  scheduled: { label: 'Agendada', tone: 'pending' },
  processed: { label: 'Processada', tone: 'done' },
}

const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sem data'

const request = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })

  let payload
  try {
    payload = await response.json()
  } catch (error) {
    payload = { message: 'Erro inesperado' }
  }

  if (!response.ok) {
    throw new Error(payload?.message || 'Erro inesperado ao falar com o servidor')
  }

  return payload
}

function App() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState(buildForm())
  const [submitting, setSubmitting] = useState(false)
  const [notification, setNotification] = useState(null)
  const [processingId, setProcessingId] = useState(null)
  const [emailingId, setEmailingId] = useState(null)
  const [emailPreview, setEmailPreview] = useState(null)

  const notify = (type, message) => {
    setNotification({ type, message })
    if (typeof window !== 'undefined') {
      window.clearTimeout(notify.timeoutId)
      notify.timeoutId = window.setTimeout(() => setNotification(null), 4000)
    }
  }

  useEffect(() => {
    const loadMeetings = async () => {
      setLoading(true)
      try {
        const data = await request('/api/meetings')
        setMeetings(data.meetings || [])
      } catch (error) {
        notify('error', error.message)
      } finally {
        setLoading(false)
      }
    }

    loadMeetings()
  }, [])

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
        body: JSON.stringify({ ...form, participants }),
      })
      setMeetings((prev) => [payload.meeting, ...prev])
      setForm(buildForm())
      notify('success', 'Reunião cadastrada!')
    } catch (error) {
      notify('error', error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleProcessMeeting = async (meetingId) => {
    setProcessingId(meetingId)
    setEmailPreview(null)
    try {
      const payload = await request(`/api/meetings/${meetingId}/transcribe`, { method: 'POST' })
      setMeetings((prev) => prev.map((meeting) => (meeting.id === meetingId ? payload.meeting : meeting)))
      notify('success', 'Transcrição e resumo prontos!')
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
      setMeetings((prev) => prev.map((meeting) => (meeting.id === meetingId ? payload.meeting : meeting)))
      setEmailPreview({ meetingId, preview: payload.emailPreview })
      notify('success', 'Ata criada e e-mails encaminhados (mock)!')
    } catch (error) {
      notify('error', error.message)
    } finally {
      setEmailingId(null)
    }
  }

  const summaryStats = useMemo(() => ({
    total: meetings.length,
    processed: meetings.filter((meeting) => meeting.status === 'processed').length,
    pendingEmails: meetings.filter((meeting) => meeting.status === 'processed' && !meeting.emailsSentAt).length,
  }), [meetings])

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">CallSnap • Companion para Google Meet</p>
          <h1>Grave, transcreva e envie atas em minutos</h1>
          <p className="subtitle">
            Prototipo web que simula a automação estilo tl;dv: cadastro da reunião, geração de transcrição/resumo e
            disparo de ata para o e-mail de cada participante.
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
            <h2>Nova reunião</h2>
            <p>Informe os dados básicos e os participantes que receberão a ata.</p>
          </div>

          <label className="field">
            <span>Título</span>
            <input
              type="text"
              placeholder="Ex: Alinhamento com o time de Produto"
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

          <div className="participants">
            <div className="participants-header">
              <span>Participantes</span>
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
          </div>
        </div>
      </section>

      <section className="card meetings">
        <div className="card-header">
          <h2>Chamadas monitoradas</h2>
          <p>{loading ? 'Carregando...' : 'Clique em uma reunião para acompanhar a transcrição e as ações.'}</p>
        </div>

        {meetings.length === 0 && !loading && (
          <div className="empty-state">
            <p>Nenhuma reunião cadastrada. Use o formulário acima para começar.</p>
          </div>
        )}

        <div className="meetings-grid">
          {meetings.map((meeting) => (
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

              <div className="participants-list">
                {meeting.participants.map((participant) => (
                  <span key={participant.email} className="pill">
                    {participant.name} · {participant.email}
                  </span>
                ))}
              </div>

              {meeting.summary && (
                <div className="summary-block">
                  <strong>Resumo automático</strong>
                  <p>{meeting.summary}</p>
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

              <footer>
                <button
                  className="secondary"
                  onClick={() => handleProcessMeeting(meeting.id)}
                  disabled={processingId === meeting.id}
                >
                  {processingId === meeting.id ? 'Processando...' : 'Gerar transcrição & resumo'}
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
          ))}
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
