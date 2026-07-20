import { Link } from 'react-router-dom'
import type { Book, BookMenu } from '../types/database'
import { buildMenuTree, type MenuTreeNode } from '../lib/menuTree'
import TypeBadge from './TypeBadge'

interface SidebarProps {
  book: Book
  menus: BookMenu[]
  activeMenuId: string | null
  /** 메뉴 클릭 시 호출 — 모바일 드로어를 닫는 용도 */
  onNavigate?: () => void
}

function TreeItem({
  node,
  depth,
  bookId,
  activeMenuId,
  onNavigate,
}: {
  node: MenuTreeNode
  depth: number
  bookId: string
  activeMenuId: string | null
  onNavigate?: () => void
}) {
  const active = node.menu.id === activeMenuId
  return (
    <li>
      <Link
        to={`/book/${bookId}/${node.menu.id}`}
        onClick={onNavigate}
        className={`block truncate rounded px-3 py-1.5 text-sm ${
          active
            ? 'bg-blue-100 font-semibold text-blue-700'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        style={{ paddingLeft: 12 + depth * 14 }}
      >
        {node.menu.title}
      </Link>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <TreeItem
              key={child.menu.id}
              node={child}
              depth={depth + 1}
              bookId={bookId}
              activeMenuId={activeMenuId}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/** 공개 뷰어 좌측 사이드바 — 메뉴 트리 재귀 렌더 */
export default function Sidebar({ book, menus, activeMenuId, onNavigate }: SidebarProps) {
  const tree = buildMenuTree(menus)
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-100 p-4">
        <Link to="/" className="text-xs text-blue-600 hover:underline">
          ← 홈으로
        </Link>
        <div className="mt-2">
          <TypeBadge type={book.type} />
          {!book.is_published && (
            <span className="ml-1 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
              비공개
            </span>
          )}
        </div>
        <h1 className="mt-1 break-words text-lg font-bold leading-snug">{book.title}</h1>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {tree.length === 0 ? (
          <p className="px-3 py-2 text-sm text-gray-400">메뉴가 없습니다.</p>
        ) : (
          <ul className="space-y-0.5">
            {tree.map((node) => (
              <TreeItem
                key={node.menu.id}
                node={node}
                depth={0}
                bookId={book.id}
                activeMenuId={activeMenuId}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}
      </nav>
    </aside>
  )
}
