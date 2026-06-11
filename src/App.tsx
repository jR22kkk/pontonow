/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Employee } from './types';
import LoginScreen from './components/LoginScreen';
import EmployeeDashboard from './components/EmployeeDashboard';
import AdminDashboard from './components/AdminDashboard';
import ThemeToggle from './components/ThemeToggle';
import { Clock, ShieldAlert, Sparkles, Building2, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<Employee | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check persistent session from local storage on launch
  useEffect(() => {
    const cachedUser = localStorage.getItem('session_user');
    const cachedIsAdmin = localStorage.getItem('session_is_admin');

    if (cachedIsAdmin === 'true') {
      setIsAdmin(true);
    } else if (cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
      } catch (e) {
        console.error('Falha ao parsear sessão armazenada:', e);
        localStorage.removeItem('session_user');
      }
    }
    setCheckingSession(false);
  }, []);

  const handleEmployeeLoginSuccess = (loggedInUser: Employee) => {
    setUser(loggedInUser);
    setIsAdmin(false);
    localStorage.setItem('session_user', JSON.stringify(loggedInUser));
    localStorage.removeItem('session_is_admin');
  };

  const handleAdminLoginSuccess = () => {
    setIsAdmin(true);
    setUser(null);
    localStorage.setItem('session_is_admin', 'true');
    localStorage.removeItem('session_user');
  };

  const handleLogout = () => {
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem('session_user');
    localStorage.removeItem('session_is_admin');
  };

  if (checkingSession) {
    return (
      <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-3" id="app-loading-screen">
        <Clock className="w-10 h-10 animate-spin text-blue-600" />
        <span className="text-sm text-slate-500 font-medium">Restaurando sessão criptografada...</span>
      </div>
    );
  }

  const pageTransition = {
    initial: { opacity: 0, y: 16, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -16, scale: 0.985 },
    transition: {
      type: "spring",
      stiffness: 240,
      damping: 24,
      mass: 0.8
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300" id="main-application-container">
      
      {/* Top Universal Floating Header */}
      <header className="sticky top-0 z-40 bg-white/70 dark:bg-[#090d16]/75 backdrop-blur-md border-b border-slate-100 dark:border-slate-900/80 p-4">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo Brand Brand */}
          <div className="flex items-center gap-2" id="app-top-logo">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm tracking-tighter">
              P
            </div>
            <div>
              <span className="font-display font-black text-sm tracking-tight text-slate-850 dark:text-slate-100">
                PontoNow
              </span>
              <span className="block text-[8px] tracking-widest text-slate-400 font-bold uppercase -mt-1 leading-none">
                Biométrico
              </span>
            </div>
          </div>

          {/* Quick Info bar or toggler */}
          <div className="flex items-center gap-3">
            {isAdmin && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2.5 py-1 rounded-full">
                <ShieldAlert className="w-3.5 h-3.5" /> Administrador
              </span>
            )}

            {user && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-800">
                Colaborador: <strong className="font-semibold text-slate-700 dark:text-slate-300">{user.name.split(' ')[0]}</strong>
              </span>
            )}
            
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Container body */}
      <main className="flex-1 flex flex-col p-4 sm:p-6 w-full max-w-7xl mx-auto items-center justify-center">
        <AnimatePresence mode="wait">
          {!user && !isAdmin ? (
            /* Login flow visualizer */
            <motion.div
              key="login"
              {...pageTransition}
              className="w-full py-8"
            >
              <LoginScreen 
                onLoginSuccess={handleEmployeeLoginSuccess}
                onAdminLoginSuccess={handleAdminLoginSuccess}
              />
            </motion.div>
          ) : user ? (
            /* Employee control dashboard */
            <motion.div
              key="employee"
              {...pageTransition}
              className="w-full py-4 text-center"
            >
              <EmployeeDashboard 
                user={user}
                onLogout={handleLogout}
              />
            </motion.div>
          ) : (
            /* Admin backoffice panel */
            <motion.div
              key="admin"
              {...pageTransition}
              className="w-full py-4"
            >
              <AdminDashboard 
                onLogout={handleLogout}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* App footer branding */}
      <footer className="py-6 border-t border-slate-100 dark:border-slate-900/60 text-center text-[11px] text-slate-400 dark:text-slate-600 gap-1 flex flex-col sm:flex-row items-center justify-center" id="app-system-footer">
        <span>© 2026 PontoNow Eletrônico Ltda. Todos os direitos reservados.</span>
        <span className="hidden sm:inline">•</span>
        <span className="flex items-center gap-1">
          <Building2 className="w-3 h-3" /> Matriz da Corporação • Conformidade MTE Portaria 671
        </span>
      </footer>

    </div>
  );
}
