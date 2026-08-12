const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ── Config ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

// 관리자 = 아래 이메일의 계정. 이 계정으로 로그인하면
// 관리자 페이지를 사용할 수 있고, 강사 프로필도 자동 승인된다.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'buddykorea79@gmail.com').toLowerCase();

// LibroSpace 주소 — 계정을 공유하므로 가입·비밀번호 재설정 링크를 그쪽으로 보낸다
const LIBROSPACE_URL = (process.env.LIBROSPACE_URL || 'https://librospace-three.vercel.app')
  .replace(/\/+$/, '');

const MAX_ROOMS = 5;              // 동시에 개설 가능한 최대 방 개수
const ROOM_CAPACITY = 50;         // 방당 최대 학생 수
const MAX_WHITEBOARD_SEGMENTS = 100000;  // 화이트보드 누적 세그먼트 상한 (메모리 보호)
const MAX_MESSAGES = 500;         // 방별 채팅 보관 상한 (메모리 보호, 초과 시 오래된 것부터 삭제)

// ── Supabase (인증 + 강사 프로필 영속화) ─────────────────────────────────────
// 인증은 LibroSpace와 같은 Supabase Auth(이메일/비밀번호)가 담당하고, 이 서버는 access token 을
// 검증한 뒤 instructor_profiles 테이블의 승인 상태만 관리한다.
//
// 필요 환경변수:
//   SUPABASE_URL              — 프로젝트 URL              (LibroSpace와 같은 값)
//   SUPABASE_ANON_KEY         — 브라우저 로그인 + 토큰 검증 (LibroSpace와 같은 값)
//   SUPABASE_SERVICE_ROLE_KEY — 서버 전용 (프로필 테이블 읽기·쓰기, 계정 삭제)
//
// 프로필 테이블은 edutalk/supabase.sql 을 SQL Editor에서 한 번 실행해 만든다.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const CLIENT_OPTS = { auth: { persistSession: false, autoRefreshToken: false } };

/**
 * 토큰 검증 전용 클라이언트.
 *
 * 검증(`auth.getUser(token)`)은 anon key 로도 되므로 service role key 와 분리한다.
 * 예전에는 service role key 로만 만든 클라이언트로 검증해서, 그 키 하나가 빠지거나
 * 잘못 들어가면 "LibroSpace 로그인은 되는데 EduTalk 로그인만 실패"하는 상태가 됐다.
 * (브라우저 로그인은 anon key 로 이미 성공한 뒤였기 때문)
 */
const authKey = SUPABASE_ANON_KEY || SUPABASE_SERVICE_KEY;
const authClient = (SUPABASE_URL && authKey)
  ? createClient(SUPABASE_URL, authKey, CLIENT_OPTS)
  : null;

/** 프로필 테이블 접근용 — RLS 를 우회해야 하므로 service role key 전용 */
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, CLIENT_OPTS)
  : null;

/** 비어 있는 필수 환경변수 목록 — 로그인 실패 원인을 즉시 알려 주기 위해 모아 둔다 */
const missingEnv = [
  ['SUPABASE_URL', SUPABASE_URL],
  ['SUPABASE_ANON_KEY', SUPABASE_ANON_KEY],
  ['SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_KEY]
].filter(([, v]) => !v).map(([k]) => k);

if (missingEnv.length) {
  console.warn(
    `⚠️  환경변수 누락: ${missingEnv.join(', ')} — 로그인이 정상 동작하지 않습니다.\n` +
    '    Render → Environment 에 LibroSpace와 같은 Supabase 값을 등록하세요.\n' +
    '    설정 상태는 /api/health 에서 확인할 수 있습니다.'
  );
}

// ── Instructor profiles (인메모리 캐시 + Supabase write-through) ─────────────
let instructorProfiles = []; // { userId, email, name, status, createdAt, approvedAt }
let profilesLoaded = false;  // 부팅 시 전체 로드에 성공했는지

function dbToProfile(r) {
  return {
    userId: r.user_id, email: r.email, name: r.name,
    status: r.status, createdAt: r.created_at, approvedAt: r.approved_at ?? null
  };
}

/** 캐시에 반영 (같은 user_id / email 의 기존 항목은 교체) */
function cacheProfile(prof) {
  instructorProfiles = instructorProfiles.filter(
    p => p.userId !== prof.userId && p.email !== prof.email
  );
  instructorProfiles.push(prof);
  return prof;
}

/** Supabase 오류를 운영자가 바로 고칠 수 있는 한국어 안내로 */
function dbErrorMessage(error) {
  const msg = String((error && error.message) || '');
  if (/relation .*instructor_profiles.* does not exist/i.test(msg) ||
      /schema cache/i.test(msg) ||
      (error && (error.code === '42P01' || error.code === 'PGRST205'))) {
    return 'instructor_profiles 테이블이 없습니다. edutalk/supabase.sql 을 Supabase SQL Editor에서 실행하세요.';
  }
  if (/row-level security/i.test(msg)) {
    return 'instructor_profiles 접근이 RLS에 막혔습니다. SUPABASE_SERVICE_ROLE_KEY가 올바른지 확인하세요.';
  }
  return `프로필 조회에 실패했습니다: ${msg}`;
}

const SERVICE_KEY_MISSING =
  '서버에 SUPABASE_SERVICE_ROLE_KEY가 없어 강사 프로필을 확인할 수 없습니다. 관리자에게 환경변수 등록을 요청하세요.';

async function loadInstructorProfiles() {
  if (!supabase) return;
  const { data, error } = await supabase.from('instructor_profiles').select('*');
  if (error) {
    console.error('Supabase load error:', dbErrorMessage(error));
    return;
  }
  instructorProfiles = (data || []).map(dbToProfile);
  profilesLoaded = true;
  console.log(`Loaded ${instructorProfiles.length} instructor profiles from Supabase`);
}

loadInstructorProfiles().catch(e => console.error('Supabase init error:', e.message));

/** 토큰이 틀린 게 아니라 Supabase에 닿지 못한 경우인지 */
function isNetworkError(error) {
  if (!error) return false;
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return true;
  return /fetch failed|network|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|timeout/i.test(
    String(error.message || '')
  );
}

/**
 * Supabase access token 검증.
 * 실패 원인을 구분해서 돌려준다 — "설정 누락"과 "비밀번호 틀림"은 대응이 전혀 다른데,
 * 예전에는 둘 다 똑같이 '인증에 실패했습니다'로 보여 원인을 찾을 수 없었다.
 */
async function authenticate(token) {
  if (!authClient) {
    return {
      user: null, status: 503, code: 'NOT_CONFIGURED',
      error: `서버에 Supabase 인증이 설정되지 않았습니다 (누락: ${missingEnv.join(', ') || 'SUPABASE_URL'}). 관리자에게 문의하세요.`
    };
  }
  if (typeof token !== 'string' || !token) {
    return { user: null, status: 401, code: 'NO_TOKEN', error: '로그인이 필요합니다.' };
  }
  try {
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data || !data.user) {
      console.error('[auth] 토큰 검증 실패:', (error && error.message) || 'user 없음');
      // 네트워크 오류는 error 로 돌아온다(throw 가 아니라).
      // 이걸 '토큰 만료'로 보여 주면 멀쩡한 계정으로 계속 다시 로그인하게 된다.
      if (isNetworkError(error)) {
        return {
          user: null, status: 503, code: 'AUTH_UNAVAILABLE',
          error: 'Supabase 인증 서버에 연결하지 못했습니다. SUPABASE_URL이 올바른지, 프로젝트가 일시중지 상태는 아닌지 확인하세요.'
        };
      }
      return {
        user: null, status: 401, code: 'INVALID_TOKEN',
        error: '로그인 정보가 만료되었거나 다른 Supabase 프로젝트의 계정입니다. 다시 로그인해 주세요.'
      };
    }
    return { user: data.user };
  } catch (e) {
    console.error('[auth] 토큰 검증 오류:', e.message);
    return {
      user: null, status: 503, code: 'AUTH_UNAVAILABLE',
      error: '인증 서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.'
    };
  }
}

/**
 * 강사 프로필 조회 — 캐시에 없으면 DB에서 다시 찾는다.
 *
 * 부팅 시 loadInstructorProfiles()가 실패했거나(테이블 미생성, 일시적 네트워크 오류)
 * 그 뒤에 행이 생겼을 수 있다. 캐시만 믿으면 이미 승인된 계정이 계속 '승인 대기'로
 * 보이거나 강의실 입장이 막힌다.
 */
async function findProfile(user) {
  const cached = instructorProfiles.find(p => p.userId === user.id);
  if (cached) return { profile: cached };
  if (!supabase) return { profile: null, status: 503, error: SERVICE_KEY_MISSING };

  const { data, error } = await supabase
    .from('instructor_profiles').select('*').eq('user_id', user.id).maybeSingle();
  if (error) return { profile: null, status: 500, error: dbErrorMessage(error) };
  if (!data) return { profile: null };
  return { profile: cacheProfile(dbToProfile(data)) };
}

/**
 * 관리자 계정(ADMIN_EMAIL)은 항상 승인 상태로 유지한다.
 * ADMIN_EMAIL 을 나중에 지정했거나 그 전에 로그인해 pending 으로 남은 경우를 스스로 고친다.
 */
async function autoApproveAdmin(profile) {
  if (!profile || profile.email !== ADMIN_EMAIL || profile.status === 'approved') {
    return { profile };
  }
  if (!supabase) return { profile };
  const approvedAt = Date.now();
  const { error } = await supabase
    .from('instructor_profiles')
    .update({ status: 'approved', approved_at: approvedAt })
    .eq('user_id', profile.userId);
  if (error) {
    console.error('관리자 자동 승인 실패:', error.message);
    return { profile };   // 못 고쳐도 로그인 흐름은 계속
  }
  profile.status = 'approved';
  profile.approvedAt = approvedAt;
  return { profile };
}

/** 프로필 조회 — 없으면 신규 등록(pending). 관리자 계정은 자동 승인 */
async function ensureProfile(user) {
  const found = await findProfile(user);
  if (found.error) return found;
  if (found.profile) return await autoApproveAdmin(found.profile);
  if (!supabase) return { profile: null, status: 503, error: SERVICE_KEY_MISSING };

  const email = (user.email || '').toLowerCase();

  // 같은 이메일의 예전 행이 남아 있을 수 있다 (Auth 계정을 지웠다가 다시 만든 경우 등).
  // email 에 UNIQUE 가 걸려 있어 그대로 insert 하면 23505 로 실패하므로,
  // 기존 행의 user_id 를 지금 계정으로 옮겨 승인 상태를 이어받는다.
  const { data: byEmail, error: byEmailErr } = await supabase
    .from('instructor_profiles').select('*').eq('email', email).maybeSingle();
  if (byEmailErr) return { profile: null, status: 500, error: dbErrorMessage(byEmailErr) };

  if (byEmail) {
    const { data: relinked, error: relinkErr } = await supabase
      .from('instructor_profiles')
      .update({ user_id: user.id })
      .eq('email', email)
      .select('*')
      .maybeSingle();
    if (relinkErr) return { profile: null, status: 500, error: dbErrorMessage(relinkErr) };
    console.log(`[auth] 프로필 재연결: ${email} → ${user.id}`);
    return await autoApproveAdmin(
      cacheProfile(dbToProfile(relinked || { ...byEmail, user_id: user.id }))
    );
  }

  const isAdmin = email === ADMIN_EMAIL;
  const meta = user.user_metadata || {};
  const row = {
    user_id: user.id,
    email,
    // LibroSpace 가입 시 넣는 nickname 을 우선 사용한다 (Google 계정이면 full_name)
    name: String(meta.nickname || meta.full_name || meta.name || email.split('@')[0]).slice(0, 30),
    status: isAdmin ? 'approved' : 'pending',   // 관리자 계정은 자동 승인
    created_at: Date.now(),
    approved_at: isAdmin ? Date.now() : null
  };
  const { data: inserted, error } = await supabase
    .from('instructor_profiles').insert(row).select('*').maybeSingle();
  if (error) {
    console.error('Supabase profile insert error:', error.message);
    return { profile: null, status: 500, error: dbErrorMessage(error) };
  }
  return { profile: cacheProfile(dbToProfile(inserted || row)) };
}

// 관리자 페이지용 세션 토큰 (메모리 — 서버 재시작 시 재로그인 필요)
const adminTokens = new Set();

// ── Uploads ───────────────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ── In-memory state ───────────────────────────────────────────────────────────
// rooms: { [roomCode]: { lectureName, capacity, instructorSocketId,
//   students: Map<socketId,{name,emoji}>, assistants: Map<socketId,{name}>,
//   messages:[], surveys:[], activeSurvey, resources:[], surveyResponses: Map,
//   whiteboard: [] } }
const rooms = new Map();

function getRoom(code) { return rooms.get(code); }

function createRoom(code, lectureName, instructorSocketId) {
  rooms.set(code, {
    lectureName,
    capacity: ROOM_CAPACITY,
    instructorSocketId,
    students: new Map(),
    assistants: new Map(),
    messages: [],
    surveys: [],
    activeSurvey: null,
    resources: [],
    surveyResponses: new Map(),
    whiteboard: []
  });
  return rooms.get(code);
}

// 강사(주강사) 또는 조교인지 — 설문/자료/화이트보드 지우기 등 운영 권한 확인
function canInstruct(room, socketId) {
  if (!room) return false;
  return room.instructorSocketId === socketId || room.assistants.has(socketId);
}

// 메시지 발신자 표시 이름/이모지 결정 (강사 / 조교 / 학생)
function resolveSender(room, socketId, role) {
  if (role === 'instructor') {
    return { name: '강사', emoji: '👨‍🏫' };
  }
  if (role === 'assistant') {
    const a = room.assistants.get(socketId);
    return { name: a ? a.name : '조교', emoji: '🧑‍🏫' };
  }
  const s = room.students.get(socketId);
  return s ? { name: s.name, emoji: s.emoji } : null;
}

// ── Express middleware ────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── supabase-js 브라우저 번들 ────────────────────────────────────────────────
// CDN(jsdelivr) 대신 서버가 직접 내려 준다.
//
// 예전에는 로그인 화면이 아래 주소를 불렀다.
//   https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js
// 그런데 supabase-js v2 패키지에는 'supabase.min.js'가 없다(umd 폴더에 supabase.js 하나뿐).
// 그래서 window.supabase 가 만들어지지 않았고, 로그인 버튼을 눌러도
// `if (!sb) return;` 에 걸려 아무 반응이 없었다 — LibroSpace에서는 되는 계정이
// EduTalk에서만 안 되는 것처럼 보인 원인이다.
//
// 서버가 이미 의존성으로 갖고 있는 파일을 그대로 주면 버전도 서버와 일치하고,
// CDN 차단·오프라인 환경에서도 동작한다. (socket.io 클라이언트와 같은 방식)
//
// 경로 해석이 실패해도 서버가 죽지 않게 감싼다. 최상위에서 throw 되면 로그인만이 아니라
// 강의방 전체가 뜨지 않는다 — 원래 문제보다 나쁜 상황이 된다.
let SUPABASE_UMD_PATH = null;
try {
  SUPABASE_UMD_PATH = require.resolve('@supabase/supabase-js/dist/umd/supabase.js');
} catch (e) {
  console.error(
    `⚠️  supabase-js 브라우저 번들을 찾지 못했습니다 (${e.message}).\n` +
    '    edutalk 폴더에서 npm install 이 정상적으로 끝났는지 확인하세요. 로그인이 막힙니다.'
  );
}

app.get('/vendor/supabase.js', (req, res) => {
  res.type('application/javascript');
  if (!SUPABASE_UMD_PATH) {
    // 404 대신 '왜 안 되는지 말해 주는 스크립트'를 준다.
    // 이러면 로그인 화면이 안내 문구를 띄울 수 있다(window.supabase 가 없으므로).
    res
      .status(500)
      .send(
        'console.error("EduTalk: supabase-js 번들을 서버에서 찾지 못했습니다. ' +
          '서버 로그와 /api/health 를 확인하세요.");',
      );
    return;
  }
  res.sendFile(SUPABASE_UMD_PATH);
});
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
    // 업로드된 HTML/SVG/JS가 same-origin 으로 실행되는 것(stored XSS) 방지 — 다운로드로 강제
    if (/\.(html?|svg|xml|js|mjs|xhtml)$/i.test(filePath)) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment');
    }
  }
}));

// ── Deploy info (Render 환경변수 활용) ───────────────────────────────────────
const SERVER_START_TIME = new Date().toISOString();
const DEPLOY_COMMIT   = process.env.RENDER_GIT_COMMIT     || null;
const DEPLOY_MSG      = process.env.RENDER_GIT_COMMIT_MESSAGE || null;
const DEPLOY_BRANCH   = process.env.RENDER_GIT_BRANCH     || null;

// ── REST API ──────────────────────────────────────────────────────────────────
// Keep-alive ping — 클라이언트(강사/학생)가 10분마다 호출해 Render 슬립을 방지
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, rooms: rooms.size, ts: Date.now() });
});

app.get('/api/deploy-info', (req, res) => {
  res.json({
    startedAt: SERVER_START_TIME,
    commit:    DEPLOY_COMMIT,
    message:   DEPLOY_MSG,
    branch:    DEPLOY_BRANCH
  });
});

// 브라우저용 공개 설정 — anon key 는 공개되어도 안전한 키 (RLS/Auth 가 보호)
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL || null,
    supabaseAnonKey: SUPABASE_ANON_KEY || null,
    // 로그인 화면이 "무엇이 빠졌는지"까지 보여줄 수 있도록 (값이 아니라 이름만)
    configError: (!SUPABASE_URL || !SUPABASE_ANON_KEY)
      ? `서버에 인증이 설정되지 않았습니다 (누락: ${missingEnv.join(', ')}). 관리자에게 문의하세요.`
      : null,
    // 계정은 LibroSpace와 공용이므로 가입·비밀번호 재설정은 그쪽으로 보낸다
    librospaceUrl: LIBROSPACE_URL
  });
});

// ── 설정 진단 — 로그인이 안 될 때 어디가 문제인지 확인용 ──────────────────────
// 값은 노출하지 않고 "있다/없다"와 테이블 접근 결과만 돌려준다.
app.get('/api/health', async (req, res) => {
  const env = {
    SUPABASE_URL: Boolean(SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(SUPABASE_SERVICE_KEY)
  };

  let instructorProfilesTable = 'skipped (SUPABASE_SERVICE_ROLE_KEY 없음)';
  if (supabase) {
    // HEAD 요청(head:true)은 본문이 없어 오류 내용을 알 수 없다. 한 행만 실제로 읽어 확인한다.
    const { error } = await supabase.from('instructor_profiles').select('user_id').limit(1);
    instructorProfilesTable = error ? dbErrorMessage(error) : 'ok';
  }

  res.json({
    ok: missingEnv.length === 0 && instructorProfilesTable === 'ok' && Boolean(SUPABASE_UMD_PATH),
    env,
    missingEnv,
    // 로그인 화면이 쓰는 supabase-js 번들을 서버가 갖고 있는지
    browserBundle: SUPABASE_UMD_PATH ? 'ok' : 'missing (edutalk 에서 npm install 확인 필요)',
    instructorProfilesTable,
    profilesLoaded,
    profileCount: instructorProfiles.length,
    // 관리자 계정이 의도한 주소인지 확인용 (앞 한 글자만 노출)
    adminEmail: ADMIN_EMAIL.replace(/^(.)[^@]*/, '$1***'),
    rooms: rooms.size
  });
});

// ── 강사 세션: 로그인 직후 호출 — 프로필 조회 (없으면 자동 생성) ─────────────
// Authorization: Bearer <supabase access token>
app.post('/api/instructor/session', async (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const auth = await authenticate(token);
  if (!auth.user) {
    return res.status(auth.status).json({ ok: false, code: auth.code, error: auth.error });
  }

  const { profile, error, status } = await ensureProfile(auth.user);
  if (error || !profile) {
    return res.status(status || 500).json({
      ok: false, code: 'PROFILE', error: error || '강사 프로필을 확인하지 못했습니다.'
    });
  }

  res.json({
    ok: true,
    status: profile.status,
    name: profile.name,
    email: profile.email,
    isAdmin: profile.email === ADMIN_EMAIL
  });
});

// ── 관리자: 로그인 — ADMIN_EMAIL 계정으로 인증 ───────────────────────────────
app.post('/api/admin/auth', async (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const auth = await authenticate(token);
  const user = auth.user;
  if (!user) {
    return res.status(auth.status).json({ ok: false, code: auth.code, error: auth.error });
  }
  if ((user.email || '').toLowerCase() !== ADMIN_EMAIL) {
    return res.status(403).json({ ok: false, code: 'NOT_ADMIN', error: '관리자 계정이 아닙니다.' });
  }
  const adminToken = crypto.randomBytes(24).toString('hex');
  adminTokens.add(adminToken);
  res.json({ ok: true, token: adminToken });
});

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ ok: false, error: '관리자 인증이 필요합니다.' });
  }
  next();
}

// ── 관리자: 강사 목록 조회 ─────────────────────────────────────────────────────
app.get('/api/admin/instructors', requireAdmin, async (req, res) => {
  // 부팅 시 전체 로드가 실패했으면(테이블 미생성 등) 여기서 한 번 더 시도한다.
  // 그러지 않으면 목록이 계속 비어 보여 승인해 줄 대상을 찾을 수 없다.
  if (!profilesLoaded) {
    if (!supabase) return res.status(503).json({ ok: false, error: SERVICE_KEY_MISSING });
    await loadInstructorProfiles();
    if (!profilesLoaded) {
      return res.status(500).json({
        ok: false,
        error: '강사 목록을 불러오지 못했습니다. /api/health 로 설정을 확인하세요.'
      });
    }
  }
  res.json({
    ok: true,
    instructors: instructorProfiles.map(p => ({
      id: p.userId, name: p.name, email: p.email,
      status: p.status, createdAt: p.createdAt, approvedAt: p.approvedAt
    }))
  });
});

// ── 관리자: 승인 / 거절 / 보류 ─────────────────────────────────────────────────
app.post('/api/admin/instructors/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body || {};
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ ok: false, error: '잘못된 상태값입니다.' });
  }
  const prof = instructorProfiles.find(p => p.userId === req.params.id);
  if (!prof) return res.status(404).json({ ok: false, error: '계정을 찾을 수 없습니다.' });
  if (prof.email === ADMIN_EMAIL && status !== 'approved') {
    return res.status(400).json({ ok: false, error: '관리자 계정의 승인 상태는 변경할 수 없습니다.' });
  }

  const prevStatus = prof.status;
  prof.status = status;
  if (status === 'approved') prof.approvedAt = Date.now();

  const update = { status };
  if (status === 'approved') update.approved_at = prof.approvedAt;
  const { error } = await supabase.from('instructor_profiles').update(update).eq('user_id', prof.userId);
  if (error) {
    // 롤백
    prof.status = prevStatus;
    console.error('Supabase status update error:', error.message);
    return res.status(500).json({ ok: false, error: '서버 오류가 발생했습니다.' });
  }
  res.json({ ok: true });
});

// ── 관리자: 계정 삭제 (프로필 + Supabase Auth 사용자 모두 삭제) ───────────────
app.delete('/api/admin/instructors/:id', requireAdmin, async (req, res) => {
  const idx = instructorProfiles.findIndex(p => p.userId === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: '계정을 찾을 수 없습니다.' });
  if (instructorProfiles[idx].email === ADMIN_EMAIL) {
    return res.status(400).json({ ok: false, error: '관리자 계정은 삭제할 수 없습니다.' });
  }

  const { error } = await supabase.from('instructor_profiles').delete().eq('user_id', req.params.id);
  if (error) {
    console.error('Supabase delete error:', error.message);
    return res.status(500).json({ ok: false, error: '서버 오류가 발생했습니다.' });
  }
  // Auth 사용자도 삭제 — 다시 로그인하면 새 pending 프로필로 재신청됨
  try {
    await supabase.auth.admin.deleteUser(req.params.id);
  } catch (e) {
    console.error('Supabase auth user delete error:', e.message);
  }
  instructorProfiles.splice(idx, 1);
  res.json({ ok: true });
});

// 방 정보 조회 (URL 코드 접근 / 입장 전 정원 안내용)
app.get('/api/room/:code', (req, res) => {
  const room = getRoom(req.params.code);
  if (!room) return res.json({ exists: false });
  res.json({
    exists: true,
    lectureName: room.lectureName,
    count: room.students.size,
    capacity: room.capacity,
    full: room.students.size >= room.capacity
  });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({
    url: `/uploads/${req.file.filename}`,
    filename: req.file.originalname
  });
});

// ── AI 라우터(BizRouter) 설정 — OpenAI 호환 API ──────────────────────────────
// 엔드포인트가 다르면 아래 두 상수만 바꾸면 됨.
const AI_ROUTER_HOST = process.env.AI_ROUTER_HOST || 'bizrouter.ai';
const AI_ROUTER_PATH = process.env.AI_ROUTER_PATH || '/api/v1/chat/completions';
const AI_DEFAULT_MODEL = 'qwen/qwen3-coder';

app.post('/api/ai/chat', (req, res) => {
  const { messages, model, apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'API 키가 필요합니다.' });
  if (!messages || !messages.length) return res.status(400).json({ error: '메시지가 필요합니다.' });

  const modelId = model || AI_DEFAULT_MODEL;
  const body = JSON.stringify({ model: modelId, messages });

  const options = {
    hostname: AI_ROUTER_HOST,
    path: AI_ROUTER_PATH,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://edutalk.app',
      'X-Title': 'EduTalk'
    }
  };

  const proxyReq = https.request(options, proxyRes => {
    let data = '';
    proxyRes.on('data', chunk => data += chunk);
    proxyRes.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (proxyRes.statusCode !== 200) {
          return res.status(proxyRes.statusCode).json({ error: parsed.error?.message || '오류 발생' });
        }
        const content = parsed.choices?.[0]?.message?.content || '';
        res.json({ content });
      } catch (e) {
        res.status(500).json({ error: 'Response parse error' });
      }
    });
  });

  proxyReq.on('error', e => res.status(500).json({ error: e.message }));
  proxyReq.write(body);
  proxyReq.end();
});

// ── Socket.io ─────────────────────────────────────────────────────────────────
// Track socket → room mappings
const socketRoom = new Map();   // socketId → roomCode
const socketRole = new Map();   // socketId → 'instructor' | 'student'

function broadcastStudentList(roomCode) {
  const room = getRoom(roomCode);
  if (!room) return;
  const list = Array.from(room.students.entries()).map(([id, s]) => ({
    socketId: id,
    name: s.name,
    emoji: s.emoji
  }));
  io.to(roomCode).emit('student:list', list);
}

function broadcastStaffList(roomCode) {
  const room = getRoom(roomCode);
  if (!room) return;
  const list = Array.from(room.assistants.entries()).map(([id, a]) => ({
    socketId: id,
    name: a.name
  }));
  io.to(roomCode).emit('staff:list', list);
}

// 운영진(주강사 + 조교)에게만 이벤트 전송 — 실시간 설문 집계 등 학생에게 노출하지 않을 정보
function emitToStaff(room, event, payload) {
  const ids = [room.instructorSocketId, ...room.assistants.keys()].filter(Boolean);
  ids.forEach(id => {
    const s = io.sockets.sockets.get(id);
    if (s) s.emit(event, payload);
  });
}

function systemMsg(text) {
  return {
    id: uuidv4(),
    type: 'system',
    text,
    timestamp: Date.now()
  };
}

// 방 메시지 저장 — 상한 초과 시 오래된 메시지부터 삭제 (메모리 보호)
function pushMessage(room, msg) {
  room.messages.push(msg);
  if (room.messages.length > MAX_MESSAGES) room.messages.shift();
}

io.on('connection', socket => {
  // ── Instructor join ────────────────────────────────────────────────────────
  socket.on('instructor:join', async (payload) => {
    if (!payload || typeof payload !== 'object') return;
    const { roomCode, lectureName, asAssistant, name, token } = payload;

    // Supabase access token 검증 + 승인된 프로필 확인 (강사·조교 공통)
    const auth = await authenticate(token);
    if (!auth.user) {
      socket.emit('app:error', { message: auth.error, code: 'AUTH' });
      return;
    }
    // 캐시가 아니라 DB까지 확인한다 — 승인 직후/서버 재시작 뒤에도 바로 반영되도록
    const { profile: acct, error: profErr } = await findProfile(auth.user);
    if (profErr) {
      socket.emit('app:error', { message: profErr, code: 'AUTH' });
      return;
    }
    if (!acct) {
      socket.emit('app:error', { message: '등록되지 않은 계정입니다. 로그인 화면에서 다시 로그인해 등록을 신청하세요.', code: 'AUTH' });
      return;
    }
    if (acct.status !== 'approved') {
      socket.emit('app:error', {
        message: acct.status === 'rejected'
          ? '승인이 거절된 계정입니다. 관리자에게 문의하세요.'
          : '아직 관리자 승인 대기 중입니다.',
        code: 'AUTH'
      });
      return;
    }

    if (typeof roomCode !== 'string' || !/^\d{6}$/.test(roomCode)) {
      socket.emit('app:error', { message: '올바른 방 코드가 아닙니다.' });
      return;
    }

    let room = getRoom(roomCode);
    let role;

    if (asAssistant) {
      // 보조 강사(조교): 기존 방에만 참여 가능
      if (!room) {
        socket.emit('app:error', { message: '존재하지 않는 방입니다. 방 코드를 확인하세요.' });
        return;
      }
      const assistantName = (typeof name === 'string' && name.trim()) ? name.trim().slice(0, 20) : acct.name;
      room.assistants.set(socket.id, { name: assistantName, email: acct.email });
      role = 'assistant';

      const msg = systemMsg(`🧑‍🏫 ${assistantName} 조교님이 참여했습니다.`);
      pushMessage(room, msg);
      io.to(roomCode).emit('message:new', msg);
    } else {
      // 주강사: 신규 개설 또는 재접속(소유권 회수)
      if (!room) {
        if (rooms.size >= MAX_ROOMS) {
          socket.emit('app:error', { message: `동시 개설 가능한 방이 최대 ${MAX_ROOMS}개입니다. 잠시 후 다시 시도하세요.` });
          return;
        }
        room = createRoom(roomCode, lectureName, socket.id);
        room.ownerEmail = acct.email;
      } else {
        // 다른 강사가 만든 방의 코드를 알아내 소유권을 가로채는 것 방지
        if (room.ownerEmail && room.ownerEmail !== acct.email) {
          socket.emit('app:error', { message: '이미 다른 강사가 운영 중인 방 코드입니다. 다른 코드를 사용하세요.' });
          return;
        }
        room.instructorSocketId = socket.id;
      }
      role = 'instructor';
    }

    socketRoom.set(socket.id, roomCode);
    socketRole.set(socket.id, role);
    socket.join(roomCode);

    socket.emit('instructor:joined', {
      roomCode,
      lectureName: room.lectureName,
      role,
      capacity: room.capacity,
      students: Array.from(room.students.entries()).map(([id, s]) => ({ socketId: id, name: s.name, emoji: s.emoji })),
      assistants: Array.from(room.assistants.entries()).map(([id, a]) => ({ socketId: id, name: a.name })),
      messages: room.messages,
      surveys: room.surveys,
      resources: room.resources,
      activeSurvey: room.activeSurvey,
      whiteboard: room.whiteboard
    });

    broadcastStaffList(roomCode);
    if (asAssistant) broadcastStudentList(roomCode);
  });

  // ── Student join ───────────────────────────────────────────────────────────
  socket.on('student:join', (payload) => {
    if (!payload || typeof payload !== 'object') return;
    const { roomCode } = payload;

    // 입력 정규화: 이름·이모지 길이 제한
    const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 20) : '';
    const emoji = typeof payload.emoji === 'string' ? payload.emoji.slice(0, 8) : '🙂';
    if (!name) {
      socket.emit('app:error', { message: '닉네임을 입력하세요.' });
      return;
    }

    const room = getRoom(roomCode);
    if (!room) {
      socket.emit('app:error', { message: '존재하지 않는 방입니다.' });
      return;
    }

    // 정원 검증
    if (room.students.size >= room.capacity) {
      socket.emit('app:error', { message: `정원이 가득 찼습니다. (최대 ${room.capacity}명)`, code: 'FULL' });
      return;
    }

    room.students.set(socket.id, { name, emoji });
    socketRoom.set(socket.id, roomCode);
    socketRole.set(socket.id, 'student');
    socket.join(roomCode);

    const msg = systemMsg(`${emoji} ${name}님이 입장했습니다.`);
    pushMessage(room, msg);
    io.to(roomCode).emit('message:new', msg);

    socket.emit('student:joined', {
      roomCode,
      lectureName: room.lectureName,
      messages: room.messages.filter(m => m.id !== msg.id),
      activeSurvey: room.activeSurvey,
      resources: room.resources,
      assistants: Array.from(room.assistants.entries()).map(([id, a]) => ({ socketId: id, name: a.name })),
      whiteboard: room.whiteboard
    });

    broadcastStudentList(roomCode);
    broadcastStaffList(roomCode);
  });

  // ── Chat message ───────────────────────────────────────────────────────────
  socket.on('message:send', ({ text }) => {
    const roomCode = socketRoom.get(socket.id);
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room) return;

    // 서버측 입력 검증: 빈 메시지 무시, 길이 제한
    if (typeof text !== 'string') return;
    const cleanText = text.trim().slice(0, 2000);
    if (!cleanText) return;

    const role = socketRole.get(socket.id);
    const sender = resolveSender(room, socket.id, role);
    if (!sender) return;

    const msg = {
      id: uuidv4(),
      socketId: socket.id,
      type: 'chat',
      senderType: role,
      senderName: sender.name,
      senderEmoji: sender.emoji,
      text: cleanText,
      timestamp: Date.now()
    };
    pushMessage(room, msg);
    io.to(roomCode).emit('message:new', msg);
  });

  // ── File message ───────────────────────────────────────────────────────────
  socket.on('message:file', ({ url, filename }) => {
    const roomCode = socketRoom.get(socket.id);
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room) return;

    // 보안: 서버가 발급한 업로드 경로만 허용 (javascript: 등 악성 링크 주입 차단)
    if (typeof url !== 'string' || !/^\/uploads\/[A-Za-z0-9._-]+$/.test(url)) return;
    const cleanFilename = (typeof filename === 'string' && filename.trim())
      ? filename.trim().slice(0, 200) : '파일';

    const role = socketRole.get(socket.id);
    const sender = resolveSender(room, socket.id, role);
    if (!sender) return;

    const msg = {
      id: uuidv4(),
      socketId: socket.id,
      type: 'file',
      senderType: role,
      senderName: sender.name,
      senderEmoji: sender.emoji,
      url,
      filename: cleanFilename,
      timestamp: Date.now()
    };
    pushMessage(room, msg);
    io.to(roomCode).emit('message:new', msg);
  });

  // ── Survey: understanding ──────────────────────────────────────────────────
  socket.on('survey:understanding', () => {
    const roomCode = socketRoom.get(socket.id);
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room || !canInstruct(room, socket.id)) return;

    const survey = {
      id: uuidv4(),
      type: 'understanding',
      question: '잘 이해하셨나요?',
      options: ['이해했어요! 👍', '조금 천천히 부탁해요! 🐢', '못 따라가고 있어요. 😢'],
      results: [0, 0, 0],
      total: 0,
      closed: false,
      timestamp: Date.now()
    };

    room.activeSurvey = survey;
    room.surveys.push(survey);
    room.surveyResponses.set(survey.id, new Map());

    io.to(roomCode).emit('survey:started', survey);
  });

  // ── Survey: custom ────────────────────────────────────────────────────────
  socket.on('survey:create', ({ question, options }) => {
    const roomCode = socketRoom.get(socket.id);
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room || !canInstruct(room, socket.id)) return;

    // 서버측 검증: 잘못된 페이로드(배열 아님 등)로 인한 오류 방지
    if (typeof question !== 'string' || !question.trim()) return;
    if (!Array.isArray(options)) return;
    const cleanOptions = options
      .filter(o => typeof o === 'string' && o.trim())
      .map(o => o.trim().slice(0, 200))
      .slice(0, 10);
    if (cleanOptions.length < 2) return;

    const survey = {
      id: uuidv4(),
      type: 'custom',
      question: question.trim().slice(0, 300),
      options: cleanOptions,
      results: new Array(cleanOptions.length).fill(0),
      total: 0,
      closed: false,
      timestamp: Date.now()
    };

    room.activeSurvey = survey;
    room.surveys.push(survey);
    room.surveyResponses.set(survey.id, new Map());

    io.to(roomCode).emit('survey:started', survey);
  });

  // ── Survey: respond ────────────────────────────────────────────────────────
  socket.on('survey:respond', ({ surveyId, optionIndex }) => {
    const roomCode = socketRoom.get(socket.id);
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room) return;

    const survey = room.surveys.find(s => s.id === surveyId);
    if (!survey || survey.closed) return;

    // optionIndex 범위 검증: 잘못된 인덱스로 집계가 깨지는 것을 방지
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= survey.options.length) return;

    const responses = room.surveyResponses.get(surveyId);
    if (!responses) return;

    // Allow changing vote
    if (responses.has(socket.id)) {
      const prev = responses.get(socket.id);
      survey.results[prev]--;
      survey.total--;
    }

    responses.set(socket.id, optionIndex);
    survey.results[optionIndex]++;
    survey.total++;

    socket.emit('survey:myResponse', { surveyId, optionIndex });

    // 실시간 집계는 운영진(강사+조교)에게만 전송
    emitToStaff(room, 'survey:update', {
      surveyId,
      results: survey.results,
      total: survey.total
    });
  });

  // ── Survey: close ─────────────────────────────────────────────────────────
  socket.on('survey:close', ({ surveyId }) => {
    const roomCode = socketRoom.get(socket.id);
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room || !canInstruct(room, socket.id)) return;

    const survey = room.surveys.find(s => s.id === surveyId);
    if (!survey) return;
    survey.closed = true;
    if (room.activeSurvey && room.activeSurvey.id === surveyId) {
      room.activeSurvey = null;
    }

    io.to(roomCode).emit('survey:closed', { surveyId });
  });

  // ── Survey: share results ─────────────────────────────────────────────────
  socket.on('survey:shareResults', ({ surveyId }) => {
    const roomCode = socketRoom.get(socket.id);
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room || !canInstruct(room, socket.id)) return;

    const survey = room.surveys.find(s => s.id === surveyId);
    if (!survey) return;

    io.to(roomCode).emit('survey:resultsShared', {
      surveyId,
      question: survey.question,
      options: survey.options,
      results: survey.results,
      total: survey.total
    });
  });

  // ── Resource: share ────────────────────────────────────────────────────────
  socket.on('resource:share', ({ type, url, filename, title }) => {
    const roomCode = socketRoom.get(socket.id);
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room || !canInstruct(room, socket.id)) return;

    // 보안: URL 형식 서버측 검증 — javascript: 등 악성 스킴 주입 차단
    if (typeof url !== 'string' || url.length > 2000) return;
    if (type === 'url') {
      if (!/^https?:\/\//i.test(url)) return;
    } else if (type === 'pdf') {
      if (!/^\/uploads\/[A-Za-z0-9._-]+$/.test(url)) return;
    } else {
      return;
    }

    const resource = {
      id: uuidv4(),
      type,       // 'url' | 'pdf'
      url,
      filename: (typeof filename === 'string' ? filename.slice(0, 200) : null) || null,
      title: (typeof title === 'string' && title.trim() ? title.trim().slice(0, 300) : url),
      timestamp: Date.now()
    };

    room.resources.push(resource);
    io.to(roomCode).emit('resource:shared', resource);
  });

  // ── Whiteboard: draw ─────────────────────────────────────────────────────────
  // 협업 모드 — 강사/조교/학생 누구나 그릴 수 있음. 좌표는 0~1 정규화 값.
  socket.on('whiteboard:draw', (seg) => {
    const roomCode = socketRoom.get(socket.id);
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room) return;

    // 입력 검증: 좌표·속성이 올바른 세그먼트만 허용
    if (!seg || typeof seg !== 'object') return;
    const { x0, y0, x1, y1 } = seg;
    if (![x0, y0, x1, y1].every(n => typeof n === 'number' && n >= 0 && n <= 1)) return;
    const color = typeof seg.color === 'string' ? seg.color.slice(0, 24) : '#1A2E24';
    const width = (typeof seg.width === 'number' && seg.width > 0 && seg.width <= 64) ? seg.width : 3;
    const erase = !!seg.erase;

    const clean = { type: 'stroke', x0, y0, x1, y1, color, width, erase };

    if (room.whiteboard.length < MAX_WHITEBOARD_SEGMENTS) {
      room.whiteboard.push(clean);
    }
    // 그린 본인 제외하고 같은 방에 전파
    socket.to(roomCode).emit('whiteboard:draw', clean);
  });

  // ── Whiteboard: image ────────────────────────────────────────────────────────
  // 이미지 파일 / 화면 캡처를 보드에 삽입. url 은 우리 업로드 경로(/uploads/)만 허용.
  socket.on('whiteboard:image', (img) => {
    const roomCode = socketRoom.get(socket.id);
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room) return;

    if (!img || typeof img !== 'object') return;
    const { url, x, y, w, h } = img;
    // 보안: 서버가 발급한 업로드 경로만 허용 (외부 URL 주입 차단)
    if (typeof url !== 'string' || !/^\/uploads\/[A-Za-z0-9._-]+$/.test(url)) return;
    if (![x, y].every(n => typeof n === 'number' && n >= 0 && n <= 1)) return;
    if (![w, h].every(n => typeof n === 'number' && n > 0 && n <= 1)) return;

    const item = { type: 'image', id: uuidv4(), url, x, y, w, h };

    if (room.whiteboard.length < MAX_WHITEBOARD_SEGMENTS) {
      room.whiteboard.push(item);
    }
    // 삽입한 본인 포함 전체에 전파 (본인도 동일 좌표로 렌더)
    io.to(roomCode).emit('whiteboard:image', item);
  });

  // ── Whiteboard: clear ─────────────────────────────────────────────────────────
  // 전체 지우기는 강사/조교만 가능
  socket.on('whiteboard:clear', () => {
    const roomCode = socketRoom.get(socket.id);
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room || !canInstruct(room, socket.id)) return;

    room.whiteboard = [];
    io.to(roomCode).emit('whiteboard:cleared');
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const roomCode = socketRoom.get(socket.id);
    if (!roomCode) return;

    const room = getRoom(roomCode);
    if (!room) return;

    const role = socketRole.get(socket.id);

    if (role === 'student') {
      const s = room.students.get(socket.id);
      if (s) {
        room.students.delete(socket.id);
        const msg = systemMsg(`${s.emoji} ${s.name}님이 퇴장했습니다.`);
        pushMessage(room, msg);
        io.to(roomCode).emit('message:new', msg);
        broadcastStudentList(roomCode);
      }
    } else if (role === 'assistant') {
      const a = room.assistants.get(socket.id);
      if (a) {
        room.assistants.delete(socket.id);
        io.to(roomCode).emit('message:new', systemMsg(`🧑‍🏫 ${a.name} 조교님이 퇴장했습니다.`));
        broadcastStaffList(roomCode);
      }
    } else if (role === 'instructor') {
      // 강사 소켓이 끊기면 stale id 정리 (재접속 시 instructor:join 에서 다시 설정)
      if (room.instructorSocketId === socket.id) {
        room.instructorSocketId = null;
      }
      // Notify students instructor left
      io.to(roomCode).emit('message:new', systemMsg('강사님이 퇴장했습니다.'));
    }

    socketRoom.delete(socket.id);
    socketRole.delete(socket.id);
  });
});

// ── Midnight room cleanup ─────────────────────────────────────────────────────
function scheduleRoomCleanup() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight.getTime() - now.getTime();

  setTimeout(() => {
    const count = rooms.size;
    rooms.clear();
    socketRoom.clear();
    socketRole.clear();
    io.emit('room:expired', { reason: '자정이 지나 오늘의 모든 강의방이 초기화되었습니다.' });
    console.log(`Midnight cleanup: cleared ${count} rooms at ${new Date().toISOString()}`);
    scheduleRoomCleanup();
  }, msUntilMidnight);

  const mins = Math.round(msUntilMidnight / 60000);
  console.log(`Room cleanup scheduled in ${mins} minutes (at midnight)`);
}

scheduleRoomCleanup();

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`EduTalk v3 running on http://localhost:${PORT}`);
});
