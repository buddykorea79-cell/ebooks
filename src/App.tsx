import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { isSupabaseConfigured } from './lib/supabase'
import ConfigRequired from './components/ConfigRequired'
import RequireAuth from './components/RequireAuth'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import MyLibraryPage from './pages/MyLibraryPage'
import BookEditPage from './pages/BookEditPage'
import BookViewerPage from './pages/BookViewerPage'

export default function App() {
  if (!isSupabaseConfigured) {
    return <ConfigRequired />
  }

  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route element={<RequireAuth />}>
              <Route path="my" element={<MyLibraryPage />} />
              <Route path="book/:bookId/edit" element={<BookEditPage />} />
            </Route>
          </Route>
          {/* 뷰어는 사이드바 중심의 자체 레이아웃을 사용 */}
          <Route path="/book/:bookId" element={<BookViewerPage />} />
          <Route path="/book/:bookId/:menuId" element={<BookViewerPage />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
