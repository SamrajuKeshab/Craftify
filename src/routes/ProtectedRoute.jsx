import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Role-based frontend route guard (UX layer; Django DRF backend enforces authoritative security).
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, getDashboardUrl } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDashboardUrl()} replace />;
  }

  return children;
}
