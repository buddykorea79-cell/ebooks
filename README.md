# 📚 LibroSpace (ebooks)

도서·가이드·매뉴얼을 온라인으로 작성·공개하는 전자책 플랫폼입니다.
회원이 도서를 만들고 메뉴(목차) 트리를 구성해 HTML 콘텐츠를 작성하면, 뷰어에서 누구나 읽을 수 있습니다.

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
| 코드 에디터 | CodeMirror (`@uiw/react-codemirror`) | HTML/CSS 편집 탭, 지연 로딩 청크 |
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

---

## 2. 주요 기능

- **회원**: 이메일 가입(닉네임 필수)·로그인·비밀번호 재설정(메일 링크 → `/reset-password`)
- **내 서재**(`/my`): 도서 생성/삭제, 공개 여부 설정
- **도서 편집**(`/book/:id/edit`): 탭 구조
  - 기본 정보: 제목/분류/유형/설명/공개, 표지 이미지 업로드(Storage `covers` 버킷)
  - 메뉴 관리: 트리 편집(추가/이름변경/삭제/이동/들여쓰기) + CodeMirror HTML 편집·미리보기
  - CSS: 도서 전용 커스텀 CSS, "콘텐츠에도 적용" 옵션(`css_apply_to_content`)
- **뷰어**(`/book/:id`): 사이드바 목차(모바일은 드로어) + iframe 샌드박스 렌더링(HtmlViewer)
- **홈**(`/`): 공개 도서를 **분류별 그룹 + 분류 필터 탭**으로 표시. 카드에는 세로(3:4) 표지,
  제목(줄바꿈 표시), 작성자 닉네임, 설명, 최하단에 **유형 배지**와 (활성화 시) **👍 추천 버튼**
- **관리자**(`/admin`, 관리자 전용):
  - 분류(categories) 추가/이름 변경/순서 이동/삭제
  - 유형(book_types) 추가/이름 변경/순서 이동/삭제
  - 회원 추천 기능 켜기/끄기(`site_settings.recommend_enabled`)
- **추천**: 로그인 회원이 도서당 1회 추천/취소, 추천 수는 누구나 조회 가능
- **Docs**(`/docs`): 사용법 안내 페이지

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

> `admin.sql`에는 최초 관리자 지정 구문이 포함되어 있습니다.
> 이메일을 본인 계정으로 바꿔 실행하세요:
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
                      is_published, created_at, updated_at)
book_menus            메뉴(목차) 트리 (book_id, parent_id 자기참조, title,
                      sort_order, html_content)
profiles              회원 프로필 (id=auth.users FK, nickname, is_admin)
site_settings         단일 행 사이트 설정 (id=1, recommend_enabled)
book_recommendations  추천 (book_id, user_id 복합 PK)
```

### 3-3. RLS(Row Level Security) 요약

| 테이블 | 조회 | 쓰기 |
|--------|------|------|
| categories | 누구나 | 관리자만 (`is_admin()`) |
| book_types | 누구나 | 관리자만 |
| books | 공개(is_published) 또는 소유자 | 소유자만 |
| book_menus | 소속 도서 규칙을 따름 | 소속 도서 소유자만 |
| profiles | 누구나 (닉네임 공개) | 본인만 수정 (생성은 가입 트리거) |
| site_settings | 누구나 | 관리자만 |
| book_recommendations | 누구나 (추천 수 표시) | 로그인 회원이 본인 것만 추가/삭제 |

`is_admin()`은 `security definer` 함수라 RLS 정책 안에서 재귀 없이 profiles를 조회합니다.

### 3-4. Supabase 대시보드 설정

- **Auth → URL Configuration**
  - Site URL: `https://librospace-three.vercel.app`
  - Redirect URLs: `http://localhost:5173` 추가 (로컬에서 재설정 메일 테스트용)

---

## 4. 프로젝트 구조

```
src/
├── api/                  Supabase 호출 레이어 (화면과 분리)
│   ├── auth.ts           로그인/가입/로그아웃/비밀번호 재설정
│   ├── books.ts          도서 CRUD
│   ├── bookTypes.ts      유형 CRUD + useBookTypes 훅(모듈 캐시, 없으면 기본 3종 fail-soft)
│   ├── categories.ts     분류 CRUD
│   ├── covers.ts         표지 업로드 (Storage)
│   ├── menus.ts          메뉴 CRUD
│   ├── profiles.ts       프로필/닉네임 조회
│   ├── recommendations.ts 추천 추가/삭제/집계
│   └── settings.ts       사이트 설정 조회/변경
├── components/
│   ├── BookForm.tsx      도서 생성·수정 공용 폼
│   ├── CoverUploader.tsx 표지 업로드 UI
│   ├── CssEditorTab.tsx  CSS 편집 탭 (CodeMirror)
│   ├── HtmlViewer.tsx    iframe srcDoc + sandbox 렌더러 (높이 자동 조절 postMessage)
│   ├── Layout.tsx        헤더/네비 공통 레이아웃 (관리자 링크는 is_admin일 때만)
│   ├── MenuTreeEditor.tsx 메뉴 트리 편집 UI
│   ├── RequireAuth.tsx   로그인 가드
│   ├── Sidebar.tsx       뷰어 목차 사이드바 (모바일 드로어)
│   └── TypeBadge.tsx     유형 배지 (동적 유형 + 색상 팔레트 순환)
├── contexts/
│   └── AuthContext.tsx   세션/닉네임/isAdmin 전역 상태
├── lib/
│   ├── menuTree.ts       메뉴 트리 순수 계산 (이동/들여쓰기 → sort_order 정규화)
│   └── supabase.ts       클라이언트 생성, env 확인
├── pages/
│   ├── AdminPage.tsx     관리자: 분류/유형/기능 설정
│   ├── BookEditPage.tsx  편집 (탭: 기본정보/메뉴/CSS)
│   ├── BookViewerPage.tsx 뷰어 (자체 레이아웃)
│   ├── DocsPage.tsx      사용법
│   ├── HomePage.tsx      홈 (분류 필터 + 카드 그리드)
│   ├── LoginPage.tsx / SignupPage.tsx
│   ├── ForgotPasswordPage.tsx / ResetPasswordPage.tsx
│   └── MyLibraryPage.tsx 내 서재
└── types/
    └── database.ts       DB 행 타입 정의
supabase/                 SQL (실행 순서: schema → profiles → storage → admin)
```

설계 특징:
- **fail-soft**: 새 테이블(profiles, book_types, site_settings 등)이 아직 생성되지 않아도
  앱이 죽지 않고 기본값으로 동작하도록 호출부에서 예외를 흡수
- **코드 분할**: 편집/뷰어/Docs/관리자 페이지는 `lazy()` 지연 로딩, CodeMirror는 별도 청크
- **뷰어 보안**: 사용자 HTML은 iframe `sandbox="allow-scripts"`로 격리 렌더링

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
