import { useState, useRef, useEffect } from 'react'
import { Close, CircleCheck, Edit } from '@design-systems/icons'
import styles from '../../styles/data-review/NotesPane.module.css'

export type NoteReply = {
  id: string
  text: string
  author: string
  at: string
  role: 'preparer' | 'reviewer'
}

export type Note = {
  id: string
  text: string
  author: string
  at: string
  context?: string
  /** C2: open until a reviewer/preparer resolves */
  status?: 'open' | 'resolved'
  replies?: NoteReply[]
  role?: 'preparer' | 'reviewer'
}

interface NotesPaneProps {
  notes: Note[]
  onAdd: (text: string) => void
  onEdit: (id: string, text: string) => void
  onResolve?: (id: string) => void
  onReply?: (id: string, text: string) => void
  onClose: () => void
  closing?: boolean
  /** When set, scroll/open that note first (Pass 2 open-items) */
  focusNoteId?: string | null
}

function renderNoteText(text: string) {
  const parts = text.split(/(@\w+)/g)
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className={styles.mention}>{part}</span>
      : part
  )
}

export default function NotesPane({
  notes,
  onAdd,
  onEdit,
  onResolve,
  onReply,
  onClose,
  closing = false,
  focusNoteId = null,
}: NotesPaneProps) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)
  const noteRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    if (editingId) editTextareaRef.current?.focus()
  }, [editingId])

  useEffect(() => {
    if (!focusNoteId) return
    const el = noteRefs.current[focusNoteId]
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [focusNoteId, notes])

  const handlePost = () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setDraft('')
  }

  const startEdit = (note: Note) => {
    setEditingId(note.id)
    setEditDraft(note.text)
    setReplyingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft('')
  }

  const saveEdit = () => {
    const trimmed = editDraft.trim()
    if (!trimmed || !editingId) return
    onEdit(editingId, trimmed)
    setEditingId(null)
    setEditDraft('')
  }

  const startReply = (noteId: string) => {
    setReplyingId(noteId)
    setReplyDraft('')
    setEditingId(null)
  }

  const saveReply = () => {
    const trimmed = replyDraft.trim()
    if (!trimmed || !replyingId || !onReply) return
    onReply(replyingId, trimmed)
    setReplyingId(null)
    setReplyDraft('')
  }

  return (
    <div className={`${styles.panel} ${closing ? styles.panelClosing : ''}`}>

      <div className={styles.header}>
        <span className={styles.title}>Comments</span>
        <button className={styles.closeBtn} aria-label="Close comments" onClick={onClose}>
          <Close size="small" />
        </button>
      </div>

      <div className={styles.notesList}>
        {notes.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="5" width="20" height="22" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <line x1="10" y1="11" x2="22" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="10" y1="15" x2="22" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="10" y1="19" x2="17" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className={styles.emptyTitle}>No comments yet</p>
            <p className={styles.emptyBody}>Add a comment to flag something for your team or leave context for a reviewer.</p>
          </div>
        ) : (
          <div className={styles.noteItems}>
            {notes.map(note => {
              const isEditing = editingId === note.id
              const isReplying = replyingId === note.id
              const isFocused = focusNoteId === note.id
              return (
                <div
                  key={note.id}
                  ref={el => { noteRefs.current[note.id] = el }}
                  className={`${styles.noteCard} ${isFocused ? styles.noteCardFocused : ''} ${note.status === 'resolved' ? styles.noteCardResolved : ''}`}
                >
                  <div className={styles.noteHeader}>
                    <div className={styles.noteAvatar}>
                      {note.author.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className={styles.noteMeta}>
                      <span className={styles.noteAuthor}>{note.author}</span>
                      <span className={styles.noteAt}>{note.at}</span>
                    </div>
                    {!isEditing && (
                      <button
                        className={styles.editBtn}
                        aria-label="Edit comment"
                        onClick={() => startEdit(note)}
                      >
                        <Edit size="small" />
                      </button>
                    )}
                  </div>
                  {note.context && (
                    <div className={styles.noteContext}>
                      <span className={styles.noteContextIcon}><CircleCheck size="small" /></span>
                      {note.context}
                    </div>
                  )}
                  {isEditing ? (
                    <div className={styles.editArea}>
                      <div className={styles.editBox}>
                        <textarea
                          ref={editTextareaRef}
                          className={styles.editInput}
                          value={editDraft}
                          onChange={e => setEditDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Escape') cancelEdit()
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit()
                          }}
                          rows={3}
                        />
                      </div>
                      <div className={styles.editActions}>
                        <button className={styles.cancelBtn} onClick={cancelEdit}>Cancel</button>
                        <button
                          className={`${styles.postBtn} ${editDraft.trim() ? styles.postBtnActive : ''}`}
                          disabled={!editDraft.trim()}
                          onClick={saveEdit}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className={styles.noteText}>{renderNoteText(note.text)}</p>

                      {(note.replies?.length ?? 0) > 0 && (
                        <ul className={styles.replyList}>
                          {note.replies!.map(r => (
                            <li key={r.id} className={styles.replyItem}>
                              <span className={styles.replyAuthor}>{r.author.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>
                              <div className={styles.replyBody}>
                                <span className={styles.replyMeta}>{r.author} · {r.at}</span>
                                <p className={styles.replyText}>{renderNoteText(r.text)}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className={styles.noteActions}>
                        {onReply && (note.status ?? 'open') === 'open' && (
                          <button type="button" className={styles.cancelBtn} onClick={() => startReply(note.id)}>
                            Reply
                          </button>
                        )}
                        {onResolve && (note.status ?? 'open') === 'open' && (
                          <button type="button" className={styles.cancelBtn} onClick={() => onResolve(note.id)}>
                            Mark resolved
                          </button>
                        )}
                        {note.status === 'resolved' && (
                          <span className={styles.noteAt}>Resolved</span>
                        )}
                      </div>

                      {isReplying && (
                        <div className={styles.editArea}>
                          <div className={styles.editBox}>
                            <textarea
                              className={styles.editInput}
                              placeholder="Write a reply…"
                              value={replyDraft}
                              onChange={e => setReplyDraft(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Escape') setReplyingId(null)
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveReply()
                              }}
                              rows={2}
                              autoFocus
                            />
                          </div>
                          <div className={styles.editActions}>
                            <button className={styles.cancelBtn} onClick={() => setReplyingId(null)}>Cancel</button>
                            <button
                              className={`${styles.postBtn} ${replyDraft.trim() ? styles.postBtnActive : ''}`}
                              disabled={!replyDraft.trim()}
                              onClick={saveReply}
                            >
                              Post reply
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className={styles.compose}>
        <div className={styles.composeBox}>
          <textarea
            ref={textareaRef}
            className={styles.composeInput}
            placeholder="Add a note… Use @ to mention a team member"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost()
            }}
            rows={3}
          />
        </div>
        <div className={styles.composeActions}>
          <button className={styles.cancelBtn} onClick={() => setDraft('')}>Clear</button>
          <button
            className={`${styles.postBtn} ${draft.trim() ? styles.postBtnActive : ''}`}
            disabled={!draft.trim()}
            onClick={handlePost}
          >
            Post note
          </button>
        </div>
      </div>

    </div>
  )
}
