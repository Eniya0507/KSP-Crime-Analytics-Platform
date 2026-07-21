// Core domain types for the KSP Crime Intelligence Platform

export type Role = 'Admin' | 'Supervisor' | 'Investigator' | 'Analyst';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  rank: string;
  stationId: string;
  districtId: string;
  avatarColor: string;
}

export type CaseStatus = 'Open' | 'Under Investigation' | 'Charge Sheet Filed' | 'Closed' | 'Pending';

export type CrimeCategory =
  | 'Violent'
  | 'Property'
  | 'Cyber'
  | 'Economic'
  | 'Narcotics'
  | 'Against Women'
  | 'Against Children'
  | 'Public Order';

export interface District {
  id: string;
  name: string;
  region: 'Bengaluru' | 'Mysuru' | 'Belagavi' | 'Kalaburagi' | 'Dakshina Kannada' | 'Hubballi' | 'Coastal' | 'Central';
  lat: number;
  lng: number;
  population: number;
}

export interface PoliceStation {
  id: string;
  name: string;
  districtId: string;
  zone: string;
  lat: number;
  lng: number;
  jurisdictionPop: number;
}

export interface PoliceOfficer {
  id: string;
  name: string;
  rank: string;
  stationId: string;
  districtId: string;
  yearsOfService: number;
  casesHandled: number;
  clearanceRate: number;
  phone: string;
}

export interface Accused {
  id: string;
  caseId: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  districtId: string;
  priorsCount: number;
  riskScore: number;
  status: 'Arrested' | 'Absconding' | 'On Bail' | 'In Custody' | 'Surrendered';
  phone: string;
  aadhaarLast4: string;
  gangAffiliation: string | null;
  occupation: string;
}

export interface Victim {
  id: string;
  caseId: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  districtId: string;
  injurySeverity: 'None' | 'Minor' | 'Major' | 'Fatal';
  phone: string;
}

export interface CrimeCase {
  id: string;
  firNumber: string;
  crimeType: string;
  category: CrimeCategory;
  ipcSections: string[];
  status: CaseStatus;
  districtId: string;
  stationId: string;
  officerId: string;
  lat: number;
  lng: number;
  date: string; // ISO
  timeOfDay: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  severity: number; // 1-10
  valueLossInr: number;
  weaponUsed: string | null;
  locationType: string;
  description: string;
  accusedIds: string[];
  victimIds: string[];
  isSolved: boolean;
  daysToClose: number | null;
}

export interface Alert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  districtId: string;
  createdAt: string;
  category: 'Hotspot' | 'Repeat Offender' | 'Forecast Spike' | 'Network' | 'Risk';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  lang: 'en' | 'kn';
  timestamp: string;
  sources?: ChatSource[];
  confidence?: number;
}

export interface ChatSource {
  title: string;
  caseId?: string;
  snippet: string;
}

export interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  category: 'Login' | 'Report' | 'Case Access' | 'AI Query' | 'Prediction' | 'Export';
  detail: string;
  timestamp: string;
}

export interface ShapFeature {
  feature: string;
  value: number; // contribution, can be + or -
  display: string;
}

export interface RiskExplanation {
  score: number; // 0-100
  level: 'Low' | 'Medium' | 'High' | 'Critical';
  baseValue: number;
  features: ShapFeature[];
  reasoning: string[];
}
