import { useEffect, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { html as htmlLang } from '@codemirror/lang-html'
import { markdown as markdownLang } from '@codemirror/lang-markdown'
import type { Book, BookMenu } from '../types/database'
import { updateMenu } from '../api/menus'
import { buildMenuTree, type MenuTreeNode } from '../lib/menuTree'
import { buildInjectedCss, openContentPreview } from '../lib/preview'
import { useAuth } from '../contexts/AuthContext'
import AiAssistPanel from './AiAssistPanel'
import ErrorAlert from './ErrorAlert'

interface ContentEditorTabProps {
  book: Book
  menus: BookMenu[] | null
  /** 저장 후 목록(본문 작성 여부 표시)을 갱신한다 */
  onSaved: () => Promise<void>
  /** 이 탭이 화면에 보이는 중인지 — 단축키를 이때만 받는다 */
  active: boolean
}

/**
 * 본문 작성 전용 화면.
 * 왼쪽에서 꼭지를 고르고 오른쪽에서 쓴다. 목차가 길어져도 왼쪽 목록만
 * 스크롤되므로 편집기가 아래로 밀리지 않는다.
 * 미리보기는 '미리보기' 버튼으로 새 창에서 연다.
 */
export default function ContentEditorTab({
  book,
  menus,
  onSaved,
  active,
}: ContentEditorTabProps) {
  const { aiEnabled } = useAuth()
  const format = (book.content_format ?? 'html') === 'markdown' ? 'markdown' : 'html'
  const isMarkdown = format === 'markdown'
  const formatLabel = isMarkdown ? '마크다운' : 'HTML'

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedMenu = selectedId && menus ? (menus.find((m) => m.id === selectedId) ?? null) : null
  const dirty = selectedMenu ? draft !== (selectedMenu.html_content ?? '') : false

  // 고른 꼭지가 없으면 첫 꼭지를 자동으로 연다
  useEffect(() => {
    if (selectedId !== null || !menus || menus.length === 0) return
    const first = buildMenuTree(menus)[0]?.menu ?? menus[0]
    setSelectedId(first.id)
    setDraft(first.html_content ?? '')
  }, [menus, selectedId])

  // 선택한 꼭지가 다른 탭에서 삭제되면 선택을 푼다
  useEffect(() => {
    if (!menus || selectedId === null) return
    if (!menus.some((m) => m.id === selectedId)) {
      setSelectedId(null)
      setDraft('')
    }
  }, [menus, selectedId])

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 3000)
    return () => clearTimeout(t)
  }, [saved])

  // 저장하지 않은 내용이 있으면 창을 닫을 때 물어본다
  useEffect(() => {
    if (!dirty) return
    function warn(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  async function handleSave() {
    if (!selectedMenu || !dirty) return
    const id = selectedMenu.id
    const content = draft
    setBusy(true)
    setError(null)
    try {
      await updateMenu(id, { html_content: content })
      await onSaved()
      setSaved(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`저장에 실패했습니다: ${msg}`)
    } finally {
      setBusy(false)
    }
  }

  // Ctrl/Cmd+S 저장. 최신 상태를 보도록 ref로 넘긴다
  const saveRef = useRef(handleSave)
  saveRef.current = handleSave
  useEffect(() => {
    if (!active) return
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void saveRef.current()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active])

  function handleSelect(menu: BookMenu) {
    if (menu.id === selectedId) return
    if (
      dirty &&
      !window.confirm('저장하지 않은 변경사항이 있습니다. 버리고 다른 꼭지로 이동할까요?')
    ) {
      return
    }
    setSelectedId(menu.id)
    setDraft(menu.html_content ?? '')
    setSaved(false)
    setError(null)
  }

  function handlePreview() {
    if (!selectedMenu) return
    const message = openContentPreview({
      title: selectedMenu.title,
      content: draft,
      format,
      css: buildInjectedCss(book, format),
      note: dirty ? '저장 전 편집 중인 내용' : '저장된 내용',
    })
    setError(message)
  }

  function renderPicker(nodes: MenuTreeNode[], depth: number): React.ReactNode {
    return nodes.map((node) => {
      const menu = node.menu
      const isSelected = menu.id === selectedId
      const hasContent = (menu.html_content ?? '').trim().length > 0
      return (
        <li key={menu.id}>
          <button
            onClick={() => handleSelect(menu)}
            style={{ paddingLeft: 10 + depth * 14 }}
            className={`flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm transition-colors ${
              isSelected
                ? 'bg-brand-50 font-semibold text-brand-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span
              title={hasContent ? '본문 작성됨' : '비어 있음'}
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                hasContent ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            />
            <span className="truncate">{menu.title}</span>
          </button>
          {node.children.length > 0 && <ul>{renderPicker(node.children, depth + 1)}</ul>}
        </li>
      )
    })
  }

  if (menus === null) {
    return <p className="text-sm text-gray-500">메뉴를 불러오는 중…</p>
  }

  if (menus.length === 0) {
    return (
      <div className="max-w-2xl rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-12 text-center">
        <p className="text-sm text-gray-600">아직 목차가 없어 쓸 곳이 없습니다.</p>
        <p className="mt-1 text-xs text-gray-500">
          <strong className="font-medium text-gray-700">목차 관리</strong> 탭에서 메뉴를 먼저
          만들어 주세요.
        </p>
      </div>
    )
  }

  const tree = buildMenuTree(menus)
  const written = menus.filter((m) => (m.html_content ?? '').trim()).length

  return (
    <div className="grid gap-5 lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* 꼭지 선택 — 길어져도 이 안에서만 스크롤된다 */}
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="flex items-baseline justify-between border-b border-gray-200 px-3 py-2">
            <span className="text-xs font-semibold text-gray-700">목차</span>
            <span className="text-xs text-gray-400">
              {written}/{menus.length} 작성
            </span>
          </div>
          <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto p-1.5">
            {renderPicker(tree, 0)}
          </ul>
        </div>
      </aside>

      <section className="min-w-0">
        {selectedMenu ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-gray-900">
                  {selectedMenu.title}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {formatLabel} · {draft.length.toLocaleString()}자
                  {dirty ? (
                    <span className="ml-1 font-medium text-amber-600">· 저장되지 않음</span>
                  ) : saved ? (
                    <span className="ml-1 font-medium text-emerald-600">· 저장되었습니다 ✓</span>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={handlePreview}
                  className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                >
                  미리보기 ↗
                </button>
                <button
                  onClick={handleSave}
                  disabled={busy || !dirty}
                  title="Ctrl+S"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
                >
                  {busy ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-3">
                <ErrorAlert message={error} />
              </div>
            )}

            {/* 관리자가 허용한 회원에게만 노출. 결과는 초안에만 들어가고 저장은 위 '저장' 버튼이 담당한다 */}
            {aiEnabled && (
              <AiAssistPanel
                book={book}
                sectionTitle={selectedMenu.title}
                format={format}
                content={draft}
                onReplace={(text) => setDraft(text)}
                onAppend={(text) =>
                  setDraft((prev) => (prev.trim() ? `${prev.replace(/\s+$/, '')}\n\n${text}` : text))
                }
                disabled={busy}
              />
            )}

            <div className="mt-4 overflow-hidden rounded-lg border border-gray-300 focus-within:border-brand-400">
              <CodeMirror
                value={draft}
                height="620px"
                extensions={[isMarkdown ? markdownLang() : htmlLang()]}
                onChange={(value) => setDraft(value)}
                placeholder={
                  isMarkdown
                    ? '마크다운(MD) 문서를 작성하거나 붙여넣으세요'
                    : 'Claude 아티팩트 등에서 복사한 HTML을 붙여넣으세요'
                }
              />
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Ctrl+S로 저장할 수 있습니다. '미리보기 ↗'는 지금 편집 중인 내용을 새 창에서
              보여줍니다.
            </p>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-12 text-center text-sm text-gray-500">
            왼쪽 목차에서 쓸 꼭지를 선택하세요.
          </div>
        )}
      </section>
    </div>
  )
}
