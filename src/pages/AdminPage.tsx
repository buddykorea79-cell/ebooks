import { useCallback, useEffect, useState } from 'react'
import type { BookTypeRow, Category } from '../types/database'
import { HOME_LAYOUT_LABELS } from '../types/database'
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
  'rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none'
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
          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          추가
        </button>
      </div>
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

  useEffect(() => {
    fetchSiteSettings()
      .then((s) => setSettings(s))
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
        msg.includes('home_layout') || msg.includes('home_featured_count')
          ? '저장에 실패했습니다. supabase/home-layout.sql을 SQL Editor에서 실행했는지 확인하세요.'
          : msg,
      )
    } finally {
      setBusy(false)
    }
  }

  const layout = settings?.home_layout ?? 'latest'
  const featuredCount = settings?.home_featured_count ?? 8

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
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------

export default function AdminPage() {
  const { isAdmin } = useAuth()

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
        <FeatureSettings />
      </div>
    </div>
  )
}
