import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import Badge from '../components/Badge'
import styles from './ProfilePage.module.css'

const ROLE_META = {
  ADMIN: { label: 'Administrator', icon: '🛡️', color: 'danger', fields: ['fullName', 'email', 'phone', 'department'] },
  PROFESSOR: { label: 'Professor', icon: '👨‍🏫', color: 'primary', fields: ['fullName', 'email', 'phone', 'department', 'subject'] },
  STUDENT: { label: 'Student', icon: '🎓', color: 'success', fields: ['fullName', 'email', 'phone', 'rollNumber', 'course'] },
}

const FIELD_LABELS = {
  fullName: 'Full Name', email: 'Email Address', phone: 'Phone Number',
  department: 'Department', subject: 'Subject / Specialization',
  rollNumber: 'Roll Number', course: 'Course / Program',
}

export default function ProfilePage() {
  const { session, updateProfile } = useAuth()
  const meta = ROLE_META[session?.role] || ROLE_META.STUDENT

  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    fullName: session?.fullName || session?.username || '',
    email: session?.email || '',
    phone: session?.phone || '',
    department: session?.department || '',
    subject: session?.subject || '',
    rollNumber: session?.rollNumber || '',
    course: session?.course || '',
  })
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)

  const initials = (form.fullName || session?.username || '?').slice(0, 2).toUpperCase()

  const handleSave = () => {
    updateProfile(form)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handlePasswordChange = () => {
    setPwError('')
    if (!pwForm.current) return setPwError('Enter your current password')
    if (pwForm.next.length < 8) return setPwError('New password must be at least 8 characters')
    if (pwForm.next !== pwForm.confirm) return setPwError('Passwords do not match')
    updateProfile({ passwordHint: '••••••••' })
    setPwForm({ current: '', next: '', confirm: '' })
    setPwSaved(true)
    setTimeout(() => setPwSaved(false), 3000)
  }

  return (
    <div className={styles.page}>
      {/* Profile header card */}
      <div className={styles.heroCard}>
        <div className={styles.avatarWrap}>
          <div className={styles.avatar}>{initials}</div>
          <div className={`${styles.roleRing} ${styles[meta.color]}`} />
        </div>
        <div className={styles.heroInfo}>
          <h1 className={styles.displayName}>{form.fullName || session?.username}</h1>
          <p className={styles.username}>@{session?.username}</p>
          <div className={styles.heroBadges}>
            <Badge variant={meta.color}>{meta.icon} {meta.label}</Badge>
            <span className={styles.emailChip}>✉ {form.email}</span>
          </div>
        </div>
        <button className={styles.editToggle} onClick={() => { setEditing(e => !e); setSaved(false) }}>
          {editing ? '✕ Cancel' : '✏ Edit Profile'}
        </button>
      </div>

      {saved && <div className={styles.toast}>✅ Profile updated successfully</div>}
      {pwSaved && <div className={styles.toast}>✅ Password changed successfully</div>}

      <div className={styles.grid}>
        {/* Info section */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Profile Information</h2>
          <div className={styles.fields}>
            {meta.fields.map(key => (
              <div key={key} className={styles.field}>
                <label className={styles.label}>{FIELD_LABELS[key]}</label>
                {editing ? (
                  <input
                    className={styles.input}
                    type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={`Enter ${FIELD_LABELS[key].toLowerCase()}`}
                  />
                ) : (
                  <p className={styles.value}>{form[key] || <span className={styles.empty}>Not set</span>}</p>
                )}
              </div>
            ))}
          </div>
          {editing && (
            <div className={styles.actions}>
              <button className={styles.saveBtn} onClick={handleSave}>Save Changes</button>
              <button className={styles.cancelBtn} onClick={() => setEditing(false)}>Cancel</button>
            </div>
          )}
        </div>

        <div className={styles.right}>
          {/* Account info */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Account Details</h2>
            <div className={styles.infoRow}><span>Username</span><strong>@{session?.username}</strong></div>
            <div className={styles.infoRow}><span>Role</span><Badge variant={meta.color}>{meta.label}</Badge></div>
            <div className={styles.infoRow}><span>User ID</span><code>#{session?.userId}</code></div>
            <div className={styles.infoRow}><span>Status</span><Badge variant="success">Active</Badge></div>
          </div>

          {/* Change password */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Change Password</h2>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label className={styles.label}>Current Password</label>
                <input className={styles.input} type="password" value={pwForm.current}
                  onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} placeholder="••••••••" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>New Password</label>
                <input className={styles.input} type="password" value={pwForm.next}
                  onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} placeholder="Min 8 characters" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Confirm New Password</label>
                <input className={styles.input} type="password" value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Repeat new password" />
              </div>
            </div>
            {pwError && <p className={styles.error}>{pwError}</p>}
            <button className={styles.saveBtn} style={{ marginTop: '1rem' }} onClick={handlePasswordChange}>
              Update Password
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
