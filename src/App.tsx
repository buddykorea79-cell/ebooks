import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { isSupabaseConfigured } from './lib/supabase'
import ConfigRequired from './components/ConfigRequired'
import RequireAuth from './components/RequireAuth'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import MyLibraryPage from './pages/MyLibraryPage'

// 무거운 페이지는 지연 로딩으로 분리 (특히 편집 페이지는 CodeMirror를 포함)
const BookEditPage = lazy(() => import('./pages/BookEditPage'))
const BookViewerPage = lazy(() => import('./pages/BookViewerPage'))
const DocsPage = lazy(() => import('./pages/DocsPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))

export default function App() {
  if (!isSupabaseConfigured) {
    return <ConfigRequired />
  }

  return (
    <AuthProvider>
      <HashRouter>
        <Suspense
          fallback={<div className="py-16 text-center text-gray-500">불러오는 중…</div>}
        >
          <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route element={<RequireAuth />}>
              <Route path="my" element={<MyLibraryPage />} />
              <Route path="book/:bookId/edit" element={<BookEditPage />} />
              <Route path="admin" element={<AdminPage />} />
            </Route>
          </Route>
          {/* 뷰어는 사이드바 중심의 자체 레이아웃을 사용 */}
          <Route path="/book/:bookId" element={<BookViewerPage />} />
          <Route path="/book/:bookId/:menuId" element={<BookViewerPage />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </AuthProvider>
  )
}
