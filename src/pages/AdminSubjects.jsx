import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useLayout } from '../components/DashLayout'
import { useToast } from '../components/Toast'

export default function AdminSubjects() {
  const { setPageTitle, setPageSub } = useLayout()
  const { showToast } = useToast()
  
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  
  const [formData, setFormData] = useState({
    id: null,
    title: '',
    slug: '',
    description: '',
    icon: '',
    color: '#000000',
    order_index: 0,
    is_active: true
  })

  useEffect(() => {
    setPageTitle('TRACK ADMIN')
    setPageSub('Manage study tracks & subjects')
    fetchSubjects()
  }, [setPageTitle, setPageSub])

  const fetchSubjects = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('order_index')
    
    if (error) {
      console.error(error)
      if (error.message.includes('is_active')) {
        showToast('Database error: is_active column missing. Please run the SQL migration.', 'error')
      } else {
        showToast('Failed to load subjects', 'error')
      }
    } else {
      setSubjects(data || [])
    }
    setLoading(false)
  }

  const handleToggleActive = async (subject) => {
    const { error } = await supabase
      .from('subjects')
      .update({ is_active: !subject.is_active })
      .eq('id', subject.id)
      
    if (error) {
      showToast('Failed to update status', 'error')
    } else {
      showToast('Status updated', 'success')
      fetchSubjects()
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this subject? This will delete all its modules and questions!')) return
    
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id)
      
    if (error) {
      showToast('Failed to delete subject', 'error')
    } else {
      showToast('Subject deleted', 'success')
      fetchSubjects()
    }
  }

  const openNewModal = () => {
    setFormData({
      id: null,
      title: '',
      slug: '',
      description: '',
      icon: '',
      color: '#000000',
      order_index: subjects.length + 1,
      is_active: true
    })
    setShowModal(true)
  }

  const openEditModal = (subject) => {
    setFormData({
      id: subject.id,
      title: subject.title,
      slug: subject.slug,
      description: subject.description || '',
      icon: subject.icon || '',
      color: subject.color || '#000000',
      order_index: subject.order_index || 0,
      is_active: subject.is_active ?? true
    })
    setShowModal(true)
  }

  const autoGenerateSlug = (title) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
  }

  const handleTitleChange = (e) => {
    const newTitle = e.target.value
    setFormData(prev => ({
      ...prev,
      title: newTitle,
      slug: prev.id ? prev.slug : autoGenerateSlug(newTitle)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const payload = {
      title: formData.title,
      slug: formData.slug,
      description: formData.description,
      icon: formData.icon,
      color: formData.color,
      order_index: formData.order_index,
      is_active: formData.is_active
    }

    if (formData.id) {
      const { error } = await supabase
        .from('subjects')
        .update(payload)
        .eq('id', formData.id)
        
      if (error) showToast('Update failed: ' + error.message, 'error')
      else {
        showToast('Subject updated', 'success')
        setShowModal(false)
        fetchSubjects()
      }
    } else {
      const { error } = await supabase
        .from('subjects')
        .insert([payload])
        
      if (error) showToast('Create failed: ' + error.message, 'error')
      else {
        showToast('Subject created', 'success')
        setShowModal(false)
        fetchSubjects()
      }
    }
  }

  if (loading) return <div className="page-loading" />

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h2>Study Tracks</h2>
        <button className="btn-module" onClick={openNewModal}>+ Add Track</button>
      </div>
      
      <div className="shadow-wrap">
        <div className="shadow-box" />
        <div style={{ background: '#fff', border: '1px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f8f9fa', borderBottom: '2px solid #000' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left' }}>Order</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Icon</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Title</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Slug</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Visible</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((sub) => (
                <tr key={sub.id} style={{ borderBottom: '1px solid #eaeaea', opacity: sub.is_active === false ? 0.6 : 1 }}>
                  <td style={{ padding: '12px' }}>{sub.order_index}</td>
                  <td style={{ padding: '12px', fontSize: '20px' }}>{sub.icon}</td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: sub.color }} />
                      {sub.title}
                    </div>
                  </td>
                  <td style={{ padding: '12px', color: '#666' }}>{sub.slug}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={sub.is_active !== false}
                        onChange={() => handleToggleActive(sub)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </label>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <button onClick={() => openEditModal(sub)} style={{ background: 'none', border: 'none', color: '#007aff', cursor: 'pointer', fontWeight: 'bold', marginRight: '16px' }}>Edit</button>
                    <button onClick={() => handleDelete(sub.id)} style={{ background: 'none', border: 'none', color: '#ff3b30', cursor: 'pointer', fontWeight: 'bold' }}>Delete</button>
                  </td>
                </tr>
              ))}
              {subjects.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No subjects found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="modal-content shadow-wrap" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px' }}>
            <div className="shadow-box" />
            <div style={{ background: '#fff', border: '2px solid #000', borderRadius: '8px', padding: '24px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{formData.id ? 'Edit Track' : 'Add New Track'}</h3>
              
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Title</label>
                  <input required type="text" value={formData.title} onChange={handleTitleChange} style={{ width: '100%', padding: '8px', border: '2px solid #000', borderRadius: '4px' }} placeholder="e.g. Desmos Guide" />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Slug (URL path)</label>
                  <input required type="text" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} style={{ width: '100%', padding: '8px', border: '2px solid #000', borderRadius: '4px' }} placeholder="e.g. desmos-guide" />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Description</label>
                  <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{ width: '100%', padding: '8px', border: '2px solid #000', borderRadius: '4px' }} placeholder="Short description" />
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Icon (Emoji/Text)</label>
                    <input type="text" value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})} style={{ width: '100%', padding: '8px', border: '2px solid #000', borderRadius: '4px' }} placeholder="📈" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Color (Hex)</label>
                    <input type="color" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} style={{ width: '100%', height: '38px', padding: '2px', border: '2px solid #000', borderRadius: '4px', cursor: 'pointer' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '4px' }}>Order</label>
                    <input type="number" value={formData.order_index} onChange={e => setFormData({...formData, order_index: parseInt(e.target.value)||0})} style={{ width: '100%', padding: '8px', border: '2px solid #000', borderRadius: '4px' }} />
                  </div>
                </div>

                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 16px', background: 'transparent', border: '2px solid #000', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" className="btn-module">Save Track</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
