import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, BookOpen, LogOut, Settings, Eye, ShieldCheck, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function AppLayout() {
  const { profile, signOut, isAdmin, isAdminAccount, viewMode, toggleViewMode } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const homePath = isAdmin ? '/admin' : '/';

  const handleToggleView = () => {
    toggleViewMode();
    navigate(viewMode === 'admin' ? '/' : '/admin');
  };

  return (
    <div className="app-container">
      <div className="bg-blobs" aria-hidden="true">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      <nav className="navbar">
        <div className="nav-brand" onClick={() => navigate(homePath)}>
          <div className="nav-logo-icon">M</div>
          <span className="nav-title">MicroLearn AI</span>
        </div>
        <div className="nav-links">
          <button
            className={`nav-link ${location.pathname === homePath ? 'active' : ''}`}
            onClick={() => navigate(homePath)}
          >
            <LayoutDashboard size={16} /> {isAdmin ? 'Admin' : 'My Learning'}
          </button>
          {isAdmin && (
            <>
              <button
                className={`nav-link ${location.pathname.startsWith('/admin/courses') ? 'active' : ''}`}
                onClick={() => navigate('/admin/courses/new')}
              >
                <BookOpen size={16} /> New Course
              </button>
              <button
                className={`nav-link ${location.pathname === '/admin/settings' ? 'active' : ''}`}
                onClick={() => navigate('/admin/settings')}
              >
                <Settings size={16} /> AI Settings
              </button>
            </>
          )}
          <button className="nav-link btn-icon" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {isAdminAccount && (
            <button className="nav-link view-toggle" onClick={handleToggleView} title="Switch between Admin and Student views without logging out">
              {viewMode === 'admin' ? <><Eye size={16} /> View as Student</> : <><ShieldCheck size={16} /> Back to Admin</>}
            </button>
          )}
          <span className="nav-user">{profile?.full_name ?? 'User'}</span>
          <button className="nav-link" onClick={() => signOut()}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
