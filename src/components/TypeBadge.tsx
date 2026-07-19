import type { BookType } from '../types/database'
import { BOOK_TYPE_LABELS } from '../types/database'

const TYPE_COLORS: Record<BookType, string> = {
  book: 'bg-blue-100 text-blue-700',
  guide: 'bg-green-100 text-green-700',
  manual: 'bg-purple-100 text-purple-700',
}

export default function TypeBadge({ type }: { type: BookType }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${TYPE_COLORS[type]}`}>
      {BOOK_TYPE_LABELS[type]}
    </span>
  )
}
