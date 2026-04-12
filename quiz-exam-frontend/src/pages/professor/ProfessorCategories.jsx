import React, { useEffect, useState } from 'react'
import { categories as categoriesApi } from '../../api/api'
import Modal from '../../components/Modal'
import styles from './ProfessorCategories.module.css'

const emptyForm = { name: '', description: '' }

export default function ProfessorCategories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    try {
      const data = await categoriesApi.list()
      setCategories(data || [])
    } catch (e) {
      setMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (category) => {
    setEditing(category)
    setForm({ name: category.name || '', description: category.description || '' })
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        const updated = await categoriesApi.update(editing.id, form)
        setCategories(list => list.map(c => c.id === editing.id ? updated : c))
        setMsg('Category updated.')
      } else {
        const created = await categoriesApi.create(form)
        setCategories(list => [...list, created].sort((a, b) => a.name.localeCompare(b.name)))
        setMsg('Category created.')
      }
      setShowModal(false)
      setForm(emptyForm)
      setEditing(null)
    } catch (err) {
      setMsg(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this category?')) return
    try {
      await categoriesApi.delete(id)
      setCategories(list => list.filter(c => c.id !== id))
      setMsg('Category deleted.')
    } catch (e) {
      setMsg(e.message)
    }
  }

  if (loading) return <div className={styles.page}><p>Loading categories…</p></div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Category Management</h1>
          <p className={styles.sub}>{categories.length} categories</p>
        </div>
        <button className={styles.addBtn} onClick={openCreate}>+ Add Category</button>
      </div>

      {msg && <div className={styles.msg} onClick={() => setMsg('')}>{msg}</div>}

      <div className={styles.grid}>
        {categories.map(category => (
          <div key={category.id} className={styles.card}>
            <h3 className={styles.name}>{category.name}</h3>
            <p className={styles.desc}>{category.description || 'No description provided.'}</p>
            <div className={styles.actions}>
              <button className={styles.editBtn} onClick={() => openEdit(category)}>Edit</button>
              <button className={styles.deleteBtn} onClick={() => handleDelete(category.id)}>Delete</button>
            </div>
          </div>
        ))}
        {categories.length === 0 && <p className={styles.empty}>No categories yet. Add your first category.</p>}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Category' : 'Add Category'}
      >
        <form onSubmit={handleSave} className={styles.form}>
          <div className={styles.field}>
            <label>Name</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className={styles.field}>
            <label>Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? 'Saving…' : (editing ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
