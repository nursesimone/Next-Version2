import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { patientsAPI } from '../lib/api';
import { formatDate, formatDateTime, calculateAge, getHealthStatusColor, formatDateNumeric } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { 
  Stethoscope, 
  Users, 
  Plus, 
  Search, 
  LogOut, 
  Activity,
  Calendar,
  User,
  ChevronRight,
  ClipboardList,
  ArrowLeft,
  PhoneOff,
  Clock,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { nurse, logout } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPostAddDialog, setShowPostAddDialog] = useState(false);
  const [newlyAddedPatientId, setNewlyAddedPatientId] = useState(null);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientOrg, setNewPatientOrg] = useState('');
  const [addingPatient, setAddingPatient] = useState(false);

  // Get visit type from session
  const visitType = sessionStorage.getItem('visitType') || 'nurse_visit';

  const getVisitTypeLabel = () => {
    switch (visitType) {
      case 'nurse_visit': return 'Nurse Visit';
      case 'vitals_only': return 'Vital Signs Only';
      case 'daily_note': return "Resident's Daily Note";
      default: return 'Visit';
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const response = await patientsAPI.list();
      setPatients(response.data);
    } catch (error) {
      toast.error('Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPatient = async (e) => {
    e.preventDefault();
    if (!newPatientName.trim() || !newPatientOrg) {
      toast.error('Please enter patient name and select organization');
      return;
    }
    
    setAddingPatient(true);
    try {
      const response = await patientsAPI.create({ 
        full_name: newPatientName.trim(),
        organization: newPatientOrg
      });
      setPatients([response.data, ...patients]);
      setShowAddDialog(false);
      setNewlyAddedPatientId(response.data.id);
      setShowPostAddDialog(true);
      toast.success('Patient added successfully');
    } catch (error) {
      toast.error('Failed to add patient');
    } finally {
      setAddingPatient(false);
    }
  };
  
  const handleAddAnother = () => {
    setShowPostAddDialog(false);
    setNewPatientName('');
    setNewPatientOrg('');
    setNewlyAddedPatientId(null);
    setShowAddDialog(true);
  };
  
  const handleViewPatient = () => {
    setShowPostAddDialog(false);
    navigate(`/patients/${newlyAddedPatientId}`);
  };

  const filteredPatients = patients.filter(p => 
    p.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50" data-testid="dashboard-page">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-eggplant-700 rounded-xl flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">POSH-Able Living</span>
            </div>
            
            <div className="flex items-center gap-4">
              {nurse?.is_admin && (
                <>
                  <Button 
                    onClick={() => navigate('/admin')}
                    size="sm"
                    className="bg-navy-700 hover:bg-navy-600"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Admin
                  </Button>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/reports')}
                    className="hidden sm:flex"
                  >
                    <ClipboardList className="w-4 h-4 mr-2" />
                    Reports
                  </Button>
                </>
              )}
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-900">{nurse?.full_name}</p>
                <p className="text-xs text-slate-500">{nurse?.license_number || 'Nurse'}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleLogout}
                className="text-slate-500 hover:text-slate-700"
                data-testid="logout-btn"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Personalized Greeting */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-slate-900">
            Hello {nurse?.full_name?.split(' ')[0] || 'there'}, please select a patient's file
          </h2>
        </div>

        {/* Search and Add */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-white"
              data-testid="search-patients-input"
            />
          </div>
          
          {nurse?.is_admin && (
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="h-11 bg-eggplant-700 hover:bg-eggplant-600" data-testid="add-patient-btn">
                  <Plus className="w-5 h-5 mr-2" />
                  Add Patient
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Patient</DialogTitle>
                <DialogDescription>
                  Enter the patient's name to create their profile. You can add more details later.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddPatient} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="patientName">Patient Full Name</Label>
                  <Input
                    id="patientName"
                    placeholder="John Doe"
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    className="h-11"
                    required
                    data-testid="new-patient-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="organization">Organization</Label>
                  <Select
                    value={newPatientOrg}
                    onValueChange={setNewPatientOrg}
                    required
                  >
                    <SelectTrigger className="h-11" data-testid="new-patient-org-select">
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POSH Host Homes">POSH Host Homes</SelectItem>
                      <SelectItem value="Ebenezer Private HomeCare">Ebenezer Private HomeCare</SelectItem>
                      <SelectItem value="Jericho">Jericho</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="bg-eggplant-700 hover:bg-eggplant-600"
                    disabled={addingPatient}
                    data-testid="confirm-add-patient-btn"
                  >
                    {addingPatient ? 'Adding...' : 'Add Patient'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </div>

        {/* Patient List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="bg-white border-slate-100">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-slate-200 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                        <div className="h-3 bg-slate-200 rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="empty-state">
            <Users className="empty-state-icon" />
            <h3 className="empty-state-title">
              {searchQuery ? 'No patients found' : 'No patients yet'}
            </h3>
            <p className="empty-state-description">
              {searchQuery 
                ? 'Try adjusting your search terms'
                : 'Add your first patient to get started with documentation'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPatients.map(patient => {
              const canAccess = nurse?.is_admin || patient.is_assigned_to_me;
              
              return (
              <Card 
                key={patient.id} 
                className={`patient-card bg-white border-slate-100 ${
                  canAccess ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
                } ${!patient.is_assigned_to_me && nurse?.is_admin ? 'opacity-75' : ''}`}
                onClick={() => canAccess && navigate(`/patients/${patient.id}`)}
                data-testid={`patient-card-${patient.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canAccess) navigate(`/patients/${patient.id}`);
                        }}
                        className={`w-14 h-14 ${
                          patient.is_assigned_to_me ? 'bg-eggplant-50 hover:bg-eggplant-100' : 'bg-slate-100'
                        } rounded-full flex items-center justify-center transition-colors ${
                          canAccess ? 'cursor-pointer' : 'cursor-not-allowed'
                        }`}
                        title={canAccess ? "View patient profile" : "Not assigned to you"}
                        disabled={!canAccess}
                      >
                        <User className={`w-7 h-7 ${
                          patient.is_assigned_to_me ? 'text-eggplant-700' : 'text-slate-400'
                        }`} />
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{patient.full_name}</h3>
                          {!patient.is_assigned_to_me && (
                            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                              Not Assigned
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                          {patient.permanent_info?.date_of_birth && (
                            <>
                              <span>{calculateAge(patient.permanent_info.date_of_birth)} yrs</span>
                              <span>•</span>
                            </>
                          )}
                          {patient.permanent_info?.gender && (
                            <>
                              <span>{patient.permanent_info.gender}</span>
                              <span>•</span>
                            </>
                          )}
                          {patient.permanent_info?.race && (
                            <span>{patient.permanent_info.race}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                  
                  {/* Last Vitals with Date - Clickable */}
                  {patient.last_vitals && patient.last_visit_id && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Navigate to the visit that contains these vitals
                            navigate(`/visits/${patient.last_visit_id}`);
                          }}
                          className="text-xs text-eggplant-600 hover:text-eggplant-700 underline font-medium"
                        >
                          Last Vitals
                        </button>
                        {patient.last_vitals_date && (
                          <p className="text-xs text-slate-400 font-mono">
                            {formatDate(patient.last_vitals_date)}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {patient.last_vitals.blood_pressure_systolic && (
                          <span className="bg-slate-100 px-2 py-1 rounded font-mono">
                            BP: {patient.last_vitals.blood_pressure_systolic}/{patient.last_vitals.blood_pressure_diastolic}
                          </span>
                        )}
                        {patient.last_vitals.body_temperature && (
                          <span className="bg-slate-100 px-2 py-1 rounded font-mono">
                            T: {patient.last_vitals.body_temperature}°F
                          </span>
                        )}
                        {patient.last_vitals.weight && (
                          <span className="bg-slate-100 px-2 py-1 rounded font-mono">
                            Wt: {patient.last_vitals.weight} lbs
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Last Visit - ALWAYS shown */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    {patient.last_visit_id && patient.last_visit_date ? (
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="w-3 h-3 text-eggplant-600" />
                        <span className="text-slate-600">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/visits/${patient.last_visit_id}`);
                            }}
                            className="text-eggplant-600 hover:text-eggplant-700 underline font-medium"
                          >
                            Last Visit
                          </button>
                          : {formatDate(patient.last_visit_date)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="w-3 h-3 text-navy-500" />
                        <span className="text-navy-600 font-medium">
                          No Visits as of {formatDate(new Date().toISOString())}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Last Unable to Contact - Shows if exists */}
                  {patient.last_utc && (
                    <div className="mt-2 pb-1">
                      <div className="flex items-center gap-2 text-xs">
                        <PhoneOff className="w-3 h-3 text-amber-600" />
                        <span className="text-slate-600">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate(`/utc/${patient.last_utc.id}`);
                            }}
                            className="text-amber-600 font-medium hover:text-amber-700 cursor-pointer"
                          >
                            UTC
                          </button>
                          <span>: {formatDate(patient.last_utc.date)} - </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('UTC clicked:', patient.last_utc.id);
                              navigate(`/utc/${patient.last_utc.id}`);
                            }}
                            className="text-amber-600 hover:text-amber-700 underline font-medium cursor-pointer"
                          >
                            {patient.last_utc.reason}
                          </button>
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}
      </main>
      
      {/* Post-Add Patient Dialog */}
      <Dialog open={showPostAddDialog} onOpenChange={setShowPostAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Patient Added Successfully!</DialogTitle>
            <DialogDescription>
              What would you like to do next?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button 
              onClick={handleAddAnother}
              className="bg-eggplant-700 hover:bg-eggplant-600 h-12"
              data-testid="add-another-patient-btn"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Another Patient
            </Button>
            <Button 
              onClick={handleViewPatient}
              variant="outline"
              className="h-12"
              data-testid="view-patient-btn"
            >
              <ChevronRight className="w-5 h-5 mr-2" />
              Go to Patient Page
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
