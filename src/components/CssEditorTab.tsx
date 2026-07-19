import { useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { css as cssLang } from '@codemirror/lang-css'
import type { Book } from '../types/database'
import { updateBook } from '../api/books'
import ErrorAlert from './ErrorAlert'

interface CssEditorTabProps {
  book: Book
  onSaved: (book: Book) => void
}

export default function CssEditorTab({ book, onSaved }: CssEditorTabProps) {
  const [cssText, setCssText] = useState(book.custom_css ?? '')
  const [applyToContent, setApplyToContent] = useState(book.css_apply_to_content)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const dirty =
    cssText !== (book.custom_css ?? '') || applyToContent !== book.css_apply_to_content

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 3000)
    return () => clearTimeout(t)
  }, [saved])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const updated = await updateBook(book.id, {
        custom_css: cssText.trim() ? cssText : null,
        css_apply_to_content: applyToContent,
      })
      onSaved(updated)
      setSaved(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`저장에 실패했습니다: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-gray-500">
        여기에 입력한 CSS는 공개 뷰어의 셸(사이드바·헤더 등)에 <code>&lt;style&gt;</code>로
        주입됩니다. 아래 체크박스를 켜면 각 메뉴의 HTML 콘텐츠(iframe)에도 함께 주입됩니다.
      </p>

      <div className="mt-3 overflow-hidden rounded border border-gray-300">
        <CodeMirror
          value={cssText}
          height="420px"
          extensions={[cssLang()]}
          onChange={(value) => setCssText(value)}
          placeholder={'/* 예: .sidebar-title { color: #1d4ed8; } */'}
        />
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={applyToContent}
          onChange={(e) => setApplyToContent(e.target.checked)}
          className="h-4 w-4"
        />
        콘텐츠에도 적용 (각 메뉴의 HTML iframe 앞부분에 이 CSS를 주입합니다)
      </label>

      {error && (
        <div className="mt-3">
          <ErrorAlert message={error} />
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        {saved && !dirty && (
          <span className="text-sm font-medium text-emerald-600">저장되었습니다 ✓</span>
        )}
        {dirty && <span className="text-sm font-medium text-amber-600">저장되지 않은 변경</span>}
      </div>
    </div>
  )
}
