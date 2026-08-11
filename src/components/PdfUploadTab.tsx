import { useEffect, useRef, useState } from 'react'
import type { Book } from '../types/database'
import { DEFAULT_PDF_MAX_MB } from '../types/database'
import { updateBook } from '../api/books'
import { formatBytes, uploadBookPdf } from '../api/pdf'
import { fetchSiteSettings } from '../api/settings'
import ErrorAlert from './ErrorAlert'

interface PdfUploadTabProps {
  book: Book
  onSaved: (book: Book) => void
}

/**
 * PDF 모드: PDF 한 개를 그대로 도서로 쓴다.
 * 파일은 Cloudflare R2로 직접 올라가고(Vercel 함수는 서명 URL만 발급),
 * DB에는 공개 URL과 파일 정보만 저장한다.
 */
export default function PdfUploadTab({ book, onSaved }: PdfUploadTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [percent, setPercent] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  // 관리자가 정한 상한. 못 읽으면 기본값으로 두고, 최종 판단은 어차피 서버가 한다
  const [maxMb, setMaxMb] = useState(DEFAULT_PDF_MAX_MB)

  useEffect(() => {
    fetchSiteSettings()
      .then((s) => {
        if (typeof s?.pdf_max_mb === 'number' && s.pdf_max_mb > 0) setMaxMb(s.pdf_max_mb)
      })
      .catch(() => {
        // site-settings-extra.sql 실행 전이면 기본값으로 동작
      })
  }, [])

  const pdfUrl = book.pdf_url ?? null

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setSaved(false)

    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      setError('PDF(.pdf) 파일만 올릴 수 있습니다.')
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
      const result = await uploadBookPdf(book.id, file, setPercent)
      const updated = await updateBook(book.id, {
        pdf_url: result.url,
        pdf_name: result.name,
        pdf_size: result.size,
      })
      onSaved(updated)
      setSaved(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('pdf_url') || msg.includes('pdf_name') || msg.includes('pdf_size')) {
        setError(
          '저장에 실패했습니다. supabase/pdf-mode.sql을 SQL Editor에서 실행했는지 확인하세요.',
        )
      } else {
        setError(msg)
      }
    } finally {
      setBusy(false)
      setPercent(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemove() {
    if (!pdfUrl) return
    if (
      !window.confirm(
        'PDF 연결을 해제할까요?\n도서에서는 사라지지만 R2에 올라간 파일 자체는 남습니다.',
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const updated = await updateBook(book.id, { pdf_url: null, pdf_name: null, pdf_size: null })
      onSaved(updated)
      setSaved(false)
    } catch (err) {
      setError(`해제에 실패했습니다: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-base font-semibold text-gray-900">PDF 파일</h2>
      <p className="mt-1 text-sm text-gray-500">
        PDF 한 개를 올리면 그대로 도서가 됩니다. 목차·본문 편집은 없고, 원본 그대로 보여줍니다.
        파일은 <strong className="font-medium text-gray-700">Cloudflare R2</strong>에 저장되며
        브라우저에서 직접 전송되므로 큰 교재도 올릴 수 있습니다. 현재 한 파일당{' '}
        <strong className="font-medium text-gray-700">최대 {maxMb}MB</strong>까지 올릴 수 있습니다
        (관리자 설정).
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? '올리는 중…' : pdfUrl ? 'PDF 다시 올리기' : 'PDF 올리기'}
        </button>
        {pdfUrl && (
          <>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              새 창에서 열기 ↗
            </a>
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              연결 해제
            </button>
          </>
        )}
        {saved && <span className="text-xs font-medium text-emerald-600">저장되었습니다 ✓</span>}
      </div>

      {busy && (
        <div className="mt-4">
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
        <div className="mt-4">
          <ErrorAlert message={error} />
        </div>
      )}

      {pdfUrl ? (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden="true">
              📄
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {book.pdf_name ?? 'document.pdf'}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {book.pdf_size ? formatBytes(book.pdf_size) : '크기 정보 없음'}
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded border border-gray-200">
            <iframe
              src={pdfUrl}
              title="PDF 미리보기"
              className="block h-[520px] w-full border-0 bg-gray-50"
            />
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-12 text-center">
          <p className="text-sm text-gray-600">아직 올린 PDF가 없습니다.</p>
          <p className="mt-1 text-xs text-gray-500">
            'PDF 올리기'로 파일을 선택하면 여기에 미리보기가 표시됩니다.
          </p>
        </div>
      )}
    </div>
  )
}
