import { Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Role-based frontend route guard (UX layer; Django DRF backend enforces authoritative security).
 * Waits for initial silent HttpOnly cookie refresh before redirecting to /login.
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, authLoading, getDashboardUrl } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F6F7F9] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#2E9A90]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDashboardUrl()} replace />;
  }

  return children;
}
