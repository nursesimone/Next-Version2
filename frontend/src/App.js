import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VisitTypePage from './pages/VisitTypePage';
import DashboardPage from './pages/DashboardPage';
import PatientDetailPage from './pages/PatientDetailPage';
import NewVisitPage from './pages/NewVisitPage';
import VisitDetailPage from './pages/VisitDetailPage';
import ReportsPage from './pages/ReportsPage';
import DailyNotesReportPage from './pages/DailyNotesReportPage';
import AdminPage from './pages/AdminPage';
import UnableToContactPage from './pages/UnableToContactPage';
import UTCDetailPage from './pages/UTCDetailPage';
import IncidentReportPage from './pages/IncidentReportPage';
import InterventionPage from './pages/InterventionPage';
import './App.css';

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { nurse, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading...</div>
      </div>
    );
  }
  
  if (!nurse) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

// Public Route wrapper (redirects to visit-type if already logged in)
function PublicRoute({ children }) {
  const { nurse, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading...</div>
      </div>
    );
  }
  
  if (nurse) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } 
      />
      <Route 
        path="/register" 
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        } 
      />
      <Route 
        path="/visit-type" 
        element={
          <ProtectedRoute>
            <VisitTypePage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/patients/:patientId" 
        element={
          <ProtectedRoute>
            <PatientDetailPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/patients/:patientId/new-visit" 
        element={
          <ProtectedRoute>
            <NewVisitPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/patients/:patientId/unable-to-contact" 
        element={
          <ProtectedRoute>
            <UnableToContactPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/patients/:patientId/intervention" 
        element={
          <ProtectedRoute>
            <InterventionPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/visits/:visitId" 
        element={
          <ProtectedRoute>
            <VisitDetailPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/utc/:utcId" 
        element={
          <ProtectedRoute>
            <UTCDetailPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/reports" 
        element={
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/daily-notes-report" 
        element={
          <ProtectedRoute>
            <DailyNotesReportPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/incident-report" 
        element={
          <ProtectedRoute>
            <IncidentReportPage />
          </ProtectedRoute>
        } 
      />
      <Route path="*" element={<Navigate to="/visit-type" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
