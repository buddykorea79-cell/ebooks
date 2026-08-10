import { uploadToR2, type UploadResult } from './r2'

/** PDF 도서 파일 업로드 — 실제 전송은 lib 공용 경로(api/r2.ts)가 담당한다 */
export type PdfUploadResult = UploadResult

export function uploadBookPdf(
  bookId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<PdfUploadResult> {
  return uploadToR2('pdf', bookId, file, onProgress)
}

export { formatBytes } from './r2'
