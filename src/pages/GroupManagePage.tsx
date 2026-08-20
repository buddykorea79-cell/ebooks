import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  createGroup,
  fetchGroupMembers,
  fetchMyLedGroups,
  removeGroupMember,
} from '../api/groups'
import { fetchNicknames } from '../api/profiles'
import type { Group, GroupMember } from '../types/database'
import ErrorAlert from '../components/ErrorAlert'

const inputClass =
  'mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'

function MemberList({ group }: { group: Group }) {
  const [members, setMembers] = useState<GroupMember[] | null>(null)
  const [nicknames, setNicknames] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const rows = await fetchGroupMembers(group.id)
      setMembers(rows)
      setNicknames(await fetchNicknames(rows.map((r) => r.user_id)))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`그룹원 목록을 불러오지 못했습니다: ${msg}`)
    }
  }, [group.id])

  useEffect(() => {
    load()
  }, [load])

  async function handleRemove(member: GroupMember) {
    const name = nicknames[member.user_id] ?? '이 회원'
    if (!window.confirm(`'${name}' 님을 '${group.name}' 그룹에서 탈퇴시킬까요?`)) return
    setBusyId(member.id)
    setError(null)
    try {
      await removeGroupMember(member.id)
      await load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`탈퇴 처리에 실패했습니다: ${msg}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {error && (
        <div className="mb-2">
          <ErrorAlert message={error} />
        </div>
      )}
      {members === null ? (
        <p className="text-sm text-gray-500">불러오는 중…</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-gray-500">아직 그룹원이 없습니다.</p>
      ) : (
        <ul className="space-y-1.5">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{nicknames[m.user_id] ?? m.user_id}</span>
              <button
                onClick={() => handleRemove(m)}
                disabled={busyId !== null}
                className="shrink-0 rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                {busyId === m.id ? '처리 중…' : '탈퇴'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function GroupManagePage() {
  const { user, isAdmin, isGroupLeader } = useAuth()
  const [groups, setGroups] = useState<Group[] | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    try {
      setGroups(await fetchMyLedGroups(user.id))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`그룹 목록을 불러오지 못했습니다: ${msg}`)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!name.trim()) {
      setError('그룹 이름을 입력하세요.')
      return
    }
    setError(null)
    setCreating(true)
    try {
      await createGroup(name.trim(), user.id)
      setName('')
      await load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`그룹 만들기에 실패했습니다: ${msg}`)
    } finally {
      setCreating(false)
    }
  }

  if (isAdmin === null) {
    return <p className="text-gray-500">불러오는 중…</p>
  }

  if (!isGroupLeader && !isAdmin) {
    return (
      <p className="text-gray-500">
        그룹리더에게만 열려 있는 화면입니다. 그룹리더 권한이 필요하면 관리자에게 문의하세요.
      </p>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">그룹 관리</h1>

      <form
        onSubmit={handleCreate}
        className="mt-6 flex items-end gap-2 rounded-lg border border-gray-200 bg-white p-4"
      >
        <div className="flex-1">
          <label htmlFor="group-name" className="block text-sm font-medium text-gray-700">
            + 새 그룹
          </label>
          <input
            id="group-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="그룹 이름"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {creating ? '만드는 중…' : '만들기'}
        </button>
      </form>

      {error && (
        <div className="mt-4">
          <ErrorAlert message={error} />
        </div>
      )}

      {groups === null && !error && <p className="mt-6 text-gray-500">불러오는 중…</p>}

      {groups !== null && groups.length === 0 && (
        <p className="mt-6 text-gray-500">아직 만든 그룹이 없습니다.</p>
      )}

      {groups !== null && groups.length > 0 && (
        <ul className="mt-4 space-y-3">
          {groups.map((g) => (
            <li key={g.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="text-lg font-semibold">{g.name}</h2>
              <MemberList group={g} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
