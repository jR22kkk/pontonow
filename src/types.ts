/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PunchType = 'entrada' | 'intervalo_saida' | 'intervalo_entrada' | 'saida';

export interface Employee {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  role: 'employee' | 'admin';
  createdAt: string;
  pin?: string;
}

export interface Punch {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePhone: string;
  timestamp: string; // ISO String
  type: PunchType;
  photo: string; // Base64 Image string
  latitude: number;
  longitude: number;
  createdAt: string; // ISO String or Firestore ServerTimestamp representation
}
