import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { patientsAPI } from '../lib/api';
import axios from 'axios';
import jsPDF from 'jspdf';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../components/ui/command';
import { 
  ArrowLeft, 
  AlertTriangle,
  Save,
  FileText,
  Check,
  ChevronsUpDown,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function IncidentReportPage() {
  const navigate = useNavigate();
  const { nurse } = useAuth();
  const [patients, setPatients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [saving, setSaving] = useState(false);
  const [openResidentSelect, setOpenResidentSelect] = useState(false);
  const [openStaffSelect, setOpenStaffSelect] = useState(false);
  
  const [formData, setFormData] = useState({
    organization: '',
    incident_date: new Date().toISOString().split('T')[0],
    incident_time: '',
    involved_parties: {
      resident: false,
      staff: false,
      visitor: false,
      other: false,
      no_people: false
    },
    involved_residents: [],
    involved_staff: [],
    visitor_details: {
      name: '',
      visiting_whom: '',
      phone: ''
    },
    other_details: {
      name: '',
      reason: '',
      contact: ''
    },
    incident_type: '',
    location: '',
    description: '',
    severity: '3',
    officials_called: {
      none: false,
      police: false,
      fire: false,
      emt: false,
      gcal: false,
      other: false
    },
    official_report_filed: '',
    attachments: [],
    witnesses: '',
    others_notified: '',
    outcome: '',
    additional_info: '',
    reported_by: `${nurse?.full_name}, ${nurse?.title}`,
    reporter_cell: '',
    reporter_email: nurse?.email || ''
  });

  useEffect(() => {
    fetchData();
  }, [formData.organization]);

  const fetchData = async () => {
    try {
      // Fetch all patients
      const patientsRes = await patientsAPI.list();
      setPatients(patientsRes.data);

      // Fetch all staff
      const token = localStorage.getItem('nurse_token');
      const staffRes = await axios.get(`${API}/admin/nurses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStaff(staffRes.data);
    } catch (error) {
      console.error('Failed to load data');
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleInvolvedParty = (party) => {
    setFormData(prev => ({
      ...prev,
      involved_parties: {
        ...prev.involved_parties,
        [party]: !prev.involved_parties[party]
      }
    }));
  };

  const toggleOfficial = (official) => {
    setFormData(prev => ({
      ...prev,
      officials_called: {
        ...prev.officials_called,
        [official]: !prev.officials_called[official]
      }
    }));
  };

  const toggleResidentInvolved = (patientId) => {
    setFormData(prev => ({
      ...prev,
      involved_residents: prev.involved_residents.includes(patientId)
        ? prev.involved_residents.filter(id => id !== patientId)
        : [...prev.involved_residents, patientId]
    }));
  };

  const toggleStaffInvolved = (staffId) => {
    setFormData(prev => ({
      ...prev,
      involved_staff: prev.involved_staff.includes(staffId)
        ? prev.involved_staff.filter(id => id !== staffId)
        : [...prev.involved_staff, staffId]
    }));
  };

  const getFilteredPatients = () => {
    if (!formData.organization) return [];
    // More flexible matching - handles variations in organization names
    return patients.filter(p => {
      const patientOrg = p.permanent_info?.organization || '';
      const selectedOrg = formData.organization || '';
      // Exact match or contains match
      return patientOrg === selectedOrg || 
             patientOrg.toLowerCase().includes(selectedOrg.toLowerCase()) ||
             selectedOrg.toLowerCase().includes(patientOrg.toLowerCase());
    });
  };

  const getFilteredStaff = () => {
    if (!formData.organization) return [];
    // Show all admins plus staff assigned to this organization
    return staff.filter(s => {
      if (s.is_admin) return true;
      const assignedOrgs = s.assigned_organizations || [];
      const selectedOrg = formData.organization;
      // Check for exact match or partial match in assigned organizations
      return assignedOrgs.some(org => 
        org === selectedOrg || 
        org.toLowerCase().includes(selectedOrg.toLowerCase()) ||
        selectedOrg.toLowerCase().includes(org.toLowerCase())
      );
    });
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;
    const margin = 20;
    const lineHeight = 7;

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('INCIDENT REPORT', pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.text(formData.organization || 'N/A', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Date and Time
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Incident Date: ${formData.incident_date} at ${formData.incident_time}`, margin, y);
    y += lineHeight * 2;

    // Involved Parties
    doc.setFont('helvetica', 'bold');
    doc.text('Involved Parties:', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    
    const involved = [];
    if (formData.involved_parties.resident) involved.push('Resident/Patient');
    if (formData.involved_parties.employee) involved.push('Employee');
    if (formData.involved_parties.management) involved.push('Management');
    if (formData.involved_parties.visitor) involved.push('Visitor');
    if (formData.involved_parties.other) involved.push('Other');
    if (formData.involved_parties.no_people) involved.push('Did not involve people');
    
    doc.text(involved.join(', ') || 'None selected', margin + 5, y);
    y += lineHeight * 2;

    // Incident Type
    doc.setFont('helvetica', 'bold');
    doc.text('Type of Incident:', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.text(formData.incident_type || 'Not specified', margin + 5, y);
    y += lineHeight * 2;

    // Location
    doc.setFont('helvetica', 'bold');
    doc.text('Location:', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    const locationLines = doc.splitTextToSize(formData.location || 'Not specified', pageWidth - margin * 2 - 5);
    doc.text(locationLines, margin + 5, y);
    y += lineHeight * locationLines.length + lineHeight;

    // Description
    doc.setFont('helvetica', 'bold');
    doc.text('Description:', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(formData.description || 'Not provided', pageWidth - margin * 2 - 5);
    doc.text(descLines, margin + 5, y);
    y += lineHeight * descLines.length + lineHeight;

    // Severity
    doc.setFont('helvetica', 'bold');
    doc.text(`Severity: ${formData.severity}/5`, margin, y);
    y += lineHeight * 2;

    // Officials Called
    doc.setFont('helvetica', 'bold');
    doc.text('Officials Called:', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    const officials = [];
    if (formData.officials_called.police) officials.push('Police');
    if (formData.officials_called.fire) officials.push('Fire Department');
    if (formData.officials_called.emt) officials.push('EMT/Ambulance');
    if (formData.officials_called.gcal) officials.push('GCAL');
    if (formData.officials_called.other) officials.push('Other');
    doc.text(officials.length > 0 ? officials.join(', ') : 'None', margin + 5, y);
    y += lineHeight * 2;

    // Outcome
    if (formData.outcome) {
      doc.setFont('helvetica', 'bold');
      doc.text('Outcome:', margin, y);
      y += lineHeight;
      doc.setFont('helvetica', 'normal');
      const outcomeLines = doc.splitTextToSize(formData.outcome, pageWidth - margin * 2 - 5);
      doc.text(outcomeLines, margin + 5, y);
      y += lineHeight * outcomeLines.length + lineHeight;
    }

    // Reported By
    doc.setFont('helvetica', 'bold');
    doc.text('Reported By:', margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.text(formData.reported_by, margin + 5, y);
    y += lineHeight;
    if (formData.reporter_cell) {
      doc.text(`Cell: ${formData.reporter_cell}`, margin + 5, y);
      y += lineHeight;
    }
    if (formData.reporter_email) {
      doc.text(`Email: ${formData.reporter_email}`, margin + 5, y);
    }

    // Save PDF
    doc.save(`Incident_Report_${formData.incident_date}.pdf`);
    toast.success('Incident report downloaded');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = localStorage.getItem('nurse_token');
      await axios.post(`${API}/incident-reports`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Incident report saved successfully');
      generatePDF();
      
      // Reset form
      setFormData({
        organization: '',
        incident_date: new Date().toISOString().split('T')[0],
        incident_time: '',
        involved_parties: {
          resident: false,
          staff: false,
          visitor: false,
          other: false,
          no_people: false
        },
        involved_residents: [],
        involved_staff: [],
        visitor_details: {
          name: '',
          visiting_whom: '',
          phone: ''
        },
        other_details: {
          name: '',
          reason: '',
          contact: ''
        },
        incident_type: '',
        location: '',
        description: '',
        severity: '3',
        officials_called: {
          police: false,
          fire: false,
          emt: false,
          gcal: false,
          other: false
        },
        official_report_filed: '',
        attachments: [],
        witnesses: '',
        others_notified: '',
        outcome: '',
        additional_info: '',
        reported_by: `${nurse?.full_name}, ${nurse?.title}`,
        reporter_cell: '',
        reporter_email: nurse?.email || ''
      });
    } catch (error) {
      toast.error('Failed to save incident report');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/reports')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-slate-900">Safety First</h1>
                  <p className="text-xs text-red-600">For all reportable incidents, Please fill out IMMEDIATELY</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Incident Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Organization *</Label>
                <Select value={formData.organization} onValueChange={(value) => updateField('organization', value)} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POSH Host Homes">POSH Host Homes</SelectItem>
                    <SelectItem value="Ebenezer Private HomeCare">Ebenezer Private HomeCare</SelectItem>
                    <SelectItem value="Jericho">Jericho</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Date of Incident *</Label>
                  <Input
                    type="date"
                    value={formData.incident_date}
                    onChange={(e) => updateField('incident_date', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Time *</Label>
                  <Input
                    type="time"
                    value={formData.incident_time}
                    onChange={(e) => updateField('incident_time', e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Involved Parties */}
          <Card>
            <CardHeader>
              <CardTitle>Who did the incident involve? (Select all that apply)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="resident"
                    checked={formData.involved_parties.resident}
                    onCheckedChange={() => toggleInvolvedParty('resident')}
                  />
                  <Label htmlFor="resident" className="font-normal cursor-pointer">Resident/Patient</Label>
                </div>

                {formData.involved_parties.resident && (
                  <div className="ml-6 p-4 bg-slate-50 rounded border space-y-3">
                    <Label className="block">Select Resident(s):</Label>
                    {formData.organization ? (
                      <>
                        <Popover open={openResidentSelect} onOpenChange={setOpenResidentSelect}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openResidentSelect}
                              className="w-full justify-between h-auto min-h-[40px]"
                            >
                              <span className="text-left flex-1">
                                {formData.involved_residents.length > 0
                                  ? `${formData.involved_residents.length} resident(s) selected`
                                  : "Select residents..."}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search residents..." />
                              <CommandList>
                                <CommandEmpty>No resident found.</CommandEmpty>
                                <CommandGroup>
                                  {getFilteredPatients().map((patient) => (
                                    <CommandItem
                                      key={patient.id}
                                      value={patient.full_name}
                                      onSelect={() => {
                                        toggleResidentInvolved(patient.id);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          formData.involved_residents.includes(patient.id)
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      {patient.full_name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        
                        {/* Selected Residents as Badges */}
                        {formData.involved_residents.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {formData.involved_residents.map((residentId) => {
                              const resident = patients.find(p => p.id === residentId);
                              return resident ? (
                                <Badge key={residentId} variant="secondary" className="text-sm">
                                  {resident.full_name}
                                  <button
                                    type="button"
                                    onClick={() => toggleResidentInvolved(residentId)}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">Please select an organization first</p>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="staff"
                    checked={formData.involved_parties.staff}
                    onCheckedChange={() => toggleInvolvedParty('staff')}
                  />
                  <Label htmlFor="staff" className="font-normal cursor-pointer">Staff Member</Label>
                </div>

                {formData.involved_parties.staff && (
                  <div className="ml-6 p-4 bg-slate-50 rounded border space-y-3">
                    <Label className="block">Select Staff Member(s):</Label>
                    {formData.organization ? (
                      <>
                        <Popover open={openStaffSelect} onOpenChange={setOpenStaffSelect}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openStaffSelect}
                              className="w-full justify-between h-auto min-h-[40px]"
                            >
                              <span className="text-left flex-1">
                                {formData.involved_staff.length > 0
                                  ? `${formData.involved_staff.length} staff member(s) selected`
                                  : "Select staff members..."}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search staff..." />
                              <CommandList>
                                <CommandEmpty>No staff member found.</CommandEmpty>
                                <CommandGroup>
                                  {getFilteredStaff().map((staffMember) => (
                                    <CommandItem
                                      key={staffMember.id}
                                      value={`${staffMember.full_name} ${staffMember.title}`}
                                      onSelect={() => {
                                        toggleStaffInvolved(staffMember.id);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          formData.involved_staff.includes(staffMember.id)
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      {staffMember.full_name} ({staffMember.title})
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        
                        {/* Selected Staff as Badges */}
                        {formData.involved_staff.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {formData.involved_staff.map((staffId) => {
                              const staffMember = staff.find(s => s.id === staffId);
                              return staffMember ? (
                                <Badge key={staffId} variant="secondary" className="text-sm">
                                  {staffMember.full_name} ({staffMember.title})
                                  <button
                                    type="button"
                                    onClick={() => toggleStaffInvolved(staffId)}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">Please select an organization first</p>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="visitor"
                    checked={formData.involved_parties.visitor}
                    onCheckedChange={() => toggleInvolvedParty('visitor')}
                  />
                  <Label htmlFor="visitor" className="font-normal cursor-pointer">Visitor</Label>
                </div>

                {formData.involved_parties.visitor && (
                  <div className="ml-6 p-4 bg-slate-50 rounded border space-y-3">
                    <div>
                      <Label>Visitor Name *</Label>
                      <Input
                        value={formData.visitor_details.name}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          visitor_details: { ...prev.visitor_details, name: e.target.value }
                        }))}
                        placeholder="Full name of visitor"
                      />
                    </div>
                    <div>
                      <Label>Who were they visiting? *</Label>
                      <Input
                        value={formData.visitor_details.visiting_whom}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          visitor_details: { ...prev.visitor_details, visiting_whom: e.target.value }
                        }))}
                        placeholder="Name of person being visited"
                      />
                    </div>
                    <div>
                      <Label>Visitor Phone Number</Label>
                      <Input
                        type="tel"
                        value={formData.visitor_details.phone}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          visitor_details: { ...prev.visitor_details, phone: e.target.value }
                        }))}
                        placeholder="Contact phone number"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="other"
                    checked={formData.involved_parties.other}
                    onCheckedChange={() => toggleInvolvedParty('other')}
                  />
                  <Label htmlFor="other" className="font-normal cursor-pointer">Other</Label>
                </div>

                {formData.involved_parties.other && (
                  <div className="ml-6 p-4 bg-slate-50 rounded border space-y-3">
                    <div>
                      <Label>Name *</Label>
                      <Input
                        value={formData.other_details.name}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          other_details: { ...prev.other_details, name: e.target.value }
                        }))}
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <Label>Reason for being there *</Label>
                      <Input
                        value={formData.other_details.reason}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          other_details: { ...prev.other_details, reason: e.target.value }
                        }))}
                        placeholder="Why were they present?"
                      />
                    </div>
                    <div>
                      <Label>Contact Information</Label>
                      <Input
                        value={formData.other_details.contact}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          other_details: { ...prev.other_details, contact: e.target.value }
                        }))}
                        placeholder="Phone number or email"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="no_people"
                    checked={formData.involved_parties.no_people}
                    onCheckedChange={() => toggleInvolvedParty('no_people')}
                  />
                  <Label htmlFor="no_people" className="font-normal cursor-pointer">Did not involve people</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Incident Type */}
          <Card>
            <CardHeader>
              <CardTitle>Type of Incident *</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={formData.incident_type} onValueChange={(value) => updateField('incident_type', value)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select incident type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fall">Fall (includes slips, trips and falls)</SelectItem>
                  <SelectItem value="medication_error">Medication Error</SelectItem>
                  <SelectItem value="exposure">Exposure to chemicals/poisoning</SelectItem>
                  <SelectItem value="near_miss">Near Misses (could've/would've aka close calls)</SelectItem>
                  <SelectItem value="altercation">Altercation/Fight</SelectItem>
                  <SelectItem value="fire">Fire</SelectItem>
                  <SelectItem value="theft">Theft</SelectItem>
                  <SelectItem value="death">Death</SelectItem>
                  <SelectItem value="other">All other types of incidents</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Location & Description */}
          <Card>
            <CardHeader>
              <CardTitle>Incident Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Where did the incident occur? *</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => updateField('location', e.target.value)}
                  placeholder="Location of incident"
                  required
                />
              </div>

              <div>
                <Label>Description of Incident (details) *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Provide detailed description of what happened..."
                  className="min-h-[120px]"
                  required
                />
              </div>

              <div>
                <Label>Incident Severity (1 = Not Severe, 5 = Very Severe) *</Label>
                <div className="flex items-center gap-4 mt-2">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={formData.severity}
                    onChange={(e) => updateField('severity', e.target.value)}
                    className="flex-1"
                  />
                  <span className="font-bold text-lg w-8">{formData.severity}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Officials */}
          <Card>
            <CardHeader>
              <CardTitle>Officials & Reporting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="mb-2 block">Which officials, if any, were called out to the incident?</Label>
                <div className="space-y-2">
                  {[
                    { id: 'police', label: 'Police' },
                    { id: 'fire', label: 'Fire Department' },
                    { id: 'emt', label: 'EMT/Ambulance' },
                    { id: 'gcal', label: 'GCAL (Georgia Crisis and Access Line)' },
                    { id: 'other', label: 'Other' }
                  ].map(official => (
                    <div key={official.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`official-${official.id}`}
                        checked={formData.officials_called[official.id]}
                        onCheckedChange={() => toggleOfficial(official.id)}
                      />
                      <Label htmlFor={`official-${official.id}`} className="font-normal cursor-pointer">{official.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Was an incident report filed by/with the officials?</Label>
                <RadioGroup value={formData.official_report_filed} onValueChange={(value) => updateField('official_report_filed', value)}>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="yes" id="report-yes" />
                      <Label htmlFor="report-yes" className="font-normal cursor-pointer">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="no" id="report-no" />
                      <Label htmlFor="report-no" className="font-normal cursor-pointer">No</Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader>
              <CardTitle>Do you need to upload any pictures or documents?</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                onChange={(e) => updateField('attachments', Array.from(e.target.files))}
                className="cursor-pointer"
              />
              {formData.attachments.length > 0 && (
                <p className="text-sm text-slate-600 mt-2">{formData.attachments.length} file(s) selected</p>
              )}
            </CardContent>
          </Card>

          {/* Witnesses & Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Witnesses & Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Were there any other witnesses?</Label>
                <Textarea
                  value={formData.witnesses}
                  onChange={(e) => updateField('witnesses', e.target.value)}
                  placeholder="Provide names and contact details of witnesses..."
                  className="min-h-[80px]"
                />
              </div>

              <div>
                <Label>Was anyone else notified?</Label>
                <Textarea
                  value={formData.others_notified}
                  onChange={(e) => updateField('others_notified', e.target.value)}
                  placeholder="Name, title, contact info..."
                  className="min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Outcome */}
          <Card>
            <CardHeader>
              <CardTitle>Outcome & Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>What was the outcome of the incident?</Label>
                <Textarea
                  value={formData.outcome}
                  onChange={(e) => updateField('outcome', e.target.value)}
                  placeholder="I.e. hospitalization, arrest, removal, unresolved, etc"
                  className="min-h-[80px]"
                />
              </div>

              <div>
                <Label>Additional Information</Label>
                <Textarea
                  value={formData.additional_info}
                  onChange={(e) => updateField('additional_info', e.target.value)}
                  placeholder="Any other relevant information..."
                  className="min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Reported By */}
          <Card>
            <CardHeader>
              <CardTitle>Incident Reported By</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Name & Title</Label>
                <p className="font-medium mt-1">{formData.reported_by}</p>
              </div>
              
              <div>
                <Label>Contact Cell Phone</Label>
                <Input
                  type="tel"
                  value={formData.reporter_cell}
                  onChange={(e) => updateField('reporter_cell', e.target.value)}
                  placeholder="Contact phone number"
                />
              </div>

              <div>
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={formData.reporter_email}
                  onChange={(e) => updateField('reporter_email', e.target.value)}
                  placeholder="Contact email address"
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end">
            <Button 
              type="submit" 
              className="bg-red-600 hover:bg-red-500 h-12 px-8"
              disabled={saving}
            >
              <FileText className="w-5 h-5 mr-2" />
              {saving ? 'Submitting...' : 'Submit & Download PDF'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
