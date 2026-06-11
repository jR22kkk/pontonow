/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, addDoc, doc, setDoc } from 'firebase/firestore';
import { Employee, Punch } from '../types';
import { maskPhone } from '../utils';
import { User, Phone, Shield, Database, Loader2, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginScreenProps {
  onLoginSuccess: (user: Employee) => void;
  onAdminLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess, onAdminLoginSuccess }: LoginScreenProps) {
  const [activeTab, setActiveTab] = useState<'employee' | 'admin'>('employee');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [adminCode, setAdminCode] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [stats, setStats] = useState({ employees: 0, punches: 0 });

  // Load current statistics to inspect if database is empty
  useEffect(() => {
    async function loadStats() {
      try {
        const empSnap = await getDocs(collection(db, 'employees'));
        const pncSnap = await getDocs(collection(db, 'punches'));
        setStats({
          employees: empSnap.size,
          punches: pncSnap.size
        });
      } catch (err) {
        console.error('Falha ao contar estatísticas iniciais:', err);
      }
    }
    loadStats();
  }, [seeding]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setPhone(maskPhone(raw));
  };

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, informe seu nome completo.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Por favor, informe um número de celular válido com DDD.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const employeesSnap = await getDocs(collection(db, 'employees'));
      const employeesList: Employee[] = [];
      employeesSnap.forEach((doc) => {
        const data = doc.data();
        employeesList.push({
          id: doc.id,
          name: data.name,
          phone: data.phone,
          isActive: data.isActive,
          role: data.role,
          createdAt: data.createdAt,
        });
      });

      // Find first matching active employee
      const cleanInputPhone = phone.replace(/\D/g, '');
      const matched = employeesList.find((emp) => {
        const cleanEmpPhone = emp.phone.replace(/\D/g, '');
        const nameMatches = emp.name.trim().toLowerCase() === name.trim().toLowerCase();
        const phoneMatches = cleanEmpPhone === cleanInputPhone;
        return nameMatches && phoneMatches && emp.isActive;
      });

      if (matched) {
        onLoginSuccess(matched);
      } else {
        // Look up deactivated employee to show descriptive error
        const deact = employeesList.find((emp) => {
          const cleanEmpPhone = emp.phone.replace(/\D/g, '');
          const nameMatches = emp.name.trim().toLowerCase() === name.trim().toLowerCase();
          const phoneMatches = cleanEmpPhone === cleanInputPhone;
          return nameMatches && phoneMatches && !emp.isActive;
        });

        if (deact) {
          setError('Este funcionário foi desativado pelo administrador.');
        } else {
          setError('Funcionário não cadastrado ou dados incorretos. Contate o administrador.');
        }
      }
    } catch (err) {
      setError('Erro ao autenticar. Verifique sua conexão.');
      handleFirestoreError(err, OperationType.LIST, 'employees');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (adminCode === 'admin123' || adminCode === '1234') {
      onAdminLoginSuccess();
      return;
    }

    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'employees'));
      let matchedAdmin = false;
      snap.forEach((doc) => {
        const data = doc.data();
        if (data.role === 'admin' && data.isActive && data.pin === adminCode) {
          matchedAdmin = true;
        }
      });

      if (matchedAdmin) {
        onAdminLoginSuccess();
      } else {
        setError('Código de administrador inválido! (Dica: utilize seu PIN cadastrado ou "admin123")');
      }
    } catch (err) {
      setError('Por favor, utilize o código de administrador fallback "admin123".');
    } finally {
      setLoading(false);
    }
  };

  // Setup rich initial demo data (perfect for first launch)
  const handleSeedData = async () => {
    setSeeding(true);
    setError(null);
    try {
      const defaultUsers = [
        { name: 'Ana Carolina Silva', phone: '(11) 98765-4321', isActive: true, role: 'employee', createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
        { name: 'Carlos Henrique Souza', phone: '(11) 91234-5678', isActive: true, role: 'employee', createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
        { name: 'Mariana Rodrigues Oliveira', phone: '(21) 99888-7777', isActive: true, role: 'employee', createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
        { name: 'Roberto Alencar (Admin)', phone: '(11) 90000-1111', isActive: true, role: 'admin', createdAt: new Date().toISOString() },
        { name: 'José Albuquerque (Inativo)', phone: '(81) 97777-6666', isActive: false, role: 'employee', createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString() }
      ];

      // Add default employees
      const employeeIds: string[] = [];
      for (const u of defaultUsers) {
        const docRef = await addDoc(collection(db, 'employees'), u);
        employeeIds.push(docRef.id);
      }

      // Base64 Placeholder SVGs
      const placeholderImg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23a1c4fd"/><stop offset="100%" stop-color="%23c2e9fb"/></linearGradient></defs><rect width="300" height="300" fill="url(%23g)"/><circle cx="150" cy="110" r="45" fill="%234a5568"/><path d="M70,230 C70,180 110,165 150,165 C190,165 230,180 230,230" fill="%234a5568"/><circle cx="150" cy="150" r="120" fill="none" stroke="%23ffffff" stroke-width="6" opacity="0.3"/><text x="150" y="275" font-family="sans-serif" font-size="14" fill="%232d3748" font-weight="bold" text-anchor="middle">Selfie Confirmada (GPS Ativo)</text></svg>';

      // Generate history records for yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayISO = yesterday.toISOString().split('T')[0];

      const seedPunchesList = [
        // Ana Carolina yesterday
        {
          employeeId: employeeIds[0],
          employeeName: defaultUsers[0].name,
          employeePhone: defaultUsers[0].phone,
          timestamp: `${yesterdayISO}T08:02:15.000Z`,
          type: 'entrada',
          photo: placeholderImg,
          latitude: -23.55052,
          longitude: -46.633308, // Sao Paulo Central
          createdAt: `${yesterdayISO}T08:02:15.000Z`
        },
        {
          employeeId: employeeIds[0],
          employeeName: defaultUsers[0].name,
          employeePhone: defaultUsers[0].phone,
          timestamp: `${yesterdayISO}T12:05:40.000Z`,
          type: 'intervalo_saida',
          photo: placeholderImg,
          latitude: -23.55102,
          longitude: -46.633808,
          createdAt: `${yesterdayISO}T12:05:40.000Z`
        },
        {
          employeeId: employeeIds[0],
          employeeName: defaultUsers[0].name,
          employeePhone: defaultUsers[0].phone,
          timestamp: `${yesterdayISO}T13:01:10.000Z`,
          type: 'intervalo_entrada',
          photo: placeholderImg,
          latitude: -23.55042,
          longitude: -46.632908,
          createdAt: `${yesterdayISO}T13:01:10.000Z`
        },
        {
          employeeId: employeeIds[0],
          employeeName: defaultUsers[0].name,
          employeePhone: defaultUsers[0].phone,
          timestamp: `${yesterdayISO}T17:10:05.000Z`,
          type: 'saida',
          photo: placeholderImg,
          latitude: -23.55092,
          longitude: -46.633108,
          createdAt: `${yesterdayISO}T17:10:05.000Z`
        },
        // Carlos Henrique yesterday
        {
          employeeId: employeeIds[1],
          employeeName: defaultUsers[1].name,
          employeePhone: defaultUsers[1].phone,
          timestamp: `${yesterdayISO}T09:12:00.000Z`,
          type: 'entrada',
          photo: placeholderImg,
          latitude: -23.55824,
          longitude: -46.66118, // Paulista Avenida region
          createdAt: `${yesterdayISO}T09:12:00.000Z`
        },
        {
          employeeId: employeeIds[1],
          employeeName: defaultUsers[1].name,
          employeePhone: defaultUsers[1].phone,
          timestamp: `${yesterdayISO}T18:15:22.000Z`,
          type: 'saida',
          photo: placeholderImg,
          latitude: -23.55834,
          longitude: -46.66108,
          createdAt: `${yesterdayISO}T18:15:22.000Z`
        }
      ];

      for (const p of seedPunchesList) {
        await addDoc(collection(db, 'punches'), p);
      }

      alert('Dados de demonstração inseridos com sucesso! Use "Ana Carolina Silva" e "(11) 98765-4321" para login de teste.');
    } catch (err) {
      setError('Falha ao criar dados de demonstração: ' + String(err));
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto" id="login-screen-widget">
      {/* Visual Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-2xl shadow-lg ring-4 ring-blue-500/10 mb-4">
          <Clock className="w-8 h-8" />
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          PontoNow
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
          Controle de ponto corporativo com precisão GPS e foto
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-3xl shadow-xl overflow-hidden">
        {/* Modern Segmented Navigation (Like iOS segmented control) */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-150 dark:border-slate-850">
          <div className="flex bg-slate-200/60 dark:bg-slate-850 p-1 rounded-2xl">
            <button
              id="login-tab-employee"
              onClick={() => { setActiveTab('employee'); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-xl transition duration-200 ${
                activeTab === 'employee'
                  ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <User className="w-4 h-4" />
              Funcionário
            </button>
            <button
              id="login-tab-admin"
              onClick={() => { setActiveTab('admin'); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-xl transition duration-200 ${
                activeTab === 'admin'
                  ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              Administração
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="p-6">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-xs rounded-2xl"
              id="login-error-toast"
            >
              {error}
            </motion.div>
          )}

          {activeTab === 'employee' ? (
            <form onSubmit={handleEmployeeLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Nome Completo
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <User className="w-5 h-5" />
                  </span>
                  <input
                    id="employee-login-name-input"
                    type="text"
                    required
                    placeholder="Ex: Ana Carolina Silva"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Número de Celular (com DDD)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Phone className="w-5 h-5" />
                  </span>
                  <input
                    id="employee-login-phone-input"
                    type="text"
                    required
                    placeholder="(11) 98765-4321"
                    value={phone}
                    onChange={handlePhoneChange}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition font-mono"
                  />
                </div>
              </div>

              <button
                id="employee-login-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium text-sm rounded-2xl shadow-lg shadow-blue-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar na folha de ponto'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Código de Autenticação Admin
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Shield className="w-5 h-5" />
                  </span>
                  <input
                    id="admin-login-code-input"
                    type="password"
                    required
                    placeholder="Dispositivo de acesso"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Como administrador, você pode gerenciar a lista de funcionários ativos, aprovar admissões e monitorar logs e localizações.
              </p>

              <button
                id="admin-login-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700/20 text-white font-medium text-sm rounded-2xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Acessar Painel Web'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Database Seeder Block for Fresh project runs */}
      {stats.employees === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 p-5 bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40 rounded-3xl flex flex-col items-center text-center gap-3"
          id="seed-demo-data-ad"
        >
          <div className="w-10 h-10 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Banco de dados vazio!
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
              Configure instâncias de demonstração para testar filtros, fotos do aplicativo de ponto e mapas no painel administrativo instantaneamente.
            </p>
          </div>
          <button
            id="seed-demo-data-btn"
            onClick={handleSeedData}
            disabled={seeding}
            className="flex items-center gap-2 py-2 px-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-xl shadow-sm border border-slate-250/50 dark:border-slate-870 cursor-pointer transition"
          >
            {seeding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Seeding...
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                Criar Funcionários e Histórico Demo
              </>
            )}
          </button>
        </motion.div>
      )}
    </div>
  );
}
