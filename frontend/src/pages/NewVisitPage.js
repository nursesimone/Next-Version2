import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { patientsAPI, visitsAPI } from '../lib/api';
import { isBloodPressureAbnormal } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { Badge } from '../components/ui/badge';
import { 
  Stethoscope, 
  ArrowLeft, 
  Activity,
  Heart,
  Eye,
  Brain,
  Wind,
  Droplet,
  AlertCircle,
  Save,
  User,
  Building2,
  FileText,
  ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';

const initialVisitData = {
  visit_date: new Date().toISOString().split('T')[0],
  visit_type: 'nurse_visit',
  organization: '',
  vital_signs: {
    height: '',
    weight: '',
    body_temperature: '',
    blood_pressure_systolic: '',
    blood_pressure_diastolic: '',
    pulse_oximeter: '',
    pulse: '',
    respirations: '',
    repeat_blood_pressure_systolic: '',
    repeat_blood_pressure_diastolic: '',
    bp_abnormal: false
  },
  physical_assessment: {
    general_appearance: '',
    general_appearance_from_last: false,
    skin_assessment: '',
    skin_assessment_from_last: false,
    mobility_level: '',
    mobility_level_from_last: false,
    speech_level: '',
    speech_level_from_last: false,
    alert_oriented_level: '',
    alert_oriented_level_from_last: false,
    gait_status: '',
    fall_incidence_since_last_visit: ''
  },
  head_to_toe: {
    head_neck: '',
    head_neck_from_last: false,
    eyes_vision: '',
    eyes_vision_from_last: false,
    ears_hearing: '',
    ears_hearing_from_last: false,
    nose_nasal_cavity: '',
    nose_nasal_cavity_from_last: false,
    mouth_teeth_oral_cavity: '',
    mouth_teeth_oral_cavity_from_last: false
  },
  gastrointestinal: {
    last_bowel_movement: '',
    bowel_sounds: '',
    nutritional_diet: ''
  },
  genito_urinary: {
    toileting_level: ''
  },
  respiratory: {
    lung_sounds: '',
    oxygen_type: ''
  },
  endocrine: {
    is_diabetic: false,
    diabetic_notes: '',
    blood_sugar: '',
    blood_sugar_date: '',
    blood_sugar_time_of_day: ''
  },
  changes_since_last: {
    medication_changes: '',
    diagnosis_changes: '',
    er_urgent_care_visits: '',
    upcoming_appointments: ''
  },
  home_visit_logbook: {
    locked_meds_checked: false,
    mar_reviewed: false,
    bm_log_checked: false,
    communication_log_checked: false,
    seizure_log_checked: false,
    notes: ''
  },
  overall_health_status: '',
  nurse_notes: '',
  medication_compliance: '',
  concerns_actions: {
    no_concerns: false,
    no_corrective_actions: false
  },
  miscellaneous_info: {
    satisfied: false,
    clean_tidy: false,
    safety_practices: false,
    follows_plan: false
  },
  additional_notes: '',
  attachments: [],
  daily_note_content: '',
  status: 'completed',
  screening_completed_by: '',
  reviewed_and_signed_by: ''
};

export default function NewVisitPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { nurse } = useAuth();
  const [patient, setPatient] = useState(null);
  const [visitData, setVisitData] = useState(initialVisitData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bpAbnormal, setBpAbnormal] = useState(false);
  const [lastVisit, setLastVisit] = useState(null);

  // Get visit type from session storage
  const visitType = sessionStorage.getItem('visitType') || 'nurse_visit';

  // Redirect to InterventionPage if patient_intervention type is selected
  useEffect(() => {
    if (visitType === 'patient_intervention') {
      navigate(`/patients/${patientId}/intervention`, { replace: true });
    }
  }, [visitType, patientId, navigate]);

  // Auto-fill screening completed by
  useEffect(() => {
    if (nurse && !visitData.screening_completed_by) {
      const screeningBy = `${nurse.full_name}, ${nurse.title}`;
      setVisitData(prev => ({ ...prev, screening_completed_by: screeningBy }));
    }
  }, [nurse]);

  useEffect(() => {
    fetchPatient();
  }, [patientId]);

  useEffect(() => {
    const { blood_pressure_systolic, blood_pressure_diastolic } = visitData.vital_signs;
    const abnormal = isBloodPressureAbnormal(blood_pressure_systolic, blood_pressure_diastolic);
    setBpAbnormal(abnormal);
    if (abnormal && !visitData.vital_signs.bp_abnormal) {
      updateVitalSign('bp_abnormal', true);
    }
  }, [visitData.vital_signs.blood_pressure_systolic, visitData.vital_signs.blood_pressure_diastolic]);

  const fetchPatient = async () => {
    try {
      const response = await patientsAPI.get(patientId);
      setPatient(response.data);
      
      // Set visit type from session and organization from patient profile
      const patientOrg = response.data.permanent_info?.organization || '';
      setVisitData(prev => ({
        ...prev,
        visit_type: visitType,
        organization: patientOrg
      }));
      
      // Load last visit for "pull from last" functionality
      try {
        const lastVisitResponse = await visitsAPI.getLast(patientId);
        setLastVisit(lastVisitResponse.data);
      } catch (err) {
        // No previous visit - that's okay
        console.log('No previous visits found');
      }
      
      // Pre-fill height from last vitals (height should persist)
      if (response.data.last_vitals?.height) {
        setVisitData(prev => ({
          ...prev,
          vital_signs: {
            ...prev.vital_signs,
            height: response.data.last_vitals.height
          }
        }));
      }
    } catch (error) {
      toast.error('Failed to load patient');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const updateVitalSign = (field, value) => {
    setVisitData(prev => ({
      ...prev,
      vital_signs: { ...prev.vital_signs, [field]: value }
    }));
  };

  const updatePhysicalAssessment = (field, value) => {
    setVisitData(prev => ({
      ...prev,
      physical_assessment: { ...prev.physical_assessment, [field]: value }
    }));
  };

  const updateHeadToToe = (field, value) => {
    setVisitData(prev => ({
      ...prev,
      head_to_toe: { ...prev.head_to_toe, [field]: value }
    }));
  };

  const updateGI = (field, value) => {
    setVisitData(prev => ({
      ...prev,
      gastrointestinal: { ...prev.gastrointestinal, [field]: value }
    }));
  };

  const updateGU = (field, value) => {
    setVisitData(prev => ({
      ...prev,
      genito_urinary: { ...prev.genito_urinary, [field]: value }
    }));
  };

  const updateRespiratory = (field, value) => {
    setVisitData(prev => ({
      ...prev,
      respiratory: { ...prev.respiratory, [field]: value }
    }));
  };

  const updateEndocrine = (field, value) => {
    setVisitData(prev => ({
      ...prev,
      endocrine: { ...prev.endocrine, [field]: value }
    }));
  };

  const updateChanges = (field, value) => {
    setVisitData(prev => ({
      ...prev,
      changes_since_last: { ...prev.changes_since_last, [field]: value }
    }));
  };

  const updateHomeLogbook = (field, value) => {
    setVisitData(prev => ({
      ...prev,
      home_visit_logbook: { ...prev.home_visit_logbook, [field]: value }
    }));
  };

  const pullFromLast = (section, field) => {
    if (!lastVisit) {
      toast.error('No previous visit found');
      return;
    }
    
    const lastValue = lastVisit[section]?.[field];
    if (lastValue) {
      setVisitData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: lastValue,
          [`${field}_from_last`]: true
        }
      }));
      toast.success(`Pulled "${field.replace(/_/g, ' ')}" from last visit`);
    } else {
      toast.error('No previous data found for this field');
    }
  };

  const handleSubmit = async (e, saveAs = 'completed') => {
    e.preventDefault();
    setSaving(true);
    
    try {
      let submitData = { ...visitData, status: saveAs };
      
      // Auto-append initials for daily notes
      if (visitType === 'daily_note' && submitData.daily_note_content) {
        const initials = nurse?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase();
        if (!submitData.daily_note_content.trim().endsWith(initials)) {
          submitData.daily_note_content = submitData.daily_note_content.trim() + ` -${initials}`;
        }
      }
      
      await visitsAPI.create(patientId, submitData);
      toast.success(saveAs === 'draft' ? 'Visit saved as draft' : 'Visit completed successfully');
      navigate(`/patients/${patientId}`);
    } catch (error) {
      toast.error('Failed to save visit');
    } finally {
      setSaving(false);
    }
  };

  const getVisitTypeLabel = () => {
    switch (visitType) {
      case 'nurse_visit': return 'Nurse Visit';
      case 'vitals_only': return 'Vitals Only';
      case 'daily_note': return "Resident's Daily Note";
      default: return 'Visit';
    }
  };

  const getVisitTypeColor = () => {
    switch (visitType) {
      case 'nurse_visit': return 'bg-eggplant-50 text-eggplant-700 border-eggplant-200';
      case 'vitals_only': return 'bg-navy-50 text-blue-700 border-blue-200';
      case 'daily_note': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="new-visit-page">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate(`/patients/${patientId}`)}
                data-testid="back-btn"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-eggplant-700 rounded-xl flex items-center justify-center">
                  <Stethoscope className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-slate-900">{getVisitTypeLabel()}</h1>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline"
                onClick={(e) => handleSubmit(e, 'draft')}
                disabled={saving}
                data-testid="save-draft-btn"
              >
                Save as Draft
              </Button>
              <Button 
                className="bg-eggplant-700 hover:bg-eggplant-600"
                onClick={(e) => handleSubmit(e, 'completed')}
                disabled={saving}
                data-testid="save-visit-btn"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : (visitType === 'daily_note' ? 'Save' : 'Complete Visit')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Visit Info */}
          <Card className="bg-white border-slate-100">
            <CardContent className="pt-6">
              <div>
                <Label>
                  {visitType === 'daily_note' ? 'Daily note for:' : 
                   visitType === 'vitals_only' ? 'Vital signs measured on:' :
                   'Routine nurse visit for:'}
                </Label>
                <Input
                  type="date"
                  value={visitData.visit_date}
                  onChange={(e) => setVisitData(prev => ({ ...prev, visit_date: e.target.value }))}
                  className="mt-1"
                  data-testid="visit-date-input"
                />
              </div>
            </CardContent>
          </Card>

          {/* Vital Signs - NOT shown for daily_note */}
          {visitType !== 'daily_note' && (
            <Card className="bg-white border-slate-100">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-500" />
                Vital Signs
              </CardTitle>
              <CardDescription>Record the patient's current vital signs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div>
                  <Label>Weight (lbs)</Label>
                  <Input
                    value={visitData.vital_signs.weight}
                    onChange={(e) => updateVitalSign('weight', e.target.value)}
                    placeholder="e.g., 150"
                    className="mt-1"
                    data-testid="weight-input"
                  />
                </div>
                <div>
                  <Label>Temperature (°F)</Label>
                  <Input
                    value={visitData.vital_signs.body_temperature}
                    onChange={(e) => updateVitalSign('body_temperature', e.target.value)}
                    placeholder="e.g., 98.6"
                    className="mt-1"
                    data-testid="temperature-input"
                  />
                </div>
                <div>
                  <Label>BP Systolic</Label>
                  <Input
                    value={visitData.vital_signs.blood_pressure_systolic}
                    onChange={(e) => updateVitalSign('blood_pressure_systolic', e.target.value)}
                    placeholder="e.g., 120"
                    className={`mt-1 ${bpAbnormal ? 'border-rose-300 bg-rose-50' : ''}`}
                    data-testid="bp-systolic-input"
                  />
                </div>
                <div>
                  <Label>BP Diastolic</Label>
                  <Input
                    value={visitData.vital_signs.blood_pressure_diastolic}
                    onChange={(e) => updateVitalSign('blood_pressure_diastolic', e.target.value)}
                    placeholder="e.g., 80"
                    className={`mt-1 ${bpAbnormal ? 'border-rose-300 bg-rose-50' : ''}`}
                    data-testid="bp-diastolic-input"
                  />
                </div>
                <div>
                  <Label>Pulse Oximeter (%)</Label>
                  <Input
                    value={visitData.vital_signs.pulse_oximeter}
                    onChange={(e) => updateVitalSign('pulse_oximeter', e.target.value)}
                    placeholder="e.g., 98"
                    className="mt-1"
                    data-testid="spo2-input"
                  />
                </div>
                <div>
                  <Label>Pulse (bpm)</Label>
                  <Input
                    value={visitData.vital_signs.pulse}
                    onChange={(e) => updateVitalSign('pulse', e.target.value)}
                    placeholder="e.g., 72"
                    className="mt-1"
                    data-testid="pulse-input"
                  />
                </div>
                <div>
                  <Label>Respirations (/min)</Label>
                  <Input
                    value={visitData.vital_signs.respirations}
                    onChange={(e) => updateVitalSign('respirations', e.target.value)}
                    placeholder="e.g., 16"
                    className="mt-1"
                    data-testid="respirations-input"
                  />
                </div>
              </div>

              {bpAbnormal && (
                <div className="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                  <div className="flex items-center gap-2 text-rose-700 mb-3">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">Blood pressure appears abnormal. Please repeat.</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Repeat BP Systolic</Label>
                      <Input
                        value={visitData.vital_signs.repeat_blood_pressure_systolic}
                        onChange={(e) => updateVitalSign('repeat_blood_pressure_systolic', e.target.value)}
                        placeholder="e.g., 120"
                        className="mt-1"
                        data-testid="repeat-bp-systolic-input"
                      />
                    </div>
                    <div>
                      <Label>Repeat BP Diastolic</Label>
                      <Input
                        value={visitData.vital_signs.repeat_blood_pressure_diastolic}
                        onChange={(e) => updateVitalSign('repeat_blood_pressure_diastolic', e.target.value)}
                        placeholder="e.g., 80"
                        className="mt-1"
                        data-testid="repeat-bp-diastolic-input"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Daily Note Content - Only for daily_note type */}
          {visitType === 'daily_note' && (
            <Card className="bg-white border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-600" />
                  Daily Note
                </CardTitle>
                <CardDescription>Record observations and notes for today</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={visitData.daily_note_content}
                  onChange={(e) => setVisitData(prev => ({ ...prev, daily_note_content: e.target.value }))}
                  placeholder="Enter daily observations, activities, mood, appetite, sleep patterns, and any notable events..."
                  className="min-h-[200px]"
                  data-testid="daily-note-input"
                />
              </CardContent>
            </Card>
          )}

          {/* Home Visit Logbook - Only for nurse_visit type */}
          {visitType === 'nurse_visit' && (
            <Card className="bg-white border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-navy-600" />
                  Home Visit Logbook Checks
                </CardTitle>
                <CardDescription>Review and check required home environment items</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="locked-meds"
                      checked={visitData.home_visit_logbook.locked_meds_checked}
                      onCheckedChange={(checked) => updateHomeLogbook('locked_meds_checked', checked)}
                      data-testid="locked-meds-checkbox"
                    />
                    <Label htmlFor="locked-meds" className="cursor-pointer">
                      Locked Medications Checked
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="mar-reviewed"
                      checked={visitData.home_visit_logbook.mar_reviewed}
                      onCheckedChange={(checked) => updateHomeLogbook('mar_reviewed', checked)}
                      data-testid="mar-checkbox"
                    />
                    <Label htmlFor="mar-reviewed" className="cursor-pointer">
                      MAR (Medication Administration Record) Reviewed
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="bm-log"
                      checked={visitData.home_visit_logbook.bm_log_checked}
                      onCheckedChange={(checked) => updateHomeLogbook('bm_log_checked', checked)}
                      data-testid="bm-log-checkbox"
                    />
                    <Label htmlFor="bm-log" className="cursor-pointer">
                      BM (Bowel Movement) Log Checked
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="communication-log"
                      checked={visitData.home_visit_logbook.communication_log_checked}
                      onCheckedChange={(checked) => updateHomeLogbook('communication_log_checked', checked)}
                      data-testid="communication-log-checkbox"
                    />
                    <Label htmlFor="communication-log" className="cursor-pointer">
                      Communication Log Checked
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="seizure-log"
                      checked={visitData.home_visit_logbook.seizure_log_checked}
                      onCheckedChange={(checked) => updateHomeLogbook('seizure_log_checked', checked)}
                      data-testid="seizure-log-checkbox"
                    />
                    <Label htmlFor="seizure-log" className="cursor-pointer">
                      Seizure Log Checked (if applicable)
                    </Label>
                  </div>
                </div>
                <div>
                  <Label>Logbook Notes</Label>
                  <Textarea
                    value={visitData.home_visit_logbook.notes}
                    onChange={(e) => updateHomeLogbook('notes', e.target.value)}
                    placeholder="Any observations or concerns from logbook review..."
                    className="mt-1"
                    rows={2}
                    data-testid="logbook-notes-input"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Full Assessment - Only for nurse_visit type */}
          {visitType === 'nurse_visit' && (
            <>
              {/* Physical Assessment */}
              <Card className="bg-white border-slate-100">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5 text-eggplant-700" />
                    Physical Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>General Appearance</Label>
                      {lastVisit && (
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="sm"
                          onClick={() => pullFromLast('physical_assessment', 'general_appearance')}
                          className="text-xs text-eggplant-600 hover:text-eggplant-700"
                        >
                          Pull from last visit
                        </Button>
                      )}
                    </div>
                    <Textarea
                      value={visitData.physical_assessment.general_appearance}
                      onChange={(e) => updatePhysicalAssessment('general_appearance', e.target.value)}
                      placeholder="Describe patient's general appearance..."
                      className="mt-1"
                      rows={2}
                      data-testid="general-appearance-input"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Skin Assessment</Label>
                      {lastVisit && (
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="sm"
                          onClick={() => pullFromLast('physical_assessment', 'skin_assessment')}
                          className="text-xs text-eggplant-600 hover:text-eggplant-700"
                        >
                          Pull from last visit
                        </Button>
                      )}
                    </div>
                    <Textarea
                      value={visitData.physical_assessment.skin_assessment}
                      onChange={(e) => updatePhysicalAssessment('skin_assessment', e.target.value)}
                      placeholder="Describe skin condition, integrity, wounds..."
                      className="mt-1"
                      rows={2}
                      data-testid="skin-assessment-input"
                    />
                  </div>
                  
                  {/* Mobility, Speech, Orientation */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label>Mobility Level</Label>
                        {lastVisit && (
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm"
                            onClick={() => pullFromLast('physical_assessment', 'mobility_level')}
                            className="text-xs text-eggplant-600 hover:text-eggplant-700"
                          >
                            ↻
                          </Button>
                        )}
                      </div>
                      <Select
                        value={visitData.physical_assessment.mobility_level}
                        onValueChange={(value) => updatePhysicalAssessment('mobility_level', value)}
                      >
                        <SelectTrigger className="mt-1" data-testid="mobility-select">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ambulatory">Ambulatory</SelectItem>
                          <SelectItem value="Supervised">Supervised</SelectItem>
                          <SelectItem value="With Assistance">With Assistance</SelectItem>
                          <SelectItem value="Wheelchair">Wheelchair</SelectItem>
                          <SelectItem value="Paralyzed">Paralyzed</SelectItem>
                          <SelectItem value="Non-Ambulatory">Non-Ambulatory</SelectItem>
                          <SelectItem value="Independent">Independent</SelectItem>
                          <SelectItem value="Minimal Assistance">Minimal Assistance</SelectItem>
                          <SelectItem value="Moderate Assistance">Moderate Assistance</SelectItem>
                          <SelectItem value="Maximum Assistance">Maximum Assistance</SelectItem>
                          <SelectItem value="Total Dependence">Total Dependence</SelectItem>
                          <SelectItem value="Bedbound">Bedbound</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label>Speech Level</Label>
                        {lastVisit && (
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm"
                            onClick={() => pullFromLast('physical_assessment', 'speech_level')}
                            className="text-xs text-eggplant-600 hover:text-eggplant-700"
                          >
                            ↻
                          </Button>
                        )}
                      </div>
                      <Select
                        value={visitData.physical_assessment.speech_level}
                        onValueChange={(value) => updatePhysicalAssessment('speech_level', value)}
                      >
                        <SelectTrigger className="mt-1" data-testid="speech-select">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Clear & Coherent">Clear & Coherent</SelectItem>
                          <SelectItem value="Slurred">Slurred</SelectItem>
                          <SelectItem value="Impaired">Impaired</SelectItem>
                          <SelectItem value="Non-verbal">Non-verbal</SelectItem>
                          <SelectItem value="ASL/Sign">ASL/Sign Language</SelectItem>
                          <SelectItem value="Speech Impediment">Speech Impediment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label>Alert & Oriented</Label>
                        {lastVisit && (
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm"
                            onClick={() => pullFromLast('physical_assessment', 'alert_oriented_level')}
                            className="text-xs text-eggplant-600 hover:text-eggplant-700"
                          >
                            ↻
                          </Button>
                        )}
                      </div>
                      <Select
                        value={visitData.physical_assessment.alert_oriented_level}
                        onValueChange={(value) => updatePhysicalAssessment('alert_oriented_level', value)}
                      >
                        <SelectTrigger className="mt-1" data-testid="orientation-select">
                          <SelectValue placeholder="Select level (0-4)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="x4 - Person, Place, Time, Situation">x4 - Person, Place, Time, Situation</SelectItem>
                          <SelectItem value="x3 - Person, Place, Time">x3 - Person, Place, Time</SelectItem>
                          <SelectItem value="x2 - Person, Place">x2 - Person, Place</SelectItem>
                          <SelectItem value="x1 - Person only">x1 - Person only</SelectItem>
                          <SelectItem value="x0 - Unresponsive">x0 - Unresponsive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Gait Monitoring & Fall Incidence */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                    <div>
                      <Label>Gait Status</Label>
                      <Select
                        value={visitData.physical_assessment.gait_status}
                        onValueChange={(value) => updatePhysicalAssessment('gait_status', value)}
                      >
                        <SelectTrigger className="mt-1" data-testid="gait-status-select">
                          <SelectValue placeholder="Select gait status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="No Falls">No Falls</SelectItem>
                          <SelectItem value="Uneventful Falls">Uneventful Falls (No Injury)</SelectItem>
                          <SelectItem value="Eventful Falls">Eventful Falls (With Injury)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Fall Incidence Since Last Visit</Label>
                      <Textarea
                        value={visitData.physical_assessment.fall_incidence_since_last_visit}
                        onChange={(e) => updatePhysicalAssessment('fall_incidence_since_last_visit', e.target.value)}
                        placeholder="Describe any falls..."
                        className="mt-1"
                        rows={2}
                        data-testid="fall-incidence-input"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* System Assessments */}
              <Accordion type="multiple" defaultValue={["head-to-toe"]} className="space-y-4">
                {/* Head to Toe */}
                <AccordionItem value="head-to-toe" className="bg-white border border-slate-100 rounded-xl px-6">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-lg font-semibold">
                      <Eye className="w-5 h-5 text-eggplant-700" />
                      Head to Toe Assessment
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <Label>Head & Neck</Label>
                      <Textarea
                        value={visitData.head_to_toe.head_neck}
                        onChange={(e) => updateHeadToToe('head_neck', e.target.value)}
                        placeholder="Describe findings..."
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label>Eyes / Vision</Label>
                      <Textarea
                        value={visitData.head_to_toe.eyes_vision}
                        onChange={(e) => updateHeadToToe('eyes_vision', e.target.value)}
                        placeholder="Describe findings..."
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label>Ears / Hearing</Label>
                      <Textarea
                        value={visitData.head_to_toe.ears_hearing}
                        onChange={(e) => updateHeadToToe('ears_hearing', e.target.value)}
                        placeholder="Describe findings..."
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label>Nose / Nasal Cavity</Label>
                      <Textarea
                        value={visitData.head_to_toe.nose_nasal_cavity}
                        onChange={(e) => updateHeadToToe('nose_nasal_cavity', e.target.value)}
                        placeholder="Describe findings..."
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label>Mouth / Teeth / Oral Cavity</Label>
                      <Textarea
                        value={visitData.head_to_toe.mouth_teeth_oral_cavity}
                        onChange={(e) => updateHeadToToe('mouth_teeth_oral_cavity', e.target.value)}
                        placeholder="Describe findings..."
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Gastrointestinal */}
                <AccordionItem value="gi" className="bg-white border border-slate-100 rounded-xl px-6">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-lg font-semibold">
                      <Droplet className="w-5 h-5 text-amber-600" />
                      Gastrointestinal Assessment
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Last Bowel Movement</Label>
                        <Input
                          type="date"
                          value={visitData.gastrointestinal.last_bowel_movement}
                          onChange={(e) => updateGI('last_bowel_movement', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Bowel Sounds</Label>
                        <Select
                          value={visitData.gastrointestinal.bowel_sounds}
                          onValueChange={(value) => updateGI('bowel_sounds', value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Present - Normal">Present - Normal</SelectItem>
                            <SelectItem value="Hyperactive">Hyperactive</SelectItem>
                            <SelectItem value="Hypoactive">Hypoactive</SelectItem>
                            <SelectItem value="Absent">Absent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Nutritional Diet</Label>
                      <Select
                        value={visitData.gastrointestinal.nutritional_diet}
                        onValueChange={(value) => updateGI('nutritional_diet', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select diet type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Regular">Regular</SelectItem>
                          <SelectItem value="Puree/Blended">Puree/Blended</SelectItem>
                          <SelectItem value="Tube Feeding">Tube Feeding</SelectItem>
                          <SelectItem value="DASH Diet">DASH Diet</SelectItem>
                          <SelectItem value="Restricted Fluids">Restricted Fluids</SelectItem>
                          <SelectItem value="Diabetic Diet">Diabetic Diet</SelectItem>
                          <SelectItem value="Low Sodium">Low Sodium</SelectItem>
                          <SelectItem value="Thickened Liquids">Thickened Liquids</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Genito-Urinary */}
                <AccordionItem value="gu" className="bg-white border border-slate-100 rounded-xl px-6">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-lg font-semibold">
                      <Droplet className="w-5 h-5 text-navy-600" />
                      Genito-Urinary Assessment
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <Label>Toileting Level</Label>
                      <Select
                        value={visitData.genito_urinary.toileting_level}
                        onValueChange={(value) => updateGU('toileting_level', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select toileting level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Self-Toileting">Self-Toileting</SelectItem>
                          <SelectItem value="Assisted Toileting">Assisted Toileting</SelectItem>
                          <SelectItem value="Bedpan/Urinal">Bedpan/Urinal</SelectItem>
                          <SelectItem value="Indwelling Catheter">Indwelling Catheter</SelectItem>
                          <SelectItem value="Intermittent Catheter">Intermittent Catheter</SelectItem>
                          <SelectItem value="Adult Diapers/Brief">Adult Diapers/Brief</SelectItem>
                          <SelectItem value="Ostomy">Ostomy</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Respiratory */}
                <AccordionItem value="respiratory" className="bg-white border border-slate-100 rounded-xl px-6">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-lg font-semibold">
                      <Wind className="w-5 h-5 text-cyan-600" />
                      Respiratory Assessment
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Lung Sounds</Label>
                        <Select
                          value={visitData.respiratory.lung_sounds}
                          onValueChange={(value) => updateRespiratory('lung_sounds', value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Clear">Clear</SelectItem>
                            <SelectItem value="Wheezing">Wheezing</SelectItem>
                            <SelectItem value="Crackles">Crackles</SelectItem>
                            <SelectItem value="Rhonchi">Rhonchi</SelectItem>
                            <SelectItem value="Diminished">Diminished</SelectItem>
                            <SelectItem value="Absent">Absent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Oxygen Type</Label>
                        <Select
                          value={visitData.respiratory.oxygen_type}
                          onValueChange={(value) => updateRespiratory('oxygen_type', value)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select oxygen type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Room Air">Room Air</SelectItem>
                            <SelectItem value="Nasal Cannula">Nasal Cannula</SelectItem>
                            <SelectItem value="Simple Mask">Simple Mask</SelectItem>
                            <SelectItem value="Non-Rebreather">Non-Rebreather</SelectItem>
                            <SelectItem value="BiPAP">BiPAP</SelectItem>
                            <SelectItem value="CPAP">CPAP</SelectItem>
                            <SelectItem value="Ventilator">Ventilator</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Endocrine */}
                <AccordionItem value="endocrine" className="bg-white border border-slate-100 rounded-xl px-6">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-lg font-semibold">
                      <Activity className="w-5 h-5 text-purple-600" />
                      Endocrine Assessment
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="isDiabetic"
                        checked={visitData.endocrine.is_diabetic}
                        onCheckedChange={(checked) => updateEndocrine('is_diabetic', checked)}
                      />
                      <Label htmlFor="isDiabetic" className="cursor-pointer">Patient is diabetic</Label>
                    </div>
                    {visitData.endocrine.is_diabetic && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label>Blood Sugar (mg/dL)</Label>
                            <Input
                              value={visitData.endocrine.blood_sugar}
                              onChange={(e) => updateEndocrine('blood_sugar', e.target.value)}
                              placeholder="e.g., 120"
                              className="mt-1"
                              data-testid="blood-sugar-input"
                            />
                          </div>
                          <div>
                            <Label>Date of Reading</Label>
                            <Input
                              type="date"
                              value={visitData.endocrine.blood_sugar_date}
                              onChange={(e) => updateEndocrine('blood_sugar_date', e.target.value)}
                              className="mt-1"
                              data-testid="blood-sugar-date-input"
                            />
                          </div>
                          <div>
                            <Label>Time of Day</Label>
                            <Select
                              value={visitData.endocrine.blood_sugar_time_of_day}
                              onValueChange={(value) => updateEndocrine('blood_sugar_time_of_day', value)}
                            >
                              <SelectTrigger className="mt-1" data-testid="blood-sugar-time-select">
                                <SelectValue placeholder="Select time" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AM">AM (Morning)</SelectItem>
                                <SelectItem value="PM">PM (Afternoon/Evening)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label>Diabetic Notes</Label>
                          <Textarea
                            value={visitData.endocrine.diabetic_notes}
                            onChange={(e) => updateEndocrine('diabetic_notes', e.target.value)}
                            placeholder="Additional notes..."
                            className="mt-1"
                            rows={2}
                          />
                        </div>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                {/* Changes Since Last Visit */}
                <AccordionItem value="changes" className="bg-white border border-slate-100 rounded-xl px-6">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-lg font-semibold">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      Changes Since Last Visit
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div>
                      <Label>Medication Changes (Start/Stop)</Label>
                      <Textarea
                        value={visitData.changes_since_last.medication_changes}
                        onChange={(e) => updateChanges('medication_changes', e.target.value)}
                        placeholder="Any medication changes since last visit..."
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label>Diagnosis Changes</Label>
                      <Textarea
                        value={visitData.changes_since_last.diagnosis_changes}
                        onChange={(e) => updateChanges('diagnosis_changes', e.target.value)}
                        placeholder="Any new diagnoses or changes..."
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label>ER / Urgent Care Visits</Label>
                      <Textarea
                        value={visitData.changes_since_last.er_urgent_care_visits}
                        onChange={(e) => updateChanges('er_urgent_care_visits', e.target.value)}
                        placeholder="Any ER or urgent care visits since last seen..."
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                    <div>
                      <Label>Upcoming Appointments (Next 30 Days)</Label>
                      <Textarea
                        value={visitData.changes_since_last.upcoming_appointments}
                        onChange={(e) => updateChanges('upcoming_appointments', e.target.value)}
                        placeholder="Any scheduled appointments..."
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          )}

          {/* Overall Status - For nurse_visit and vitals_only */}
          {(visitType === 'nurse_visit' || visitType === 'vitals_only') && (
            <Card className="bg-white border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="w-5 h-5 text-eggplant-700" />
                  Overall Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Current Overall Health Condition</Label>
                  <Select
                    value={visitData.overall_health_status}
                    onValueChange={(value) => setVisitData(prev => ({ ...prev, overall_health_status: value }))}
                  >
                    <SelectTrigger className="mt-1" data-testid="health-status-select">
                      <SelectValue placeholder="Select health status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Stable">Stable</SelectItem>
                      <SelectItem value="Unstable">Unstable</SelectItem>
                      <SelectItem value="Deteriorating">Deteriorating</SelectItem>
                      <SelectItem value="Needs Immediate Attention">Needs Immediate Medical Attention at Hospital</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nurse Documentation</Label>
                  <Textarea
                    value={visitData.nurse_notes}
                    onChange={(e) => setVisitData(prev => ({ ...prev, nurse_notes: e.target.value }))}
                    placeholder="Additional observations, recommendations, or concerns..."
                    className="mt-1"
                    rows={4}
                    data-testid="nurse-notes-input"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Medication Compliance - For nurse_visit */}
          {visitType === 'nurse_visit' && (
            <Card className="bg-white border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg">Compliance with Medications?</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={visitData.medication_compliance}
                  onValueChange={(value) => setVisitData(prev => ({ ...prev, medication_compliance: value }))}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <RadioGroupItem value="compliance" id="compliance" />
                    <Label htmlFor="compliance" className="font-normal cursor-pointer">Compliance</Label>
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <RadioGroupItem value="partial_compliance" id="partial_compliance" />
                    <Label htmlFor="partial_compliance" className="font-normal cursor-pointer">Partial Compliance</Label>
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <RadioGroupItem value="noncompliance" id="noncompliance" />
                    <Label htmlFor="noncompliance" className="font-normal cursor-pointer">Noncompliance</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="not_applicable" id="not_applicable" />
                    <Label htmlFor="not_applicable" className="font-normal cursor-pointer">Not Applicable</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          {/* Concerns/Actions - For nurse_visit */}
          {visitType === 'nurse_visit' && (
            <Card className="bg-white border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg">Concerns/Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="no_concerns"
                    checked={visitData.concerns_actions.no_concerns}
                    onCheckedChange={(checked) => 
                      setVisitData(prev => ({
                        ...prev,
                        concerns_actions: { ...prev.concerns_actions, no_concerns: checked }
                      }))
                    }
                  />
                  <Label htmlFor="no_concerns" className="font-normal cursor-pointer">
                    No new concerns identified as per staff reporting
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="no_corrective_actions"
                    checked={visitData.concerns_actions.no_corrective_actions}
                    onCheckedChange={(checked) => 
                      setVisitData(prev => ({
                        ...prev,
                        concerns_actions: { ...prev.concerns_actions, no_corrective_actions: checked }
                      }))
                    }
                  />
                  <Label htmlFor="no_corrective_actions" className="font-normal cursor-pointer">
                    No Corrective actions required
                  </Label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Miscellaneous Information - For nurse_visit */}
          {visitType === 'nurse_visit' && (
            <Card className="bg-white border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg">Miscellaneous Information (Select all that apply)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="satisfied"
                    checked={visitData.miscellaneous_info.satisfied}
                    onCheckedChange={(checked) => 
                      setVisitData(prev => ({
                        ...prev,
                        miscellaneous_info: { ...prev.miscellaneous_info, satisfied: checked }
                      }))
                    }
                  />
                  <Label htmlFor="satisfied" className="font-normal cursor-pointer">
                    Individual is satisfied with Service
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="clean_tidy"
                    checked={visitData.miscellaneous_info.clean_tidy}
                    onCheckedChange={(checked) => 
                      setVisitData(prev => ({
                        ...prev,
                        miscellaneous_info: { ...prev.miscellaneous_info, clean_tidy: checked }
                      }))
                    }
                  />
                  <Label htmlFor="clean_tidy" className="font-normal cursor-pointer">
                    Home area Clean and Tidy
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="safety_practices"
                    checked={visitData.miscellaneous_info.safety_practices}
                    onCheckedChange={(checked) => 
                      setVisitData(prev => ({
                        ...prev,
                        miscellaneous_info: { ...prev.miscellaneous_info, safety_practices: checked }
                      }))
                    }
                  />
                  <Label htmlFor="safety_practices" className="font-normal cursor-pointer">
                    Good Safety Practices observed
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="follows_plan"
                    checked={visitData.miscellaneous_info.follows_plan}
                    onCheckedChange={(checked) => 
                      setVisitData(prev => ({
                        ...prev,
                        miscellaneous_info: { ...prev.miscellaneous_info, follows_plan: checked }
                      }))
                    }
                  />
                  <Label htmlFor="follows_plan" className="font-normal cursor-pointer">
                    Follows Healthcare Plan and Protocols
                  </Label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Additional Notes - For nurse_visit */}
          {visitType === 'nurse_visit' && (
            <Card className="bg-white border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg">Additional Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={visitData.additional_notes}
                  onChange={(e) => setVisitData(prev => ({ ...prev, additional_notes: e.target.value }))}
                  placeholder="Any additional notes or observations..."
                  className="min-h-[100px]"
                />
              </CardContent>
            </Card>
          )}

          {/* Pictures/Documents Upload - For nurse_visit */}
          {visitType === 'nurse_visit' && (
            <Card className="bg-white border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg">Do you need to add any pictures or documents?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={(e) => {
                      const files = Array.from(e.target.files);
                      setVisitData(prev => ({
                        ...prev,
                        attachments: files
                      }));
                    }}
                    className="cursor-pointer"
                  />
                  {visitData.attachments.length > 0 && (
                    <div className="text-sm text-slate-600">
                      {visitData.attachments.length} file(s) selected
                    </div>
                  )}
                  <p className="text-xs text-slate-500">
                    Accepted formats: Images (JPG, PNG), PDF, Word documents
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Signature Section - For nurse_visit */}
          {visitType === 'nurse_visit' && (
            <Card className="bg-white border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-eggplant-700" />
                  Certification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-slate-700 font-medium">Screening completed by:</Label>
                  <p className="text-lg text-slate-900 mt-2">
                    <span className="underline font-medium">
                      {visitData.screening_completed_by || `${nurse?.full_name}, ${nurse?.title}`}
                    </span>
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <Label className="text-slate-700 font-medium">
                    Nurse assessment was reviewed and signed by:
                  </Label>
                  <Select
                    value={visitData.reviewed_and_signed_by}
                    onValueChange={(value) => setVisitData(prev => ({ ...prev, reviewed_and_signed_by: value }))}
                  >
                    <SelectTrigger className="mt-2 h-12" data-testid="reviewed-by-select">
                      <SelectValue placeholder="Select reviewer..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={`${nurse?.full_name}, ${nurse?.title}`}>
                        {nurse?.full_name}, {nurse?.title}
                      </SelectItem>
                      <SelectItem value="Simone Lajonquille, LPN">
                        Simone Lajonquille, LPN
                      </SelectItem>
                      <SelectItem value="Hilary Thompson-Pierre, RN">
                        Hilary Thompson-Pierre, RN
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {visitData.reviewed_and_signed_by && (
                    <p className="text-lg text-slate-900 mt-3">
                      Signed by: <span className="underline font-medium">{visitData.reviewed_and_signed_by}</span>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Signature Section - For vitals_only */}
          {visitType === 'vitals_only' && (
            <Card className="bg-white border-slate-100">
              <CardContent className="pt-6 pb-6">
                <p className="text-slate-700">
                  Completed by: <span className="font-medium">{nurse?.full_name}, {nurse?.title}</span>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3">
            <Button 
              type="button"
              variant="outline"
              className="h-12 px-8"
              onClick={(e) => handleSubmit(e, 'draft')}
              disabled={saving}
              data-testid="submit-draft-btn"
            >
              Save as Draft
            </Button>
            <Button 
              type="submit"
              className="bg-eggplant-700 hover:bg-eggplant-600 h-12 px-8"
              disabled={saving}
              data-testid="submit-visit-btn"
            >
              <Save className="w-5 h-5 mr-2" />
              {saving ? 'Saving Visit...' : 'Complete Visit'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
