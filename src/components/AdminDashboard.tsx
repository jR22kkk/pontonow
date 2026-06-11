/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Employee, Punch, PunchType } from '../types';
import { formatDate, formatTime, getPunchTypeDetails, exportPunchesToCSV, exportPunchesToPDF } from '../utils';
import { 
  Users, Calendar, Clock, MapPin, Search, Plus, Edit2, 
  Trash2, ArrowLeft, Download, Eye, CheckCircle2, XCircle, 
  Filter, AlertCircle, Shield, MoreVertical, Sparkles, Check, UserPlus,
  Loader2, X
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

interface AdminDashboardProps {
  onLogout: () => void;
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view: 'punches' (Default logs view) or 'employees' (Employees CRUD)
  const [activeTab, setActiveTab] = useState<'punches' | 'employees'>('punches');

  // Filters for punche logs
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected punch for detailing drawer
  const [selectedPunch, setSelectedPunch] = useState<Punch | null>(null);

  // Employee CRUD Modal/Form state
  const [crudModalOpen, setCrudModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formRole, setFormRole] = useState<'employee' | 'admin'>('employee');
  const [formPin, setFormPin] = useState('');
  const [crudError, setCrudError] = useState<string | null>(null);
  const [crudSubmitting, setCrudSubmitting] = useState(false);

  // Deletion Modal state
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load backend data from Firestore
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Employees
      const employeesSnap = await getDocs(collection(db, 'employees'));
      const empList: Employee[] = [];
      employeesSnap.forEach((doc) => {
        const d = doc.data();
        empList.push({
          id: doc.id,
          name: d.name,
          phone: d.phone,
          isActive: d.isActive ?? true,
          role: d.role ?? 'employee',
          createdAt: d.createdAt || new Date().toISOString()
        });
      });
      // Sort alphabetically
      empList.sort((a, b) => a.name.localeCompare(b.name));
      setEmployees(empList);

      // 2. Fetch Punches
      const punchesSnap = await getDocs(collection(db, 'punches'));
      const punchList: Punch[] = [];
      punchesSnap.forEach((doc) => {
        const d = doc.data();
        punchList.push({
          id: doc.id,
          employeeId: d.employeeId,
          employeeName: d.employeeName || 'Colaborador',
          employeePhone: d.employeePhone || '',
          timestamp: d.timestamp,
          type: d.type as PunchType,
          photo: d.photo,
          latitude: d.latitude,
          longitude: d.longitude,
          createdAt: d.createdAt
        });
      });
      // Sort newest first
      punchList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPunches(punchList);

    } catch (err) {
      console.error('Falha ao carregar registros do painel admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter punches list based on selection
  const filteredPunches = punches.filter(p => {
    // 1. Employee query filter
    if (filterEmployeeId !== 'all' && p.employeeId !== filterEmployeeId) return false;

    // 2. Date match
    if (filterDate) {
      const punchDateStr = p.timestamp.split('T')[0];
      if (punchDateStr !== filterDate) return false;
    }

    // 3. Punch category type
    if (filterType !== 'all' && p.type !== filterType) return false;

    // 4. Case-insensitive search query (name or phone)
    if (searchQuery.trim() !== '') {
      const queryStr = searchQuery.toLowerCase();
      const nameMatch = p.employeeName?.toLowerCase().includes(queryStr);
      const phoneMatch = p.employeePhone?.includes(queryStr);
      if (!nameMatch && !phoneMatch) return false;
    }

    return true;
  });

  // Export filtered logs to CSV spreadsheet
  const handleExportCSV = () => {
    const employeesMap: Record<string, string> = {};
    employees.forEach(e => {
      employeesMap[e.id] = e.name;
    });

    const csvData = exportPunchesToCSV(filteredPunches, employeesMap);
    
    // Trigger download in client browser
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `folha_pontos_exportados_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export filtered logs to PDF report
  const handleExportPDF = () => {
    const employeesMap: Record<string, string> = {};
    employees.forEach(e => {
      employeesMap[e.id] = e.name;
    });

    exportPunchesToPDF(filteredPunches, employeesMap);
  };

  // Trigger Register Employee modal
  const handleOpenCreateModal = () => {
    setEditingEmployee(null);
    setFormName('');
    setFormPhone('');
    setFormIsActive(true);
    setFormRole('employee');
    setFormPin('');
    setCrudError(null);
    setCrudModalOpen(true);
  };

  // Trigger Edit Employee modal
  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormName(emp.name);
    setFormPhone(emp.phone);
    setFormIsActive(emp.isActive);
    setFormRole(emp.role);
    setFormPin(emp.pin || '');
    setCrudError(null);
    setCrudModalOpen(true);
  };

  // Save Employee Form (Create / Edit) in Firestore
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setCrudError('O nome completo é obrigatório.');
      return;
    }
    if (formPhone.replace(/\D/g, '').length < 10) {
      setCrudError('Insira um número de celular válido com DDD.');
      return;
    }
    if (formRole === 'admin' && !formPin.trim()) {
      setCrudError('Para administradores, o PIN de acesso numérico é obrigatório.');
      return;
    }

    setCrudSubmitting(true);
    setCrudError(null);

    try {
      if (editingEmployee) {
        // Edit flow
        const docRef = doc(db, 'employees', editingEmployee.id);
        const updatedFields = {
          name: formName.trim(),
          phone: formPhone.trim(),
          isActive: formIsActive,
          role: formRole,
          pin: formRole === 'admin' ? formPin.trim() : ''
        };
        await updateDoc(docRef, updatedFields);
      } else {
        // Create flow
        const newEmp = {
          name: formName.trim(),
          phone: formPhone.trim(),
          isActive: formIsActive,
          role: formRole,
          pin: formRole === 'admin' ? formPin.trim() : '',
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'employees'), newEmp);
      }

      setCrudModalOpen(false);
      loadData(); // refresh list
    } catch (err) {
      setCrudError('Falha ao gravar funcionário no banco de dados.');
      handleFirestoreError(err, OperationType.WRITE, 'employees');
    } finally {
      setCrudSubmitting(false);
    }
  };

  // Quick Inline employee active-status switch
  const handleToggleActiveStatus = async (emp: Employee) => {
    try {
      const docRef = doc(db, 'employees', emp.id);
      await updateDoc(docRef, { isActive: !emp.isActive });
      loadData();
    } catch (err) {
      alert('Ocorreu um erro ao atualizar o status do funcionário.');
      handleFirestoreError(err, OperationType.UPDATE, `employees/${emp.id}`);
    }
  };

  // Delete employee from Firestore database
  const handleDeleteEmployee = async (empId: string) => {
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteDoc(doc(db, 'employees', empId));
      setEmployeeToDelete(null);
      loadData();
    } catch (err) {
      setDeleteError('Falha ao excluir o colaborador no banco de dados.');
      handleFirestoreError(err, OperationType.DELETE, `employees/${empId}`);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Calculations for Dash overview statistcs
  const getOverviewStats = () => {
    const totalActive = employees.filter(e => e.isActive).length;
    
    // Punches made today
    const todayStr = new Date().toISOString().split('T')[0];
    const todayPunchesList = punches.filter(p => p.timestamp.startsWith(todayStr));
    const totalPunchesToday = todayPunchesList.length;

    // Number of distinct employees who registered at least "entrada" today
    const uniqueEmployeesPresent = new Set(
      todayPunchesList
        .filter(p => p.type === 'entrada')
        .map(p => p.employeeId)
    ).size;

    const presencePercent = totalActive > 0 ? Math.round((uniqueEmployeesPresent / totalActive) * 100) : 0;

    return {
      totalActive,
      totalPunchesToday,
      uniqueEmployeesPresent,
      presencePercent
    };
  };

  // Prepare chart coordinates data reflecting hour of day punches
  const getHourDistributionData = () => {
    const hourCounts: Record<number, number> = {};
    // Seed standard hours
    for (let h = 6; h <= 20; h++) hourCounts[h] = 0;

    punches.forEach(p => {
      const date = new Date(p.timestamp);
      const hour = date.getHours();
      if (hour >= 6 && hour <= 20) {
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });

    return Object.entries(hourCounts).map(([h, val]) => ({
      hour: `${h}h`,
      'Registros': val
    }));
  };

  // Prepare Pie Chart data representing categories division
  const getPunchTypeStats = () => {
    const counts = { entrada: 0, intervalo_saida: 0, intervalo_entrada: 0, saida: 0 };
    punches.forEach(p => {
      if (counts[p.type] !== undefined) {
        counts[p.type]++;
      }
    });

    return [
      { name: 'Entrada', value: counts.entrada, color: '#10b981' },
      { name: 'Saída/Intervalo', value: counts.intervalo_saida, color: '#f59e0b' },
      { name: 'Retorno/Intervalo', value: counts.intervalo_entrada, color: '#06b6d4' },
      { name: 'Saída Final', value: counts.saida, color: '#f43f5e' }
    ].filter(item => item.value > 0);
  };

  const stats = getOverviewStats();
  const distributionData = getHourDistributionData();
  const pieData = getPunchTypeStats();

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6" id="admin-dashboard-section">
      
      {/* Admin Title Top bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div>
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-950/40 px-3 py-1 rounded-full border border-blue-100 dark:border-blue-900/30 font-mono">
            Painel da Administração
          </span>
          <h1 className="font-display text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight mt-2.5">
            Timesheet Backoffice
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Controle de frequência, auditoria GPS e admissões biométricas
          </p>
        </div>
        
        {/* Logout button */}
        <div className="flex items-center gap-3 self-start md:self-center">
          <button
            id="admin-logout-btn"
            onClick={onLogout}
            className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Sair do Painel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-2" id="admin-big-loader">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          <span className="text-sm text-slate-500 font-medium">Buscando auditoria em tempo real...</span>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Dashboard bento grids statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="bento-statistics-grid">
            
            {/* KPI 1: Active headcount */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-150 dark:border-slate-850 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Ativos Registrados</span>
                <h3 className="font-display text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">{stats.totalActive}</h3>
                <span className="text-[10px] text-slate-400 mt-1 block">Colaboradores ativos</span>
              </div>
              <div className="w-11 h-11 bg-blue-500/15 text-blue-600 rounded-2xl flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 2: Punches today */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-150 dark:border-slate-850 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Batidas Hoje</span>
                <h3 className="font-display text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">{stats.totalPunchesToday}</h3>
                <span className="text-[10px] text-emerald-500 font-bold mt-1 block flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Transações seguras
                </span>
              </div>
              <div className="w-11 h-11 bg-emerald-500/15 text-emerald-600 rounded-2xl flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 3: Present staff count */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-150 dark:border-slate-850 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Presenças Hoje</span>
                <h3 className="font-display text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">{stats.uniqueEmployeesPresent}</h3>
                <span className="text-[10px] text-slate-400 mt-1 block">Fizeram registro hoje</span>
              </div>
              <div className="w-11 h-11 bg-purple-500/15 text-purple-600 rounded-2xl flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 4: Presence percentage dial */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-150 dark:border-slate-850 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Taxa de Adesão</span>
                <h3 className="font-display text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">{stats.presencePercent}%</h3>
                <span className="text-[10px] text-slate-450 mt-1 block">Do time ativo online</span>
              </div>
              <div className="w-11 h-11 bg-orange-500/15 text-orange-600 rounded-2xl flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>

          </div>

          {/* Graphical Analytics Distribution blocks */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="analytics-charts-panel">
            {/* Chart 1: Time distribution chart */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 p-5 rounded-3xl shadow-sm">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-450" />
                Horários de Maior Registro (Entrada/Saída)
              </h4>
              <div className="w-full h-64 font-sans text-xs">
                {distributionData.every(d => d.Registros === 0) ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5 border border-dashed border-slate-200 rounded-2xl">
                    <AlertCircle className="w-5 h-5" />
                    <span>Nenhuma atividade registrada no período</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="hour" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '16px', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          backgroundColor: '#1e293b',
                          color: '#ffffff'
                        }} 
                      />
                      <Bar dataKey="Registros" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                        {distributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 2 || index === 11 ? '#10b981' : '#3b82f6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Category ratio split */}
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 p-5 rounded-3xl shadow-sm">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-450" />
                Distribuição por Categoria
              </h4>
              <div className="w-full h-64 flex items-center justify-center">
                {pieData.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1.5 border border-dashed border-slate-200 rounded-2xl">
                    <AlertCircle className="w-5 h-5" />
                    <span>Sem dados cadastrados</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col justify-between font-sans">
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* legend list */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-500 p-2">
                      {pieData.map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="truncate">{item.name}: {item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Tab controllers (Like iOS Segmented) */}
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl max-w-sm mb-6" id="dashboard-nav-toggle-bar">
            <button
              id="admin-nav-punches-tab"
              onClick={() => setActiveTab('punches')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold rounded-xl transition duration-200 ${
                activeTab === 'punches'
                  ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Auditoria de Pontos
            </button>
            <button
              id="admin-nav-employees-tab"
              onClick={() => setActiveTab('employees')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold rounded-xl transition duration-200 ${
                activeTab === 'employees'
                  ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              Funcionários
            </button>
          </div>

          {/* VIEW 1: ADVANCED AUDIT PUNCH LEAF */}
          {activeTab === 'punches' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-3xl shadow-sm overflow-hidden" id="punches-auditing-panel">
              
              {/* Header search toolbar & Export */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100">
                      Auditoria de Pontos Eletrônicos
                    </h3>
                    <p className="text-xs text-slate-400">
                      Filtragem cruzada e validação de biometria facial
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2.5 self-start sm:self-auto">
                    <button
                      id="admin-export-csv-btn"
                      onClick={handleExportCSV}
                      className="flex items-center gap-2 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl cursor-pointer transition border border-slate-200/50 dark:border-slate-700 shadow-sm"
                    >
                      <Download className="w-4 h-4 text-slate-500" />
                      Exportar CSV
                    </button>
                    <button
                      id="admin-export-pdf-btn"
                      onClick={handleExportPDF}
                      className="flex items-center gap-2 py-2.5 px-4 bg-gradient-to-r from-red-600 to-rose-600 text-white hover:opacity-95 text-xs font-bold rounded-xl cursor-pointer transition shadow shadow-red-500/10"
                    >
                      <Download className="w-4 h-4" />
                      Exportar Relatório (PDF)
                    </button>
                  </div>
                </div>

                {/* Filter Controls Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white dark:bg-slate-900 p-4 border border-slate-200/50 dark:border-slate-800 rounded-2xl shadow-xs">
                  {/* Filter Employee */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Filtrar por Colaborador</label>
                    <select
                      id="filter-employee-select"
                      value={filterEmployeeId}
                      onChange={(e) => setFilterEmployeeId(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-slate-700 dark:text-slate-350 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="all">Ver todos</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filter Date */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data Específica</label>
                    <input
                      id="filter-date-input"
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-slate-700 dark:text-slate-350 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Filter Punch Category Type */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tipo de Ponto</label>
                    <select
                      id="filter-punchtype-select"
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-slate-700 dark:text-slate-350 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="all">Todos os tipos</option>
                      <option value="entrada">Entrada</option>
                      <option value="intervalo_saida">Saída para Intervalo</option>
                      <option value="intervalo_entrada">Retorno de Intervalo</option>
                      <option value="saida">Saída Final</option>
                    </select>
                  </div>

                  {/* Search Query Name */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Buscar por Nome/Celular</label>
                    <div className="relative">
                      <input
                        id="filter-search-query"
                        type="text"
                        placeholder="Pesquisar..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 pl-8 pr-2.5 py-2.5 rounded-xl text-slate-700 dark:text-slate-350 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <Search className="absolute left-2.5 top-3 w-3.5 h-3.5 text-slate-450" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Table Data list */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm" id="punches-logs-table">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/80">
                    <tr>
                      <th className="py-4 px-6">Funcionário</th>
                      <th className="py-4 px-6">Data</th>
                      <th className="py-4 px-6">Horário</th>
                      <th className="py-4 px-6">Tipo</th>
                      <th className="py-4 px-6">Localização GPS</th>
                      <th className="py-4 px-6">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                    {filteredPunches.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                          <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          Nenhum registro de ponto encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredPunches.map((p) => {
                        const { label, color } = getPunchTypeDetails(p.type);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/10 transition">
                            <td className="py-4 px-6">
                              <div>
                                <span className="font-semibold text-slate-800 dark:text-slate-100 block">{p.employeeName}</span>
                                <span className="text-[10px] text-slate-450 font-mono block">{p.employeePhone}</span>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-slate-650 font-medium">
                              {formatDate(p.timestamp)}
                            </td>
                            <td className="py-4 px-6 font-mono text-xs font-semibold text-slate-800 dark:text-emerald-400">
                              {formatTime(p.timestamp)}
                            </td>
                            <td className="py-4 px-6">
                              <span className={`inline-flex px-2 px-2.5 py-1 text-[11px] font-bold rounded-lg border ${color}`}>
                                {label}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                                {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <button
                                id={`drill-down-punch-${p.id}`}
                                onClick={() => setSelectedPunch(p)}
                                className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold hover:text-slate-900 dark:hover:text-white text-[11px] rounded-lg cursor-pointer transition"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Detalhes e Mapa
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* VIEW 2: EMPLOYEES CRUD PANEL */}
          {activeTab === 'employees' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-3xl shadow-sm overflow-hidden" id="employees-crud-panel">
              
              {/* Header toolbar */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100">
                    Gerenciamento Corporativo
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cadastro de admissão de usuários e alteração de canais de acesso
                  </p>
                </div>

                <button
                  id="admin-create-emp-trigger"
                  onClick={handleOpenCreateModal}
                  className="flex items-center gap-2 py-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-95 text-xs font-bold rounded-xl cursor-pointer transition shadow shadow-blue-500/10"
                >
                  <UserPlus className="w-4 h-4" />
                  Cadastrar Colaborador
                </button>
              </div>

              {/* Employees Table list */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm" id="employees-data-table">
                  <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800/80">
                    <tr>
                      <th className="py-4 px-6">Funcionário</th>
                      <th className="py-4 px-6">Celular</th>
                      <th className="py-4 px-6">Perfil</th>
                      <th className="py-4 px-6">Admissão</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                    {employees.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                          <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          Nenhum funcionário cadastrado no sistema.
                        </td>
                      </tr>
                    ) : (
                      employees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/10 transition">
                          <td className="py-4 px-6">
                            <span className="font-semibold text-slate-800 dark:text-slate-100">{emp.name}</span>
                          </td>
                          <td className="py-4 px-6 font-mono text-xs text-slate-650">
                            {emp.phone}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col items-start gap-1">
                              <span className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-md border ${
                                emp.role === 'admin' 
                                  ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' 
                                  : 'bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400'
                              }`}>
                                {emp.role === 'admin' ? 'Administrador' : 'Funcionário'}
                              </span>
                              {emp.role === 'admin' && emp.pin && (
                                <span className="text-[10px] font-mono font-semibold text-amber-600 bg-amber-500/5 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
                                  PIN: {emp.pin}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-xs text-slate-500">
                            {formatDate(emp.createdAt)}
                          </td>
                          <td className="py-4 px-6">
                            <button
                              id={`toggle-emp-status-${emp.id}`}
                              onClick={() => handleToggleActiveStatus(emp)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full border cursor-pointer transition ${
                                emp.isActive
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                              }`}
                              title={emp.isActive ? 'Clique para desativar funcionário' : 'Clique para reativar funcionário'}
                            >
                              {emp.isActive ? (
                                <>
                                  <Check className="w-3 h-3" /> Ativo
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3" /> Inativo
                                </>
                              )}
                            </button>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <button
                                id={`edit-emp-btn-${emp.id}`}
                                onClick={() => handleOpenEditModal(emp)}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-850 dark:hover:text-white rounded-lg transition"
                                title="Editar dados"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                id={`disable-emp-btn-${emp.id}`}
                                onClick={() => handleToggleActiveStatus(emp)}
                                className={`p-1.5 rounded-lg transition ${
                                  emp.isActive 
                                    ? 'hover:bg-rose-105/30 text-rose-500' 
                                    : 'hover:bg-emerald-101/30 text-emerald-500'
                                }`}
                                title={emp.isActive ? 'Desativar acesso' : 'Reativar acesso'}
                              >
                                {emp.isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                id={`delete-emp-btn-${emp.id}`}
                                onClick={() => {
                                  setDeleteError(null);
                                  setEmployeeToDelete(emp);
                                }}
                                className="p-1.5 hover:bg-rose-100/30 dark:hover:bg-rose-900/20 text-rose-500 hover:text-rose-600 rounded-lg transition cursor-pointer"
                                title="Excluir Colaborador"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>
      )}

      {/* DETAIL MODAL DRAWER */}
      <AnimatePresence>
        {selectedPunch && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-150 dark:border-slate-850 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              id="details-punch-drawer"
            >
              
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-widest">Auditoria de Transação</span>
                  <h3 className="font-display font-black text-slate-850 dark:text-slate-100">
                    Detalhes do Ponto Registrado
                  </h3>
                </div>
                <button
                  id="close-detail-modal-btn"
                  onClick={() => setSelectedPunch(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable details container */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1 text-left">
                
                {/* Employee and Category overview metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-150/50 dark:border-slate-850">
                  <div className="space-y-1.5">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Colaborador</span>
                    <strong className="block text-slate-850 dark:text-slate-200 font-bold text-base leading-tight">
                      {selectedPunch.employeeName}
                    </strong>
                    <span className="block text-xs font-mono text-slate-500">
                      Celular: {selectedPunch.employeePhone}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Categoria do Ponto</span>
                    <span className={`inline-flex px-3 py-1 font-bold text-xs rounded-lg border leading-none ${getPunchTypeDetails(selectedPunch.type).color}`}>
                      {getPunchTypeDetails(selectedPunch.type).label}
                    </span>
                    <span className="block text-xs font-mono text-slate-500">
                      Horário: {formatDate(selectedPunch.timestamp)} - {formatTime(selectedPunch.timestamp)}
                    </span>
                  </div>
                </div>

                {/* Picture and Map Visual Split */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  
                  {/* Selfie frame */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-650 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Foto Comprobatória (Selfie)
                    </h5>
                    <div className="rounded-2xl overflow-hidden border border-slate-150 dark:border-slate-800 aspect-square bg-slate-950 flex items-center justify-center">
                      <img
                        id="detailed-punch-snapshot"
                        src={selectedPunch.photo}
                        alt="Foto do punch"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>

                  {/* Interactive Dynamic Google Map widget */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-650 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Localização Georreferenciada
                    </h5>
                    <div className="rounded-2xl overflow-hidden border border-slate-150 dark:border-slate-800 aspect-square relative bg-slate-100 dark:bg-slate-950">
                      {/* Leaflet or interactive google maps iframe */}
                      <iframe
                        id="google-maps-embed-iframe"
                        title="Google Maps"
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer"
                        src={`https://maps.google.com/maps?q=${selectedPunch.latitude},${selectedPunch.longitude}&z=15&output=embed`}
                      ></iframe>
                    </div>
                    {/* Footnotes coords */}
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 border border-slate-150 rounded-xl px-3 py-2 mt-2">
                      <span className="font-mono text-[10px] text-slate-500">
                        Lat: {selectedPunch.latitude.toFixed(6)} | Long: {selectedPunch.longitude.toFixed(6)}
                      </span>
                      <a 
                        id="google-maps-redirect-link"
                        href={`https://www.google.com/maps/search/?api=1&query=${selectedPunch.latitude},${selectedPunch.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-blue-600 hover:underline font-bold"
                      >
                        Ver no Google Maps
                      </a>
                    </div>
                  </div>

                </div>

              </div>

              {/* Drawer footer actions */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end">
                <button
                  id="dismiss-detail-btn"
                  onClick={() => setSelectedPunch(null)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs rounded-xl cursor-pointer transition"
                >
                  Fechar Detalhes
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CRUD PANEL EMPLOYEE FORM MODAL */}
      <AnimatePresence>
        {crudModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-150 dark:border-slate-850 shadow-2xl overflow-hidden"
              id="employees-crud-form-modal"
            >
              <form onSubmit={handleSaveEmployee}>
                
                {/* Modal Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-bold text-slate-800 dark:text-slate-100">
                      {editingEmployee ? 'Editar Colaborador' : 'Admitir Colaborador'}
                    </h3>
                    <p className="text-xs text-slate-450 mt-0.5">
                      PontoNow Painel de Perfis
                    </p>
                  </div>
                  <button
                    id="close-crud-modal-btn"
                    type="button"
                    onClick={() => setCrudModalOpen(false)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form fields */}
                <div className="p-6 space-y-4 text-left">
                  {crudError && (
                    <div className="p-3 bg-rose-50 text-rose-600 text-xs rounded-xl border border-rose-200">
                      {crudError}
                    </div>
                  )}

                  {/* Field: Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Nome Completo
                    </label>
                    <input
                      id="form-emp-name"
                      type="text"
                      required
                      placeholder="Ex: Ana Carolina Silva"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full pl-3.5 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  {/* Field: Phone */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Celular (com DDD)
                    </label>
                    <input
                      id="form-emp-phone"
                      type="text"
                      required
                      placeholder="(11) 98765-4321"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      className="w-full pl-3.5 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm font-mono"
                    />
                  </div>

                  {/* Field: Role selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Perfil / Função do Usuário
                    </label>
                    <select
                      id="form-emp-role"
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value as 'employee' | 'admin')}
                      className="w-full pl-3.5 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                    >
                      <option value="employee">Funcionário Padrão</option>
                      <option value="admin">Administrador (Permissões de Admin)</option>
                    </select>
                  </div>

                  {/* Field: Admin PIN number */}
                  {formRole === 'admin' && (
                    <div className="space-y-1.5 p-3.5 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/50 dark:border-amber-900/30 transition-all">
                      <label className="block text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                        PIN de Acesso Admin (Número)
                      </label>
                      <input
                        id="form-emp-pin"
                        type="password"
                        maxLength={6}
                        placeholder="Ex: 1234"
                        value={formPin}
                        onChange={(e) => setFormPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-950 border border-amber-300 dark:border-amber-900/60 rounded-xl text-slate-850 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 text-sm font-mono tracking-widest text-center font-bold"
                      />
                      <span className="block text-[10px] leading-tight text-amber-600 dark:text-amber-400">
                        Crie um código numérico para o administrador fazer login no painel (Ex: 4 a 6 dígitos).
                      </span>
                    </div>
                  )}

                  {/* Field: Active Switch toggle toggle */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-150/60 dark:border-slate-850">
                    <div>
                      <strong className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Status de acesso operacional
                      </strong>
                      <span className="block text-[10px] text-slate-450 mt-0.5">
                        Inativos ficam impedidos de bater ponto no terminal
                      </span>
                    </div>
                    
                    <button
                      id="form-emp-status-toggle"
                      type="button"
                      onClick={() => setFormIsActive(!formIsActive)}
                      className={`relative w-12 h-6.5 rounded-full transition duration-300 focus:outline-none cursor-pointer ${
                        formIsActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-850'
                      }`}
                    >
                      <div 
                        className={`absolute top-0.5 w-5.5 h-5.5 bg-white rounded-full shadow transition-all duration-300 ${
                          formIsActive ? 'left-6' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                </div>

                {/* Submit actions bottom bar bar */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-2.5">
                  <button
                    id="cancel-crud-form-btn"
                    type="button"
                    onClick={() => setCrudModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl cursor-pointer transition"
                  >
                    Descartar
                  </button>
                  <button
                    id="submit-crud-form-btn"
                    type="submit"
                    disabled={crudSubmitting}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white text-xs font-bold rounded-xl shadow cursor-pointer transition flex items-center gap-1"
                  >
                    {crudSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Gravando...
                      </>
                    ) : (
                      'Salvar perfil'
                    )}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}

        {employeeToDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl border border-slate-150 dark:border-slate-850 shadow-2xl overflow-hidden"
              id="employees-delete-confirm-modal"
            >
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 text-rose-600">
                    <Trash2 className="w-5 h-5 animate-pulse" /> Excluir Colaborador
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Esta ação é definitiva
                  </p>
                </div>
                <button
                  id="close-delete-modal-btn"
                  type="button"
                  onClick={() => setEmployeeToDelete(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 text-left space-y-4">
                {deleteError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl border border-rose-200 dark:border-rose-900/30">
                    {deleteError}
                  </div>
                )}
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Tem certeza que deseja excluir o cadastro de <strong className="font-semibold text-slate-800 dark:text-slate-200">{employeeToDelete.name}</strong>?
                  <span className="block mt-2 text-xs text-slate-400 dark:text-slate-500">
                    Os registros anteriores no histórico de ponto continuarão existindo no banco de dados para segurança de auditoria, mas o perfil do colaborador será removido e o acesso de consulta dele será revogado.
                  </span>
                </p>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-2.5">
                <button
                  id="cancel-delete-btn"
                  type="button"
                  onClick={() => setEmployeeToDelete(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  id="confirm-delete-btn"
                  type="button"
                  disabled={deleteSubmitting}
                  onClick={() => handleDeleteEmployee(employeeToDelete.id)}
                  className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-650 hover:opacity-95 text-white text-xs font-bold rounded-xl shadow cursor-pointer transition flex items-center gap-1"
                >
                  {deleteSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Removendo...
                    </>
                  ) : (
                    'Excluir'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
