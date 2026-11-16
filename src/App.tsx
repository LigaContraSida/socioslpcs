import React, { useState, useEffect } from 'react';
import { User } from './types.ts';
import { Header } from './components/Header.tsx';
import { Footer } from './components/Footer.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { PartnersPage } from './pages/PartnersPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { PaymentsPage } from './pages/PaymentsPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { MerchantValidatePage } from './pages/MerchantValidatePage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { PartnershipPage } from './pages/PartnershipPage.tsx';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname || '/');
  const [routeQuery, setRouteQuery] = useState<Record<string, string>>({});

  const fetchCurrentUser = async (): Promise<User | null> => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        setIsAdmin(!!data.isAdmin);
        return data.user;
      } else {
        setUser(null);
        setIsAdmin(false);
        return null;
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
      setUser(null);
      setIsAdmin(false);
      return null;
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();

    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      const searchParams = new URLSearchParams(window.location.search);
      const queryObj: Record<string, string> = {};
      searchParams.forEach((val, key) => {
        queryObj[key] = val;
      });
      setRouteQuery(queryObj);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string, query?: Record<string, string>) => {
    let url = path;
    if (query && Object.keys(query).length > 0) {
      const sp = new URLSearchParams(query);
      url += `?${sp.toString()}`;
    }
    window.history.pushState({}, '', url);
    setCurrentPath(path);
    setRouteQuery(query || {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    setUser(null);
    setIsAdmin(false);
    navigate('/');
  };

  // Render current view
  const renderPage = () => {
    if (loadingUser) {
      return (
        <div className="py-32 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#C81E2B] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-stone-500 font-medium">A carregar Portal LPCS...</p>
        </div>
      );
    }

    if (currentPath === '/parceiros') {
      return (
        <PartnersPage
          user={user}
          initialQuery={routeQuery}
          onNavigate={navigate}
        />
      );
    }

    if (currentPath === '/validar') {
      return <MerchantValidatePage />;
    }

    if (currentPath === '/entrar') {
      return (
        <LoginPage
          onNavigate={navigate}
          onRefreshUser={fetchCurrentUser}
        />
      );
    }

    if (currentPath === '/registar') {
      return (
        <RegisterPage
          onNavigate={navigate}
          onRefreshUser={fetchCurrentUser}
        />
      );
    }

    if (currentPath === '/dashboard') {
      if (!user) {
        return (
          <LoginPage
            onNavigate={navigate}
            onRefreshUser={fetchCurrentUser}
          />
        );
      }
      return (
        <DashboardPage
          user={user}
          onNavigate={navigate}
          onRefreshUser={fetchCurrentUser}
        />
      );
    }

    if (currentPath === '/pagamentos') {
      if (!user) {
        return (
          <LoginPage
            onNavigate={navigate}
            onRefreshUser={fetchCurrentUser}
          />
        );
      }
      return (
        <PaymentsPage
          user={user}
          onRefreshUser={fetchCurrentUser}
        />
      );
    }

    if (currentPath === '/perfil') {
      if (!user) {
        return (
          <LoginPage
            onNavigate={navigate}
            onRefreshUser={fetchCurrentUser}
          />
        );
      }
      return (
        <ProfilePage
          user={user}
          onRefreshUser={fetchCurrentUser}
        />
      );
    }

    if (currentPath === '/parceria') {
      return <PartnershipPage onNavigate={navigate} />;
    }

    if (currentPath === '/admin') {
      return (
        <AdminPage
          user={user}
          isAdmin={isAdmin}
          onNavigate={navigate}
          onRefreshUser={fetchCurrentUser}
          onLogout={handleLogout}
        />
      );
    }

    // Default: Home
    return <HomePage user={user} onNavigate={navigate} onRefreshUser={fetchCurrentUser} />;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#141619]">
      <Header
        user={user}
        isAdmin={isAdmin}
        currentPath={currentPath}
        onNavigate={navigate}
        onLogout={handleLogout}
      />
      
      <main className="flex-1">
        {renderPage()}
      </main>

      <Footer onNavigate={navigate} />
    </div>
  );
}
