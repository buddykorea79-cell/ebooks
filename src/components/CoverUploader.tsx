import { useMemo, useRef, useState } from 'react'
import type { Book } from '../types/database'
import { updateBook } from '../api/books'
import { removeCoverByUrl, sanitizeSvg, svgToDataUri, uploadCover, uploadCoverSvg } from '../api/covers'
import ErrorAlert from './ErrorAlert'

interface CoverUploaderProps {
  book: Book
  onSaved: (book: Book) => void
}

type Mode = 'file' | 'svg'

export default function CoverUploader({ book, onSaved }: CoverUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>('file')
  const [svgCode, setSvgCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 붙여넣은 코드의 미리보기 (정제 후 data URI). 잘못된 코드면 null
  const svgPreview = useMemo(() => {
    if (!svgCode.trim()) return null
    try {
      return svgToDataUri(sanitizeSvg(svgCode))
    } catch {
      return null
    }
  }, [svgCode])

  /** 표지 URL 교체 후 이전 파일 정리 (공통) */
  async function applyCoverUrl(url: string) {
    const oldUrl = book.cover_url
    const updated = await updateBook(book.id, { cover_url: url })
    onSaved(updated)
    if (oldUrl) await removeCoverByUrl(oldUrl)
  }

  async function handleFileChange(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      await applyCoverUrl(await uploadCover(book.id, file))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`표지 업로드에 실패했습니다: ${msg}`)
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleApplySvg() {
    if (!svgCode.trim()) return
    setBusy(true)
    setError(null)
    try {
      await applyCoverUrl(await uploadCoverSvg(book.id, svgCode))
      setSvgCode('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`SVG 표지 적용에 실패했습니다: ${msg}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    if (!book.cover_url) return
    if (!window.confirm('표지 이미지를 제거할까요?')) return
    setBusy(true)
    setError(null)
    try {
      const oldUrl = book.cover_url
      const updated = await updateBook(book.id, { cover_url: null })
      onSaved(updated)
      await removeCoverByUrl(oldUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`표지 제거에 실패했습니다: ${msg}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full shrink-0 lg:w-64">
      <h3 className="text-sm font-medium text-gray-700">표지 이미지</h3>

      <div className="mt-1 overflow-hidden rounded border border-gray-300 bg-gray-50">
        {/* SVG 입력 중에는 붙여넣은 코드를 먼저 보여준다 */}
        {mode === 'svg' && svgPreview ? (
          <img src={svgPreview} alt="SVG 표지 미리보기" className="aspect-[3/4] w-full object-cover" />
        ) : book.cover_url ? (
          <img
            src={book.cover_url}
            alt={`${book.title} 표지`}
            className="aspect-[3/4] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[3/4] w-full items-center justify-center text-sm text-gray-400">
            표지 없음
          </div>
        )}
      </div>

      {/* 입력 방식 전환 */}
      <div className="mt-2 flex gap-1 rounded-lg bg-gray-100 p-1 text-xs">
        {(
          [
            { value: 'file', label: '파일 업로드' },
            { value: 'svg', label: 'SVG 코드' },
          ] as { value: Mode; label: string }[]
        ).map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => {
              setMode(m.value)
              setError(null)
            }}
            className={`flex-1 rounded-md px-2 py-1 font-medium transition ${
              mode === m.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'file' ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0])}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {busy ? '처리 중…' : book.cover_url ? '이미지 변경' : '이미지 선택'}
            </button>
            {book.cover_url && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={busy}
                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                제거
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            jpg·png 등 이미지, 5MB 이하. 권장 비율 3:4
          </p>
        </>
      ) : (
        <>
          <textarea
            rows={6}
            value={svgCode}
            onChange={(e) => setSvgCode(e.target.value)}
            placeholder={'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">\n  …\n</svg>'}
            className="mt-2 w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs focus:border-brand-500 focus:outline-none"
          />
          {svgCode.trim() && !svgPreview && (
            <p className="mt-1 text-xs text-amber-600">
              아직 올바른 SVG가 아닙니다. &lt;svg&gt;로 시작하고 태그가 닫혔는지 확인하세요.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleApplySvg}
              disabled={busy || !svgPreview}
              className="flex-1 rounded bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? '처리 중…' : '표지로 적용'}
            </button>
            {book.cover_url && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={busy}
                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                제거
              </button>
            )}
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            SVG 코드를 그대로 붙여넣으면 미리보기가 표시됩니다. 안전을 위해 스크립트와 외부
            리소스 참조는 제거됩니다. 권장 비율 3:4
          </p>
        </>
      )}

      {error && (
        <div className="mt-2">
          <ErrorAlert message={error} />
        </div>
      )}
    </div>
  )
}
