import { useState } from 'react'
import type { FormEvent } from 'react'
import type { useStudySession } from '../hooks/useStudySession'
import { TASK_DRAG_TYPE } from '../lib/studySession'

export function TaskList({ session, onFocusTask, onDragTask }: {
  session: ReturnType<typeof useStudySession>
  onFocusTask: (id: string) => void
  onDragTask: (id: string | null) => void
}) {
  const { state, dispatch } = session
  const [title, setTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending')
  const [notice, setNotice] = useState('')
  const pending = state.tasks.filter(task => !task.completed).length
  const completed = state.tasks.length - pending
  const tasks = state.tasks.filter(task => filter === 'all' || task.completed === (filter === 'completed'))

  async function addTask(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    await dispatch({ type: 'task-add', id: crypto.randomUUID(), title })
    setTitle(''); setFilter('pending'); setNotice('Task added.')
  }

  async function saveTask(event: FormEvent) {
    event.preventDefault()
    if (!editingId || !editingTitle.trim()) return
    await dispatch({ type: 'task-edit', id: editingId, title: editingTitle })
    setEditingId(null); setNotice('Task updated.')
  }

  return <section className="tasks-panel" aria-labelledby="tasks-heading">
    <div className="panel-heading"><div><span className="eyebrow">YOUR TASKS</span><h2 id="tasks-heading">The to-do list</h2></div><span className="task-count">{pending} pending</span></div>
    <form className="add-task" onSubmit={event => void addTask(event)}>
      <label className="sr-only" htmlFor="new-task">New task</label>
      <input id="new-task" placeholder="What needs doing?" maxLength={200} required value={title} onChange={event => setTitle(event.target.value)} />
      <button className="add-task-button" disabled={!title.trim()} type="submit"><span aria-hidden="true">+</span> Add task</button>
    </form>
    <div className="task-toolbar"><div className="task-filters" aria-label="Filter tasks">
      <button aria-pressed={filter === 'pending'} onClick={() => setFilter('pending')}>Pending <span>{pending}</span></button>
      <button aria-pressed={filter === 'completed'} onClick={() => setFilter('completed')}>Done <span>{completed}</span></button>
      <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
    </div><span className="drag-hint">Drag a task onto the timer</span></div>
    {tasks.length === 0 ? <p className="empty-tasks">{filter === 'completed' ? 'No completed tasks yet.' : filter === 'pending' && state.tasks.length ? 'All tasks done. Nice work.' : 'Add a task, then choose Focus to get started.'}</p> :
      <ul className="task-list">{tasks.map(task => <li key={task.id} data-task-id={task.id} className={`task-row ${state.selectedTaskId === task.id ? 'selected' : ''} ${task.completed ? 'done' : ''}`}
        draggable={editingId !== task.id}
        onDragStart={event => {
          event.dataTransfer.setData(TASK_DRAG_TYPE, task.id)
          event.dataTransfer.effectAllowed = 'copy'
          onDragTask(task.id)
        }} onDragEnd={() => onDragTask(null)}>
        {editingId === task.id ? <form className="edit-task" onSubmit={event => void saveTask(event)}>
          <label className="sr-only" htmlFor={`edit-${task.id}`}>Edit task title</label>
          <input id={`edit-${task.id}`} autoFocus maxLength={200} required value={editingTitle} onChange={event => setEditingTitle(event.target.value)}
            onKeyDown={event => { if (event.key === 'Escape') setEditingId(null) }} />
          <button type="submit" disabled={!editingTitle.trim()}>Save</button><button type="button" onClick={() => setEditingId(null)}>Cancel</button>
        </form> : <>
          <span className="drag-grip" aria-hidden="true"><svg viewBox="0 0 12 20">{[4, 10, 16].flatMap(y => [3, 9].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" />))}</svg></span>
          <input className="task-checkbox" type="checkbox" checked={task.completed} aria-label={`Mark ${task.title} ${task.completed ? 'incomplete' : 'complete'}`}
            onChange={() => { void dispatch({ type: 'task-toggle', id: task.id }); setNotice(task.completed ? 'Task reopened.' : 'Task completed.') }} />
          <div className="task-title"><span>{task.title}</span>{state.selectedTaskId === task.id && <small>Current focus</small>}</div>
          <button className="focus-task" aria-pressed={state.selectedTaskId === task.id} aria-label={`Focus on ${task.title}`} onClick={() => onFocusTask(task.id)}>{state.selectedTaskId === task.id ? 'Selected' : 'Focus'}</button>
          <button className="icon-button" aria-label={`Edit ${task.title}`} title="Edit task" onClick={() => { setEditingId(task.id); setEditingTitle(task.title) }}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 12 9-9 4 4-9 9-5 1Z M11 5l4 4" /></svg></button>
          <button className="icon-button delete-task" aria-label={`Delete ${task.title}`} title="Delete task" onClick={() => { void dispatch({ type: 'task-delete', id: task.id }); setNotice('Task deleted. Session history is unchanged.') }}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M7 5V3h6v2M5 5l1 12h8l1-12M8 8v6M12 8v6" /></svg></button>
        </>}
      </li>)}</ul>}
    <p className="sr-only" role="status">{notice}</p>
  </section>
}
