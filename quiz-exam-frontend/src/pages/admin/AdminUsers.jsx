import React, { useState, useEffect } from 'react'
import { users as usersApi } from '../../api/api'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import styles from './AdminUsers.module.css'

const roleBadge = { ADMIN: 'danger', PROFESSOR: 'primary', STUDENT: 'success' }

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    usersApi.list()
      .then(data => setUsers(data || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async e => {
    e.preventDefault()
    try {
      const newUser = await usersApi.createAdmin(form)
      setUsers(u => [...u, newUser])
      setMsg('Admin account created successfully.')
      setShowModal(false)
      setForm({ username: '', email: '', password: '' })
    } catch (err) {
      setMsg(err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this user?')) return
    try {
      await usersApi.delete(id)
      setUsers(u => u.filter(x => x.id !== id))
      setMsg('User deleted.')
    } catch (err) {
      setMsg(err.message)
    }
  }

  if (loading) return <div className={styles.page}><p>Loading users…</p></div>

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
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className={styles.toolbar}>
        <input className={styles.search} placeholder="Search by username or email…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Username</th><th>Email</th><th>Role</th><th>Joined</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td><strong>{u.username}</strong></td>
                <td>{u.email}</td>
                <td><Badge variant={roleBadge[u.role] || 'default'}>{u.role}</Badge></td>
                <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                <td>
                  {u.role !== 'ADMIN' && (
                    <button onClick={() => handleDelete(u.id)}
                      style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Delete
                    </button>
                  )}
                </td>
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
