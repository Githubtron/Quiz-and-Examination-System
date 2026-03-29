import React, { useState } from 'react'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import styles from './AdminUsers.module.css'

const MOCK_USERS = [
  { id: 1, username: 'admin', email: 'admin@quizmaster.com', role: 'ADMIN', createdAt: '2026-01-01' },
  { id: 2, username: 'professor', email: 'prof@quizmaster.com', role: 'PROFESSOR', createdAt: '2026-01-05' },
  { id: 3, username: 'student', email: 'student@quizmaster.com', role: 'STUDENT', createdAt: '2026-01-10' },
  { id: 4, username: 'alice', email: 'alice@example.com', role: 'STUDENT', createdAt: '2026-02-01' },
  { id: 5, username: 'bob', email: 'bob@example.com', role: 'STUDENT', createdAt: '2026-02-15' },
]

const roleBadge = { ADMIN: 'danger', PROFESSOR: 'primary', STUDENT: 'success' }

export default function AdminUsers() {
  const [users, setUsers] = useState(MOCK_USERS)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [msg, setMsg] = useState('')

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = e => {
    e.preventDefault()
    const newUser = { id: Date.now(), ...form, role: 'ADMIN', createdAt: new Date().toISOString().slice(0, 10) }
    setUsers(u => [...u, newUser])
    setMsg('Admin account created successfully.')
    setShowModal(false)
    setForm({ username: '', email: '', password: '' })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>User Management</h1>
          <p className={styles.sub}>{users.length} registered users</p>
        </div>
        <button className={styles.createBtn} onClick={() => setShowModal(true)}>+ Create Admin</button>
      </div>

      {msg && <div className={styles.successMsg}>{msg}</div>}

      <div className={styles.toolbar}>
        <input
          className={styles.search} placeholder="Search by username or email…"
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Username</th><th>Email</th><th>Role</th><th>Joined</th></tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td><strong>{u.username}</strong></td>
                <td>{u.email}</td>
                <td><Badge variant={roleBadge[u.role]}>{u.role}</Badge></td>
                <td>{u.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className={styles.empty}>No users found.</p>}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create Admin Account">
        <form onSubmit={handleCreate} className={styles.form}>
          <div className={styles.field}>
            <label>Username</label>
            <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
          </div>
          <div className={styles.field}>
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className={styles.field}>
            <label>Password</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className={styles.submitBtn}>Create Admin</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
