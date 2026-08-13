/**
 * pdf.js의 legacy 번들에는 타입 선언이 딸려 오지 않는다(기본 번들에만 있다).
 * 두 번들의 API는 같으므로 기본 번들의 타입을 그대로 빌려 쓴다.
 *
 * legacy를 쓰는 이유는 components/PdfViewer.tsx 주석 참고 — 구형 모바일 브라우저 대응.
 */
declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export * from 'pdfjs-dist'
}
