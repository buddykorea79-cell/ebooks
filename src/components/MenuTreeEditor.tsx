import { useCallback, useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { html as htmlLang } from '@codemirror/lang-html'
import type { Book, BookMenu } from '../types/database'
import {
  createMenu,
  deleteMenu,
  fetchMenus,
  updateMenu,
  updateMenuPositions,
} from '../api/menus'
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
import HtmlViewer from './HtmlViewer'

interface MenuTreeEditorProps {
  book: Book
}

const iconBtn =
  'rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent'

export default function MenuTreeEditor({ book }: MenuTreeEditorProps) {
  const bookId = book.id
  const [menus, setMenus] = useState<BookMenu[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [htmlSaved, setHtmlSaved] = useState(false)

  const load = useCallback(async () => {
    const data = await fetchMenus(bookId)
    setMenus(data)
  }, [bookId])

  useEffect(() => {
    load().catch((err) => {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`메뉴를 불러오지 못했습니다: ${msg}`)
    })
  }, [load])

  useEffect(() => {
    if (!htmlSaved) return
    const t = setTimeout(() => setHtmlSaved(false), 3000)
    return () => clearTimeout(t)
  }, [htmlSaved])

  const selectedMenu = selectedId && menus ? (menus.find((m) => m.id === selectedId) ?? null) : null
  const draftDirty = selectedMenu ? draft !== (selectedMenu.html_content ?? '') : false

  /** 공통 실행기: 작업 → 목록 재조회, 에러는 화면에 표시 */
  async function run(op: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await op()
      await load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`작업에 실패했습니다: ${msg}`)
    } finally {
      setBusy(false)
    }
  }

  function handleSelect(menu: BookMenu) {
    if (menu.id === selectedId) return
    if (
      draftDirty &&
      !window.confirm('저장하지 않은 HTML 변경사항이 있습니다. 버리고 다른 메뉴로 이동할까요?')
    ) {
      return
    }
    setSelectedId(menu.id)
    setDraft(menu.html_content ?? '')
    setHtmlSaved(false)
  }

  function handleSaveHtml() {
    if (!selectedMenu) return
    const id = selectedMenu.id
    const content = draft
    run(async () => {
      await updateMenu(id, { html_content: content })
      setHtmlSaved(true)
    })
  }

  function handleAdd(parentId: string | null) {
    if (!menus) return
    const current = menus
    run(async () => {
      const created = await createMenu({
        book_id: bookId,
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
        ? `'${menu.title}'과(와) 하위 메뉴 ${n}개가 모두 삭제됩니다.\n삭제된 메뉴의 HTML 콘텐츠도 되돌릴 수 없습니다. 계속할까요?`
        : `'${menu.title}' 메뉴를 삭제할까요?`
    if (!window.confirm(msg)) return
    if (menu.id === selectedId || (selectedId && isDescendantOf(menus, selectedId, menu.id))) {
      setSelectedId(null)
      setDraft('')
    }
    run(() => deleteMenu(menu.id))
  }

  function renderNodes(nodes: MenuTreeNode[], depth: number): React.ReactNode {
    return nodes.map((node, idx) => {
      const menu = node.menu
      const isRenaming = renamingId === menu.id
      const isSelected = selectedId === menu.id
      return (
        <div key={menu.id}>
          <div
            className={`flex items-center justify-between gap-2 rounded border px-2 py-1.5 ${
              isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
            }`}
            style={{ marginLeft: depth * 24 }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {depth > 0 && <span className="shrink-0 text-gray-300">└</span>}
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
                    className="w-full min-w-0 flex-1 rounded border border-blue-400 px-2 py-0.5 text-sm focus:outline-none"
                  />
                  <button onClick={saveRename} disabled={busy} className={iconBtn}>
                    저장
                  </button>
                  <button onClick={() => setRenamingId(null)} disabled={busy} className={iconBtn}>
                    취소
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleSelect(menu)}
                  title="클릭하면 HTML을 편집합니다"
                  className={`truncate text-left text-sm ${
                    isSelected ? 'font-semibold text-blue-700' : 'text-gray-800'
                  }`}
                >
                  {menu.title}
                </button>
              )}
            </div>
            {!isRenaming && (
              <div className="flex shrink-0 items-center gap-1">
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
                  className="rounded border border-red-300 px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-30"
                >
                  삭제
                </button>
              </div>
            )}
          </div>
          <div className="mt-1 space-y-1">{renderNodes(node.children, depth + 1)}</div>
        </div>
      )
    })
  }

  if (menus === null && !error) {
    return <p className="text-gray-500">메뉴를 불러오는 중…</p>
  }

  const tree = menus ? buildMenuTree(menus) : []

  return (
    <div>
      <div className="flex max-w-3xl items-center justify-between">
        <p className="text-sm text-gray-500">메뉴 이름을 클릭하면 HTML 콘텐츠를 편집할 수 있습니다.</p>
        <button
          onClick={() => handleAdd(null)}
          disabled={busy || menus === null}
          className="shrink-0 rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          + 새 메뉴
        </button>
      </div>

      {error && (
        <div className="mt-3 max-w-3xl">
          <ErrorAlert message={error} />
        </div>
      )}

      {menus !== null && tree.length === 0 && (
        <p className="mt-6 text-gray-500">
          아직 메뉴가 없습니다. '+ 새 메뉴' 버튼으로 첫 메뉴를 만들어 보세요.
        </p>
      )}

      <div className="mt-3 max-w-3xl space-y-1">{renderNodes(tree, 0)}</div>

      {selectedMenu && (
        <div className="mt-8 border-t border-gray-200 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold">
              '{selectedMenu.title}' HTML 편집
            </h3>
            <div className="flex items-center gap-2">
              {htmlSaved && !draftDirty && (
                <span className="text-xs font-medium text-emerald-600">저장되었습니다 ✓</span>
              )}
              {draftDirty && (
                <span className="text-xs font-medium text-amber-600">저장되지 않은 변경</span>
              )}
              <button
                onClick={handleSaveHtml}
                disabled={busy || !draftDirty}
                className="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded border border-gray-300">
              <CodeMirror
                value={draft}
                height="520px"
                extensions={[htmlLang()]}
                onChange={(value) => setDraft(value)}
                placeholder="Claude 아티팩트 등에서 복사한 HTML을 붙여넣으세요"
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-gray-500">미리보기 (마지막 저장 내용)</p>
              <div className="max-h-[520px] overflow-y-auto rounded border border-gray-300 bg-white">
                {selectedMenu.html_content ? (
                  <HtmlViewer
                    menuId={selectedMenu.id}
                    html={selectedMenu.html_content}
                    injectedCss={book.css_apply_to_content ? book.custom_css : null}
                  />
                ) : (
                  <p className="p-4 text-sm text-gray-400">
                    저장된 콘텐츠가 없습니다. HTML을 입력하고 저장하면 여기에 표시됩니다.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** targetId가 ancestorId의 자손인지 (선택된 메뉴의 조상 삭제 시 선택 해제용) */
function isDescendantOf(menus: BookMenu[], targetId: string, ancestorId: string): boolean {
  let current = menus.find((m) => m.id === targetId)
  const visited = new Set<string>()
  while (current?.parent_id) {
    if (current.parent_id === ancestorId) return true
    if (visited.has(current.parent_id)) return false
    visited.add(current.parent_id)
    current = menus.find((m) => m.id === current!.parent_id)
  }
  return false
}
