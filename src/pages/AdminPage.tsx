import { useCallback, useEffect, useState } from 'react'
import type { AiUsageSummary, BookTypeRow, Category, Profile } from '../types/database'
import {
  HOME_LAYOUT_LABELS,
  UPLOAD_MAX_MB_OPTIONS,
  resolveUploadMaxMb,
} from '../types/database'
import { fetchAiUsageSummary, fetchProfiles, setUserAdmin, setUserAiEnabled } from '../api/profiles'
import { useAuth } from '../contexts/AuthContext'
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
} from '../api/categories'
import {
  createBookType,
  deleteBookType,
  fetchBookTypes,
  invalidateBookTypesCache,
  updateBookType,
} from '../api/bookTypes'
import { fetchSiteSettings, updateSiteSettings, type SiteSettingsPatch } from '../api/settings'
import type { HomeLayout, SiteSettings } from '../types/database'
import ErrorAlert from '../components/ErrorAlert'

const inputClass =
  'rounded border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none'
const smallBtn = 'rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100'
const dangerBtn = 'rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50'

function errMsg(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('violates foreign key constraint')) {
    return '이 항목을 사용 중인 도서가 있어 삭제할 수 없습니다.'
  }
  if (msg.includes('row-level security')) {
    return '권한이 없습니다. 관리자 계정인지, admin.sql을 실행했는지 확인하세요.'
  }
  if (msg.includes('set_user_ai_enabled')) {
    return 'AI 사용 권한 변경 기능을 찾을 수 없습니다. supabase/ai-assist.sql을 SQL Editor에서 실행하세요.'
  }
  if (msg.includes('set_user_admin') || msg.includes('Could not find the function')) {
    return '회원 권한 변경 기능을 찾을 수 없습니다. supabase/admin-members.sql을 SQL Editor에서 실행하세요.'
  }
  return msg
}

// ---------------------------------------------------------------
// 분류 관리
// ---------------------------------------------------------------

function CategoryManager() {
  const [items, setItems] = useState<Category[] | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const rows = await fetchCategories()
      setItems(rows)
      setNames(Object.fromEntries(rows.map((r) => [r.id, r.name])))
    } catch (err) {
      setError(`분류를 불러오지 못했습니다: ${errMsg(err)}`)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function run(action: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await action()
      await load()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  function handleAdd() {
    const name = newName.trim()
    if (!name) return
    const maxOrder = Math.max(0, ...(items ?? []).map((i) => i.sort_order))
    run(async () => {
      await createCategory(name, maxOrder + 1)
      setNewName('')
    })
  }

  function handleRename(item: Category) {
    const name = (names[item.id] ?? '').trim()
    if (!name || name === item.name) return
    run(() => updateCategory(item.id, { name }))
  }

  function handleDelete(item: Category) {
    if (!window.confirm(`'${item.name}' 분류를 삭제할까요?\n이 분류의 도서는 '미분류'로 표시됩니다.`))
      return
    run(() => deleteCategory(item.id))
  }

  // 이웃 항목과 sort_order를 맞바꿔 순서 이동
  function handleMove(index: number, dir: -1 | 1) {
    if (!items) return
    const a = items[index]
    const b = items[index + dir]
    if (!a || !b) return
    run(async () => {
      await updateCategory(a.id, { sort_order: b.sort_order })
      await updateCategory(b.id, { sort_order: a.sort_order })
    })
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold">분류 관리</h2>
      <p className="mt-1 text-xs text-gray-500">
        홈 화면의 그룹과 도서 등록 폼의 분류 목록에 사용됩니다.
      </p>
      {error && (
        <div className="mt-3">
          <ErrorAlert message={error} />
        </div>
      )}
      {items === null && !error && <p className="mt-3 text-sm text-gray-500">불러오는 중…</p>}
      {items !== null && (
        <ul className="mt-3 space-y-2">
          {items.map((item, i) => (
            <li key={item.id} className="flex items-center gap-2">
              <input
                value={names[item.id] ?? ''}
                onChange={(e) => setNames((m) => ({ ...m, [item.id]: e.target.value }))}
                className={`${inputClass} min-w-0 flex-1`}
              />
              <button
                onClick={() => handleMove(i, -1)}
                disabled={busy || i === 0}
                className={`${smallBtn} disabled:opacity-40`}
                title="위로"
              >
                ↑
              </button>
              <button
                onClick={() => handleMove(i, 1)}
                disabled={busy || i === items.length - 1}
                className={`${smallBtn} disabled:opacity-40`}
                title="아래로"
              >
                ↓
              </button>
              <button
                onClick={() => handleRename(item)}
                disabled={busy || (names[item.id] ?? '').trim() === item.name}
                className={`${smallBtn} disabled:opacity-40`}
              >
                이름 저장
              </button>
              <button
                onClick={() => handleDelete(item)}
                disabled={busy}
                className={`${dangerBtn} disabled:opacity-40`}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="새 분류 이름"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button
          onClick={handleAdd}
          disabled={busy || !newName.trim()}
          className="rounded bg-brand-600 px-3 py-1 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          추가
        </button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------
// 유형 관리
// ---------------------------------------------------------------

function TypeManager() {
  const [items, setItems] = useState<BookTypeRow[] | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const rows = await fetchBookTypes()
      setItems(rows)
      setNames(Object.fromEntries(rows.map((r) => [r.id, r.name])))
    } catch (err) {
      setError(
        `유형을 불러오지 못했습니다: ${errMsg(err)}\n(book_types 테이블이 없다면 supabase/admin.sql을 먼저 실행하세요)`,
      )
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function run(action: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await action()
      invalidateBookTypesCache()
      await load()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  function handleAdd() {
    const id = newId.trim().toLowerCase()
    const name = newName.trim()
    if (!id || !name) return
    if (!/^[a-z0-9_-]+$/.test(id)) {
      setError('ID는 영문 소문자, 숫자, -, _ 만 사용할 수 있습니다.')
      return
    }
    const maxOrder = Math.max(0, ...(items ?? []).map((i) => i.sort_order))
    run(async () => {
      await createBookType(id, name, maxOrder + 1)
      setNewId('')
      setNewName('')
    })
  }

  function handleRename(item: BookTypeRow) {
    const name = (names[item.id] ?? '').trim()
    if (!name || name === item.name) return
    run(() => updateBookType(item.id, { name }))
  }

  function handleDelete(item: BookTypeRow) {
    if (!window.confirm(`'${item.name}' 유형을 삭제할까요?\n이 유형을 사용 중인 도서가 있으면 삭제할 수 없습니다.`))
      return
    run(() => deleteBookType(item.id))
  }

  function handleMove(index: number, dir: -1 | 1) {
    if (!items) return
    const a = items[index]
    const b = items[index + dir]
    if (!a || !b) return
    run(async () => {
      await updateBookType(a.id, { sort_order: b.sort_order })
      await updateBookType(b.id, { sort_order: a.sort_order })
    })
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold">유형 관리</h2>
      <p className="mt-1 text-xs text-gray-500">
        도서 카드의 배지와 도서 등록 폼의 유형 목록에 사용됩니다. ID는 영문 슬러그입니다.
      </p>
      {error && (
        <div className="mt-3">
          <ErrorAlert message={error} />
        </div>
      )}
      {items === null && !error && <p className="mt-3 text-sm text-gray-500">불러오는 중…</p>}
      {items !== null && (
        <ul className="mt-3 space-y-2">
          {items.map((item, i) => (
            <li key={item.id} className="flex items-center gap-2">
              <code className="w-20 shrink-0 truncate text-xs text-gray-400">{item.id}</code>
              <input
                value={names[item.id] ?? ''}
                onChange={(e) => setNames((m) => ({ ...m, [item.id]: e.target.value }))}
                className={`${inputClass} min-w-0 flex-1`}
              />
              <button
                onClick={() => handleMove(i, -1)}
                disabled={busy || i === 0}
                className={`${smallBtn} disabled:opacity-40`}
                title="위로"
              >
                ↑
              </button>
              <button
                onClick={() => handleMove(i, 1)}
                disabled={busy || i === items.length - 1}
                className={`${smallBtn} disabled:opacity-40`}
                title="아래로"
              >
                ↓
              </button>
              <button
                onClick={() => handleRename(item)}
                disabled={busy || (names[item.id] ?? '').trim() === item.name}
                className={`${smallBtn} disabled:opacity-40`}
              >
                이름 저장
              </button>
              <button
                onClick={() => handleDelete(item)}
                disabled={busy}
                className={`${dangerBtn} disabled:opacity-40`}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-2">
        <input
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          placeholder="ID (영문)"
          className={`${inputClass} w-28`}
        />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="새 유형 이름"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button
          onClick={handleAdd}
          disabled={busy || !newId.trim() || !newName.trim()}
          className="rounded bg-brand-600 px-3 py-1 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          추가
        </button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------
// 회원 관리 (관리자 지정/해제)
// ---------------------------------------------------------------

function MemberManager({ myId }: { myId: string | null }) {
  // 내 권한을 내가 바꾼 경우, 새로고침 없이 헤더·편집 화면에 반영되도록 프로필을 다시 읽는다
  const { refreshProfile } = useAuth()
  const [members, setMembers] = useState<Profile[] | null>(null)
  const [aiUsage, setAiUsage] = useState<Record<string, AiUsageSummary>>({})
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      // 사용량 조회는 ai-assist.sql 실행 전이면 빈 맵을 돌려준다 (fail-soft)
      const [rows, usage] = await Promise.all([fetchProfiles(), fetchAiUsageSummary()])
      setMembers(rows)
      setAiUsage(usage)
    } catch (err) {
      setError(`회원 목록을 불러오지 못했습니다: ${errMsg(err)}`)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleToggle(member: Profile) {
    const makeAdmin = member.is_admin !== true
    const message = makeAdmin
      ? `'${member.nickname}' 님에게 관리자 권한을 부여할까요?\n분류·유형·회원 권한을 모두 변경할 수 있게 됩니다.`
      : `'${member.nickname}' 님의 관리자 권한을 해제할까요?`
    if (!window.confirm(message)) return

    setBusyId(member.id)
    setError(null)
    try {
      await setUserAdmin(member.id, makeAdmin)
      await load()
      if (member.id === myId) await refreshProfile()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleAi(member: Profile) {
    const enable = member.ai_enabled !== true
    const message = enable
      ? `'${member.nickname}' 님에게 AI 작성 도우미 사용을 허용할까요?\n도서 편집 화면에서 AI로 본문을 작성·수정할 수 있게 되며, 사용한 만큼 BizRouter 요금이 발생합니다.`
      : `'${member.nickname}' 님의 AI 작성 도우미 사용을 차단할까요?`
    if (!window.confirm(message)) return

    setBusyId(member.id)
    setError(null)
    try {
      await setUserAiEnabled(member.id, enable)
      await load()
      if (member.id === myId) await refreshProfile()
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusyId(null)
    }
  }

  const keyword = query.trim().toLowerCase()
  const filtered = (members ?? []).filter((m) => m.nickname.toLowerCase().includes(keyword))
  const adminCount = (members ?? []).filter((m) => m.is_admin).length
  const aiCount = (members ?? []).filter((m) => m.ai_enabled).length
  const totalAiCost = Object.values(aiUsage).reduce((sum, u) => sum + u.total_cost, 0)

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold">회원 관리</h2>
      <p className="mt-1 text-xs text-gray-500">
        최초로 가입한 회원이 자동으로 관리자가 됩니다. 여기서 다른 회원에게 관리자 권한을
        부여하거나 해제할 수 있습니다. (본인 권한은 해제할 수 없습니다)
      </p>
      <p className="mt-1 text-xs text-gray-500">
        <strong>AI 허용</strong>을 켜면 그 회원은 도서 편집 화면에서 AI 작성 도우미를 쓸 수
        있습니다. 기본값은 차단이며, 사용한 만큼 BizRouter 요금이 발생하므로 필요한 회원에게만
        열어 주세요.
      </p>

      {error && (
        <div className="mt-3">
          <ErrorAlert message={error} />
        </div>
      )}

      {members === null && !error && <p className="mt-3 text-sm text-gray-500">불러오는 중…</p>}

      {members !== null && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="닉네임 검색"
              className={`${inputClass} min-w-0 flex-1`}
            />
            <span className="text-xs text-gray-400">
              전체 {members.length}명 · 관리자 {adminCount}명 · AI 허용 {aiCount}명
              {totalAiCost > 0 &&
                ` · AI 누적 ₩${totalAiCost.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`}
            </span>
          </div>

          {filtered.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">
              {members.length === 0 ? '가입한 회원이 없습니다.' : '검색 결과가 없습니다.'}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {filtered.map((member) => {
                const isMe = member.id === myId
                const isAdminMember = member.is_admin === true
                const isAiMember = member.ai_enabled === true
                const usage = aiUsage[member.id]
                return (
                  <li key={member.id} className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium">{member.nickname}</span>
                      {isMe && <span className="ml-1 text-xs text-gray-400">(나)</span>}
                      {isAdminMember && (
                        <span className="ml-2 inline-block rounded bg-brand-100 px-1.5 py-0.5 text-xs font-medium text-brand-700">
                          관리자
                        </span>
                      )}
                      {isAiMember && (
                        <span className="ml-1.5 inline-block rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700">
                          AI 허용
                        </span>
                      )}
                      <span className="block text-xs text-gray-400">
                        가입 {member.created_at.slice(0, 10)}
                        {usage &&
                          usage.request_count > 0 &&
                          ` · AI ${usage.request_count}회 · ₩${usage.total_cost.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleAi(member)}
                      disabled={busyId !== null}
                      title="AI 작성 도우미 사용 허용 여부"
                      className={`${
                        isAiMember
                          ? 'rounded border border-violet-300 px-2 py-1 text-xs text-violet-700 hover:bg-violet-50'
                          : smallBtn
                      } shrink-0 disabled:opacity-40`}
                    >
                      {busyId === member.id ? '처리 중…' : isAiMember ? 'AI 차단' : 'AI 허용'}
                    </button>
                    <button
                      onClick={() => handleToggle(member)}
                      disabled={busyId !== null || (isAdminMember && isMe)}
                      title={
                        isAdminMember && isMe ? '자기 자신의 권한은 해제할 수 없습니다' : undefined
                      }
                      className={`${isAdminMember ? dangerBtn : smallBtn} shrink-0 disabled:opacity-40`}
                    >
                      {busyId === member.id
                        ? '처리 중…'
                        : isAdminMember
                          ? '관리자 해제'
                          : '관리자 지정'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------
// 기능 설정 (추천 기능 켜기/끄기 + 홈 목록 구성)
// ---------------------------------------------------------------

const LAYOUT_OPTIONS: { value: HomeLayout; hint: string }[] = [
  { value: 'latest', hint: '새로 등록된 도서가 먼저 보입니다. 신간 위주로 운영할 때.' },
  { value: 'recommended', hint: '추천을 많이 받은 도서가 먼저 보입니다. 인기 도서 위주로 운영할 때.' },
  {
    value: 'both',
    hint: "'추천 도서'를 위에, '최신 도서'를 아래에 나눠 보여줍니다. 둘 다 보여주고 싶을 때.",
  },
]

function FeatureSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // 주소는 타이핑 중간마다 저장할 수 없으니 초안을 따로 들고 있는다
  const [edutalkDraft, setEdutalkDraft] = useState('')

  useEffect(() => {
    fetchSiteSettings()
      .then((s) => {
        setSettings(s)
        setEdutalkDraft(s?.edutalk_url ?? '')
      })
      .catch((err) =>
        setError(
          `설정을 불러오지 못했습니다: ${errMsg(err)}\n(site_settings 테이블이 없다면 supabase/admin.sql을 먼저 실행하세요)`,
        ),
      )
  }, [])

  /** 낙관적 반영 후 실패하면 되돌린다 */
  async function save(patch: SiteSettingsPatch) {
    if (!settings) return
    const prev = settings
    setSettings({ ...settings, ...patch })
    setError(null)
    setBusy(true)
    try {
      await updateSiteSettings(patch)
    } catch (err) {
      setSettings(prev)
      const msg = errMsg(err)
      setError(
        msg.includes('upload_max_mb')
          ? '저장에 실패했습니다. supabase/upload-limits.sql을 SQL Editor에서 실행했는지 확인하세요.'
          : msg.includes('edutalk_url')
            ? '저장에 실패했습니다. supabase/site-settings-extra.sql을 SQL Editor에서 실행했는지 확인하세요.'
            : msg.includes('home_layout') || msg.includes('home_featured_count')
              ? '저장에 실패했습니다. supabase/home-layout.sql을 SQL Editor에서 실행했는지 확인하세요.'
              : msg,
      )
    } finally {
      setBusy(false)
    }
  }

  function saveEdutalkUrl() {
    const url = edutalkDraft.trim()
    if (url && !/^https?:\/\//i.test(url)) {
      setError('EduTalk 주소는 http:// 또는 https:// 로 시작해야 합니다.')
      return
    }
    save({ edutalk_url: url || null })
  }

  const layout = settings?.home_layout ?? 'latest'
  const featuredCount = settings?.home_featured_count ?? 8
  const uploadMaxMb = resolveUploadMaxMb(settings)
  /**
   * 마이그레이션 실행 여부.
   * 조회는 select('*')라 성공하지만 컬럼이 없으면 값이 undefined로 온다.
   * 저장할 때가 되어서야 실패하면 원인을 알기 어려우므로 미리 알려 준다.
   */
  const needsUploadSql = settings !== null && settings.upload_max_mb === undefined
  const needsExtraSql = settings !== null && settings.edutalk_url === undefined

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold">기능 설정</h2>
      {error && (
        <div className="mt-3">
          <ErrorAlert message={error} />
        </div>
      )}
      {settings === null && !error && <p className="mt-3 text-sm text-gray-500">불러오는 중…</p>}

      {settings !== null && (
        <>
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.recommend_enabled}
              disabled={busy}
              onChange={(e) => save({ recommend_enabled: e.target.checked })}
              className="h-4 w-4"
            />
            회원 추천 기능 사용 (홈 도서 카드에 👍 추천 버튼과 추천 수가 표시됩니다)
          </label>

          <div className="mt-5 border-t border-gray-100 pt-4">
            <h3 className="text-sm font-medium text-gray-700">홈 도서 목록 구성</h3>
            <p className="mt-1 text-xs text-gray-500">
              홈의 '전체' 탭에서 공개 도서를 어떤 순서로 보여줄지 선택합니다. 분류 탭을 고르면
              해당 분류의 도서만 같은 순서로 표시됩니다.
            </p>
            <div className="mt-3 space-y-2">
              {LAYOUT_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="home-layout"
                    value={opt.value}
                    checked={layout === opt.value}
                    disabled={busy}
                    onChange={() => save({ home_layout: opt.value })}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>
                    <span className="font-medium">{HOME_LAYOUT_LABELS[opt.value]}</span>
                    <span className="block text-xs text-gray-400">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>

            {layout === 'both' && (
              <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-700">
                추천 도서 섹션에 표시할 개수
                <select
                  value={featuredCount}
                  disabled={busy}
                  onChange={(e) => save({ home_featured_count: Number(e.target.value) })}
                  className={inputClass}
                >
                  {[4, 8, 12, 16].map((n) => (
                    <option key={n} value={n}>
                      {n}개
                    </option>
                  ))}
                </select>
              </label>
            )}

            {layout !== 'latest' && !settings.recommend_enabled && (
              <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                추천 기능이 꺼져 있어 회원이 새로 추천할 수 없습니다. 이미 쌓인 추천 수로만
                정렬되니, 위의 '회원 추천 기능 사용'도 함께 켜는 것이 좋습니다.
              </p>
            )}
          </div>

          {needsExtraSql && (
            <div className="mt-5 rounded border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              <strong className="font-semibold">
                EduTalk 주소 설정이 아직 준비되지 않았습니다.
              </strong>
              <br />
              Supabase SQL Editor에서{' '}
              <code className="rounded bg-amber-100 px-1">supabase/site-settings-extra.sql</code>{' '}
              을 실행한 뒤 이 페이지를 새로고침하세요. 실행 전에는 저장이 실패합니다.
            </div>
          )}

          {needsUploadSql && (
            <div className="mt-5 rounded border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              <strong className="font-semibold">
                업로드 크기 설정이 아직 준비되지 않았습니다.
              </strong>
              <br />
              Supabase SQL Editor에서{' '}
              <code className="rounded bg-amber-100 px-1">supabase/upload-limits.sql</code> 을
              실행한 뒤 이 페이지를 새로고침하세요. 실행 전에는 저장이 실패하고, 업로드는 기본값
              50MB로 동작합니다.
            </div>
          )}

          <div className="mt-5 border-t border-gray-100 pt-4">
            <h3 className="text-sm font-medium text-gray-700">
              파일 업로드 최대 크기 (HTML · MD · PDF 공통)
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              도서에 올리는 <strong className="font-medium text-gray-600">HTML(.html)</strong>,{' '}
              <strong className="font-medium text-gray-600">마크다운(.md)</strong>,{' '}
              <strong className="font-medium text-gray-600">PDF(.pdf)</strong> 파일 하나의 크기
              한도입니다. 세 형식 모두 이 값 하나를 따릅니다. 화면에서 미리 걸러 주고, 서버(PDF)와
              DB 트리거(HTML·MD)가 같은 값으로 다시 확인합니다.
            </p>
            <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-700">
              한 파일당
              <select
                value={uploadMaxMb}
                disabled={busy || needsUploadSql}
                onChange={(e) => save({ upload_max_mb: Number(e.target.value) })}
                className={inputClass}
              >
                {UPLOAD_MAX_MB_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}MB
                  </option>
                ))}
              </select>
              까지
            </label>
            <p className="mt-2 text-xs text-gray-400">
              PDF는 Cloudflare R2로 브라우저에서 직접 전송되므로 서버 용량과 무관합니다. HTML·MD는
              본문 텍스트로 DB에 저장되니, 수십 MB짜리는 저장·열람이 느려질 수 있습니다. 본문
              이미지는 이 설정과 별개로 10MB 고정입니다.
            </p>
          </div>

          <div className="mt-5 border-t border-gray-100 pt-4">
            <h3 className="text-sm font-medium text-gray-700">교육생과 대화하기 (EduTalk)</h3>
            <p className="mt-1 text-xs text-gray-500">
              주소를 넣으면 홈 화면에 <strong className="font-medium">교육생과 대화하기</strong>{' '}
              버튼이 생기고, 누르면 새 창으로 열립니다. 비워 두면 버튼이 표시되지 않습니다.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="url"
                value={edutalkDraft}
                disabled={busy || needsExtraSql}
                onChange={(e) => setEdutalkDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveEdutalkUrl()}
                placeholder="https://edutalk-xxxx.onrender.com"
                className={`${inputClass} min-w-0 flex-1`}
              />
              <button
                onClick={saveEdutalkUrl}
                disabled={busy || needsExtraSql || edutalkDraft.trim() === (settings.edutalk_url ?? '')}
                className="rounded bg-brand-600 px-3 py-1 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
              >
                저장
              </button>
              {settings.edutalk_url && (
                <a
                  href={settings.edutalk_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={smallBtn}
                >
                  열어보기 ↗
                </a>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-400">
              EduTalk는 실시간 통신(Socket.IO) 서버라 이 사이트(Vercel)와 함께 배포할 수 없습니다.
              저장소의 <code className="rounded bg-gray-100 px-1">edutalk/</code> 폴더를 Render 등에
              따로 배포한 뒤 그 주소를 넣으세요.
            </p>
          </div>
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------

export default function AdminPage() {
  const { isAdmin, user } = useAuth()

  if (isAdmin === null) {
    return <p className="mt-6 text-gray-500">권한 확인 중…</p>
  }

  if (!isAdmin) {
    return (
      <div className="mt-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        관리자 전용 페이지입니다. 관리자 권한이 필요하면 supabase/admin.sql의 최초 관리자 지정
        구문을 확인하세요.
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">관리자</h1>
      <div className="mt-4 space-y-4">
        <CategoryManager />
        <TypeManager />
        <MemberManager myId={user?.id ?? null} />
        <FeatureSettings />
      </div>
    </div>
  )
}
