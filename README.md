# 📚 LibroSpace (ebooks)

**도서·매뉴얼·가이드·지침을 한 곳에서 관리하고 공개하는 문서 플랫폼**입니다.

조직이나 개인이 만드는 문서는 형태가 제각각입니다. 챕터를 나눠 오래 쓰는 책이 있는가 하면,
생성 AI가 한 번에 만들어 준 HTML 한 장이나 마크다운 파일 하나로 끝나는 문서도 있습니다.
LibroSpace는 이 문서들을 **같은 서재에 나란히 올려두고**, 각 문서에 맞는 방식으로 작성·표시합니다.
문서 종류(도서·매뉴얼·가이드·지침 등)와 주제 분류는 관리자가 자유롭게 정의합니다.

- **라이브 서비스**: https://librospace-three.vercel.app
- **저장소**: https://github.com/buddykorea79-cell/ebooks

---

## 1. 기술 스택

| 구분 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | React 18 + TypeScript | 함수형 컴포넌트, hooks |
| 빌드 | Vite 6 | `@vitejs/plugin-react` |
| 스타일 | Tailwind CSS v4 | `@tailwindcss/vite` 플러그인 방식 (설정 파일 없음) |
| 라우팅 | react-router-dom 6 | **HashRouter** (정적 호스팅에서 새로고침 404 방지) |
| 백엔드 | Supabase | Auth(이메일)·Postgres(RLS)·Storage(표지 이미지) |
| 코드 에디터 | CodeMirror (`@uiw/react-codemirror`) | HTML/마크다운/CSS 편집, 지연 로딩 청크 |
| 마크다운 | marked | 마크다운 도서 본문 → HTML 변환 (GFM) |
| 배포 | Vercel | Git 연동 자동 배포, base `/` |

### 실행 방법

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build → dist/
npm run preview
```

`.env`에 Supabase 연결 정보가 필요합니다 (없으면 앱이 설정 안내 화면을 표시):

```
VITE_SUPABASE_URL=https://<프로젝트>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

AI 작성 도우미(2-7)를 쓰려면 BizRouter 키를 추가합니다. **`VITE_` 접두사를 붙이면 안 됩니다** —
붙이면 브라우저 번들에 키가 그대로 노출됩니다.

```
BIZROUTER_API_KEY=sk-br-v1-...
```

---

## 2. 주요 기능

### 2-1. 문서를 나누는 두 축 — 유형과 분류

문서는 **유형**과 **분류**라는 독립적인 두 축으로 정리됩니다. "업무 분류의 매뉴얼",
"프로그래밍 분류의 가이드"처럼 조합되며, 둘 다 관리자가 화면에서 직접 추가·수정·삭제합니다.

| 축 | 뜻 | 기본값 | 어디에 쓰이나 |
|----|----|--------|---------------|
| **유형**(`book_types`) | 문서의 성격 (필수) | 도서, 가이드, 매뉴얼 | 카드 하단 배지. **지침·규정·FAQ** 등 필요한 만큼 추가 |
| **분류**(`categories`) | 문서의 주제 (선택) | 프로그래밍, 디자인, 업무 매뉴얼, 일반 | 홈 상단 필터 탭. 비우면 '미분류' |

즉 도서·매뉴얼·가이드·지침을 따로 만들 필요 없이, **한 서재에서 유형만 달리해 함께 관리**합니다.

### 2-2. 콘텐츠 작성 방식 — 4가지 조합 ⭐

문서마다 만들어지는 방식이 다르므로, **구성 방식**(메뉴를 직접 구성 / 파일 하나 업로드)과
**본문 형식**(HTML / 마크다운)을 조합해 네 가지로 작성할 수 있습니다.
구성 방식은 도서 만들 때 또는 기본정보 탭에서 언제든 바꿀 수 있습니다.

| | 구성 방식 | 본문 형식 | 이런 문서에 |
|---|-----------|-----------|-------------|
| **①** | 메뉴 구성 | HTML | 챕터를 나눠 오래 쓰는 책·매뉴얼. 챕터마다 AI 아티팩트를 붙여넣기 |
| **②** | 메뉴 구성 | 마크다운 | 챕터별로 가볍게 쓰는 가이드·지침. 태그 없이 글에 집중 |
| **③** | 단일 파일 | HTML | **생성 AI가 만들어 준 완성된 HTML 한 장을 그대로** 올리기 |
| **④** | 단일 파일 | 마크다운 | 이미 써둔 `.md` 문서 하나를 그대로 올리기 |

#### ① 메뉴 구성 + HTML

메뉴 관리 탭에서 목차 트리를 만들고(추가·이름변경·삭제·순서 이동·들여쓰기/내어쓰기),
메뉴를 클릭해 CodeMirror로 HTML을 작성합니다. 저장하면 오른쪽에 바로 미리보기가 뜹니다.
Claude 등 AI가 만든 **아티팩트 HTML을 `<!doctype html>`부터 통째로** 붙여넣어도 되고,
스크립트·스타일이 든 인터랙티브 콘텐츠도 격리된 iframe에서 그대로 동작합니다.

#### ② 메뉴 구성 + 마크다운

①과 목차 구성은 같고, 편집기가 마크다운 문법 강조로 바뀝니다. 저장한 내용은 뷰어에서
`marked`(GFM — 표·코드블록·취소선 지원)로 변환되고, 읽기 좋은 기본 문서 스타일이 입혀집니다.

#### ③ 단일 파일 + HTML — 완성된 AI 산출물 그대로

파일 업로드 탭에서 `.html` 파일 하나를 올리면 그것이 곧 문서 전체가 됩니다.
목차를 만들 필요가 없으므로 **뷰어도 좌측 메뉴 없이 전체 폭**으로 표시합니다.
디자인까지 완성된 한 장짜리 산출물을 손대지 않고 그대로 공개할 때 적합합니다.

#### ④ 단일 파일 + 마크다운 — 목차 자동 생성

`.md` 파일 하나를 올리면 **H1·H2 제목을 기준으로 좌측 목차가 자동으로 만들어집니다**
(H1이 상위, H2가 하위 메뉴. H3 이하는 본문에 포함). 업로드 화면에서 생성될 목차를
미리 확인할 수 있고, 코드 블록 안의 `#`은 제목으로 오인하지 않습니다.
첫 제목 앞의 도입부는 '들어가며' 섹션이 됩니다.

> - 단일 파일 모드의 본문 형식은 **업로드한 확장자로 자동 판별**되므로 따로 고르지 않습니다.
>   다른 형식의 파일을 다시 올리면 형식도 함께 바뀝니다.
> - 구성 방식을 바꿔도 **기존 메뉴와 업로드한 파일은 각각 그대로 보관**됩니다
>   (`book_menus`와 `books.single_content`가 별개). 언제든 되돌릴 수 있습니다.

### 2-3. 도서 편집 (`/book/:id/edit`)

탭으로 구성되며, 구성 방식(2-2)에 따라 탭 구성이 달라집니다.

| 구성 방식 | 탭 |
|-----------|-----|
| 메뉴 구성 (①②) | 기본정보 · **목차 관리** · **콘텐츠 작성** · CSS |
| 단일 파일 (③④) | 기본정보 · 파일 업로드 · CSS |
| PDF | 기본정보 · **PDF 파일** · CSS |

- **기본정보** — 제목·분류·유형·설명·공개 여부, 구성 방식(2-2), 표지 이미지.
  표지는 **이미지 파일 업로드**와 **SVG 코드 직접 붙여넣기** 두 가지를 지원하며,
  SVG는 붙여넣는 즉시 미리보기가 보입니다.
- **목차 관리** — 메뉴 추가·이름 변경·순서 이동·들여쓰기·삭제만 합니다.
  각 메뉴 앞의 점으로 본문 작성 여부(초록=작성됨, 회색=비어 있음)를 알 수 있습니다.
- **콘텐츠 작성** — 본문 쓰기 전용. 왼쪽에서 꼭지를 고르고 오른쪽에서 씁니다.
  **목차가 길어져도 왼쪽 목록만 스크롤**되므로 편집기가 아래로 밀리지 않습니다.
  `Ctrl+S`로 저장하고, **미리보기 ↗** 버튼으로 지금 쓰고 있는 내용을 새 창에서 봅니다.
  저장하지 않은 채 창을 닫으려 하면 브라우저가 확인을 묻습니다.
  **이미지**는 `🖼 이미지` 버튼, 편집기에 **붙여넣기(Ctrl+V)**, **끌어다 놓기** 셋 다 됩니다 —
  Cloudflare R2에 올라가고 커서 위치에 태그가 들어갑니다(2-8).
- **파일 업로드** — 단일 파일 모드 전용(2-2의 ③④).
- **PDF 파일** — PDF 모드 전용. 파일은 Cloudflare R2로 직접 올라갑니다(2-8).
- **CSS** — 문서 전용 스타일. 뷰어 화면(사이드바·제목 영역)에 적용되고,
  "콘텐츠에도 적용"을 켜면 본문에도 함께 적용됩니다.

### 2-4. 뷰어 (`/book/:id`)

구성 방식에 따라 화면이 달라집니다.

| 문서 | 화면 |
|------|------|
| 메뉴 구성 (①②) | 좌측 목차 + 본문 (모바일은 ☰ 드로어) |
| 단일 HTML (③) | **좌측 메뉴 없음** — 상단 바 + 전체 폭 |
| 단일 마크다운 (④) | 자동 생성된 좌측 목차 + 본문 |

본문은 항상 `sandbox` iframe 안에서 렌더링되고 높이는 내용에 맞춰 자동 조절됩니다.

### 2-5. 찾아보기

- **홈**(`/`) — 공개 문서를 하나의 목록으로 표시합니다. 상단 **분류 필터 탭**으로 주제를 좁힐 수
  있고, 카드에는 세로(3:4) 표지, 제목(길어도 줄바꿈되어 전부 표시), 작성자, 설명,
  하단에 **유형 배지**가 놓입니다. 목록 순서는 관리자가 정합니다(2-6).
- **검색**(`/search`) — 헤더 검색창(모바일은 🔍)으로 어느 페이지에서나 진입합니다.
  제목·설명뿐 아니라 **본문 내용까지** 검색해, 찾은 대목의 앞뒤 문맥을 하이라이트로 보여주고
  클릭하면 해당 메뉴로 바로 이동합니다.
- **추천** — 관리자가 켜두면 로그인 회원이 문서당 한 번 👍 추천할 수 있고, 추천 수는 누구나 봅니다.

### 2-6. 회원과 관리자

- **회원** — 이메일 가입(닉네임 필수)·로그인·비밀번호 재설정. 내 서재(`/my`)에서 문서를
  만들고 지우며, 공개 여부를 직접 정합니다. 비공개 문서는 홈·검색에 나타나지 않습니다.
- **관리자**(`/admin`) — **최초로 가입한 회원이 자동으로 관리자**가 되고, 이후에는 관리자가
  다른 회원에게 권한을 넘겨줄 수 있습니다.

| 관리 항목 | 할 수 있는 것 |
|-----------|---------------|
| 분류 | 추가 · 이름 변경 · 순서 이동 · 삭제 |
| 유형 | 추가 · 이름 변경 · 순서 이동 · 삭제 (지침 등 자유롭게) |
| 회원 | 닉네임 검색, 관리자 지정/해제 (본인 해제는 불가 — 잠김 방지) |
| AI 사용 권한 | 회원별로 AI 작성 도우미 허용 / 차단 + 회원별 사용 횟수·누적 요금 확인 |
| 추천 기능 | 켜기 / 끄기 |
| 홈 목록 구성 | 최신순 / 추천순 / '추천 도서 + 최신 도서' 2단 (2단일 때 추천 개수 지정) |

- **Docs**(`/docs`) — 이용자를 위한 사용법 안내 페이지

### 2-7. AI 작성 도우미 ✨

메뉴 구성(2-2의 ①②) 문서를 편집할 때, 본문 편집기 위에 AI 패널이 열립니다.
**관리자가 허용한 회원에게만 보입니다.**

작업은 여섯 가지입니다.

| 작업 | 하는 일 | 필요한 것 |
|------|---------|-----------|
| 새로 작성 | 지시문만 보고 이 꼭지의 본문을 처음부터 씀 | 지시문 |
| 이어서 쓰기 | 지금 본문 뒤에 이어질 내용을 씀 | 본문 |
| 다듬기 | 내용은 두고 문장과 흐름만 개선 | 본문 |
| 자세히 | 설명·예시를 보태 확장 | 본문 |
| 요약 | 핵심만 남기고 줄임 | 본문 |
| 직접 지시 | 원하는 작업을 적으면 그대로 수행 | 본문 + 지시문 |

**결과는 곧바로 저장되지 않습니다.** 생성된 내용은 원본/미리보기로 확인한 뒤

- **반영 (본문 교체)** — 편집기 본문을 결과로 바꿉니다
- **본문 끝에 이어붙이기** — 기존 본문 뒤에 덧붙입니다

를 누르면 **편집기 초안에만** 들어갑니다. 최종 반영은 기존과 똑같이 **'저장'** 버튼이 합니다.
그래서 저장 전이라면 언제든 되돌릴 수 있습니다.

문서 형식(HTML/마크다운)에 맞는 결과가 나오도록 서버가 출력 규칙을 지정하며,
결과가 코드펜스로 감싸여 오면 벗겨서 돌려줍니다.

#### 동작 구조 — 키는 서버에만

이 앱은 클라이언트 SPA라서 API 키를 브라우저에 두면 누구나 꺼내 쓸 수 있습니다.
그래서 호출은 반드시 서버를 거칩니다.

```
브라우저  ──POST /api/ai (Supabase 액세스 토큰)──▶  서버 프록시
                                                    ├ 토큰 검증 (로그인 확인)
                                                    ├ profiles.ai_enabled 확인 (권한)
                                                    ├ BizRouter 호출 (여기서만 API 키 사용)
                                                    └ ai_usage에 사용량 기록
```

| 파일 | 역할 |
|------|------|
| `api/ai.ts` | 인증·권한 검사, 프롬프트 구성, BizRouter 호출, 오류 한국어 변환, 사용량 기록 + 맨 아래 Vercel 함수 진입점(default export) |
| `vite.config.ts` | `npm run dev`용 `/api/ai` 미들웨어 (로컬) — 같은 파일의 `runAi`를 호출 |

`ai_enabled` 확인을 **서버에서** 하므로, 화면을 우회해 `/api/ai`를 직접 호출해도 막힙니다.

> ⚠️ `api/` 안의 파일에는 **상대 경로 import를 두면 안 됩니다.** `package.json`이
> `"type": "module"`이라 Vercel에서 ESM으로 실행되는데, Node ESM은 확장자 없는 상대 import를
> 해석하지 못해 모듈 로드 단계에서 `FUNCTION_INVOCATION_FAILED`로 죽습니다.
> (그래서 로직과 함수 진입점을 `api/ai.ts` 한 파일에 합쳐 두었습니다)

| 항목 | 값 |
|------|-----|
| 엔드포인트 | `POST https://api.bizrouter.ai/v1/chat/completions` (OpenAI 호환) |
| 모델 | `openai/gpt-5.6-luna` (`BIZROUTER_MODEL`로 교체 가능) |
| 문서 | https://bizrouter.ai/docs |
| 요금 | 응답의 `usage.cost`(원화)를 그대로 `ai_usage`에 적재 → 관리자 화면에 표시 |

> **Vercel 환경변수**: 프로젝트 Settings → Environment Variables에 `BIZROUTER_API_KEY`를
> 추가하고 재배포해야 운영에서 동작합니다. 함수 최대 실행 시간은 `vercel.json`에서 60초로
> 잡아 두었습니다.

### 2-8. 파일이 저장되는 곳

무엇을 올리느냐에 따라 저장소가 다릅니다.

| 올리는 것 | 저장소 | 무료 한도 | 이유 |
|-----------|--------|-----------|------|
| 도서 본문(HTML·MD) | **Postgres** `book_menus.html_content`, `books.single_content` | DB 500MB | 텍스트라 DB가 가장 싸고 검색도 됨 |
| 표지 이미지 | Supabase Storage `covers` | 1GB | 도서당 1장, 작고 이미 쓰던 경로 |
| **본문 이미지** | **Cloudflare R2** | 10GB + **전송량 무료** | 여러 장이 반복 열람됨 |
| **PDF 도서** | **Cloudflare R2** | (같은 버킷) | 교재는 크고 반복 열람이 많아 egress가 비용을 좌우 |

#### 왜 R2인가

Supabase 무료 플랜은 **파일 1개 50MB 상한**과 **월 5GB 전송량** 제한이 있습니다. 교재 PDF는
이 둘 다에 쉽게 걸리고, 본문 이미지도 여러 사람이 반복해서 받으면 전송량부터 바닥납니다.
R2는 저장 10GB가 무료이고 **전송량이 아예 무료**입니다.

PDF와 본문 이미지가 **같은 버킷**을 쓰고, 서버가 `kind`로 폴더를 나눕니다.

```
브라우저 → POST /api/r2-upload-url   (서명 URL만, 몇 KB)
브라우저 → R2 에 PUT                 (파일 본체) ← Vercel을 거치지 않는다
브라우저 → books.pdf_url 저장 / 편집기에 <img> 삽입
```

파일을 Vercel 함수로 통과시키지 않는 이유는 **서버리스 함수의 요청 본문이 4.5MB로 제한**되기
때문입니다. 그래서 `api/r2-upload-url.ts`는 서명 URL만 발급하고, 그 과정에서 로그인 여부와
**해당 도서가 요청자의 것인지**, 종류별 형식·크기 제한까지 확인합니다.

| kind | 폴더 | 허용 형식 | 최대 |
|------|------|-----------|------|
| `pdf` | `{uid}/pdf/{bookId}/` | application/pdf | 300MB |
| `image` | `{uid}/images/{bookId}/` | PNG·JPG·GIF·WebP·AVIF | 10MB |

SVG는 양쪽 다 막습니다 — 공개 버킷이라 URL을 직접 열면 스크립트가 실행될 수 있습니다.

#### 파일 이름 충돌 방지

R2는 같은 키로 PUT하면 **조용히 덮어씁니다.** 그래서 키에 UUID를 넣습니다.

```
{userId}/{kind}/{bookId}/{YYYYMMDD}-{uuid}-{정리된이름}.{확장자}
```

원본 이름은 알아보기 위한 꼬리표일 뿐이고 유일성은 UUID가 보장합니다. 이름 부분은 ASCII만
남기고 연속된 점을 지워 `..`가 경로 세그먼트로 남지 않게 합니다. 같은 밀리초에 2만 개를
생성해도 중복이 없는 것을 확인했습니다.

> `X-Amz-Expires`는 반드시 **쿼리스트링**에 넣어야 합니다. 헤더로 넘기면 만료 시간이 무시되고
> (기본 86400) `SignedHeaders`에 섞여 들어가, 브라우저가 보내지 않는 헤더를 요구하게 되므로
> PUT이 403으로 실패합니다.

설정에 필요한 환경변수와 Cloudflare 쪽 준비 순서(공개 주소, CORS, API 토큰)는
[.env.example](.env.example)에 적어 두었습니다.

---

## 3. 데이터베이스 (Supabase)

### 3-1. SQL 파일과 실행 순서

`supabase/` 폴더의 SQL은 Supabase **SQL Editor**에서 아래 순서대로 실행합니다.
(마이그레이션 도구를 쓰지 않고 파일을 직접 실행하는 방식입니다)

| 순서 | 파일 | 내용 |
|------|------|------|
| 1 | `schema.sql` | 핵심 테이블(categories, books, book_menus) + RLS + updated_at 트리거 + 분류 seed 4개 |
| 2 | `profiles.sql` | 닉네임용 profiles 테이블, 가입 시 자동 생성 트리거(`handle_new_user`), 기존 가입자 백필 |
| 3 | `storage.sql` | 표지 이미지용 Storage `covers` 공개 버킷 + 소유자별 폴더 정책 |
| 4 | `admin.sql` | 관리자 플래그(`profiles.is_admin`) + `is_admin()` 함수, **유형 테이블화**(book_types, books.type의 check 제약 → FK 교체), 분류 관리자 쓰기 정책, 사이트 설정(site_settings), 추천(book_recommendations) |
| 5 | `content-format.sql` | `books.content_format` 컬럼 추가 — 도서별 본문 형식('html' \| 'markdown') |
| 6 | `single-file.sql` | `books.source_mode`('menu' \| 'single')와 `books.single_content` 추가 — 단일 파일 업로드 모드 |
| 7 | `home-layout.sql` | `site_settings.home_layout`('latest' \| 'recommended' \| 'both')과 `home_featured_count` 추가 — 홈 목록 구성 |
| 8 | `admin-members.sql` | 최초 가입자 자동 관리자(가입 트리거 교체), 관리자 지정/해제 함수(`set_user_admin`), **권한 상승 차단**(profiles 컬럼 단위 UPDATE 권한) |
| 9 | `ai-assist.sql` | AI 작성 도우미 — `profiles.ai_enabled` 컬럼, 허용/차단 함수(`set_user_ai_enabled`), 사용량 로그(`ai_usage`)와 회원별 요약 뷰(`ai_usage_summary`) |
| 10 | `categories-ai-it.sql` | 분류를 AI·IT 체계로 재구성 (기존 도서를 옮긴 뒤 빈 분류만 삭제) |
| 11 | `pdf-mode.sql` | `source_mode`에 `'pdf'` 추가 + `books.pdf_url / pdf_name / pdf_size` |

> 본문 이미지는 DB나 Supabase Storage가 아니라 **Cloudflare R2**로 가므로 SQL이 필요 없습니다
> (2-8). 환경변수만 등록하면 됩니다.

> **관리자 계정은 어떻게 정해지나요?**
> `admin-members.sql`을 실행하면 **최초로 가입한 회원이 자동으로 관리자**가 되고,
> 이후에는 관리자가 `/admin` → 회원 관리에서 다른 회원에게 권한을 줄 수 있습니다.
> 이미 운영 중이라 관리자가 한 명도 없다면 같은 스크립트가 가장 먼저 가입한 회원을
> 관리자로 지정합니다(이미 관리자가 있으면 건드리지 않음).
> 특정 계정을 직접 지정하려면 SQL Editor에서 실행하세요:
> ```sql
> update public.profiles set is_admin = true
> where id = (select id from auth.users where email = '관리자이메일');
> ```

### 3-2. 테이블 구조

```
categories            분류 (id, name, sort_order)
book_types            유형 (id=영문 슬러그, name, sort_order)  ← admin.sql에서 추가
books                 도서 (owner_id, category_id, type→book_types FK, title,
                      description, cover_url, custom_css, css_apply_to_content,
                      content_format('html'|'markdown'),
                      source_mode('menu'|'single'), single_content,
                      is_published, created_at, updated_at)
book_menus            메뉴(목차) 트리 (book_id, parent_id 자기참조, title,
                      sort_order, html_content)
profiles              회원 프로필 (id=auth.users FK, nickname, is_admin, ai_enabled)
site_settings         단일 행 사이트 설정 (id=1, recommend_enabled,
                      home_layout, home_featured_count)
book_recommendations  추천 (book_id, user_id 복합 PK)
ai_usage              AI 사용량 로그 (user_id, book_id, action, model,
                      prompt_tokens, completion_tokens, cost(원화), created_at)
ai_usage_summary      회원별 사용량 요약 뷰 (security_invoker)
```

### 3-3. RLS(Row Level Security) 요약

| 테이블 | 조회 | 쓰기 |
|--------|------|------|
| categories | 누구나 | 관리자만 (`is_admin()`) |
| book_types | 누구나 | 관리자만 |
| books | 공개(is_published) 또는 소유자 | 소유자만 |
| book_menus | 소속 도서 규칙을 따름 | 소속 도서 소유자만 |
| profiles | 누구나 (닉네임 공개) | 본인의 **nickname 컬럼만** 수정 (생성은 가입 트리거). `is_admin`·`ai_enabled` 변경은 관리자만, `set_user_admin()` / `set_user_ai_enabled()` 함수를 통해서만 |
| site_settings | 누구나 | 관리자만 |
| book_recommendations | 누구나 (추천 수 표시) | 로그인 회원이 본인 것만 추가/삭제 |
| ai_usage | 본인 것 + 관리자는 전체 | 로그인 회원이 본인 것만 추가 (서버 프록시가 사용자 토큰으로 기록) |

`is_admin()`은 `security definer` 함수라 RLS 정책 안에서 재귀 없이 profiles를 조회합니다.

> ⚠️ RLS 정책은 **행 단위**라 컬럼별 제한을 할 수 없습니다. `is_admin`이 profiles 행에 있는 이상
> "본인 행 수정 허용" 정책만으로는 회원이 스스로 관리자가 되는 것을 막을 수 없어,
> `admin-members.sql`에서 컬럼 단위 `GRANT UPDATE (nickname)`으로 차단하고
> 권한 변경은 `set_user_admin()` security definer 함수로만 가능하게 했습니다.

### 3-4. Supabase 대시보드 설정

- **Auth → URL Configuration**
  - Site URL: `https://librospace-three.vercel.app`
  - Redirect URLs: `http://localhost:5173` 추가 (로컬에서 재설정 메일 테스트용)

---

## 4. 프로젝트 구조

```
api/                      서버 사이드 (브라우저에 노출되면 안 되는 것만)
└── ai.ts                 POST /api/ai — BizRouter 연동 (인증·권한·프롬프트·오류 변환·
                          사용량 기록) + Vercel 서버리스 함수 진입점. 상대 import 금지
src/
├── api/                  Supabase 호출 레이어 (화면과 분리)
│   ├── ai.ts             /api/ai 호출부 + 작업(액션) 정의
│   ├── auth.ts           로그인/가입/로그아웃/비밀번호 재설정
│   ├── books.ts          도서 CRUD
│   ├── bookTypes.ts      유형 CRUD + useBookTypes 훅(모듈 캐시, 없으면 기본 3종 fail-soft)
│   ├── categories.ts     분류 CRUD
│   ├── covers.ts         표지 업로드 (Storage) + SVG 코드 정제(sanitizeSvg)
│   ├── menus.ts          메뉴 CRUD
│   ├── profiles.ts       프로필/닉네임 조회, 회원 목록, 관리자 지정(set_user_admin RPC),
│   │                     AI 허용(set_user_ai_enabled RPC), AI 사용량 요약
│   ├── recommendations.ts 추천 추가/삭제/집계
│   ├── search.ts         도서·본문 검색 (ilike, 와일드카드 이스케이프)
│   └── settings.ts       사이트 설정 조회/변경
├── components/
│   ├── AiAssistPanel.tsx AI 작성 도우미 패널 (생성 → 미리보기 → 반영/이어붙이기)
│   ├── BookForm.tsx      도서 생성·수정 공용 폼 (구성 방식·본문 형식 선택 포함)
│   ├── ContentEditorTab.tsx 본문 작성 탭 (꼭지 선택 사이드바 + 편집기 + Ctrl+S)
│   ├── CoverUploader.tsx 표지 UI — 파일 업로드 / SVG 코드 입력 전환
│   ├── CssEditorTab.tsx  CSS 편집 탭 (CodeMirror)
│   ├── HtmlViewer.tsx    iframe srcDoc + sandbox 렌더러 (높이 자동 조절 postMessage)
│   ├── Layout.tsx        헤더/네비 공통 레이아웃 (검색창, 관리자 링크는 is_admin일 때만)
│   ├── MenuTreeEditor.tsx 목차 트리 관리 UI — 순서·단계만 (본문은 ContentEditorTab)
│   ├── SingleContentTab.tsx 단일 파일 업로드 UI (작성 방식 ③④)
│   ├── RequireAuth.tsx   로그인 가드
│   ├── Sidebar.tsx       뷰어 목차 사이드바 (모바일 드로어)
│   └── TypeBadge.tsx     유형 배지 (동적 유형 + 색상 팔레트 순환)
├── contexts/
│   └── AuthContext.tsx   세션/닉네임/isAdmin/aiEnabled 전역 상태
├── lib/
│   ├── markdown.ts       마크다운 → HTML 변환, H1·H2 섹션 분할(splitMarkdownSections)
│   ├── menuTree.ts       메뉴 트리 순수 계산 (이동/들여쓰기 → sort_order 정규화)
│   ├── preview.ts        새 창 미리보기 (sandbox iframe으로 격리) + 주입 CSS 조립
│   └── supabase.ts       클라이언트 생성, env 확인
├── pages/
│   ├── AdminPage.tsx     관리자: 분류/유형/회원/기능 설정
│   ├── BookEditPage.tsx  편집 (탭: 기본정보 / 메뉴 관리·파일 업로드 / CSS)
│   ├── BookViewerPage.tsx 뷰어 (구성 방식별 레이아웃 분기)
│   ├── DocsPage.tsx      사용법
│   ├── HomePage.tsx      홈 (분류 필터 + 카드 그리드, 관리자 설정에 따른 정렬)
│   ├── SearchPage.tsx    검색 결과 (도서 / 본문 스니펫)
│   ├── LoginPage.tsx / SignupPage.tsx
│   ├── ForgotPasswordPage.tsx / ResetPasswordPage.tsx
│   └── MyLibraryPage.tsx 내 서재
└── types/
    └── database.ts       DB 행 타입 정의
supabase/                 SQL 마이그레이션 (실행 순서는 3-1 표 참고)
```

설계 특징:
- **fail-soft**: 새 테이블(profiles, book_types, site_settings 등)이 아직 생성되지 않아도
  앱이 죽지 않고 기본값으로 동작하도록 호출부에서 예외를 흡수
- **코드 분할**: 편집/뷰어/Docs/관리자 페이지는 `lazy()` 지연 로딩, CodeMirror는 별도 청크
- **뷰어 보안**: 사용자 HTML은 iframe `sandbox="allow-scripts"`로 격리 렌더링.
  새 창 미리보기도 마찬가지로, 팝업 문서에 직접 쓰지 않고 그 안의 sandbox iframe에 넣는다
  (같은 출처에 직접 쓰면 붙여넣은 `<script>`가 로그인 토큰에 접근할 수 있다)
- **표지 SVG 보안**: 붙여넣은 SVG는 `DOMParser`로 파싱해 `<script>`·`<foreignObject>`,
  `on*` 이벤트 핸들러, `javascript:`·외부 리소스 참조를 제거한 뒤 업로드.
  표지는 항상 `<img>`로만 렌더링하지만, Storage 공개 URL을 직접 열었을 때도 안전하도록 정제한다
- **AI 키 격리**: BizRouter API 키는 `api/` 아래 서버 코드에서만 읽는다. `VITE_` 접두사가 아니라
  클라이언트 번들에 들어갈 수 없고, 사용 권한(`ai_enabled`)도 서버에서 확인하므로 화면을
  우회한 직접 호출이 통하지 않는다

---

## 5. 개발 히스토리

마일스톤 7단계로 진행했으며, 각 단계 완료 시 체크포인트 확인 후 다음 단계로 넘어갔습니다.

| 단계 | 내용 |
|------|------|
| M1 | Vite+React+TS 스캐폴드, HashRouter 라우팅, Supabase 클라이언트, `schema.sql` |
| M2 | 이메일 가입/로그인/세션(AuthContext), RequireAuth 가드, env 미설정 안내 화면 |
| M3 | 도서 CRUD(공용 BookForm, 내 서재), 편집 페이지 탭 구조, 홈 분류별 그룹 |
| M4 | MenuTreeEditor: 트리 추가/이름변경/삭제/이동/들여쓰기 (`lib/menuTree.ts` 순수 계산) |
| M5 | HtmlViewer(iframe sandbox, 높이 자동조절), 뷰어 페이지, CodeMirror HTML 편집 |
| M6 | 도서별 커스텀 CSS 탭, `css_apply_to_content` 옵션 |
| M7 | 배포 — GitHub Pages에서 **Vercel로 이전** (librospace, Git 연동 자동 배포) |

이후 추가된 기능:

- 비밀번호 재설정 플로우 (`/forgot-password`, `/reset-password`)
- LibroSpace 브랜딩(히어로/헤더), `/docs` 사용법 페이지
- 번들 코드 분할 (편집/뷰어/Docs 지연 로딩, CodeMirror 별도 청크)
- 표지 이미지 업로드 (`storage.sql` — covers 버킷)
- 모바일 뷰어 사이드바 드로어
- 닉네임 (`profiles.sql` — 가입 트리거, 헤더/홈 카드 표시)
- 관리자 기능 (`admin.sql` — 분류/유형 관리, 추천 기능 토글), 유형 테이블화,
  홈 개편(분류 필터 탭, 세로 표지 2/4열 그리드, 제목 줄바꿈, 유형 배지 하단 배치, 추천 버튼)
- 본문 형식 선택 (`content-format.sql` — 도서별 HTML/마크다운 편집·렌더링)
- 전체 검색 (헤더 검색창 + `/search` — 도서 제목·설명·본문 검색, 스니펫 하이라이트)
- 단일 파일 모드 (`single-file.sql` — 완성된 HTML은 메뉴 없는 전체 화면,
  마크다운은 H1·H2 기준 목차 자동 생성)
- 홈 목록 개편 (`home-layout.sql` — 분류별 그룹 제거, 관리자가 최신순/추천순/2단 구성 선택)
- 표지 SVG 코드 입력 (파일 대신 SVG 코드를 붙여넣어 표지 지정, DB 변경 없음)
- 회원 관리 (`admin-members.sql` — 최초 가입자 자동 관리자, 관리자 지정/해제 UI,
  profiles 권한 상승 취약점 차단)
