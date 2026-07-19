import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/** 로그인이 필요한 라우트 가드. 미로그인 시 /login으로 보내고, 로그인 후 원래 위치로 복귀한다. */
export default function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="py-16 text-center text-gray-500">세션 확인 중…</div>
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
