import { useState } from 'react'
import type { Book, BookMenu } from '../types/database'
import { createMenu, deleteMenu, updateMenu, updateMenuPositions } from '../api/menus'
import {
  buildMenuTree,
  computeIndent,
  computeMove,
  computeOutdent,
  countDescendants,
  siblingsOf,
  type MenuTreeNode,
} from '../lib/menuTree'
import ErrorAlert from './ErrorAlert'

interface MenuTreeEditorProps {
  book: Book
  /** 목록은 편집 페이지가 소유한다 (콘텐츠 작성 탭과 같은 데이터를 본다) */
  menus: BookMenu[] | null
  /** 트리를 바꾼 뒤 목록을 다시 읽는다 */
  onChanged: () => Promise<void>
}

const iconBtn =
  'rounded-md px-1.5 py-1 text-xs leading-none text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-default disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-gray-400'

/**
 * 메뉴(목차) 트리 관리 — 추가·이름 변경·순서 이동·들여쓰기·삭제.
 * 본문 작성은 '콘텐츠 작성' 탭이 담당한다. 목차가 길어져도 편집기를
 * 아래로 밀어내지 않도록 화면을 나눠 두었다.
 */
export default function MenuTreeEditor({ book, menus, onChanged }: MenuTreeEditorProps) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  /** 공통 실행기: 작업 → 목록 재조회, 에러는 화면에 표시 */
  async function run(op: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await op()
      await onChanged()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`작업에 실패했습니다: ${msg}`)
    } finally {
      setBusy(false)
    }
  }

  function handleAdd(parentId: string | null) {
    if (!menus) return
    const current = menus
    run(async () => {
      const created = await createMenu({
        book_id: book.id,
        parent_id: parentId,
        title: '새 메뉴',
        sort_order: siblingsOf(current, parentId).length,
      })
      // 만들자마자 이름을 바꿀 수 있게 바로 편집 모드로
      setRenamingId(created.id)
      setRenameValue(created.title)
    })
  }

  function startRename(menu: BookMenu) {
    setRenamingId(menu.id)
    setRenameValue(menu.title)
  }

  function saveRename() {
    if (!renamingId) return
    const title = renameValue.trim()
    if (!title) {
      setError('메뉴 이름을 입력하세요.')
      return
    }
    const id = renamingId
    run(async () => {
      await updateMenu(id, { title })
      setRenamingId(null)
    })
  }

  function handleMove(id: string, direction: 'up' | 'down') {
    if (!menus) return
    const updates = computeMove(menus, id, direction)
    if (updates.length === 0) return
    run(() => updateMenuPositions(updates))
  }

  function handleIndent(id: string) {
    if (!menus) return
    const updates = computeIndent(menus, id)
    if (updates.length === 0) return
    run(() => updateMenuPositions(updates))
  }

  function handleOutdent(id: string) {
    if (!menus) return
    const updates = computeOutdent(menus, id)
    if (updates.length === 0) return
    run(() => updateMenuPositions(updates))
  }

  function handleDelete(menu: BookMenu) {
    if (!menus) return
    const n = countDescendants(menus, menu.id)
    const msg =
      n > 0
        ? `'${menu.title}'과(와) 하위 메뉴 ${n}개가 모두 삭제됩니다.\n작성한 본문도 함께 사라지며 되돌릴 수 없습니다. 계속할까요?`
        : `'${menu.title}' 메뉴를 삭제할까요?\n작성한 본문도 함께 사라집니다.`
    if (!window.confirm(msg)) return
    run(() => deleteMenu(menu.id))
  }

  function renderNodes(nodes: MenuTreeNode[], depth: number): React.ReactNode {
    return nodes.map((node, idx) => {
      const menu = node.menu
      const isRenaming = renamingId === menu.id
      const hasContent = (menu.html_content ?? '').trim().length > 0
      return (
        <li key={menu.id}>
          <div
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2 transition-colors hover:border-gray-300"
            style={{ marginLeft: depth * 20 }}
          >
            {isRenaming ? (
              <div className="flex flex-1 items-center gap-1.5">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveRename()
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  className="w-full min-w-0 flex-1 rounded-md border border-blue-400 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <button
                  onClick={saveRename}
                  disabled={busy}
                  className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  저장
                </button>
                <button
                  onClick={() => setRenamingId(null)}
                  disabled={busy}
                  className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100"
                >
                  취소
                </button>
              </div>
            ) : (
              <>
                <span
                  title={hasContent ? '본문이 작성되어 있습니다' : '본문이 비어 있습니다'}
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    hasContent ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                />
                <button
                  onClick={() => startRename(menu)}
                  title="클릭하면 이름을 바꿉니다"
                  className="min-w-0 flex-1 truncate text-left text-sm text-gray-800 hover:text-blue-700"
                >
                  {menu.title}
                </button>
                <div className="flex shrink-0 items-center">
                  <button
                    onClick={() => handleMove(menu.id, 'up')}
                    disabled={busy || idx === 0}
                    title="위로 이동"
                    aria-label="위로 이동"
                    className={iconBtn}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMove(menu.id, 'down')}
                    disabled={busy || idx === nodes.length - 1}
                    title="아래로 이동"
                    aria-label="아래로 이동"
                    className={iconBtn}
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleOutdent(menu.id)}
                    disabled={busy || depth === 0}
                    title="내어쓰기 (한 단계 위로)"
                    aria-label="내어쓰기"
                    className={iconBtn}
                  >
                    ←
                  </button>
                  <button
                    onClick={() => handleIndent(menu.id)}
                    disabled={busy || idx === 0}
                    title="들여쓰기 (위 메뉴의 하위로)"
                    aria-label="들여쓰기"
                    className={iconBtn}
                  >
                    →
                  </button>
                  <span className="mx-1 h-4 w-px bg-gray-200" />
                  <button
                    onClick={() => startRename(menu)}
                    disabled={busy}
                    title="이름 변경"
                    className={iconBtn}
                  >
                    이름
                  </button>
                  <button
                    onClick={() => handleAdd(menu.id)}
                    disabled={busy}
                    title="하위 메뉴 추가"
                    className={iconBtn}
                  >
                    +하위
                  </button>
                  <button
                    onClick={() => handleDelete(menu)}
                    disabled={busy}
                    title="삭제"
                    aria-label="삭제"
                    className="rounded-md px-1.5 py-1 text-xs leading-none text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-25"
                  >
                    삭제
                  </button>
                </div>
              </>
            )}
          </div>
          {node.children.length > 0 && (
            <ul className="mt-1.5 space-y-1.5">{renderNodes(node.children, depth + 1)}</ul>
          )}
        </li>
      )
    })
  }

  if (menus === null && !error) {
    return <p className="text-sm text-gray-500">메뉴를 불러오는 중…</p>
  }

  const tree = menus ? buildMenuTree(menus) : []
  const total = menus?.length ?? 0
  const written = menus?.filter((m) => (m.html_content ?? '').trim()).length ?? 0

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">목차 구성</h2>
          <p className="mt-1 text-sm text-gray-500">
            메뉴를 추가하고 순서·단계를 정합니다. 본문은{' '}
            <strong className="font-medium text-gray-700">콘텐츠 작성</strong> 탭에서 씁니다.
          </p>
        </div>
        <button
          onClick={() => handleAdd(null)}
          disabled={busy || menus === null}
          className="shrink-0 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          + 새 메뉴
        </button>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorAlert message={error} />
        </div>
      )}

      {total > 0 && (
        <div className="mt-4 flex items-center gap-3 text-xs text-gray-500">
          <span>메뉴 {total}개</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            본문 작성됨 {written}개
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
            비어 있음 {total - written}개
          </span>
        </div>
      )}

      {menus !== null && tree.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center">
          <p className="text-sm text-gray-600">아직 메뉴가 없습니다.</p>
          <p className="mt-1 text-xs text-gray-500">
            '+ 새 메뉴'로 첫 목차를 만들면 콘텐츠 작성 탭에서 본문을 쓸 수 있습니다.
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-1.5">{renderNodes(tree, 0)}</ul>
      )}
    </div>
  )
}
