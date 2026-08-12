import type { Book, ContentFormat } from '../types/database'
import { fetchTextFromR2, uploadToR2, type UploadResult } from './r2'

/**
 * 단일 파일 도서(HTML·MD) — PDF와 같은 경로로 Cloudflare R2에 올린다.
 * DB(books)에는 주소·이름·크기만 저장하고 파일 본체는 DB에 넣지 않는다.
 */
export type SingleUploadResult = UploadResult

export function uploadBookSingleFile(
  bookId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<SingleUploadResult> {
  return uploadToR2('single', bookId, file, onProgress)
}

/** 파일 이름으로 본문 형식을 정한다 (허용되지 않는 확장자면 null) */
export function formatFromFileName(name: string): ContentFormat | null {
  if (/\.(md|markdown)$/i.test(name)) return 'markdown'
  if (/\.(html?|xhtml)$/i.test(name)) return 'html'
  return null
}

/**
 * 도서의 단일 파일 본문을 가져온다.
 *
 * 새로 올린 도서는 R2(single_url)에서 받아오고,
 * upload-limits.sql 이전에 DB로 올려 둔 도서는 single_content를 그대로 쓴다.
 * 둘 다 없으면 null (아직 안 올린 도서).
 */
export async function loadSingleContent(book: Book): Promise<string | null> {
  if (book.single_url) return await fetchTextFromR2(book.single_url)
  return book.single_content ?? null
}

/** 이 도서에 올려 둔 단일 파일이 있는지 (R2든 예전 DB 방식이든) */
export function hasSingleContent(book: Book): boolean {
  return Boolean(book.single_url || book.single_content)
}
