import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { visitsAPI, patientsAPI } from '../lib/api';
import { formatDate, formatDateTime, getHealthStatusColor } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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
import jsPDF from 'jspdf';
import { 
  Stethoscope, 
  ArrowLeft, 
  Activity,
  Heart,
  Eye,
  Brain,
  Wind,
  Droplet,
  FileText,
  Trash2,
  Download,
  User,
  AlertCircle,
  Thermometer
} from 'lucide-react';
import { toast } from 'sonner';

export default function VisitDetailPage() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const [visit, setVisit] = useState(null);
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    fetchVisitData();
  }, [visitId]);

  const fetchVisitData = async () => {
    try {
      const visitRes = await visitsAPI.get(visitId);
      setVisit(visitRes.data);
      
      const patientRes = await patientsAPI.get(visitRes.data.patient_id);
      setPatient(patientRes.data);
    } catch (error) {
      toast.error('Failed to load visit data');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVisit = async () => {
    try {
      await visitsAPI.delete(visitId);
      toast.success('Visit deleted successfully');
      navigate(`/patients/${visit.patient_id}`);
    } catch (error) {
      toast.error('Failed to delete visit');
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;
    const lineHeight = 7;
    const margin = 20;

    // Helper functions
    const addTitle = (text) => {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(text, margin, y);
      y += lineHeight + 2;
    };

    const addSectionTitle = (text) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 118, 110);
      doc.text(text, margin, y);
      doc.setTextColor(0);
      y += lineHeight;
    };

    const addField = (label, value) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}: `, margin, y);
      doc.setFont('helvetica', 'normal');
      const valueText = value || 'N/A';
      const splitText = doc.splitTextToSize(valueText, pageWidth - margin * 2 - 40);
      doc.text(splitText, margin + 40, y);
      y += lineHeight * Math.max(1, splitText.length);
    };

    // Get visit type label
    const getVisitTypeLabel = (type) => {
      switch (type) {
        case 'nurse_visit': return 'Nurse Visit';
        case 'vitals_only': return 'Vital Signs';
        case 'daily_note': return 'Daily Note';
        default: return 'Visit Report';
      }
    };

    // ============ HEADER FOR NURSE VISIT ============
    if (visit?.visit_type === 'nurse_visit') {
      // Line 1: Routine Nurse Visit
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 118, 110);
      doc.text('Routine Nurse Visit', pageWidth / 2, y, { align: 'center' });
      y += 10;

      // Line 2: Organization Name
      const organizationName = visit?.organization || 'POSH-Able Living';
      doc.setFontSize(16);
      doc.setTextColor(60);
      doc.text(organizationName, pageWidth / 2, y, { align: 'center' });
      y += 10;

      // Divider line
      doc.setDrawColor(15, 118, 110);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Patient Information Box
      doc.setFillColor(240, 253, 250);
      const boxHeight = 90;
      doc.rect(margin, y, pageWidth - margin * 2, boxHeight, 'F');
      doc.setDrawColor(15, 118, 110);
      doc.rect(margin, y, pageWidth - margin * 2, boxHeight, 'S');
      
      y += 6;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text('Patient Information', margin + 5, y);
      y += 7;

      // Patient details in the box
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      // Column 1
      let col1X = margin + 5;
      let col1Y = y;
      doc.setFont('helvetica', 'bold');
      doc.text('Name:', col1X, col1Y);
      doc.setFont('helvetica', 'normal');
      doc.text(patient?.full_name || 'N/A', col1X + 25, col1Y);
      col1Y += 6;
      
      doc.setFont('helvetica', 'bold');
      doc.text('DOB:', col1X, col1Y);
      doc.setFont('helvetica', 'normal');
      doc.text(formatDate(patient?.permanent_info?.date_of_birth) || 'N/A', col1X + 25, col1Y);
      col1Y += 6;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Gender:', col1X, col1Y);
      doc.setFont('helvetica', 'normal');
      doc.text(patient?.permanent_info?.gender || 'N/A', col1X + 25, col1Y);
      col1Y += 6;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Race:', col1X, col1Y);
      doc.setFont('helvetica', 'normal');
      doc.text(patient?.permanent_info?.race || 'N/A', col1X + 25, col1Y);
      col1Y += 6;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Address:', col1X, col1Y);
      doc.setFont('helvetica', 'normal');
      const address = patient?.permanent_info?.home_address || 'N/A';
      const addressLines = doc.splitTextToSize(address, 70);
      doc.text(addressLines, col1X + 25, col1Y);
      col1Y += 6 * addressLines.length;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Caregiver:', col1X, col1Y);
      doc.setFont('helvetica', 'normal');
      doc.text(patient?.permanent_info?.caregiver_name || 'N/A', col1X + 25, col1Y);

      // Column 2
      let col2X = pageWidth / 2 + 5;
      let col2Y = y;
      
      if (patient?.permanent_info?.attends_adult_day_program) {
        doc.setFont('helvetica', 'bold');
        doc.text('Day Program:', col2X, col2Y);
        doc.setFont('helvetica', 'normal');
        const programName = patient?.permanent_info?.adult_day_program_name || 'N/A';
        const programLines = doc.splitTextToSize(programName, 60);
        doc.text(programLines, col2X + 30, col2Y);
        col2Y += 6 * programLines.length;
        
        if (patient?.permanent_info?.adult_day_program_address) {
          const programAddr = doc.splitTextToSize(patient.permanent_info.adult_day_program_address, 60);
          doc.text(programAddr, col2X + 30, col2Y);
          col2Y += 6 * programAddr.length;
        }
      }
      
      col2Y += 2;
      doc.setFont('helvetica', 'bold');
      doc.text('Allergies:', col2X, col2Y);
      doc.setFont('helvetica', 'normal');
      const allergies = patient?.permanent_info?.allergies?.join(', ') || 'None';
      const allergyLines = doc.splitTextToSize(allergies, 60);
      doc.text(allergyLines, col2X + 30, col2Y);
      col2Y += 6 * allergyLines.length;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Medical Dx:', col2X, col2Y);
      doc.setFont('helvetica', 'normal');
      const medDx = patient?.permanent_info?.medical_diagnoses?.join(', ') || 'None';
      const medDxLines = doc.splitTextToSize(medDx, 60);
      doc.text(medDxLines, col2X + 30, col2Y);
      col2Y += 6 * medDxLines.length;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Psych Dx:', col2X, col2Y);
      doc.setFont('helvetica', 'normal');
      const psychDx = patient?.permanent_info?.psychiatric_diagnoses?.join(', ') || 'None';
      const psychDxLines = doc.splitTextToSize(psychDx, 60);
      doc.text(psychDxLines, col2X + 30, col2Y);
      col2Y += 6 * psychDxLines.length;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Medications:', col2X, col2Y);
      doc.setFont('helvetica', 'normal');
      const meds = patient?.permanent_info?.medications?.join(', ') || 'None';
      const medLines = doc.splitTextToSize(meds, 60);
      doc.text(medLines, col2X + 30, col2Y);

      y += boxHeight + 10;

      // Visit Service Information Section
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Type of Service:', margin, y);
      doc.setFont('helvetica', 'normal');
      let serviceType = 'N/A';
      if (visit?.nurse_visit_type) {
        serviceType = visit.nurse_visit_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        if (visit.nurse_visit_type === 'other' && visit.nurse_visit_type_other) {
          serviceType += ` (${visit.nurse_visit_type_other})`;
        }
      }
      doc.text(serviceType, margin + 40, y);
      y += lineHeight;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Visit Frequency:', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(patient?.permanent_info?.visit_frequency || 'N/A', margin + 40, y);
      y += lineHeight;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Patient Seen At:', margin, y);
      doc.setFont('helvetica', 'normal');
      let location = 'N/A';
      if (visit?.visit_location) {
        location = visit.visit_location.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        if (visit.visit_location === 'other' && visit.visit_location_other) {
          location += ` (${visit.visit_location_other})`;
        }
      }
      doc.text(location, margin + 40, y);
      y += lineHeight * 2;

      // Visit Date
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      doc.text(`Visit Date: ${formatDateTime(visit?.visit_date)}`, margin, y);
      y += lineHeight * 2;
    } else {
      // ============ HEADER FOR OTHER VISIT TYPES ============
      // Business/Organization Name as main heading
      const businessName = visit?.organization || 'POSH-Able Living';
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 118, 110);
      doc.text(businessName, pageWidth / 2, y, { align: 'center' });
      y += 12;

      // Report Type
      const reportType = getVisitTypeLabel(visit?.visit_type);
      doc.setFontSize(14);
      doc.setTextColor(60);
      doc.text(reportType, pageWidth / 2, y, { align: 'center' });
      y += 8;

      // Resident Name
      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.text(`Resident: ${patient?.full_name}`, pageWidth / 2, y, { align: 'center' });
      y += 6;

      // Divider line
      doc.setDrawColor(15, 118, 110);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Visit Date
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      doc.text(`Visit Date: ${formatDateTime(visit?.visit_date)}`, margin, y);
      y += lineHeight * 2;
    }

    // Vital Signs
    addSectionTitle('Vital Signs');
    addField('Weight', visit?.vital_signs?.weight ? `${visit.vital_signs.weight} lbs` : null);
    addField('Temperature', visit?.vital_signs?.body_temperature ? `${visit.vital_signs.body_temperature}°F` : null);
    addField('Blood Pressure', visit?.vital_signs?.blood_pressure_systolic ? 
      `${visit.vital_signs.blood_pressure_systolic}/${visit.vital_signs.blood_pressure_diastolic} mmHg` : null);
    if (visit?.vital_signs?.repeat_blood_pressure_systolic) {
      addField('Repeat BP', `${visit.vital_signs.repeat_blood_pressure_systolic}/${visit.vital_signs.repeat_blood_pressure_diastolic} mmHg`);
    }
    addField('SpO2', visit?.vital_signs?.pulse_oximeter ? `${visit.vital_signs.pulse_oximeter}%` : null);
    addField('Pulse', visit?.vital_signs?.pulse ? `${visit.vital_signs.pulse} bpm` : null);
    addField('Respirations', visit?.vital_signs?.respirations ? `${visit.vital_signs.respirations}/min` : null);
    y += 5;

    // Physical Assessment
    addSectionTitle('Physical Assessment');
    addField('General Appearance', visit?.physical_assessment?.general_appearance);
    addField('Skin Assessment', visit?.physical_assessment?.skin_assessment);
    addField('Mobility Level', visit?.physical_assessment?.mobility_level);
    addField('Speech Level', visit?.physical_assessment?.speech_level);
    addField('Alert & Oriented', visit?.physical_assessment?.alert_oriented_level);
    y += 5;

    // Head to Toe
    addSectionTitle('Head to Toe Assessment');
    addField('Head & Neck', visit?.head_to_toe?.head_neck);
    addField('Eyes/Vision', visit?.head_to_toe?.eyes_vision);
    addField('Ears/Hearing', visit?.head_to_toe?.ears_hearing);
    addField('Nose/Nasal', visit?.head_to_toe?.nose_nasal_cavity);
    addField('Mouth/Oral', visit?.head_to_toe?.mouth_teeth_oral_cavity);
    y += 5;

    // GI Assessment
    addSectionTitle('Gastrointestinal Assessment');
    addField('Last Bowel Movement', formatDate(visit?.gastrointestinal?.last_bowel_movement));
    addField('Bowel Sounds', visit?.gastrointestinal?.bowel_sounds);
    addField('Diet Type', visit?.gastrointestinal?.nutritional_diet);
    y += 5;

    // GU Assessment
    addSectionTitle('Genito-Urinary Assessment');
    addField('Toileting Level', visit?.genito_urinary?.toileting_level);
    y += 5;

    // Respiratory
    addSectionTitle('Respiratory Assessment');
    addField('Lung Sounds', visit?.respiratory?.lung_sounds);
    addField('Oxygen Type', visit?.respiratory?.oxygen_type);
    y += 5;

    // Endocrine
    if (visit?.endocrine?.is_diabetic) {
      addSectionTitle('Endocrine Assessment');
      addField('Diabetic', 'Yes');
      addField('Blood Sugar', visit?.endocrine?.blood_sugar ? `${visit.endocrine.blood_sugar} mg/dL` : null);
      addField('Notes', visit?.endocrine?.diabetic_notes);
      y += 5;
    }

    // Changes
    addSectionTitle('Changes Since Last Visit');
    addField('Medication Changes', visit?.changes_since_last?.medication_changes);
    addField('Diagnosis Changes', visit?.changes_since_last?.diagnosis_changes);
    addField('ER/Urgent Care', visit?.changes_since_last?.er_urgent_care_visits);
    addField('Upcoming Appointments', visit?.changes_since_last?.upcoming_appointments);
    y += 5;

    // Nurse Notes
    if (visit?.nurse_notes) {
      addSectionTitle('Nurse Notes');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const notesText = doc.splitTextToSize(visit.nurse_notes, pageWidth - margin * 2);
      doc.text(notesText, margin, y);
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
    doc.save(`visit_${patient?.full_name?.replace(/\s+/g, '_')}_${formatDate(visit?.visit_date)}.pdf`);
    toast.success('PDF downloaded successfully');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading visit data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="visit-detail-page">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 no-print">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate(`/patients/${visit.patient_id}`)}
                data-testid="back-btn"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-eggplant-700 rounded-xl flex items-center justify-center">
                  <Stethoscope className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-slate-900">Visit Details</h1>
                  <p className="text-sm text-slate-500">{patient?.full_name}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline"
                onClick={generatePDF}
                data-testid="download-pdf-btn"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button 
                variant="outline" 
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
                onClick={() => setShowDeleteDialog(true)}
                data-testid="delete-visit-btn"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Visit Summary */}
        <Card className="bg-white border-slate-100 mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-eggplant-700" />
                Visit Summary
              </CardTitle>
              <div className="flex items-center gap-2">
                {visit.visit_type && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    visit.visit_type === 'nurse_visit' ? 'bg-eggplant-50 text-eggplant-700' :
                    visit.visit_type === 'vitals_only' ? 'bg-navy-50 text-blue-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    {visit.visit_type === 'nurse_visit' ? 'Nurse Visit' :
                     visit.visit_type === 'vitals_only' ? 'Vitals Only' : 'Daily Note'}
                  </span>
                )}
                {visit.overall_health_status && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getHealthStatusColor(visit.overall_health_status)}`}>
                    {visit.overall_health_status}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-slate-600">
              <p>
                Visit Date: <span className="font-medium text-slate-900">{formatDateTime(visit.visit_date)}</span>
              </p>
              {visit.organization && (
                <p>
                  Organization: <span className="font-medium text-slate-900">{visit.organization}</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Patient Demographics Header - For nurse visits */}
        {visit.visit_type === 'nurse_visit' && patient && (
          <Card className="bg-gradient-to-br from-eggplant-50 to-white border-eggplant-100 mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-eggplant-900">
                <User className="w-5 h-5" />
                Patient Demographics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {/* Name */}
                <div>
                  <p className="text-slate-500 font-medium">Name</p>
                  <p className="text-slate-900 font-semibold">{patient.full_name}</p>
                </div>
                
                {/* DOB & Age */}
                {patient.permanent_info?.date_of_birth && (
                  <div>
                    <p className="text-slate-500 font-medium">Date of Birth</p>
                    <p className="text-slate-900">{formatDate(patient.permanent_info.date_of_birth)} 
                      <span className="text-slate-500 ml-2">({Math.floor((new Date() - new Date(patient.permanent_info.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000))} years old)</span>
                    </p>
                  </div>
                )}
                
                {/* Race */}
                {patient.permanent_info?.race && (
                  <div>
                    <p className="text-slate-500 font-medium">Race</p>
                    <p className="text-slate-900">{patient.permanent_info.race}</p>
                  </div>
                )}
                
                {/* Gender */}
                {patient.permanent_info?.gender && (
                  <div>
                    <p className="text-slate-500 font-medium">Gender</p>
                    <p className="text-slate-900">{patient.permanent_info.gender}</p>
                  </div>
                )}
                
                {/* Home Address */}
                {patient.permanent_info?.home_address && (
                  <div className="md:col-span-2">
                    <p className="text-slate-500 font-medium">Home Address</p>
                    <p className="text-slate-900">{patient.permanent_info.home_address}</p>
                  </div>
                )}
                
                {/* Allergies */}
                {patient.permanent_info?.allergies && patient.permanent_info.allergies.length > 0 && (
                  <div className="md:col-span-2">
                    <p className="text-slate-500 font-medium">Allergies</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {patient.permanent_info.allergies.map((allergy, idx) => (
                        <span key={idx} className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-medium">
                          {allergy}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Medical Diagnoses */}
                {patient.permanent_info?.medical_diagnoses && patient.permanent_info.medical_diagnoses.length > 0 && (
                  <div className="md:col-span-2">
                    <p className="text-slate-500 font-medium">Medical Diagnoses</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {patient.permanent_info.medical_diagnoses.map((diagnosis, idx) => (
                        <span key={idx} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                          {diagnosis}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Medications */}
                {patient.permanent_info?.medications && patient.permanent_info.medications.length > 0 && (
                  <div className="md:col-span-2">
                    <p className="text-slate-500 font-medium">Medications</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {patient.permanent_info.medications.map((med, idx) => (
                        <span key={idx} className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                          {med}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Visit Service Information */}
              <div className="mt-6 pt-6 border-t border-eggplant-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  {/* Type of Service */}
                  {visit.nurse_visit_type && (
                    <div>
                      <p className="text-slate-500 font-medium">Type of Service</p>
                      <p className="text-slate-900 capitalize">{visit.nurse_visit_type.replace(/_/g, ' ')}</p>
                      {visit.nurse_visit_type === 'other' && visit.nurse_visit_type_other && (
                        <p className="text-slate-600 text-xs mt-1">({visit.nurse_visit_type_other})</p>
                      )}
                    </div>
                  )}
                  
                  {/* How often is patient seen */}
                  {patient.permanent_info?.visit_frequency && (
                    <div>
                      <p className="text-slate-500 font-medium">Visit Frequency</p>
                      <p className="text-slate-900">{patient.permanent_info.visit_frequency}</p>
                    </div>
                  )}
                  
                  {/* Where patient was seen today */}
                  {visit.visit_location && (
                    <div>
                      <p className="text-slate-500 font-medium">Patient Seen At</p>
                      <p className="text-slate-900 capitalize">{visit.visit_location.replace(/_/g, ' ')}</p>
                      {visit.visit_location === 'other' && visit.visit_location_other && (
                        <p className="text-slate-600 text-xs mt-1">({visit.visit_location_other})</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Note Content - for daily_note type */}
        {visit.visit_type === 'daily_note' && visit.daily_note_content && (
          <Card className="bg-white border-slate-100 mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                Daily Note
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-900 whitespace-pre-wrap">{visit.daily_note_content}</p>
            </CardContent>
          </Card>
        )}

        {/* Vital Signs - Show for all visit types except daily_note without vitals */}
        {visit.visit_type !== 'daily_note' && (
        <Card className="bg-white border-slate-100 mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" />
              Vital Signs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-sm text-slate-500">Weight</p>
                <p className="text-xl font-bold text-slate-900 font-mono">
                  {visit.vital_signs?.weight || 'N/A'} {visit.vital_signs?.weight && 'lbs'}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-sm text-slate-500">Temperature</p>
                <p className="text-xl font-bold text-slate-900 font-mono">
                  {visit.vital_signs?.body_temperature || 'N/A'} {visit.vital_signs?.body_temperature && '°F'}
                </p>
              </div>
              <div className={`p-4 rounded-xl ${visit.vital_signs?.bp_abnormal ? 'bg-rose-50' : 'bg-slate-50'}`}>
                <p className="text-sm text-slate-500">Blood Pressure</p>
                <p className="text-xl font-bold text-slate-900 font-mono">
                  {visit.vital_signs?.blood_pressure_systolic 
                    ? `${visit.vital_signs.blood_pressure_systolic}/${visit.vital_signs.blood_pressure_diastolic}` 
                    : 'N/A'}
                </p>
              </div>
              {visit.vital_signs?.repeat_blood_pressure_systolic && (
                <div className="bg-amber-50 p-4 rounded-xl">
                  <p className="text-sm text-slate-500">Repeat BP</p>
                  <p className="text-xl font-bold text-slate-900 font-mono">
                    {visit.vital_signs.repeat_blood_pressure_systolic}/{visit.vital_signs.repeat_blood_pressure_diastolic}
                  </p>
                </div>
              )}
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-sm text-slate-500">SpO2</p>
                <p className="text-xl font-bold text-slate-900 font-mono">
                  {visit.vital_signs?.pulse_oximeter || 'N/A'}{visit.vital_signs?.pulse_oximeter && '%'}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-sm text-slate-500">Pulse</p>
                <p className="text-xl font-bold text-slate-900 font-mono">
                  {visit.vital_signs?.pulse || 'N/A'} {visit.vital_signs?.pulse && 'bpm'}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-sm text-slate-500">Respirations</p>
                <p className="text-xl font-bold text-slate-900 font-mono">
                  {visit.vital_signs?.respirations || 'N/A'}{visit.vital_signs?.respirations && '/min'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Physical Assessment - Only for nurse_visit */}
        {visit.visit_type === 'nurse_visit' && (
        <Card className="bg-white border-slate-100 mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-eggplant-700" />
              Physical Assessment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-slate-500">Mobility Level</p>
                <p className="font-medium text-slate-900">{visit.physical_assessment?.mobility_level || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Speech Level</p>
                <p className="font-medium text-slate-900">{visit.physical_assessment?.speech_level || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Alert & Oriented</p>
                <p className="font-medium text-slate-900">{visit.physical_assessment?.alert_oriented_level || 'N/A'}</p>
              </div>
            </div>
            {visit.physical_assessment?.general_appearance && (
              <div>
                <p className="text-sm text-slate-500">General Appearance</p>
                <p className="text-slate-900">{visit.physical_assessment.general_appearance}</p>
              </div>
            )}
            {visit.physical_assessment?.skin_assessment && (
              <div>
                <p className="text-sm text-slate-500">Skin Assessment</p>
                <p className="text-slate-900">{visit.physical_assessment.skin_assessment}</p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Head to Toe - Only for nurse_visit */}
        {visit.visit_type === 'nurse_visit' && (
        <Card className="bg-white border-slate-100 mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="w-5 h-5 text-eggplant-700" />
              Head to Toe Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visit.head_to_toe?.head_neck && (
                <div>
                  <p className="text-sm text-slate-500">Head & Neck</p>
                  <p className="text-slate-900">{visit.head_to_toe.head_neck}</p>
                </div>
              )}
              {visit.head_to_toe?.eyes_vision && (
                <div>
                  <p className="text-sm text-slate-500">Eyes / Vision</p>
                  <p className="text-slate-900">{visit.head_to_toe.eyes_vision}</p>
                </div>
              )}
              {visit.head_to_toe?.ears_hearing && (
                <div>
                  <p className="text-sm text-slate-500">Ears / Hearing</p>
                  <p className="text-slate-900">{visit.head_to_toe.ears_hearing}</p>
                </div>
              )}
              {visit.head_to_toe?.nose_nasal_cavity && (
                <div>
                  <p className="text-sm text-slate-500">Nose / Nasal Cavity</p>
                  <p className="text-slate-900">{visit.head_to_toe.nose_nasal_cavity}</p>
                </div>
              )}
              {visit.head_to_toe?.mouth_teeth_oral_cavity && (
                <div>
                  <p className="text-sm text-slate-500">Mouth / Oral Cavity</p>
                  <p className="text-slate-900">{visit.head_to_toe.mouth_teeth_oral_cavity}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* System Assessments - Only for nurse_visit */}
        {visit.visit_type === 'nurse_visit' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* GI */}
          <Card className="bg-white border-slate-100">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Droplet className="w-4 h-4 text-amber-600" />
                Gastrointestinal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm text-slate-500">Last Bowel Movement</p>
                <p className="font-medium">{formatDate(visit.gastrointestinal?.last_bowel_movement) || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Bowel Sounds</p>
                <p className="font-medium">{visit.gastrointestinal?.bowel_sounds || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Diet</p>
                <p className="font-medium">{visit.gastrointestinal?.nutritional_diet || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Respiratory */}
          <Card className="bg-white border-slate-100">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wind className="w-4 h-4 text-cyan-600" />
                Respiratory
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm text-slate-500">Lung Sounds</p>
                <p className="font-medium">{visit.respiratory?.lung_sounds || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Oxygen Type</p>
                <p className="font-medium">{visit.respiratory?.oxygen_type || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          {/* GU */}
          <Card className="bg-white border-slate-100">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Droplet className="w-4 h-4 text-navy-600" />
                Genito-Urinary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <p className="text-sm text-slate-500">Toileting Level</p>
                <p className="font-medium">{visit.genito_urinary?.toileting_level || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Endocrine */}
          {visit.endocrine?.is_diabetic && (
            <Card className="bg-white border-slate-100">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-purple-600" />
                  Endocrine (Diabetic)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-sm text-slate-500">Blood Sugar</p>
                  <p className="font-medium">{visit.endocrine?.blood_sugar ? `${visit.endocrine.blood_sugar} mg/dL` : 'N/A'}</p>
                </div>
                {visit.endocrine?.diabetic_notes && (
                  <div>
                    <p className="text-sm text-slate-500">Notes</p>
                    <p className="text-slate-900">{visit.endocrine.diabetic_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        )}

        {/* Changes Since Last - Only for nurse_visit */}
        {visit.visit_type === 'nurse_visit' && (
        <Card className="bg-white border-slate-100 mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              Changes Since Last Visit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {visit.changes_since_last?.medication_changes && (
              <div>
                <p className="text-sm text-slate-500">Medication Changes</p>
                <p className="text-slate-900">{visit.changes_since_last.medication_changes}</p>
              </div>
            )}
            {visit.changes_since_last?.diagnosis_changes && (
              <div>
                <p className="text-sm text-slate-500">Diagnosis Changes</p>
                <p className="text-slate-900">{visit.changes_since_last.diagnosis_changes}</p>
              </div>
            )}
            {visit.changes_since_last?.er_urgent_care_visits && (
              <div>
                <p className="text-sm text-slate-500">ER / Urgent Care Visits</p>
                <p className="text-slate-900">{visit.changes_since_last.er_urgent_care_visits}</p>
              </div>
            )}
            {visit.changes_since_last?.upcoming_appointments && (
              <div>
                <p className="text-sm text-slate-500">Upcoming Appointments</p>
                <p className="text-slate-900">{visit.changes_since_last.upcoming_appointments}</p>
              </div>
            )}
            {!visit.changes_since_last?.medication_changes && 
             !visit.changes_since_last?.diagnosis_changes && 
             !visit.changes_since_last?.er_urgent_care_visits && 
             !visit.changes_since_last?.upcoming_appointments && (
              <p className="text-slate-500 text-center py-4">No changes recorded</p>
            )}
          </CardContent>
        </Card>
        )}

        {/* Nurse Notes - Only for nurse_visit */}
        {visit.visit_type === 'nurse_visit' && visit.nurse_notes && (
          <Card className="bg-white border-slate-100">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-eggplant-700" />
                Nurse Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-900 whitespace-pre-wrap">{visit.nurse_notes}</p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Visit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this visit record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteVisit}
              className="bg-rose-600 hover:bg-rose-700"
              data-testid="confirm-delete-visit-btn"
            >
              Delete Visit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
