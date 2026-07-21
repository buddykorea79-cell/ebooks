import type { BookType } from '../types/database'
import { useBookTypes } from '../api/bookTypes'

// 유형이 동적으로 늘어날 수 있으므로 목록 순서에 따라 색상을 순환 배정
const PALETTE = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

export default function TypeBadge({ type }: { type: BookType }) {
  const types = useBookTypes()
  const index = types.findIndex((t) => t.id === type)
  const label = index >= 0 ? types[index].name : type
  const color = PALETTE[(index >= 0 ? index : 0) % PALETTE.length]
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}
