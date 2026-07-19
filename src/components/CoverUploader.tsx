import { useRef, useState } from 'react'
import type { Book } from '../types/database'
import { updateBook } from '../api/books'
import { removeCoverByUrl, uploadCover } from '../api/covers'
import ErrorAlert from './ErrorAlert'

interface CoverUploaderProps {
  book: Book
  onSaved: (book: Book) => void
}

export default function CoverUploader({ book, onSaved }: CoverUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const oldUrl = book.cover_url
      const url = await uploadCover(book.id, file)
      const updated = await updateBook(book.id, { cover_url: url })
      onSaved(updated)
      if (oldUrl) await removeCoverByUrl(oldUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`표지 업로드에 실패했습니다: ${msg}`)
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
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
        {book.cover_url ? (
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
      <p className="mt-1.5 text-xs text-gray-400">jpg·png 등 이미지, 5MB 이하. 권장 비율 3:4</p>
      {error && (
        <div className="mt-2">
          <ErrorAlert message={error} />
        </div>
      )}
    </div>
  )
}
