import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../shared/Spinner';

interface Props {
  children: ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin }: Props) {
  const { user, profile, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="full-screen-center">
        <Spinner size={40} />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />;
  if (!requireAdmin && isAdmin && profile) return <Navigate to="/admin" replace />;

  return <>{children}</>;
}
