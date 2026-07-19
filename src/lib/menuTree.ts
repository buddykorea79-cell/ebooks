import type { BookMenu } from '../types/database'

export interface MenuTreeNode {
  menu: BookMenu
  children: MenuTreeNode[]
}

/** 위치 변경(이동/들여쓰기/내어쓰기) 시 DB에 반영할 행 단위 변경분 */
export interface MenuPositionUpdate {
  id: string
  parent_id: string | null
  sort_order: number
}

/** parent_id가 목록에 없는 항목(비정상 데이터)은 루트로 취급해 유실을 막는다 */
function effectiveParentId(menu: BookMenu, ids: Set<string>): string | null {
  return menu.parent_id && ids.has(menu.parent_id) ? menu.parent_id : null
}

function sortSiblings(a: BookMenu, b: BookMenu): number {
  return a.sort_order - b.sort_order || a.id.localeCompare(b.id)
}

/** 같은 부모를 가진 메뉴들을 sort_order 순으로 반환 */
export function siblingsOf(menus: BookMenu[], parentId: string | null): BookMenu[] {
  const ids = new Set(menus.map((m) => m.id))
  return menus.filter((m) => effectiveParentId(m, ids) === parentId).sort(sortSiblings)
}

/** 평면 목록 → 트리 (parent_id + sort_order 기반) */
export function buildMenuTree(menus: BookMenu[]): MenuTreeNode[] {
  const ids = new Set(menus.map((m) => m.id))
  const byParent = new Map<string | null, BookMenu[]>()
  for (const m of menus) {
    const key = effectiveParentId(m, ids)
    const arr = byParent.get(key)
    if (arr) arr.push(m)
    else byParent.set(key, [m])
  }
  const build = (key: string | null): MenuTreeNode[] =>
    (byParent.get(key) ?? [])
      .slice()
      .sort(sortSiblings)
      .map((m) => ({ menu: m, children: build(m.id) }))
  return build(null)
}

/** 하위(자손) 메뉴 개수 — 삭제 경고에 사용 */
export function countDescendants(menus: BookMenu[], id: string): number {
  let count = 0
  for (const m of menus) {
    if (m.parent_id === id) count += 1 + countDescendants(menus, m.id)
  }
  return count
}

/** 목표 순서(ordered)와 실제 값이 다른 행만 골라 변경분을 만든다 */
function renumberUpdates(ordered: BookMenu[], parentId: string | null): MenuPositionUpdate[] {
  const updates: MenuPositionUpdate[] = []
  ordered.forEach((m, i) => {
    if ((m.parent_id ?? null) !== parentId || m.sort_order !== i) {
      updates.push({ id: m.id, parent_id: parentId, sort_order: i })
    }
  })
  return updates
}

/** 형제 사이에서 위/아래 이동. 불가능하면 빈 배열 */
export function computeMove(
  menus: BookMenu[],
  id: string,
  direction: 'up' | 'down',
): MenuPositionUpdate[] {
  const menu = menus.find((m) => m.id === id)
  if (!menu) return []
  const ids = new Set(menus.map((m) => m.id))
  const parentId = effectiveParentId(menu, ids)
  const sibs = siblingsOf(menus, parentId)
  const idx = sibs.findIndex((m) => m.id === id)
  const target = direction === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || target < 0 || target >= sibs.length) return []
  const arr = sibs.slice()
  ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
  return renumberUpdates(arr, parentId)
}

/** 들여쓰기: 바로 위 형제의 마지막 자식으로 이동. 불가능하면 빈 배열 */
export function computeIndent(menus: BookMenu[], id: string): MenuPositionUpdate[] {
  const menu = menus.find((m) => m.id === id)
  if (!menu) return []
  const ids = new Set(menus.map((m) => m.id))
  const parentId = effectiveParentId(menu, ids)
  const sibs = siblingsOf(menus, parentId)
  const idx = sibs.findIndex((m) => m.id === id)
  if (idx <= 0) return []
  const newParent = sibs[idx - 1]
  const newSibs = [...siblingsOf(menus, newParent.id), menu]
  const remaining = sibs.filter((m) => m.id !== id)
  return [...renumberUpdates(newSibs, newParent.id), ...renumberUpdates(remaining, parentId)]
}

/** 내어쓰기: 부모의 바로 다음 형제로 이동(자손은 함께 따라간다). 불가능하면 빈 배열 */
export function computeOutdent(menus: BookMenu[], id: string): MenuPositionUpdate[] {
  const menu = menus.find((m) => m.id === id)
  if (!menu) return []
  const ids = new Set(menus.map((m) => m.id))
  const parentId = effectiveParentId(menu, ids)
  if (!parentId) return []
  const parent = menus.find((m) => m.id === parentId)
  if (!parent) return []
  const grandId = effectiveParentId(parent, ids)
  const targetSibs = siblingsOf(menus, grandId)
  const pIdx = targetSibs.findIndex((m) => m.id === parent.id)
  const newArr = [...targetSibs.slice(0, pIdx + 1), menu, ...targetSibs.slice(pIdx + 1)]
  const remaining = siblingsOf(menus, parentId).filter((m) => m.id !== id)
  return [...renumberUpdates(newArr, grandId), ...renumberUpdates(remaining, parentId)]
}
