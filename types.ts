export interface AttendanceRecord {
  id: string; // Unique identifier from the database
  timestamp: string; // ISO string format for easy storage
  latitude?: number;
  longitude?: number;
  divisi_nama?: string; // Storing division name directly
}

export enum Page {
  HOME = 'HOME',
  HISTORY = 'HISTORY',
  LEAVE = 'LEAVE',
  SALARY = 'SALARY',
  PROFILE = 'PROFILE',
}

// New single interface for the combined table
export interface AturanAbsensi {
    id: string;
    nama_divisi: string;
    latitude: number;
    longitude: number;
    radius_meter: number;
}

export interface UserProfile {
  name: string;
  employeeId: string;
  position: string;
  avatarUrl: string;
  joinDate: string;
  email: string;
  phone: string;
  status: string;
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
}

export interface SalarySlip {
  id: string;
  period: string;
  basicSalary: number;
  allowance: number;
  deductions: number;
  netSalary: number;
}

export type FaceDescriptor = Float32Array;