import { useCallback, useEffect, useRef, useState } from 'react'
import type { Book } from '../types/database'
import { DEFAULT_UPLOAD_MAX_MB, resolveUploadMaxMb } from '../types/database'
import { updateBook } from '../api/books'
import { formatBytes } from '../api/r2'
import {
  formatFromFileName,
  hasSingleContent,
  loadSingleContent,
  uploadBookSingleFile,
} from '../api/single'
import { fetchSiteSettings } from '../api/settings'
import { renderMarkdown, splitMarkdownSections } from '../lib/markdown'
import { buildInjectedCss, openContentPreview } from '../lib/preview'
import ErrorAlert from './ErrorAlert'
import HtmlViewer from './HtmlViewer'

interface SingleContentTabProps {
  book: Book
  onSaved: (book: Book) => void
}

/**
 * 단일 파일 모드: 완성된 HTML/MD 파일 하나를 도서 본문으로 사용.
 *
 * 파일은 PDF와 마찬가지로 Cloudflare R2에 올라가고(브라우저 → R2 직접 전송),
 * DB에는 주소만 저장한다. 미리보기는 그 주소에서 내용을 받아 온다.
 */
export default function SingleContentTab({ book, onSaved }: SingleContentTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [percent, setPercent] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  // PDF와 같은 상한 (관리자 화면에서 함께 관리). 최종 판단은 서버가 한다
  const [maxMb, setMaxMb] = useState(DEFAULT_UPLOAD_MAX_MB)
  // R2에서 받아 온 본문 (미리보기용)
  const [content, setContent] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)

  const isMarkdown = (book.content_format ?? 'html') === 'markdown'
  const uploaded = hasSingleContent(book)
  const sections = content && isMarkdown ? splitMarkdownSections(content) : []

  useEffect(() => {
    fetchSiteSettings()
      .then((s) => setMaxMb(resolveUploadMaxMb(s)))
      .catch(() => {
        // upload-limits.sql 실행 전이면 기본값으로 동작
      })
  }, [])

  const reloadContent = useCallback(async (target: Book) => {
    if (!hasSingleContent(target)) {
      setContent(null)
      return
    }
    setLoadingContent(true)
    try {
      setContent(await loadSingleContent(target))
    } catch (err) {
      setContent(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingContent(false)
    }
  }, [])

  useEffect(() => {
    void reloadContent(book)
  }, [book, reloadContent])

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setSaved(false)

    // PDF를 여기 올리려는 경우가 잦다 — 어디로 가야 하는지 알려 준다
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      setError(
        'PDF는 이 탭에서 올릴 수 없습니다. ' +
          "기본정보 탭에서 구성 방식을 'PDF'로 바꾸고 저장하면 'PDF 파일' 탭이 나타납니다. " +
          '크기 한도는 이 탭과 같습니다.',
      )
      return
    }

    const format = formatFromFileName(file.name)
    if (!format) {
      setError('HTML(.html) 또는 마크다운(.md) 파일만 업로드할 수 있습니다.')
      return
    }
    if (file.size > maxMb * 1024 * 1024) {
      setError(
        `파일이 너무 큽니다 (${formatBytes(file.size)}). 최대 ${maxMb}MB까지 올릴 수 있습니다. 관리자에게 한도 상향을 요청하거나 파일을 나눠 주세요.`,
      )
      return
    }

    setBusy(true)
    setPercent(0)
    try {
      const result = await uploadBookSingleFile(book.id, file, setPercent)
      const updated = await updateBook(book.id, {
        single_url: result.url,
        single_name: result.name,
        single_size: result.size,
        content_format: format,
        // 예전 방식으로 DB에 들어 있던 본문은 비운다 (두 벌이 남지 않도록)
        single_content: null,
      })
      onSaved(updated)
      setSaved(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('single_url') || msg.includes('single_size')) {
        setError(
          '저장에 실패했습니다. supabase/upload-limits.sql을 SQL Editor에서 실행했는지 확인하세요.',
        )
      } else if (msg.includes('single_content') || msg.includes('source_mode')) {
        setError(
          '저장에 실패했습니다. supabase/single-file.sql을 SQL Editor에서 실행했는지 확인하세요.',
        )
      } else {
        setError(`업로드에 실패했습니다: ${msg}`)
      }
    } finally {
      setBusy(false)
      setPercent(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemove() {
    if (!uploaded) return
    if (
      !window.confirm(
        '업로드된 콘텐츠를 연결 해제할까요?\n도서에서는 사라지지만 R2에 올라간 파일 자체는 남습니다.',
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const updated = await updateBook(book.id, {
        single_url: null,
        single_name: null,
        single_size: null,
        single_content: null,
      })
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
        기준으로 목차가 자동 생성됩니다. 파일은{' '}
        <strong className="font-medium text-gray-700">Cloudflare R2</strong>에 저장되며
        브라우저에서 직접 전송됩니다. 현재 한 파일당{' '}
        <strong className="font-medium text-gray-700">최대 {maxMb}MB</strong>까지 올릴 수 있습니다
        (관리자 설정 — PDF 업로드와 같은 한도).
      </p>
      <p className="mt-1.5 text-sm text-gray-500">
        <strong className="font-medium text-gray-700">PDF를 올리시려면</strong> 기본정보 탭에서
        구성 방식을 <strong className="font-medium text-gray-700">PDF</strong>로 바꿔 주세요. 이
        탭이 'PDF 파일' 탭으로 바뀝니다.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm,.xhtml,.md,.markdown,text/html,text/markdown"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? '올리는 중…' : uploaded ? '파일 다시 업로드' : '파일 업로드'}
        </button>
        {book.single_url && (
          <a
            href={book.single_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            원본 파일 열기 ↗
          </a>
        )}
        {content && (
          <button
            type="button"
            onClick={() =>
              setError(
                openContentPreview({
                  title: book.title,
                  content,
                  format: isMarkdown ? 'markdown' : 'html',
                  css: buildInjectedCss(book, isMarkdown ? 'markdown' : 'html'),
                  note: '업로드된 내용',
                }),
              )
            }
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            새 창 미리보기 ↗
          </button>
        )}
        {uploaded && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            연결 해제
          </button>
        )}
        {saved && <span className="text-xs font-medium text-emerald-600">저장되었습니다 ✓</span>}
      </div>

      {busy && (
        <div className="mt-4 max-w-3xl">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-brand-600 transition-[width] duration-150"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            {percent < 100 ? `전송 중 ${percent}%` : '마무리하는 중…'}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-3 max-w-3xl">
          <ErrorAlert message={error} />
        </div>
      )}

      {uploaded && (
        <div className="mt-4 text-sm text-gray-600">
          현재 콘텐츠: <span className="font-medium">{isMarkdown ? '마크다운' : 'HTML'}</span>
          {book.single_name && <> · {book.single_name}</>}
          {typeof book.single_size === 'number' && <> · {formatBytes(book.single_size)}</>}
          {content && <> · {content.length.toLocaleString()}자</>}
          {!book.single_url && (
            <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
              예전 방식(DB 저장) — 다시 업로드하면 R2로 옮겨집니다
            </span>
          )}
        </div>
      )}

      {loadingContent && <p className="mt-4 text-sm text-gray-400">내용을 불러오는 중…</p>}

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
              injectedCss={buildInjectedCss(book, isMarkdown ? 'markdown' : 'html')}
            />
          </div>
        </div>
      )}

      {!uploaded && !busy && (
        <p className="mt-6 text-gray-400">
          아직 업로드된 콘텐츠가 없습니다. 파일을 올리면 미리보기가 표시됩니다.
        </p>
      )}
    </div>
  )
}
