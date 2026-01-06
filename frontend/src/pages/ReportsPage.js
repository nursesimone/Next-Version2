import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { reportsAPI, patientsAPI } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import jsPDF from 'jspdf';
import { 
  Stethoscope, 
  ArrowLeft, 
  Download,
  Calendar,
  Users,
  Activity,
  FileText,
  ClipboardList,
  Building2,
  Filter,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

export default function ReportsPage() {
  const { nurse } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [patients, setPatients] = useState([]);
  
  // Filter state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedPatient, setSelectedPatient] = useState('all');
  const [selectedOrganization, setSelectedOrganization] = useState('all');
  const [selectedVisitType, setSelectedVisitType] = useState('daily_note');

  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push({ value: y.toString(), label: y.toString() });
  }

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      const response = await patientsAPI.list();
      setPatients(response.data);
    } catch (error) {
      console.error('Failed to load patients');
    }
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const requestData = {
        year: parseInt(selectedYear),
        month: parseInt(selectedMonth),
        visit_type: selectedVisitType, // Always include visit type
      };
      
      if (selectedPatient !== 'all') {
        requestData.patient_id = selectedPatient;
      }
      
      if (selectedOrganization !== 'all') {
        requestData.organization = selectedOrganization;
      }
      
      const response = await reportsAPI.getMonthly(requestData);
      setReportData(response.data);
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    if (!reportData) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;
    const margin = 20;
    const lineHeight = 7;

    // Get visit type label
    const getVisitTypeLabel = (type) => {
      switch (type) {
        case 'vitals_only': return 'Vital Signs';
        case 'daily_note': return 'Daily Notes';
        default: return type;
      }
    };

    // Determine report type based on filter
    const reportType = selectedVisitType !== 'all' ? getVisitTypeLabel(selectedVisitType) : 'POSH-Able Living';

    // ============ HEADER ============
    // Report Type as main heading
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 118, 110);
    doc.text(reportType, pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Patient Name (or "All Patients" if filtering all)
    doc.setFontSize(14);
    doc.setTextColor(60);
    const patientName = selectedPatient !== 'all' 
      ? patients.find(p => p.id === selectedPatient)?.full_name || 'All Patients'
      : 'All Patients';
    doc.text(patientName, pageWidth / 2, y, { align: 'center' });
    y += 8;

    // Report Period (Month Year)
    const monthName = months.find(m => m.value === selectedMonth)?.label;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    doc.text(`${monthName} ${selectedYear}`, pageWidth / 2, y, { align: 'center' });
    y += 8;

    // Divider line
    doc.setDrawColor(15, 118, 110);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Report date range (below divider)
    doc.setFontSize(10);
    doc.text(`Report Period: ${reportData.summary.start_date} to ${reportData.summary.end_date}`, pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Visit Details (no stats box, no organization section)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Visit Details', margin, y);
    y += lineHeight;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    // Table header
    doc.setFillColor(15, 118, 110);
    doc.setTextColor(255);
    doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
    doc.text('Date', margin + 2, y + 5.5);
    doc.text('Resident', margin + 30, y + 5.5);
    doc.text('Type', margin + 85, y + 5.5);
    doc.text('Organization', margin + 120, y + 5.5);
    doc.text('Status', margin + 160, y + 5.5);
    y += 8;
    doc.setTextColor(0);

    // Table rows
    for (const visit of reportData.visits) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      const visitDate = formatDate(visit.visit_date);
      const patientName = visit.patient_name?.substring(0, 18) || 'Unknown';
      const visitType = getVisitTypeLabel(visit.visit_type);
      const org = (visit.organization || '-').substring(0, 12);
      const status = visit.overall_health_status?.substring(0, 10) || '-';
      
      doc.text(visitDate, margin + 2, y + 5);
      doc.text(patientName, margin + 30, y + 5);
      doc.text(visitType, margin + 85, y + 5);
      doc.text(org, margin + 120, y + 5);
      doc.text(status, margin + 160, y + 5);
      
      doc.setDrawColor(200);
      doc.line(margin, y + 7, pageWidth - margin, y + 7);
      y += 8;
    }

    // Footer
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pages}`, pageWidth - margin - 20, doc.internal.pageSize.getHeight() - 10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, doc.internal.pageSize.getHeight() - 10);
    }

    // Save
    doc.save(`monthly_report_${selectedYear}_${selectedMonth.padStart(2, '0')}.pdf`);
    toast.success('Report downloaded successfully');
  };

  const getVisitTypeLabel = (type) => {
    switch (type) {
      case 'nurse_visit': return 'Nurse Visit';
      case 'vitals_only': return 'Vital Signs';
      case 'daily_note': return 'Daily Note';
      default: return type;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50" data-testid="reports-page">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  // Check if user is admin and go to appropriate page
                  if (nurse?.is_admin) {
                    navigate('/admin');
                  } else {
                    navigate('/visit-type');
                  }
                }}
                data-testid="back-btn"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-eggplant-700 rounded-xl flex items-center justify-center">
                  <Stethoscope className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-slate-900">Monthly Reports</h1>
                  <p className="text-sm text-slate-500">Generate and download visit reports</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Incident Report Link - Similar to Unable to Contact */}
        <Card className="bg-red-50 border-red-200 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Safety First</h3>
                  <p className="text-sm text-red-700">For all reportable incidents, Please fill out IMMEDIATELY</p>
                </div>
              </div>
              <Button 
                onClick={() => navigate('/incident-report')}
                className="bg-red-600 hover:bg-red-500"
              >
                <FileText className="w-4 h-4 mr-2" />
                Incident Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="bg-white border-slate-100 mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5 text-eggplant-700" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label>Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="mt-1" data-testid="year-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year.value} value={year.value}>{year.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Month</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="mt-1" data-testid="month-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Patient (Optional)</Label>
                <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                  <SelectTrigger className="mt-1" data-testid="patient-select">
                    <SelectValue placeholder="All patients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Patients</SelectItem>
                    {patients.map(patient => (
                      <SelectItem key={patient.id} value={patient.id}>{patient.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Organization (Optional)</Label>
                <Select value={selectedOrganization} onValueChange={setSelectedOrganization}>
                  <SelectTrigger className="mt-1" data-testid="org-filter-select">
                    <SelectValue placeholder="All organizations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    <SelectItem value="POSH Host Homes">POSH Host Homes</SelectItem>
                    <SelectItem value="Ebenezer Private HomeCare">Ebenezer Private HomeCare</SelectItem>
                    <SelectItem value="Jericho">Jericho</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Visit Type</Label>
                <Select value={selectedVisitType} onValueChange={setSelectedVisitType}>
                  <SelectTrigger className="mt-1" data-testid="visit-type-filter-select">
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily_note">Daily Notes</SelectItem>
                    <SelectItem value="vitals_only">Vital Signs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button 
                className="bg-eggplant-700 hover:bg-eggplant-600"
                onClick={fetchReport}
                disabled={loading}
                data-testid="generate-report-btn"
              >
                <Calendar className="w-4 h-4 mr-2" />
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
              
              {reportData && (
                <Button 
                  variant="outline"
                  onClick={generatePDF}
                  data-testid="download-report-btn"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Report Results */}
        {reportData && (
          <div className="space-y-6 animate-fade-in">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-white border-slate-100">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-eggplant-50 rounded-lg flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-eggplant-700" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{reportData.summary.total_visits}</p>
                      <p className="text-sm text-slate-500">Total Visits</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white border-slate-100">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{reportData.summary.unique_patients}</p>
                      <p className="text-sm text-slate-500">Patients</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white border-slate-100">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-navy-50 rounded-lg flex items-center justify-center">
                      <Stethoscope className="w-5 h-5 text-navy-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{reportData.summary.nurse_visits}</p>
                      <p className="text-sm text-slate-500">Nurse Visits</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white border-slate-100">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                      <Activity className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{reportData.summary.vitals_only}</p>
                      <p className="text-sm text-slate-500">Vitals Only</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Organization Breakdown */}
            {Object.keys(reportData.summary.by_organization).length > 0 && (
              <Card className="bg-white border-slate-100">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-eggplant-700" />
                    By Organization
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(reportData.summary.by_organization).map(([org, count]) => (
                      <div key={org} className="bg-slate-50 p-4 rounded-lg">
                        <p className="font-medium text-slate-900">{org}</p>
                        <p className="text-2xl font-bold text-eggplant-700">{count} visits</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Visit List */}
            <Card className="bg-white border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg">Visit Details</CardTitle>
                <CardDescription>
                  {reportData.summary.start_date} to {reportData.summary.end_date}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="all">
                  <TabsList className="mb-4">
                    <TabsTrigger value="all">All ({reportData.visits.length})</TabsTrigger>
                    <TabsTrigger value="nurse">Nurse Visits ({reportData.visits_by_type.nurse_visit.length})</TabsTrigger>
                    <TabsTrigger value="vitals">Vitals ({reportData.visits_by_type.vitals_only.length})</TabsTrigger>
                    <TabsTrigger value="daily">Daily Notes ({reportData.visits_by_type.daily_note.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="all">
                    <VisitTable visits={reportData.visits} getVisitTypeLabel={getVisitTypeLabel} />
                  </TabsContent>
                  <TabsContent value="nurse">
                    <VisitTable visits={reportData.visits_by_type.nurse_visit} getVisitTypeLabel={getVisitTypeLabel} />
                  </TabsContent>
                  <TabsContent value="vitals">
                    <VisitTable visits={reportData.visits_by_type.vitals_only} getVisitTypeLabel={getVisitTypeLabel} />
                  </TabsContent>
                  <TabsContent value="daily">
                    <VisitTable visits={reportData.visits_by_type.daily_note} getVisitTypeLabel={getVisitTypeLabel} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}

        {!reportData && !loading && (
          <div className="text-center py-16">
            <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">Generate a Report</h3>
            <p className="text-slate-500">Select a month and click "Generate Report" to view visit data</p>
          </div>
        )}
      </main>
    </div>
  );
}

function VisitTable({ visits, getVisitTypeLabel }) {
  const navigate = useNavigate();
  
  if (visits.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        No visits found for this category
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-4 font-medium text-slate-600">Date</th>
            <th className="text-left py-3 px-4 font-medium text-slate-600">Patient</th>
            <th className="text-left py-3 px-4 font-medium text-slate-600">Type</th>
            <th className="text-left py-3 px-4 font-medium text-slate-600">Organization</th>
            <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
          </tr>
        </thead>
        <tbody>
          {visits.map(visit => (
            <tr 
              key={visit.id} 
              className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
              onClick={() => navigate(`/visits/${visit.id}`)}
            >
              <td className="py-3 px-4 font-mono text-sm">{formatDate(visit.visit_date)}</td>
              <td className="py-3 px-4">{visit.patient_name}</td>
              <td className="py-3 px-4">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  visit.visit_type === 'nurse_visit' ? 'bg-eggplant-50 text-eggplant-700' :
                  visit.visit_type === 'vitals_only' ? 'bg-navy-50 text-blue-700' :
                  'bg-amber-50 text-amber-700'
                }`}>
                  {getVisitTypeLabel(visit.visit_type)}
                </span>
              </td>
              <td className="py-3 px-4 text-slate-600">{visit.organization || '-'}</td>
              <td className="py-3 px-4">
                {visit.overall_health_status ? (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    visit.overall_health_status === 'Stable' ? 'bg-emerald-50 text-emerald-700' :
                    visit.overall_health_status === 'Unstable' ? 'bg-amber-50 text-amber-700' :
                    'bg-rose-50 text-rose-700'
                  }`}>
                    {visit.overall_health_status}
                  </span>
                ) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
