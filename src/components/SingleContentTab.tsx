import { useRef, useState } from 'react'
import type { Book, ContentFormat } from '../types/database'
import { updateBook } from '../api/books'
import { MARKDOWN_BASE_CSS, renderMarkdown, splitMarkdownSections } from '../lib/markdown'
import ErrorAlert from './ErrorAlert'
import HtmlViewer from './HtmlViewer'

interface SingleContentTabProps {
  book: Book
  onSaved: (book: Book) => void
}

const MAX_SIZE = 5 * 1024 * 1024 // 5MB

/** 단일 파일 모드: 완성된 HTML/MD 파일 하나를 올려 도서 본문으로 사용 */
export default function SingleContentTab({ book, onSaved }: SingleContentTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const content = book.single_content ?? null
  const isMarkdown = (book.content_format ?? 'html') === 'markdown'
  const sections = content && isMarkdown ? splitMarkdownSections(content) : []

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setSaved(false)

    let format: ContentFormat
    if (/\.(md|markdown)$/i.test(file.name)) format = 'markdown'
    else if (/\.(html?|xhtml)$/i.test(file.name)) format = 'html'
    else {
      setError('HTML(.html) 또는 마크다운(.md) 파일만 업로드할 수 있습니다.')
      return
    }
    if (file.size > MAX_SIZE) {
      setError('파일이 너무 큽니다. 5MB 이하 파일만 업로드할 수 있습니다.')
      return
    }

    setBusy(true)
    try {
      const text = await file.text()
      const updated = await updateBook(book.id, {
        single_content: text,
        content_format: format,
      })
      onSaved(updated)
      setSaved(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('single_content') || msg.includes('source_mode')) {
        setError(
          '저장에 실패했습니다. supabase/single-file.sql을 SQL Editor에서 실행했는지 확인하세요.',
        )
      } else {
        setError(`업로드에 실패했습니다: ${msg}`)
      }
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemove() {
    if (!content) return
    if (!window.confirm('업로드된 콘텐츠를 삭제할까요? 되돌릴 수 없습니다.')) return
    setBusy(true)
    setError(null)
    try {
      const updated = await updateBook(book.id, { single_content: null })
      onSaved(updated)
      setSaved(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`삭제에 실패했습니다: ${msg}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <p className="text-sm text-gray-500">
        완성된 <strong>HTML(.html)</strong> 또는 <strong>마크다운(.md)</strong> 파일 하나를
        올리면 그대로 도서 본문이 됩니다. HTML은 메뉴 없이 전체 화면으로, 마크다운은 제목(H1·H2)
        기준으로 목차가 자동 생성됩니다.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm,.xhtml,.md,.markdown"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? '처리 중…' : content ? '파일 다시 업로드' : '파일 업로드'}
        </button>
        {content && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            콘텐츠 삭제
          </button>
        )}
        {saved && <span className="text-xs font-medium text-emerald-600">저장되었습니다 ✓</span>}
      </div>

      {error && (
        <div className="mt-3 max-w-3xl">
          <ErrorAlert message={error} />
        </div>
      )}

      {content && (
        <div className="mt-4 text-sm text-gray-600">
          현재 콘텐츠:{' '}
          <span className="font-medium">{isMarkdown ? '마크다운' : 'HTML'}</span>,{' '}
          {content.length.toLocaleString()}자
        </div>
      )}

      {content && isMarkdown && (
        <div className="mt-4 max-w-3xl rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-700">
            자동 생성될 목차 ({sections.length}개)
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-gray-600">
            {sections.map((s) => (
              <li key={s.id} style={{ paddingLeft: s.parentId ? 16 : 0 }}>
                {s.parentId ? '└ ' : ''}
                {s.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {content && (
        <div className="mt-6">
          <p className="mb-1 text-xs text-gray-500">미리보기</p>
          <div className="max-h-[560px] overflow-y-auto rounded border border-gray-300 bg-white">
            <HtmlViewer
              menuId="single-preview"
              html={isMarkdown ? renderMarkdown(content) : content}
              injectedCss={
                [
                  isMarkdown ? MARKDOWN_BASE_CSS : '',
                  book.css_apply_to_content ? (book.custom_css ?? '') : '',
                ]
                  .filter(Boolean)
                  .join('\n') || null
              }
            />
          </div>
        </div>
      )}

      {!content && (
        <p className="mt-6 text-gray-400">
          아직 업로드된 콘텐츠가 없습니다. 파일을 올리면 미리보기가 표시됩니다.
        </p>
      )}
    </div>
  )
}
