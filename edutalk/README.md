# EduTalk — 교육생과 대화하기

강의 중 강사와 교육생이 실시간으로 대화·설문·화이트보드를 쓰는 도구입니다.
[buddykorea79-cell/edu](https://github.com/buddykorea79-cell/edu) 저장소의 코드를 그대로
가져왔습니다.

## ⚠️ 이 폴더는 LibroSpace와 함께 배포되지 않습니다

EduTalk는 **Socket.IO 상시 실행 서버**입니다. LibroSpace가 올라가는 Vercel은 서버리스라
WebSocket 연결을 유지할 수 없습니다. **별도로 배포해야 합니다.**

```
LibroSpace (Vercel)          EduTalk (Render 등)
  홈 화면의 버튼  ──새 창──▶   https://edutalk-xxxx.onrender.com
```

버튼에 쓰이는 주소는 코드가 아니라 **관리자 화면 → 기능 설정 → 교육생과 대화하기(EduTalk)**
에서 지정합니다. 비워 두면 홈에 버튼이 나타나지 않습니다.

## 계정은 LibroSpace와 공용입니다

강사·관리자 로그인은 **LibroSpace와 같은 Supabase 프로젝트의 이메일/비밀번호 계정**을
그대로 씁니다. 따로 가입할 필요가 없고, LibroSpace에서 만든 계정으로 바로 들어옵니다.

- 가입·비밀번호 재설정 링크는 로그인 화면에서 LibroSpace로 연결됩니다
- 강사는 첫 로그인 시 `pending`으로 자동 등록되고, 관리자 승인 후 강의실을 열 수 있습니다
- 관리자(`ADMIN_EMAIL`)는 첫 로그인 시 자동 승인됩니다
- 교육생은 로그인 없이 6자리 방 코드만으로 입장합니다

> `SUPABASE_URL` / `SUPABASE_ANON_KEY`를 **LibroSpace와 같은 값**으로 넣어야 계정이
> 공유됩니다. 다른 프로젝트를 가리키면 로그인은 되더라도 서로 다른 사용자가 됩니다.

## 로컬에서 실행

```bash
npm --prefix edutalk install
```

`edutalk/.env`에 환경변수를 넣고(아래 표 참고, `.gitignore`로 제외됨) 실행합니다.

```bash
npm --prefix edutalk run dev    # .env 를 읽어서 실행, http://localhost:3000
```

환경변수 없이 그냥 띄우려면 `npm --prefix edutalk start` — 서버는 뜨지만 로그인은 막힙니다.

- 교육생: `http://localhost:3000/student.html` (6자리 방 코드만으로 입장)
- 강사: `http://localhost:3000/instructor.html` (LibroSpace 계정 + 관리자 승인)
- 관리자: `http://localhost:3000/admin.html`

## 배포 (Render)

이 폴더를 **별도 저장소의 루트로** 올리거나, Render의 Root Directory를 `edutalk`로
지정해 배포합니다. `render.yaml`이 들어 있어 Blueprint로 바로 인식됩니다.

자세한 절차는 [DEPLOY.md](DEPLOY.md)를 참고하세요.

## 필요한 환경변수

| 변수 | 용도 |
|------|------|
| `SUPABASE_URL` | **LibroSpace와 같은 값** — 계정 공유의 핵심 |
| `SUPABASE_ANON_KEY` | **LibroSpace와 같은 값** — 브라우저 로그인 + 서버의 토큰 검증 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 — 강사 프로필 테이블 읽기·쓰기, 계정 삭제 |
| `ADMIN_EMAIL` | 관리자 계정 이메일 (기본 `buddykorea79@gmail.com`) |
| `LIBROSPACE_URL` | 로그인 화면의 가입·비밀번호 찾기 링크 (기본 `https://librospace-three.vercel.app`) |

`instructor_profiles` 테이블이 필요합니다 — [supabase.sql](supabase.sql)을 LibroSpace와
**같은 Supabase 프로젝트**의 SQL Editor에서 한 번 실행하세요. Google OAuth Provider는
**더 이상 필요하지 않습니다** — 이메일/비밀번호 로그인으로 바뀌었습니다.

## 로그인이 안 될 때

LibroSpace에서는 되는 계정이 EduTalk에서만 실패한다면, 비밀번호 문제가 아니라
**이 서버의 설정 문제**일 가능성이 큽니다. 로그인은 두 단계이기 때문입니다.

```
① 브라우저 → Supabase 로그인            (SUPABASE_URL + SUPABASE_ANON_KEY)
② 브라우저 → EduTalk /api/instructor/session  (토큰 검증 + 강사 프로필 확인)
```

①이 성공해도 ②가 실패하면 화면은 다시 로그인 상태로 돌아옵니다. 어디가 문제인지는
**`/api/health`** 로 바로 확인할 수 있습니다 (값은 노출되지 않고 있다/없다만 표시).

```bash
curl https://<배포주소>/api/health
```

| 응답 | 원인과 조치 |
|------|-------------|
| `missingEnv`에 이름이 있음 | 그 환경변수를 Render → Environment 에 등록하고 재배포 |
| `instructorProfilesTable`이 '테이블이 없습니다' | `supabase.sql`을 SQL Editor에서 실행 |
| 모두 정상인데 로그인 실패 | 로그인 화면의 빨간 메시지를 확인 — 원인별로 다른 문구가 나옵니다 |

`SUPABASE_URL`/`SUPABASE_ANON_KEY`가 LibroSpace와 **다른 프로젝트**를 가리키면 계정이
공유되지 않아 '이메일 또는 비밀번호가 올바르지 않습니다'로 보입니다.

## 알아둘 점

- 무료 플랜은 15분간 요청이 없으면 잠들고, 다음 접속에 약 50초가 걸립니다.
  강의 시작 전에 미리 한 번 열어 두세요.
- 방·메시지·설문은 **메모리에만** 있어 서버가 재시작되면 사라집니다.
  한 강의 세션 동안만 유지하는 용도입니다.
- 업로드 파일도 재배포 시 사라집니다.
