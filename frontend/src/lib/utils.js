import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
}

export function formatDateNumeric(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

export function formatDateTime(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function calculateAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function getHealthStatusColor(status) {
  switch (status?.toLowerCase()) {
    case 'stable':
      return 'badge-stable';
    case 'unstable':
    case 'deteriorating':
      return 'badge-warning';
    case 'needs immediate attention':
      return 'badge-critical';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function isBloodPressureAbnormal(systolic, diastolic) {
  const sys = parseInt(systolic);
  const dia = parseInt(diastolic);
  if (isNaN(sys) || isNaN(dia)) return false;
  // Abnormal: sys >= 140 or dia >= 90 or sys < 90 or dia < 60
  return sys >= 140 || dia >= 90 || sys < 90 || dia < 60;
}
