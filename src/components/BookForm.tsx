import { useEffect, useState, type FormEvent } from 'react'
import type { Book, BookType, Category, ContentFormat } from '../types/database'
import { useBookTypes } from '../api/bookTypes'
import ErrorAlert from './ErrorAlert'

export interface BookFormValues {
  title: string
  category_id: string | null
  type: BookType
  description: string | null
  content_format: ContentFormat
  is_published: boolean
}

interface BookFormProps {
  categories: Category[]
  /** 없으면 새 도서 만들기 모드 */
  initial?: Book
  submitLabel: string
  onSubmit: (values: BookFormValues) => Promise<void>
  onCancel?: () => void
}

const inputClass =
  'mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'

export default function BookForm({
  categories,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: BookFormProps) {
  const types = useBookTypes()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '')
  const [type, setType] = useState<BookType>(initial?.type ?? '')
  const [contentFormat, setContentFormat] = useState<ContentFormat>(
    initial?.content_format ?? 'html',
  )

  // 새 도서 모드: 유형 목록이 로드되면 첫 번째 유형을 기본값으로
  useEffect(() => {
    if (!type && types.length > 0) setType(types[0].id)
  }, [type, types])
  const [description, setDescription] = useState(initial?.description ?? '')
  const [isPublished, setIsPublished] = useState(initial?.is_published ?? false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('제목을 입력하세요.')
      return
    }
    if (!type) {
      setError('유형을 선택하세요.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        category_id: categoryId || null,
        type,
        description: description.trim() || null,
        content_format: contentFormat,
        is_published: isPublished,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`저장에 실패했습니다: ${msg}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="book-title" className="block text-sm font-medium text-gray-700">
          제목 <span className="text-red-500">*</span>
        </label>
        <input
          id="book-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label htmlFor="book-category" className="block text-sm font-medium text-gray-700">
            분류
          </label>
          <select
            id="book-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={inputClass}
          >
            <option value="">분류 없음</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="book-type" className="block text-sm font-medium text-gray-700">
            유형
          </label>
          <select
            id="book-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputClass}
          >
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-gray-700">본문 형식</legend>
        <div className="mt-1 flex gap-4">
          {(
            [
              { value: 'html', label: 'HTML' },
              { value: 'markdown', label: '마크다운 (MD)' },
            ] as { value: ContentFormat; label: string }[]
          ).map((f) => (
            <label key={f.value} className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="radio"
                name="content-format"
                value={f.value}
                checked={contentFormat === f.value}
                onChange={() => setContentFormat(f.value)}
                className="h-4 w-4"
              />
              {f.label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          메뉴 콘텐츠를 작성·표시할 형식입니다. 이미 작성된 콘텐츠는 변환되지 않으니 도중에
          바꾸면 기존 메뉴가 이상하게 보일 수 있습니다.
        </p>
      </fieldset>

      <div>
        <label htmlFor="book-description" className="block text-sm font-medium text-gray-700">
          설명
        </label>
        <textarea
          id="book-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          className="h-4 w-4"
        />
        공개 (체크하면 홈 목록에 노출되고 누구나 볼 수 있습니다)
      </label>

      {error && <ErrorAlert message={error} />}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? '저장 중…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            취소
          </button>
        )}
      </div>
    </form>
  )
}
