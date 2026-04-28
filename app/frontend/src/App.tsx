import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import AppShell from './components/layout/AppShell';
import { clearSession, getSessionRole } from './lib/api';
import type { RoleName } from './types';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import StoragePage from './pages/StoragePage';
import StockPage from './pages/StockPage';
import BillingPage from './pages/BillingPage';
import SalesPage from './pages/SalesPage';
import LoginPage from './pages/LoginPage';

export default function App() {
  const location = useLocation();
  const [role, setRole] = useState<RoleName | null>(getSessionRole() as RoleName | null);

  useEffect(() => {
    setRole(getSessionRole() as RoleName | null);
  }, [location.pathname]);

  function handleLogout() {
    clearSession();
    setRole(null);
  }

  if (!role && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={(nextRole) => setRole(nextRole as RoleName)} />} />
      <Route
        path="/*"
        element={
          role ? (
            <AppShell role={role} onLogout={handleLogout}>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/employees" element={role === 'Employee' ? <Navigate to="/" replace /> : <EmployeesPage />} />
                <Route path="/storage" element={<StoragePage />} />
                <Route path="/stock" element={<StockPage />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/sales" element={role === 'Employee' ? <Navigate to="/" replace /> : <SalesPage />} />
              </Routes>
            </AppShell>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}
