import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { patientsAPI } from '../lib/api';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { 
  ArrowLeft, 
  Users, 
  UserCog, 
  Shield,
  ChevronRight,
  Plus,
  Eye,
  Edit,
  Building,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminPage() {
  const navigate = useNavigate();
  const { nurse } = useAuth();
  const [nurses, setNurses] = useState([]);
  const [patients, setPatients] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [dayPrograms, setDayPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStaffSection, setShowStaffSection] = useState(false);
  const [showOrganizationsSection, setShowOrganizationsSection] = useState(false);
  const [showDayProgramsSection, setShowDayProgramsSection] = useState(false);
  const [showAddNurseDialog, setShowAddNurseDialog] = useState(false);
  const [showNurseProfileDialog, setShowNurseProfileDialog] = useState(false);
  const [showEditNurseDialog, setShowEditNurseDialog] = useState(false);
  const [showOrganizationDialog, setShowOrganizationDialog] = useState(false);
  const [showDayProgramDialog, setShowDayProgramDialog] = useState(false);
  const [selectedNurse, setSelectedNurse] = useState(null);
  const [editNurseData, setEditNurseData] = useState({
    full_name: '',
    title: '',
    license_number: '',
    email: ''
  });
  const [assignmentData, setAssignmentData] = useState({
    assigned_patients: [],
    assigned_organizations: [],
    allowed_forms: []
  });
  const [newNurseData, setNewNurseData] = useState({
    email: '',
    password: '',
    full_name: '',
    title: 'RN',
    license_number: ''
  });
  const [organizationData, setOrganizationData] = useState({
    name: '',
    address: '',
    contact_person: '',
    contact_phone: ''
  });
  const [dayProgramData, setDayProgramData] = useState({
    name: '',
    address: '',
    office_phone: '',
    contact_person: ''
  });

  useEffect(() => {
    if (!nurse?.is_admin) {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [nurse, navigate]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('nurse_token');
      const [nursesRes, patientsRes, orgsRes, programsRes] = await Promise.all([
        axios.get(`${API}/admin/nurses`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        patientsAPI.list(),
        axios.get(`${API}/admin/organizations`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] })),
        axios.get(`${API}/admin/day-programs`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] }))
      ]);
      setNurses(nursesRes.data);
      setPatients(patientsRes.data);
      setOrganizations(orgsRes.data || []);
      setDayPrograms(programsRes.data || []);
    } catch (error) {
      console.error('Admin data fetch error:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteToAdmin = async (nurseId) => {
    try {
      const token = localStorage.getItem('nurse_token');
      await axios.post(`${API}/admin/nurses/${nurseId}/promote`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Nurse promoted to admin');
      fetchData();
    } catch (error) {
      toast.error('Failed to promote nurse');
    }
  };

  const handleDemoteFromAdmin = async (nurseId) => {
    try {
      const token = localStorage.getItem('nurse_token');
      await axios.post(`${API}/admin/nurses/${nurseId}/demote`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Admin privileges removed');
      fetchData();
    } catch (error) {
      toast.error('Failed to demote nurse');
    }
  };

  const handleAddNurse = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('nurse_token');
      await axios.post(`${API}/auth/register`, newNurseData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Nurse added successfully');
      setShowAddNurseDialog(false);
      setNewNurseData({
        email: '',
        password: '',
        full_name: '',
        title: 'RN',
        license_number: ''
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add nurse');
    }
  };

  const handleSaveOrganization = async () => {
    try {
      const token = localStorage.getItem('nurse_token');
      await axios.post(`${API}/admin/organizations`, organizationData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Organization added successfully');
      setShowOrganizationDialog(false);
      setOrganizationData({ name: '', address: '', contact_person: '', contact_phone: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to add organization');
    }
  };

  const handleSaveDayProgram = async () => {
    try {
      const token = localStorage.getItem('nurse_token');
      await axios.post(`${API}/admin/day-programs`, dayProgramData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Day program added successfully');
      setShowDayProgramDialog(false);
      setDayProgramData({ name: '', address: '', office_phone: '', contact_person: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to add day program');
    }
  };

  const handleViewNurseProfile = (nurseItem) => {
    setSelectedNurse(nurseItem);
    setShowNurseProfileDialog(true);
  };

  const handleEditNurse = (nurseItem) => {
    setSelectedNurse(nurseItem);
    setEditNurseData({
      full_name: nurseItem.full_name,
      title: nurseItem.title,
      license_number: nurseItem.license_number || '',
      email: nurseItem.email
    });
    setAssignmentData({
      assigned_patients: nurseItem.assigned_patients || [],
      assigned_organizations: nurseItem.assigned_organizations || [],
      allowed_forms: nurseItem.allowed_forms || []
    });
    setShowEditNurseDialog(true);
  };

  const handleUpdateNurse = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('nurse_token');
      
      // Update nurse profile
      await axios.put(`${API}/admin/nurses/${selectedNurse.id}`, editNurseData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update assignments
      await axios.post(`${API}/admin/nurses/${selectedNurse.id}/assignments`, assignmentData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Staff profile and assignments updated successfully');
      setShowEditNurseDialog(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to update staff profile');
    }
  };

  const togglePatientAssignment = (patientId) => {
    setAssignmentData(prev => ({
      ...prev,
      assigned_patients: prev.assigned_patients.includes(patientId)
        ? prev.assigned_patients.filter(id => id !== patientId)
        : [...prev.assigned_patients, patientId]
    }));
  };

  const toggleOrganizationAssignment = (org) => {
    setAssignmentData(prev => ({
      ...prev,
      assigned_organizations: prev.assigned_organizations.includes(org)
        ? prev.assigned_organizations.filter(o => o !== org)
        : [...prev.assigned_organizations, org]
    }));
  };

  const toggleFormAccess = (form) => {
    setAssignmentData(prev => ({
      ...prev,
      allowed_forms: prev.allowed_forms.includes(form)
        ? prev.allowed_forms.filter(f => f !== form)
        : [...prev.allowed_forms, form]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/dashboard')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-slate-900">Admin Panel</h1>
                  <p className="text-sm text-slate-500">Manage nurses and assignments</p>
                </div>
              </div>
            </div>
            
            {/* Top Right Buttons */}
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => navigate('/dashboard')}
                variant="outline"
                size="sm"
              >
                <Users className="w-4 h-4 mr-2" />
                Patient List
              </Button>
              <Button 
                onClick={() => navigate('/reports')}
                className="bg-eggplant-700 hover:bg-eggplant-600"
                size="sm"
              >
                Monthly Reports
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats - All in One Line */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 divide-x divide-slate-200">
              {/* Total Staff */}
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-slate-500 mb-1">Total Staff</p>
                  <div className="flex items-center justify-center gap-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    <p className="text-3xl font-bold text-slate-900">{nurses.length}</p>
                  </div>
                </div>
              </div>
              
              {/* Total Patients */}
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-slate-500 mb-1">Total Patients</p>
                  <div className="flex items-center justify-center gap-2">
                    <Users className="w-5 h-5 text-eggplant-600" />
                    <p className="text-3xl font-bold text-slate-900">{patients.length}</p>
                  </div>
                </div>
              </div>
              
              {/* Admins */}
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-slate-500 mb-1">Admins</p>
                  <div className="flex items-center justify-center gap-2">
                    <Shield className="w-5 h-5 text-amber-600" />
                    <p className="text-3xl font-bold text-slate-900">
                      {nurses.filter(n => n.is_admin).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Organizations Management */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Manage Organizations
                </CardTitle>
                <CardDescription>
                  Add and manage residential organizations
                </CardDescription>
              </div>
              {!showOrganizationsSection ? (
                <Button 
                  onClick={() => setShowOrganizationsSection(true)}
                  className="bg-eggplant-700 hover:bg-eggplant-600"
                >
                  Launch
                </Button>
              ) : (
                <Dialog open={showOrganizationDialog} onOpenChange={setShowOrganizationDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-eggplant-700 hover:bg-eggplant-600">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Organization
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Organization</DialogTitle>
                    <DialogDescription>
                      Add a new residential organization
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveOrganization(); }} className="space-y-4">
                    <div>
                      <Label>Organization Name</Label>
                      <Input
                        value={organizationData.name}
                        onChange={(e) => setOrganizationData({...organizationData, name: e.target.value})}
                        placeholder="e.g., POSH Host Homes"
                        required
                      />
                    </div>
                    <div>
                      <Label>Address</Label>
                      <Input
                        value={organizationData.address}
                        onChange={(e) => setOrganizationData({...organizationData, address: e.target.value})}
                        placeholder="Full address"
                        required
                      />
                    </div>
                    <div>
                      <Label>Contact Person</Label>
                      <Input
                        value={organizationData.contact_person}
                        onChange={(e) => setOrganizationData({...organizationData, contact_person: e.target.value})}
                        placeholder="Name of contact person"
                        required
                      />
                    </div>
                    <div>
                      <Label>Contact Phone Number</Label>
                      <Input
                        value={organizationData.contact_phone}
                        onChange={(e) => setOrganizationData({...organizationData, contact_phone: e.target.value})}
                        placeholder="Phone number"
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setShowOrganizationDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-eggplant-700 hover:bg-eggplant-600">
                        Save Organization
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              )}
            </div>
          </CardHeader>
          {showOrganizationsSection && (
            <CardContent>
              {organizations.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No organizations added yet</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {organizations.map(org => (
                    <Card key={org.id} className="border-slate-200">
                      <CardContent className="pt-6">
                        <h3 className="font-semibold text-lg mb-2">{org.name}</h3>
                        <div className="space-y-1 text-sm text-slate-600">
                          <p><strong>Address:</strong> {org.address}</p>
                          <p><strong>Contact:</strong> {org.contact_person}</p>
                          <p><strong>Phone:</strong> {org.contact_phone}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Day Programs Management */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Manage Day Programs (CAG&apos;s)
                </CardTitle>
                <CardDescription>
                  Add and manage adult day program centers
                </CardDescription>
              </div>
              {!showDayProgramsSection ? (
                <Button 
                  onClick={() => setShowDayProgramsSection(true)}
                  className="bg-blue-600 hover:bg-blue-500"
                >
                  Launch
                </Button>
              ) : (
                <Dialog open={showDayProgramDialog} onOpenChange={setShowDayProgramDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-500">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Day Program
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Day Program</DialogTitle>
                    <DialogDescription>
                      Add a new adult day program center
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveDayProgram(); }} className="space-y-4">
                    <div>
                      <Label>Center Name</Label>
                      <Input
                        value={dayProgramData.name}
                        onChange={(e) => setDayProgramData({...dayProgramData, name: e.target.value})}
                        placeholder="Name of day program"
                        required
                      />
                    </div>
                    <div>
                      <Label>Address</Label>
                      <Input
                        value={dayProgramData.address}
                        onChange={(e) => setDayProgramData({...dayProgramData, address: e.target.value})}
                        placeholder="Full address"
                        required
                      />
                    </div>
                    <div>
                      <Label>Office Telephone Number</Label>
                      <Input
                        value={dayProgramData.office_phone}
                        onChange={(e) => setDayProgramData({...dayProgramData, office_phone: e.target.value})}
                        placeholder="Office phone number"
                        required
                      />
                    </div>
                    <div>
                      <Label>Contact Person (Optional)</Label>
                      <Input
                        value={dayProgramData.contact_person}
                        onChange={(e) => setDayProgramData({...dayProgramData, contact_person: e.target.value})}
                        placeholder="Name of contact person"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setShowDayProgramDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-blue-600 hover:bg-blue-500">
                        Save Day Program
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              )}
            </div>
          </CardHeader>
          {showDayProgramsSection && (
            <CardContent>
              {dayPrograms.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No day programs added yet</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dayPrograms.map(program => (
                    <Card key={program.id} className="border-slate-200">
                      <CardContent className="pt-6">
                        <h3 className="font-semibold text-lg mb-2">{program.name}</h3>
                        <div className="space-y-1 text-sm text-slate-600">
                          <p><strong>Address:</strong> {program.address}</p>
                          <p><strong>Office Phone:</strong> {program.office_phone}</p>
                          {program.contact_person && (
                            <p><strong>Contact:</strong> {program.contact_person}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Nurses Management */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="w-5 h-5" />
                  Manage Staff
                </CardTitle>
                <CardDescription>
                  View all staff members and manage access permissions
                </CardDescription>
              </div>
              {!showStaffSection ? (
                <Button 
                  onClick={() => setShowStaffSection(true)}
                  className="bg-purple-600 hover:bg-purple-500"
                >
                  Launch
                </Button>
              ) : (
                <Dialog open={showAddNurseDialog} onOpenChange={setShowAddNurseDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-purple-600 hover:bg-purple-500">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Staff
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Staff Member</DialogTitle>
                    <DialogDescription>
                      Create a new staff account
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddNurse} className="space-y-4">
                    <div>
                      <Label>Full Name</Label>
                      <Input
                        value={newNurseData.full_name}
                        onChange={(e) => setNewNurseData({...newNurseData, full_name: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={newNurseData.email}
                        onChange={(e) => setNewNurseData({...newNurseData, email: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={newNurseData.password}
                        onChange={(e) => setNewNurseData({...newNurseData, password: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <Label>Title/Role</Label>
                      <Input
                        value={newNurseData.title}
                        onChange={(e) => setNewNurseData({...newNurseData, title: e.target.value})}
                        placeholder="e.g., RN, LPN, CNA, DSP, Med Tech"
                        required
                      />
                    </div>
                    <div>
                      <Label>License Number</Label>
                      <Input
                        value={newNurseData.license_number}
                        onChange={(e) => setNewNurseData({...newNurseData, license_number: e.target.value})}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setShowAddNurseDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-purple-600 hover:bg-purple-500">
                        Add Staff Member
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              )}
            </div>
          </CardHeader>
          {showStaffSection && (
            <CardContent>
              <div className="space-y-3">
                {nurses.map(nurseItem => (
                <div 
                  key={nurseItem.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 flex items-center gap-2">
                        {nurseItem.full_name}
                        {nurseItem.is_admin && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                            Admin
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-slate-500">
                        {nurseItem.email} • {nurseItem.title} • {nurseItem.license_number || 'No license'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewNurseProfile(nurseItem)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditNurse(nurseItem)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    {nurseItem.is_admin && nurseItem.id !== nurse?.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDemoteFromAdmin(nurseItem.id)}
                        className="text-amber-600 border-amber-200 hover:bg-amber-50"
                      >
                        Remove Admin
                      </Button>
                    )}
                    {!nurseItem.is_admin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePromoteToAdmin(nurseItem.id)}
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Promote
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          )}
        </Card>
      </main>

      {/* Nurse Profile Dialog */}
      <Dialog open={showNurseProfileDialog} onOpenChange={setShowNurseProfileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nurse Profile</DialogTitle>
          </DialogHeader>
          {selectedNurse && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                  <Users className="w-8 h-8 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    {selectedNurse.full_name}
                    {selectedNurse.is_admin && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                        Admin
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-slate-500">{selectedNurse.title}</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label className="text-slate-500">Email</Label>
                  <p className="font-medium">{selectedNurse.email}</p>
                </div>
                
                <div>
                  <Label className="text-slate-500">License Number</Label>
                  <p className="font-medium">{selectedNurse.license_number || 'Not provided'}</p>
                </div>
                
                <div>
                  <Label className="text-slate-500">Account Created</Label>
                  <p className="font-medium">
                    {new Date(selectedNurse.created_at).toLocaleDateString()}
                  </p>
                </div>
                
                <div>
                  <Label className="text-slate-500">User ID</Label>
                  <p className="font-mono text-xs text-slate-600">{selectedNurse.id}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Nurse Dialog */}
      <Dialog open={showEditNurseDialog} onOpenChange={setShowEditNurseDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Staff Profile</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateNurse} className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={editNurseData.full_name}
                onChange={(e) => setEditNurseData({...editNurseData, full_name: e.target.value})}
                required
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={editNurseData.email}
                onChange={(e) => setEditNurseData({...editNurseData, email: e.target.value})}
                required
              />
            </div>
            <div>
              <Label>Title/Role</Label>
              <Input
                value={editNurseData.title}
                onChange={(e) => setEditNurseData({...editNurseData, title: e.target.value})}
                required
              />
            </div>
            <div>
              <Label>License Number</Label>
              <Input
                value={editNurseData.license_number}
                onChange={(e) => setEditNurseData({...editNurseData, license_number: e.target.value})}
              />
            </div>

            {/* Assignments Section - Embedded in Edit Dialog */}
            <div className="border-t pt-4 mt-6">
              <h3 className="font-semibold text-lg mb-4">Access Assignments</h3>
              
              {/* Organization Access */}
              <div className="mb-4">
                <Label className="text-base font-semibold mb-3 block">Organization Access</Label>
                <p className="text-sm text-slate-500 mb-3">
                  Grant access to all patients within selected organizations
                </p>
                <div className="space-y-2">
                  {['POSH Host Homes', 'Ebenezer Private HomeCare', 'Jericho'].map(org => (
                    <div key={org} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`edit-org-${org}`}
                        checked={assignmentData.assigned_organizations.includes(org)}
                        onChange={() => toggleOrganizationAssignment(org)}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <label htmlFor={`edit-org-${org}`} className="text-sm font-medium">
                        {org}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Individual Patient Access */}
              <div className="mb-4">
                <Label className="text-base font-semibold mb-3 block">Individual Patient Access</Label>
                <p className="text-sm text-slate-500 mb-3">
                  Or assign specific patients individually
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3">
                  {patients.map(patient => (
                    <div key={patient.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`edit-patient-${patient.id}`}
                        checked={assignmentData.assigned_patients.includes(patient.id)}
                        onChange={() => togglePatientAssignment(patient.id)}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <label htmlFor={`edit-patient-${patient.id}`} className="text-sm">
                        {patient.full_name} 
                        <span className="text-slate-500 ml-2">
                          ({patient.permanent_info?.organization || 'No org'})
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Access */}
              <div className="mb-4">
                <Label className="text-base font-semibold mb-3 block">Form Access</Label>
                <p className="text-sm text-slate-500 mb-3">
                  Control which forms this staff member can access
                </p>
                <div className="space-y-2">
                  {[
                    { id: 'nurse_visit', label: 'Nurse Visit' },
                    { id: 'vitals_only', label: 'Vital Signs' },
                    { id: 'daily_note', label: 'Daily Note' },
                    { id: 'intervention', label: 'Intervention' }
                  ].map(form => (
                    <div key={form.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`edit-form-${form.id}`}
                        checked={assignmentData.allowed_forms.includes(form.id)}
                        onChange={() => toggleFormAccess(form.id)}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <label htmlFor={`edit-form-${form.id}`} className="text-sm font-medium">
                        {form.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowEditNurseDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-500">
                Save All Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
