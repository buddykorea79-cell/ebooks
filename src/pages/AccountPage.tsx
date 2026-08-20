import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { fetchProfile, setMyGroups, updateMyNickname } from '../api/profiles'
import { fetchGroups, fetchMyGroups } from '../api/groups'
import type { Group } from '../types/database'
import { MAX_GROUPS_PER_MEMBER } from '../types/database'
import ErrorAlert from '../components/ErrorAlert'

const inputClass =
  'mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'

export default function AccountPage() {
  const { user, isAdmin, isGroupLeader, refreshProfile } = useAuth()
  const [nickname, setNickname] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [groupIds, setGroupIds] = useState<string[]>([])
  const [groupSearch, setGroupSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nicknameSaving, setNicknameSaving] = useState(false)
  const [nicknameSaved, setNicknameSaved] = useState(false)
  const [groupsSaving, setGroupsSaving] = useState(false)
  const [groupsSaved, setGroupsSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const [profile, allGroups, myGroups] = await Promise.all([
          fetchProfile(user!.id),
          fetchGroups(),
          fetchMyGroups(user!.id),
        ])
        if (cancelled) return
        setNickname(profile?.nickname ?? '')
        setGroups(allGroups)
        setGroupIds(myGroups.map((g) => g.id))
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err)
          setError(`정보를 불러오지 못했습니다: ${msg}`)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  function toggleGroup(id: string) {
    setGroupsSaved(false)
    setGroupIds((prev) => {
      if (prev.includes(id)) return prev.filter((g) => g !== id)
      if (prev.length >= MAX_GROUPS_PER_MEMBER) return prev
      return [...prev, id]
    })
  }

  async function handleNicknameSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!nickname.trim()) {
      setError('닉네임을 입력하세요.')
      return
    }
    setError(null)
    setNicknameSaving(true)
    setNicknameSaved(false)
    try {
      await updateMyNickname(user.id, nickname.trim())
      await refreshProfile()
      setNicknameSaved(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`닉네임 저장에 실패했습니다: ${msg}`)
    } finally {
      setNicknameSaving(false)
    }
  }

  async function handleGroupsSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setGroupsSaving(true)
    setGroupsSaved(false)
    try {
      await setMyGroups(groupIds)
      setGroupsSaved(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`그룹 저장에 실패했습니다: ${msg}`)
    } finally {
      setGroupsSaving(false)
    }
  }

  if (loading) {
    return <p className="text-gray-500">불러오는 중…</p>
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">내 정보</h1>
      <div className="mt-2 flex gap-1.5">
        {isAdmin === true && (
          <span className="inline-block rounded bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-700">
            관리자
          </span>
        )}
        {isGroupLeader && (
          <span className="inline-block rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
            그룹리더
          </span>
        )}
        {isAdmin === false && !isGroupLeader && (
          <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
            회원
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <ErrorAlert message={error} />
        </div>
      )}

      <form
        onSubmit={handleNicknameSubmit}
        className="mt-6 rounded-lg border border-gray-200 bg-white p-4"
      >
        <h2 className="text-lg font-semibold">닉네임</h2>
        <input
          type="text"
          value={nickname}
          maxLength={20}
          onChange={(e) => {
            setNickname(e.target.value)
            setNicknameSaved(false)
          }}
          className={inputClass}
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={nicknameSaving}
            className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {nicknameSaving ? '저장 중…' : '저장'}
          </button>
          {nicknameSaved && <span className="text-sm text-emerald-600">저장했습니다.</span>}
        </div>
      </form>

      <form
        onSubmit={handleGroupsSubmit}
        className="mt-4 rounded-lg border border-gray-200 bg-white p-4"
      >
        <h2 className="text-lg font-semibold">
          그룹 <span className="text-xs font-normal text-gray-400">(최대 {MAX_GROUPS_PER_MEMBER}개)</span>
        </h2>
        {groups.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">아직 만들어진 그룹이 없습니다.</p>
        ) : (
          <>
            <input
              type="text"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              placeholder="그룹명 검색"
              className={inputClass}
            />
            <div className="mt-2 flex flex-col gap-1.5">
              {groups
                .filter((g) => g.name.toLowerCase().includes(groupSearch.trim().toLowerCase()))
                .map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={groupIds.includes(g.id)}
                      onChange={() => toggleGroup(g.id)}
                      disabled={!groupIds.includes(g.id) && groupIds.length >= MAX_GROUPS_PER_MEMBER}
                      className="h-4 w-4"
                    />
                    {g.name}
                  </label>
                ))}
            </div>
          </>
        )}
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={groupsSaving || groups.length === 0}
            className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {groupsSaving ? '저장 중…' : '저장'}
          </button>
          {groupsSaved && <span className="text-sm text-emerald-600">저장했습니다.</span>}
        </div>
      </form>

      {(isGroupLeader || isAdmin === true) && (
        <Link
          to="/groups"
          className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-brand-50"
        >
          <div>
            <h2 className="text-lg font-semibold">그룹 관리</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              내가 만든 그룹을 관리하고 그룹원을 확인·탈퇴시킬 수 있습니다.
            </p>
          </div>
          <span className="text-brand-600">→</span>
        </Link>
      )}
    </div>
  )
}
