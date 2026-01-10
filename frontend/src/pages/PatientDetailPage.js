import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { patientsAPI, visitsAPI, unableToContactAPI, interventionsAPI } from '../lib/api';
import axios from 'axios';
import { formatDate, formatDateTime, calculateAge, getHealthStatusColor, formatDateNumeric } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { 
  Stethoscope, 
  ArrowLeft, 
  User, 
  Calendar,
  MapPin,
  Phone,
  Pill,
  AlertTriangle,
  Activity,
  Edit,
  Save,
  X,
  Plus,
  FileText,
  Trash2,
  Clock,
  PhoneOff,
  Building2,
  Heart,
  Syringe
} from 'lucide-react';
import { toast } from 'sonner';

export default function PatientDetailPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [unableToContactRecords, setUnableToContactRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [customOrganization, setCustomOrganization] = useState('');
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [draftVisit, setDraftVisit] = useState(null);
  const [pendingVisitType, setPendingVisitType] = useState(null);
  const [showDailyNotesModal, setShowDailyNotesModal] = useState(false);
  const [dailyNotesData, setDailyNotesData] = useState([]);
  const [loadingDailyNotes, setLoadingDailyNotes] = useState(false);
  const [dayPrograms, setDayPrograms] = useState([]);

  useEffect(() => {
    fetchPatientData();
    fetchDayPrograms();
  }, [patientId]);
  
  const fetchDayPrograms = async () => {
    try {
      const token = localStorage.getItem('nurse_token');
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin/day-programs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDayPrograms(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.log('Could not fetch day programs:', error);
      setDayPrograms([]); // Ensure it's always an array
    }
  };

  const fetchPatientData = async () => {
    try {
      // Fetch patient and visits first (critical)
      const [patientRes, visitsRes, utcRes] = await Promise.all([
        patientsAPI.get(patientId),
        visitsAPI.list(patientId),
        unableToContactAPI.list(patientId)
      ]);
      
      setPatient(patientRes.data);
      setProfileData(patientRes.data.permanent_info || {});
      
      // Separate daily_note visits from regular visits
      const filteredVisits = visitsRes.data.filter(v => v.visit_type !== 'daily_note');
      const dailyNotesList = visitsRes.data.filter(v => v.visit_type === 'daily_note');
      setVisits(filteredVisits);
      setDailyNotesData(dailyNotesList);
      
      setUnableToContactRecords(utcRes.data);
      
      // Fetch interventions separately (non-critical)
      try {
        const interventionsRes = await interventionsAPI.list(patientId);
        setInterventions(interventionsRes.data);
      } catch (err) {
        console.log('Could not load interventions:', err);
        setInterventions([]); // Set to empty array if fails
      }
      
      // Check if organization is custom (not one of the presets)
      const org = patientRes.data.permanent_info?.organization;
      if (org && org !== 'POSH Host Homes' && org !== 'Ebenezer Private HomeCare' && org !== 'Jericho') {
        setCustomOrganization(org);
      }
    } catch (error) {
      console.error('Failed to load patient data:', error);
      toast.error('Failed to load patient data');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayFieldChange = (field, value) => {
    // Store as string while editing, will convert to array on save
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      // Convert comma-separated strings to arrays before saving
      const processedData = { ...profileData };
      const arrayFields = ['medications', 'allergies', 'medical_diagnoses', 'psychiatric_diagnoses'];
      arrayFields.forEach(field => {
        if (typeof processedData[field] === 'string') {
          processedData[field] = processedData[field]
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
        }
      });
      
      const response = await patientsAPI.update(patientId, { permanent_info: processedData });
      setPatient(response.data);
      setEditingProfile(false);
      toast.success('Profile saved successfully');
    } catch (error) {
      toast.error('Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeletePatient = async () => {
    try {
      await patientsAPI.delete(patientId);
      toast.success('Patient deleted successfully');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to delete patient');
    }
  };

  const handleDeleteVisit = async (visitId) => {
    if (!window.confirm('Are you sure you want to delete this visit? This action cannot be undone.')) {
      return;
    }
    try {
      await visitsAPI.delete(visitId);
      toast.success('Visit deleted successfully');
      fetchPatientData(); // Refresh the data
    } catch (error) {
      toast.error('Failed to delete visit');
    }
  };

  const handleDeleteIntervention = async (interventionId) => {
    if (!window.confirm('Are you sure you want to delete this intervention? This action cannot be undone.')) {
      return;
    }
    try {
      await interventionsAPI.delete(interventionId);
      toast.success('Intervention deleted successfully');
      fetchPatientData(); // Refresh the data
    } catch (error) {
      toast.error('Failed to delete intervention');
    }
  };

  const fetchDailyNotes = async () => {
    setLoadingDailyNotes(true);
    try {
      // Get current month's start and end dates
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      
      // Fetch all visits for this patient
      const response = await visitsAPI.list(patientId);
      
      // Filter for daily_note visits from current month
      const dailyNotes = response.data.filter(visit => {
        if (visit.visit_type !== 'daily_note') return false;
        const visitDate = new Date(visit.visit_date);
        return visitDate.getFullYear() === year && 
               (visitDate.getMonth() + 1) === parseInt(month);
      });
      
      // Sort by date
      dailyNotes.sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date));
      
      setDailyNotesData(dailyNotes);
      setShowDailyNotesModal(true);
    } catch (error) {
      toast.error('Failed to load daily notes');
    } finally {
      setLoadingDailyNotes(false);
    }
  };

  const handleVisitButtonClick = async (visitType) => {
    // Check for existing draft
    try {
      const visitsRes = await visitsAPI.list(patientId);
      const draft = visitsRes.data.find(v => 
        v.visit_type === visitType && v.status === 'draft'
      );
      
      if (draft) {
        setDraftVisit(draft);
        setPendingVisitType(visitType);
        setShowDraftDialog(true);
      } else {
        // No draft, proceed to new visit
        sessionStorage.setItem('visitType', visitType);
        navigate(`/patients/${patientId}/new-visit`);
      }
    } catch (error) {
      // If error checking drafts, proceed anyway
      sessionStorage.setItem('visitType', visitType);
      navigate(`/patients/${patientId}/new-visit`);
    }
  };

  const handleResumeDraft = () => {
    sessionStorage.setItem('visitType', pendingVisitType);
    sessionStorage.setItem('draftVisitId', draftVisit.id);
    navigate(`/patients/${patientId}/new-visit`);
    setShowDraftDialog(false);
  };

  const handleStartNewVisit = () => {
    sessionStorage.setItem('visitType', pendingVisitType);
    sessionStorage.removeItem('draftVisitId');
    navigate(`/patients/${patientId}/new-visit`);
    setShowDraftDialog(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading patient data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="patient-detail-page">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/dashboard')}
                data-testid="back-to-dashboard"
                title="Return to Patient List"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="w-10 h-10 bg-eggplant-700 rounded-xl flex items-center justify-center hover:bg-eggplant-600 transition-colors cursor-pointer"
                  title="Back to Dashboard"
                >
                  <Stethoscope className="w-6 h-6 text-white" />
                </button>
                <span className="text-xl font-bold text-slate-900">POSH-Able Living</span>
              </div>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="ml-4"
                data-testid="return-to-list-btn"
              >
                Return to Patient List
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
                onClick={() => setShowDeleteDialog(true)}
                data-testid="delete-patient-btn"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Patient Header - Sticky below main header */}
        <div className="sticky top-16 z-30 bg-slate-50 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-4 mb-4 border-b border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-eggplant-50 rounded-2xl flex items-center justify-center">
                <User className="w-8 h-8 text-eggplant-700" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{patient.full_name}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-slate-500">
                  {patient.permanent_info?.organization && (
                    <span className="flex items-center gap-1 bg-eggplant-50 text-eggplant-700 px-2 py-1 rounded text-xs">
                      <Building2 className="w-3 h-3" />
                      {patient.permanent_info.organization}
                    </span>
                  )}
                  {patient.permanent_info?.date_of_birth && (
                    <span className="flex items-center gap-1 text-xs">
                      <Calendar className="w-3 h-3" />
                      {calculateAge(patient.permanent_info.date_of_birth)} years old
                    </span>
                  )}
                  {patient.permanent_info?.gender && (
                    <span className="bg-slate-100 px-2 py-1 rounded text-xs">
                      {patient.permanent_info.gender}
                    </span>
                  )}
                  {patient.permanent_info?.visit_frequency && (
                    <span className="bg-slate-100 px-2 py-1 rounded text-xs">
                      {patient.permanent_info.visit_frequency}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Create a new... Section */}
        <Card className="mb-6 bg-gradient-to-br from-eggplant-50 to-navy-50 border-eggplant-200">
          <CardHeader>
            <CardTitle className="text-lg text-eggplant-900">What would you like to do?</CardTitle>
            <CardDescription className="text-slate-600">Create a new entry for this patient</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button 
                className="h-auto py-4 flex-col gap-2 bg-white hover:bg-eggplant-50 text-eggplant-700 border-2 border-eggplant-200 shadow-sm"
                variant="outline"
                onClick={() => handleVisitButtonClick('nurse_visit')}
                data-testid="create-nurse-visit-btn"
              >
                <Stethoscope className="w-6 h-6" />
                <span className="text-sm font-medium">Nurse Visit</span>
              </Button>

              <Button 
                className="h-auto py-4 flex-col gap-2 bg-white hover:bg-navy-50 text-navy-700 border-2 border-navy-200 shadow-sm"
                variant="outline"
                onClick={() => {
                  sessionStorage.setItem('visitType', 'patient_intervention');
                  navigate(`/patients/${patientId}/intervention`);
                }}
                data-testid="create-intervention-btn"
              >
                <Activity className="w-6 h-6" />
                <span className="text-sm font-medium">Intervention</span>
              </Button>

              <Button 
                className="h-auto py-4 flex-col gap-2 bg-white hover:bg-eggplant-50 text-eggplant-700 border-2 border-eggplant-200 shadow-sm"
                variant="outline"
                onClick={() => handleVisitButtonClick('vitals_only')}
                data-testid="create-vitals-only-btn"
              >
                <Heart className="w-6 h-6" />
                <span className="text-sm font-medium">Vital Signs Only</span>
              </Button>

              <Button 
                className="h-auto py-4 flex-col gap-2 bg-white hover:bg-navy-50 text-navy-700 border-2 border-navy-200 shadow-sm"
                variant="outline"
                onClick={() => handleVisitButtonClick('daily_note')}
                data-testid="create-daily-note-btn"
              >
                <FileText className="w-6 h-6" />
                <span className="text-sm font-medium">Daily Note</span>
              </Button>
            </div>

            {/* Unable to Contact as Secondary Action */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <Button 
                variant="outline"
                size="sm"
                className="text-amber-700 border-amber-300 hover:bg-amber-50"
                onClick={() => navigate(`/patients/${patientId}/unable-to-contact`)}
                data-testid="unable-to-contact-btn"
              >
                <PhoneOff className="w-4 h-4 mr-2" />
                Unable to Contact
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <Tabs defaultValue="visits" className="space-y-6">
              <TabsList className="bg-white border border-slate-100 p-1">
                <TabsTrigger value="visits" className="data-[state=active]:bg-eggplant-50 data-[state=active]:text-eggplant-700">
                  Visit History ({visits.length + interventions.length})
                </TabsTrigger>
                <TabsTrigger value="daily-notes" className="data-[state=active]:bg-eggplant-50 data-[state=active]:text-eggplant-700">
                  Saved Notes ({dailyNotesData.length})
                </TabsTrigger>
                <TabsTrigger value="profile" className="data-[state=active]:bg-eggplant-50 data-[state=active]:text-eggplant-700">
                  Profile
                </TabsTrigger>
                <TabsTrigger value="vitals" className="data-[state=active]:bg-eggplant-50 data-[state=active]:text-eggplant-700">
                  Last Vitals
                </TabsTrigger>
              </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="bg-white border-slate-100">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold">Permanent Information</CardTitle>
                {editingProfile ? (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setEditingProfile(false)}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-eggplant-700 hover:bg-eggplant-600"
                      onClick={saveProfile}
                      disabled={savingProfile}
                      data-testid="save-profile-btn"
                    >
                      <Save className="w-4 h-4 mr-1" />
                      {savingProfile ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      try {
                        // Ensure profileData is initialized
                        if (!profileData || typeof profileData !== 'object') {
                          setProfileData(patient.permanent_info || {});
                        }
                        setEditingProfile(true);
                      } catch (error) {
                        console.error('Error entering edit mode:', error);
                        toast.error('Failed to enter edit mode');
                      }
                    }}
                    data-testid="edit-profile-btn"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {editingProfile && profileData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Organization & Basic Info */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-slate-700 flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Organization
                    </h3>
                    
                    <div className="space-y-3">
                      <div>
                        <Label className="text-slate-500">Which organization should this patient be added to?</Label>
                        {editingProfile ? (
                          <div className="space-y-2 mt-1">
                            <Select
                              value={
                                ['POSH Host Homes', 'Ebenezer Private HomeCare', 'Jericho'].includes(profileData.organization)
                                  ? profileData.organization 
                                  : profileData.organization ? 'Other' : ''
                              }
                              onValueChange={(value) => {
                                if (value === 'Other') {
                                  handleProfileChange('organization', customOrganization || '');
                                } else {
                                  handleProfileChange('organization', value);
                                  setCustomOrganization('');
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select organization" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="POSH Host Homes">POSH Host Homes</SelectItem>
                                <SelectItem value="Ebenezer Private HomeCare">Ebenezer Private HomeCare</SelectItem>
                                <SelectItem value="Jericho">Jericho</SelectItem>
                                <SelectItem value="Other">Other (Enter custom name)</SelectItem>
                              </SelectContent>
                            </Select>
                            {(profileData.organization && 
                              profileData.organization !== 'POSH-Able Living' && 
                              profileData.organization !== 'Ebenezer Private HomeCare') && (
                              <Input
                                value={profileData.organization || ''}
                                onChange={(e) => {
                                  handleProfileChange('organization', e.target.value);
                                  setCustomOrganization(e.target.value);
                                }}
                                placeholder="Enter organization name"
                              />
                            )}
                          </div>
                        ) : (
                          <p className="text-slate-900 flex items-center gap-2">
                            {profileData.organization ? (
                              <>
                                <Building2 className="w-4 h-4 text-eggplant-600" />
                                {profileData.organization}
                              </>
                            ) : (
                              'Not set'
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    <h3 className="font-medium text-slate-700 flex items-center gap-2 pt-4 border-t border-slate-100">
                      <User className="w-4 h-4" />
                      Basic Information
                    </h3>
                    
                    <div className="space-y-3">
                      <div>
                        <Label className="text-slate-500">Date of Birth</Label>
                        {editingProfile ? (
                          <Input
                            type="date"
                            value={profileData.date_of_birth || ''}
                            onChange={(e) => handleProfileChange('date_of_birth', e.target.value)}
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-slate-900">{formatDateNumeric(profileData.date_of_birth) || 'Not set'}</p>
                        )}
                      </div>

                      <div>
                        <Label className="text-slate-500">Gender</Label>
                        {editingProfile ? (
                          <Select
                            value={profileData.gender || ''}
                            onValueChange={(value) => handleProfileChange('gender', value)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Male">Male</SelectItem>
                              <SelectItem value="Female">Female</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-slate-900">{profileData.gender || 'Not set'}</p>
                        )}
                      </div>

                      <div>
                        <Label className="text-slate-500">Race</Label>
                        {editingProfile ? (
                          <Select
                            value={profileData.race || ''}
                            onValueChange={(value) => handleProfileChange('race', value)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select race" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Black or African American">Black or African American</SelectItem>
                              <SelectItem value="White or Caucasian">White or Caucasian</SelectItem>
                              <SelectItem value="Hispanic or Latino">Hispanic or Latino</SelectItem>
                              <SelectItem value="American Indian or Alaska Native">American Indian or Alaska Native</SelectItem>
                              <SelectItem value="Asian">Asian</SelectItem>
                              <SelectItem value="Native Hawaiian or Pacific Islander">Native Hawaiian or Pacific Islander</SelectItem>
                              <SelectItem value="Two or More Races">Two or More Races</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                              <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-slate-900">{profileData.race || 'Not set'}</p>
                        )}
                      </div>

                      <div>
                        <Label className="text-slate-500">Height</Label>
                        {editingProfile ? (
                          <Input
                            value={profileData.height || ''}
                            onChange={(e) => handleProfileChange('height', e.target.value)}
                            className="mt-1"
                            placeholder="e.g., 5ft 8in"
                          />
                        ) : (
                          <p className="text-slate-900">{profileData.height || 'Not set'}</p>
                        )}
                      </div>

                      <div>
                        <Label className="text-slate-500">Visit Frequency</Label>
                        {editingProfile ? (
                          <Select
                            value={profileData.visit_frequency || ''}
                            onValueChange={(value) => handleProfileChange('visit_frequency', value)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Weekly">Weekly</SelectItem>
                              <SelectItem value="Bi-weekly">Bi-weekly</SelectItem>
                              <SelectItem value="Monthly">Monthly</SelectItem>
                              <SelectItem value="As needed">As needed</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-slate-900">{profileData.visit_frequency || 'Not set'}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-slate-700 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Contact & Caregiver
                    </h3>
                    
                    <div className="space-y-3">
                      <div>
                        <Label className="text-slate-500">Home Street Address</Label>
                        {editingProfile ? (
                          <Input
                            value={profileData.home_street_address || ''}
                            onChange={(e) => handleProfileChange('home_street_address', e.target.value)}
                            className="mt-1"
                            placeholder="123 Main Street"
                          />
                        ) : (
                          <p className="text-slate-900">{profileData.home_street_address || 'Not set'}</p>
                        )}
                      </div>

                      <div>
                        <Label className="text-slate-500">City, State & ZIP</Label>
                        {editingProfile ? (
                          <Input
                            value={profileData.home_city_state_zip || ''}
                            onChange={(e) => handleProfileChange('home_city_state_zip', e.target.value)}
                            className="mt-1"
                            placeholder="Minneapolis, MN 55401"
                          />
                        ) : (
                          <p className="text-slate-900">{profileData.home_city_state_zip || 'Not set'}</p>
                        )}
                      </div>

                      <div>
                        <Label className="text-slate-500">This address is a</Label>
                        {editingProfile ? (
                          <Select
                            value={profileData.home_address_type || ''}
                            onValueChange={(value) => handleProfileChange('home_address_type', value)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select address type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Family Home">Family Home</SelectItem>
                              <SelectItem value="Host Home">Host Home</SelectItem>
                              <SelectItem value="Group Home (CLA)">Group Home (CLA)</SelectItem>
                              <SelectItem value="Personal Care Home CRA">Personal Care Home CRA</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-slate-900">{profileData.home_address_type || 'Not set'}</p>
                        )}
                      </div>

                      <div>
                        <Label className="text-slate-500">Caregiver Name</Label>
                        {editingProfile ? (
                          <Input
                            value={profileData.caregiver_name || ''}
                            onChange={(e) => handleProfileChange('caregiver_name', e.target.value)}
                            className="mt-1"
                            placeholder="Primary caregiver"
                          />
                        ) : (
                          <p className="text-slate-900">{profileData.caregiver_name || 'Not set'}</p>
                        )}
                      </div>

                      <div>
                        <Label className="text-slate-500">Caregiver Phone</Label>
                        {editingProfile ? (
                          <Input
                            value={profileData.caregiver_phone || ''}
                            onChange={(e) => handleProfileChange('caregiver_phone', e.target.value)}
                            className="mt-1"
                            placeholder="(555) 555-5555"
                          />
                        ) : (
                          <p className="text-slate-900">{profileData.caregiver_phone || 'Not set'}</p>
                        )}
                      </div>

                      <div>
                        <Label className="text-slate-500">Adult Day Program Name</Label>
                        {editingProfile ? (
                          (Array.isArray(dayPrograms) && dayPrograms.length > 0) ? (
                            <Select
                              value={profileData.adult_day_program_name || ''}
                              onValueChange={(value) => handleProfileChange('adult_day_program_name', value)}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select day program" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">None</SelectItem>
                                {dayPrograms.map(program => (
                                  <SelectItem key={program.id} value={program.name}>
                                    {program.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={profileData.adult_day_program_name || ''}
                              onChange={(e) => handleProfileChange('adult_day_program_name', e.target.value)}
                              className="mt-1"
                              placeholder="Program name"
                            />
                          )
                        ) : (
                          <p className="text-slate-900">{profileData.adult_day_program_name || 'Not set'}</p>
                        )}
                      </div>

                      <div>
                        <Label className="text-slate-500">Adult Day Program Street Address</Label>
                        {editingProfile ? (
                          <Input
                            value={profileData.adult_day_street_address || ''}
                            onChange={(e) => handleProfileChange('adult_day_street_address', e.target.value)}
                            className="mt-1"
                            placeholder="456 Oak Avenue"
                          />
                        ) : (
                          <p className="text-slate-900">{profileData.adult_day_street_address || 'Not set'}</p>
                        )}
                      </div>

                      <div>
                        <Label className="text-slate-500">City, State & ZIP</Label>
                        {editingProfile ? (
                          <Input
                            value={profileData.adult_day_city_state_zip || ''}
                            onChange={(e) => handleProfileChange('adult_day_city_state_zip', e.target.value)}
                            className="mt-1"
                            placeholder="St. Paul, MN 55102"
                          />
                        ) : (
                          <p className="text-slate-900">{profileData.adult_day_city_state_zip || 'Not set'}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Medical Info */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-slate-700 flex items-center gap-2">
                      <Pill className="w-4 h-4" />
                      Medical Information
                    </h3>
                    
                    <div className="space-y-3">
                      <div>
                        <Label className="text-slate-500">Medications</Label>
                        {editingProfile ? (
                          <Textarea
                            value={Array.isArray(profileData.medications) ? profileData.medications.join(', ') : (profileData.medications || '')}
                            onChange={(e) => handleArrayFieldChange('medications', e.target.value)}
                            className="mt-1"
                            placeholder="Separate with commas (e.g., Aspirin 81mg, Metformin 500mg, Lisinopril 10mg)"
                            rows={3}
                          />
                        ) : (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {((Array.isArray(profileData.medications) ? profileData.medications : [])).length > 0 ? (
                              (Array.isArray(profileData.medications) ? profileData.medications : []).map((med, i) => (
                                <span key={i} className="bg-eggplant-50 text-eggplant-700 px-2 py-1 rounded text-sm">
                                  {med}
                                </span>
                              ))
                            ) : (
                              <p className="text-slate-400">None listed</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <Label className="text-slate-500 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          Allergies
                        </Label>
                        {editingProfile ? (
                          <Textarea
                            value={Array.isArray(profileData.allergies) ? profileData.allergies.join(', ') : (profileData.allergies || '')}
                            onChange={(e) => handleArrayFieldChange('allergies', e.target.value)}
                            className="mt-1"
                            placeholder="Separate with commas (e.g., Penicillin, Peanuts, Latex)"
                            rows={2}
                          />
                        ) : (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {((Array.isArray(profileData.allergies) ? profileData.allergies : [])).length > 0 ? (
                              (Array.isArray(profileData.allergies) ? profileData.allergies : []).map((allergy, i) => (
                                <span key={i} className="bg-rose-50 text-rose-700 px-2 py-1 rounded text-sm">
                                  {allergy}
                                </span>
                              ))
                            ) : (
                              <p className="text-slate-400">None listed</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <Label className="text-slate-500">Medical Diagnoses</Label>
                        {editingProfile ? (
                          <Textarea
                            value={Array.isArray(profileData.medical_diagnoses) ? profileData.medical_diagnoses.join(', ') : (profileData.medical_diagnoses || '')}
                            onChange={(e) => handleArrayFieldChange('medical_diagnoses', e.target.value)}
                            className="mt-1"
                            placeholder="Separate with commas (e.g., Type 2 Diabetes, Hypertension, COPD)"
                            rows={2}
                          />
                        ) : (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {((Array.isArray(profileData.medical_diagnoses) ? profileData.medical_diagnoses : [])).length > 0 ? (
                              (Array.isArray(profileData.medical_diagnoses) ? profileData.medical_diagnoses : []).map((dx, i) => (
                                <span key={i} className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-sm">
                                  {dx}
                                </span>
                              ))
                            ) : (
                              <p className="text-slate-400">None listed</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <Label className="text-slate-500">Psychiatric Diagnoses</Label>
                        {editingProfile ? (
                          <Textarea
                            value={Array.isArray(profileData.psychiatric_diagnoses) ? profileData.psychiatric_diagnoses.join(', ') : (profileData.psychiatric_diagnoses || '')}
                            onChange={(e) => handleArrayFieldChange('psychiatric_diagnoses', e.target.value)}
                            className="mt-1"
                            placeholder="Separate with commas (e.g., Major Depression, Anxiety Disorder, PTSD)"
                            rows={2}
                          />
                        ) : (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {((Array.isArray(profileData.psychiatric_diagnoses) ? profileData.psychiatric_diagnoses : [])).length > 0 ? (
                              (Array.isArray(profileData.psychiatric_diagnoses) ? profileData.psychiatric_diagnoses : []).map((dx, i) => (
                                <span key={i} className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-sm">
                                  {dx}
                                </span>
                              ))
                            ) : (
                              <p className="text-slate-400">None listed</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <Label className="text-slate-500">Additional Information</Label>
                        <p className="text-xs text-slate-400 mb-1">Employment, hobbies, favorite things, foods, siblings, etc.</p>
                        {editingProfile ? (
                          <Textarea
                            value={profileData.additional_info || ''}
                            onChange={(e) => handleProfileChange('additional_info', e.target.value)}
                            className="mt-1"
                            placeholder="e.g., Works at local grocery store, loves painting, enjoys chocolate ice cream, has two sisters..."
                            rows={4}
                          />
                        ) : (
                          <p className="text-slate-900 mt-1 whitespace-pre-wrap">{profileData.additional_info || 'Not provided'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Added Date - at bottom of profile */}
            <div className="text-center pt-6">
              <p className="text-xs text-slate-400">
                Patient added on {formatDate(patient.created_at)}
              </p>
            </div>
          </TabsContent>

          {/* Visits Tab */}
          <TabsContent value="visits" className="space-y-4">
            {visits.length === 0 && interventions.length === 0 ? (
              <Card className="bg-white border-slate-100">
                <CardContent className="py-12">
                  <div className="empty-state">
                    <FileText className="empty-state-icon" />
                    <h3 className="empty-state-title">No visits or interventions recorded</h3>
                    <p className="empty-state-description">
                      Start documenting this patient's visits by clicking the "New Visit" or "Intervention" button above.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Visits */}
                {visits.map(visit => (
                  <Card 
                    key={`visit-${visit.id}`}
                    className="bg-white border-slate-100 hover:border-eggplant-200 transition-all"
                    data-testid={`visit-card-${visit.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div 
                          className="flex items-center gap-4 flex-1 cursor-pointer"
                          onClick={() => navigate(`/visits/${visit.id}`)}
                        >
                          <div className="w-12 h-12 bg-eggplant-50 rounded-xl flex items-center justify-center">
                            <Activity className="w-6 h-6 text-eggplant-700" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {visit.visit_type === 'nurse_visit' ? 'Nurse Visit' : 'Vitals Only'} on {formatDateTime(visit.visit_date)}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {visit.vital_signs?.blood_pressure_systolic && (
                                <span className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">
                                  BP: {visit.vital_signs.blood_pressure_systolic}/{visit.vital_signs.blood_pressure_diastolic}
                                </span>
                              )}
                              {visit.vital_signs?.pulse && (
                                <span className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">
                                  HR: {visit.vital_signs.pulse}
                                </span>
                              )}
                              {visit.vital_signs?.body_temperature && (
                                <span className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">
                                  Temp: {visit.vital_signs.body_temperature}
                                </span>
                              )}
                              {visit.overall_health_status && (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getHealthStatusColor(visit.overall_health_status)}`}>
                                  {visit.overall_health_status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(visit.visit_type === 'nurse_visit' || visit.visit_type === 'vitals_only') && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/visits/${visit.id}`);
                                }}
                                className="text-eggplant-700"
                              >
                                <FileText className="w-4 h-4 mr-1" />
                                View PDF
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('Edit visit clicked:', visit.id, 'type:', visit.visit_type);
                                  // Navigate to edit page - reuse NewVisitPage with visit data
                                  const editUrl = `/patients/${patientId}/new-visit?editVisitId=${visit.id}`;
                                  console.log('Navigating to:', editUrl);
                                  navigate(editUrl);
                                }}
                                className="text-blue-700"
                                data-testid={`edit-visit-btn-${visit.id}`}
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Edit Visit
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteVisit(visit.id);
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <div className="text-slate-400 text-sm flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDate(visit.created_at)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {/* Interventions */}
                {interventions.map(intervention => (
                  <Card 
                    key={`intervention-${intervention.id}`}
                    className="bg-white border-slate-100 hover:border-blue-200 transition-all"
                    data-testid={`intervention-card-${intervention.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                            <Syringe className="w-6 h-6 text-blue-700" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {intervention.intervention_type.charAt(0).toUpperCase() + intervention.intervention_type.slice(1)} on {formatDateTime(intervention.intervention_date)}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                                {intervention.location === 'home' ? 'Home' : 'Adult Day Center'}
                              </span>
                              {intervention.body_temperature && (
                                <span className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">
                                  Temp: {intervention.body_temperature}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              // TODO: Generate intervention PDF
                              toast.info('PDF generation for interventions coming soon');
                            }}
                            className="text-blue-700"
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            View PDF
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Navigate to edit intervention page
                              navigate(`/patients/${patientId}/intervention?editId=${intervention.id}`);
                            }}
                            className="text-blue-700"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteIntervention(intervention.id);
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <div className="text-slate-400 text-sm flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDate(intervention.created_at)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          {/* Daily Notes Tab */}
          <TabsContent value="daily-notes">
            {dailyNotesData.length === 0 ? (
              <Card className="bg-white border-slate-100">
                <CardContent className="p-12 text-center">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No daily notes saved yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {dailyNotesData.map(note => (
                  <Card 
                    key={`note-${note.id}`}
                    className="bg-white border-slate-100 hover:border-amber-200 transition-all"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-amber-700" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">
                                Daily Note - {formatDateTime(note.visit_date)}
                              </p>
                              <p className="text-xs text-slate-500">
                                Saved: {formatDate(note.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-lg">
                            <p className="text-slate-900 whitespace-pre-wrap text-sm">
                              {note.daily_note_content}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/patients/${patientId}/new-visit?editVisitId=${note.id}`)}
                            className="text-blue-700"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteVisit(note.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Last Vitals Tab */}
          <TabsContent value="vitals">
            <Card className="bg-white border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-eggplant-700" />
                  Last Recorded Vitals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {patient.last_vitals ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {patient.last_vitals.weight && (
                      <div className="bg-slate-50 p-4 rounded-xl">
                        <p className="text-sm text-slate-500">Weight</p>
                        <p className="text-2xl font-bold text-slate-900 font-mono">
                          {patient.last_vitals.weight}
                        </p>
                      </div>
                    )}
                    {patient.last_vitals.body_temperature && (
                      <div className="bg-slate-50 p-4 rounded-xl">
                        <p className="text-sm text-slate-500">Temperature</p>
                        <p className="text-2xl font-bold text-slate-900 font-mono">
                          {patient.last_vitals.body_temperature}
                        </p>
                      </div>
                    )}
                    {patient.last_vitals.blood_pressure_systolic && (
                      <div className="bg-slate-50 p-4 rounded-xl">
                        <p className="text-sm text-slate-500">Blood Pressure</p>
                        <p className="text-2xl font-bold text-slate-900 font-mono">
                          {patient.last_vitals.blood_pressure_systolic}/{patient.last_vitals.blood_pressure_diastolic}
                        </p>
                      </div>
                    )}
                    {patient.last_vitals.pulse_oximeter && (
                      <div className="bg-slate-50 p-4 rounded-xl">
                        <p className="text-sm text-slate-500">SpO2</p>
                        <p className="text-2xl font-bold text-slate-900 font-mono">
                          {patient.last_vitals.pulse_oximeter}%
                        </p>
                      </div>
                    )}
                    {patient.last_vitals.pulse && (
                      <div className="bg-slate-50 p-4 rounded-xl">
                        <p className="text-sm text-slate-500">Pulse</p>
                        <p className="text-2xl font-bold text-slate-900 font-mono">
                          {patient.last_vitals.pulse} bpm
                        </p>
                      </div>
                    )}
                    {patient.last_vitals.respirations && (
                      <div className="bg-slate-50 p-4 rounded-xl">
                        <p className="text-sm text-slate-500">Respirations</p>
                        <p className="text-2xl font-bold text-slate-900 font-mono">
                          {patient.last_vitals.respirations}/min
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    No vitals recorded yet. Complete a visit to record vitals.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
            </Tabs>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDailyNotes}
            disabled={loadingDailyNotes}
            className="ml-4 self-start"
          >
            <FileText className="w-4 h-4 mr-2" />
            {loadingDailyNotes ? 'Loading...' : 'Daily Notes Report'}
          </Button>
        </div>
      </main>

      {/* Draft Confirmation Dialog */}
      <AlertDialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Draft Found</AlertDialogTitle>
            <AlertDialogDescription>
              You have an existing draft for this visit type from {draftVisit ? formatDate(draftVisit.visit_date) : ''}. Would you like to continue editing the draft or start a new visit?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDraftDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleStartNewVisit}
            >
              Start New Visit
            </Button>
            <AlertDialogAction 
              onClick={handleResumeDraft}
              className="bg-eggplant-700 hover:bg-eggplant-600"
            >
              Continue Draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Daily Notes Report Modal */}
      <Dialog open={showDailyNotesModal} onOpenChange={setShowDailyNotesModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center justify-between">
              <span>Daily Notes for {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              <span className="font-bold">{patient?.full_name}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4 space-y-4">
            {dailyNotesData.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No daily notes recorded for this month</p>
              </div>
            ) : (
              <>
                {/* Report Header Line */}
                <div className="flex justify-between items-center text-sm text-slate-600 pb-3 border-b-2 border-slate-300">
                  <span className="font-medium">{patient?.permanent_info?.organization || 'Organization'}</span>
                  <span>
                    Report Period: {formatDate(dailyNotesData[0]?.visit_date)} - {formatDate(dailyNotesData[dailyNotesData.length - 1]?.visit_date)}
                  </span>
                </div>

                {/* Journal Entries */}
                <div className="space-y-4 mt-6">
                  {dailyNotesData.map((note, index) => (
                    <div key={note.id} className="pb-4">
                      <div className="flex gap-6">
                        <div className="font-semibold text-slate-700 min-w-[110px]">
                          {formatDateNumeric(note.visit_date)}
                        </div>
                        <div className="flex-1 text-slate-900">
                          {note.daily_note_content || note.nurse_notes || 'No notes recorded'}
                        </div>
                      </div>
                      {index < dailyNotesData.length - 1 && (
                        <div className="border-b border-slate-300 mt-4"></div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setShowDailyNotesModal(false)}
            >
              Close
            </Button>
            {dailyNotesData.length > 0 && (
              <Button
                onClick={() => {
                  // Navigate to reports page with pre-filled filters
                  const now = new Date();
                  const month = String(now.getMonth() + 1).padStart(2, '0');
                  const year = now.getFullYear();
                  navigate(`/reports?patient=${patientId}&visitType=daily_note&month=${month}&year=${year}`);
                }}
                className="bg-eggplant-700 hover:bg-eggplant-600"
              >
                <FileText className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Patient?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {patient?.full_name} and all their visit records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeletePatient}
              className="bg-rose-600 hover:bg-rose-700"
              data-testid="confirm-delete-btn"
            >
              Delete Patient
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
