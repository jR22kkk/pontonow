/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PunchType } from './types';
import { jsPDF } from 'jspdf';

// Format Date in Portuguese
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// Format Time in Portuguese with seconds
export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Mask Brazilian phone number: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
export function maskPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length <= 10) {
    return clean.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  }
  return clean.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

// Text translation for punch types
export function getPunchTypeDetails(type: PunchType) {
  switch (type) {
    case 'entrada':
      return { label: 'Entrada', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    case 'intervalo_saida':
      return { label: 'Saída P/ Almoço', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20' };
    case 'intervalo_entrada':
      return { label: 'Retorno Almoço', color: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/20' };
    case 'saida':
      return { label: 'Saída Final', color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20' };
    default:
      return { label: 'Ponto', color: 'bg-slate-500/15 text-slate-600' };
  }
}

// Export Punches database data into a CSV string
export function exportPunchesToCSV(punches: any[], employeesMap: Record<string, string>): string {
  const headers = ['Data', 'Horário', 'Funcionário', 'Celular', 'Tipo de Registro', 'Latitude', 'Longitude'];
  
  const rows = punches.map(p => {
    const typeLabel = getPunchTypeDetails(p.type).label;
    const dateStr = formatDate(p.timestamp);
    const timeStr = formatTime(p.timestamp);
    const empName = p.employeeName || employeesMap[p.employeeId] || 'Não identificado';
    const empPhone = p.employeePhone || '';
    
    return [
      `"${dateStr}"`,
      `"${timeStr}"`,
      `"${empName.replace(/"/g, '""')}"`,
      `"${empPhone}"`,
      `"${typeLabel}"`,
      p.latitude || '0',
      p.longitude || '0'
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(e => e.join(','))
  ].join('\n');

  // Prefix with BOM to support characters like "í", "á" in Excel
  return '\uFEFF' + csvContent;
}

// Export Punches to a beautiful corporate PDF list
export function exportPunchesToPDF(punches: any[], employeesMap: Record<string, string>) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageHeight = doc.internal.pageSize.getHeight(); // 297 mm
  const pageWidth = doc.internal.pageSize.getWidth(); // 210 mm
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  let currentY = 15;

  const drawHeader = (pageNumber: number) => {
    // Header background banner
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, currentY, contentWidth, 22, 'F');

    // Title text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('PontoNow - Relatorio de Registro de Ponto', margin + 6, currentY + 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin + 6, currentY + 15);

    // Page number
    doc.text(`Pag. ${pageNumber}`, margin + contentWidth - 20, currentY + 9);

    currentY += 28;

    // Table Headers
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(margin, currentY, contentWidth, 8, 'F');
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(margin, currentY + 8, margin + contentWidth, currentY + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105); // slate-600

    doc.text('Data', margin + 4, currentY + 5.5);
    doc.text('Hora', margin + 24, currentY + 5.5);
    doc.text('Colaborador', margin + 42, currentY + 5.5);
    doc.text('Celular', margin + 98, currentY + 5.5);
    doc.text('Registro', margin + 128, currentY + 5.5);
    doc.text('Coordenadas GPS', margin + 155, currentY + 5.5);

    currentY += 12;
  };

  let pageNum = 1;
  drawHeader(pageNum);

  const sortedPunches = [...punches].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  sortedPunches.forEach((p, idx) => {
    if (currentY > pageHeight - 20) {
      doc.addPage();
      currentY = 15;
      pageNum++;
      drawHeader(pageNum);
    }

    const typeLabel = getPunchTypeDetails(p.type).label;
    const dateStr = formatDate(p.timestamp);
    const timeStr = formatTime(p.timestamp);
    const empName = p.employeeName || employeesMap[p.employeeId] || 'Nao identificado';
    const empPhone = p.employeePhone || '';
    const locStr = p.latitude ? `${Number(p.latitude).toFixed(4)}, ${Number(p.longitude).toFixed(4)}` : 'S/ GPS';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);

    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(margin, currentY - 3, contentWidth, 7, 'F');
    }

    doc.text(dateStr, margin + 4, currentY + 1.5);
    doc.text(timeStr, margin + 24, currentY + 1.5);
    doc.text(empName.substring(0, 26), margin + 42, currentY + 1.5);
    doc.text(empPhone, margin + 98, currentY + 1.5);
    doc.text(typeLabel, margin + 128, currentY + 1.5);
    doc.text(locStr, margin + 155, currentY + 1.5);

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, currentY + 4, margin + contentWidth, currentY + 4);

    currentY += 7.5;
  });

  doc.save(`folha_de_ponto_${new Date().toISOString().split('T')[0]}.pdf`);
}

// Base64 Placeholder SVGs to serve as camera selfies fallbacks if sandbox blocks camera permissions
export const CAMERA_FALLBACKS = [
  {
    name: 'Selfie Corporativa 1',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23a1c4fd"/><stop offset="100%" stop-color="%23c2e9fb"/></linearGradient></defs><rect width="300" height="300" fill="url(%23g)"/><circle cx="150" cy="110" r="45" fill="%234a5568"/><path d="M70,230 C70,180 110,165 150,165 C190,165 230,180 230,230" fill="%234a5568"/><circle cx="150" cy="150" r="120" fill="none" stroke="%23ffffff" stroke-width="6" opacity="0.3"/><text x="150" y="275" font-family="sans-serif" font-size="14" fill="%232d3748" font-weight="bold" text-anchor="middle">Selfie Confirmada (GPS Ativo)</text></svg>'
  },
  {
    name: 'Selfie Corporativa 2',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><defs><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23f6d365"/><stop offset="100%" stop-color="%23fda085"/></linearGradient></defs><rect width="300" height="300" fill="url(%23g2)"/><circle cx="150" cy="110" r="45" fill="%232c3e50"/><path d="M80,225 C80,185 110,170 150,170 C190,170 220,185 220,225" fill="%232c3e50"/><circle cx="150" cy="150" r="120" fill="none" stroke="%23ffffff" stroke-width="6" opacity="0.3"/><text x="150" y="275" font-family="sans-serif" font-size="14" fill="%232c3e50" font-weight="bold" text-anchor="middle">Identificação Facial Sucedida</text></svg>'
  },
  {
    name: 'Foto no Local de Trabalho',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><defs><linearGradient id="g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%2384fab0"/><stop offset="100%" stop-color="%238fd3f4"/></linearGradient></defs><rect width="300" height="300" fill="url(%23g3)"/><rect x="80" y="70" width="140" height="120" rx="10" fill="%232d3748" opacity="0.8"/><circle cx="150" cy="120" r="25" fill="%23ffffff" opacity="0.9"/><path d="M110,190 C110,160 130,150 150,150 C170,150 190,160 190,190" fill="%23ffffff" opacity="0.9"/><text x="150" y="275" font-family="sans-serif" font-size="14" fill="%231a202c" font-weight="bold" text-anchor="middle">Ponto Presencial Registrado</text></svg>'
  }
];
