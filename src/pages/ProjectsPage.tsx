import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { createProject, fetchMyProjects } from '../api/projects'
import { fetchMyGroups, fetchMyLedGroups } from '../api/groups'
import type { Group, Project } from '../types/database'
import ErrorAlert from '../components/ErrorAlert'

const inputClass =
  'mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'

function CreateProjectForm({
  ledGroups,
  onCreated,
  onCancel,
}: {
  ledGroups: Group[]
  onCreated: () => void
  onCancel: () => void
}) {
  const { user } = useAuth()
  const [groupId, setGroupId] = useState(ledGroups[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!groupId) {
      setError('그룹을 선택하세요.')
      return
    }
    if (!title.trim()) {
      setError('제목을 입력하세요.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await createProject({
        groupId,
        title: title.trim(),
        description: description.trim() || undefined,
        createdBy: user.id,
      })
      onCreated()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`프로젝트 만들기에 실패했습니다: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold">새 프로젝트</h2>
      <div className="mt-3">
        <label htmlFor="project-group" className="block text-sm font-medium text-gray-700">
          그룹
        </label>
        <select
          id="project-group"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className={inputClass}
        >
          {ledGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3">
        <label htmlFor="project-title" className="block text-sm font-medium text-gray-700">
          제목 <span className="text-red-500">*</span>
        </label>
        <input
          id="project-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="mt-3">
        <label htmlFor="project-description" className="block text-sm font-medium text-gray-700">
          설명
        </label>
        <textarea
          id="project-description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </div>
      {error && (
        <div className="mt-3">
          <ErrorAlert message={error} />
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? '만드는 중…' : '만들기'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          취소
        </button>
      </div>
    </form>
  )
}

export default function ProjectsPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [ledGroups, setLedGroups] = useState<Group[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setError(null)
      const [p, g, lg] = await Promise.all([
        fetchMyProjects(),
        fetchMyGroups(user.id),
        fetchMyLedGroups(user.id),
      ])
      setProjects(p)
      setGroups(g)
      setLedGroups(lg)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`목록을 불러오지 못했습니다: ${msg}`)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  function groupName(id: string) {
    return groups.find((g) => g.id === id)?.name ?? '알 수 없는 그룹'
  }

  const byGroup = new Map<string, Project[]>()
  for (const p of projects ?? []) {
    const list = byGroup.get(p.group_id) ?? []
    list.push(p)
    byGroup.set(p.group_id, list)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">프로젝트 관리</h1>
        {ledGroups.length > 0 && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + 새 프로젝트
          </button>
        )}
      </div>

      {showCreate && (
        <CreateProjectForm
          ledGroups={ledGroups}
          onCreated={() => {
            setShowCreate(false)
            load()
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {error && (
        <div className="mt-4">
          <ErrorAlert message={error} />
        </div>
      )}

      {projects === null && !error && <p className="mt-6 text-gray-500">불러오는 중…</p>}

      {projects !== null && projects.length === 0 && !showCreate && (
        <p className="mt-6 text-gray-500">
          아직 볼 수 있는 프로젝트가 없습니다. 그룹리더라면 위 버튼으로 새 프로젝트를 만들어
          보세요.
        </p>
      )}

      {[...byGroup.entries()].map(([groupId, groupProjects]) => (
        <section key={groupId} className="mt-8 first:mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
            <span className="h-4 w-1 rounded-full bg-brand-600" />
            {groupName(groupId)}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {groupProjects.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-card-hover"
              >
                <h3 className="text-sm leading-snug font-semibold break-keep text-gray-900 group-hover:text-brand-700 sm:text-[15px]">
                  {p.title}
                </h3>
                {p.description && (
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-gray-500">
                    {p.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
