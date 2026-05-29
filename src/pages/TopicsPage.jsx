import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLayout } from '../components/DashLayout'
import { supabase } from '../lib/supabaseClient'
import { getCache, setCache } from '../lib/dataCache'

export default function TopicsPage() {
  const { moduleId } = useParams()
  const navigate = useNavigate()
  const { setPageTitle, setPageSub, setPageClass } = useLayout()
  const cached = getCache('topics-' + moduleId)
  const [module, setModule] = useState(cached?.module || null)
  const [topics, setTopics] = useState(cached?.topics || [])

  useEffect(() => {
    ;(async () => {
      const { data: mod } = await supabase.from('modules').select('*, subjects(title)').eq('id', moduleId).single()
      if (!mod) return
      setModule(mod)
      setPageTitle(mod.title)
      setPageSub(mod.subjects?.title || '')
      setPageClass('')

      const { data: tops } = await supabase.from('topics').select('*').eq('module_id', moduleId).order('order_index')
      if (tops?.length) setTopics(tops)
    })()
  }, [moduleId])

  const handleStart = async (topic) => {
    let cached = getCache('test-questions-' + topic.id)
    if (!cached) {
      const { data: qs } = await supabase.from('questions')
        .select('id, topic_id, question_text, options, correct_index, image_url, explanation, order_index, question_type')
        .eq('topic_id', topic.id).order('order_index')
      if (qs?.length) {
        const shuffled = [...qs].sort(() => Math.random() - 0.5)
        cached = shuffled
        setCache('test-questions-' + topic.id, shuffled)
      }
    }
    navigate('/test/' + topic.id, { state: { questions: cached, topic } })
  }

  if (!module) return null

  return (
    <>
      <div className="topics-header">
        <button className="topics-back" onClick={() => navigate(-1)}>&larr; BACK</button>
        <span className="topics-count">{topics.length} TOPIC{topics.length !== 1 ? 'S' : ''}</span>
      </div>
      <div className="topics-list">
        {topics.map((t, i) => (
          <div key={t.id} className="topic-row shadow-wrap"><div className="shadow-box" />
            <div className="topic-inner">
              <div className="topic-left">
                <span className="topic-num">{(i + 1).toString().padStart(2, '0')}</span>
                <div>
                  <div className="topic-name">{t.title}</div>
                  <div className="topic-desc">{t.description || 'Practice test'}</div>
                </div>
              </div>
              <div className="topic-right">
                <button className="btn-module" onClick={() => handleStart(t)}>START</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
