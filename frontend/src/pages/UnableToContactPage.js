import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { patientsAPI, unableToContactAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { 
  Stethoscope, 
  ArrowLeft, 
  PhoneOff,
  Calendar,
  MapPin,
  User,
  Save,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';

export default function UnableToContactPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Get visit type from session storage
  const visitType = sessionStorage.getItem('visitType') || 'nurse_visit';

  const getVisitTypeLabel = () => {
    switch (visitType) {
      case 'nurse_visit': return 'Nurse Visit';
      case 'vitals_only': return 'Vital Signs Check';
      case 'daily_note': return "Resident's Daily Note";
      default: return 'Visit';
    }
  };

  const [formData, setFormData] = useState({
    patient_id: patientId,
    visit_type: visitType,
    attempt_date: new Date().toISOString().split('T')[0],
    attempt_time: new Date().toTimeString().slice(0, 5),
    attempt_location: '',
    attempt_location_other: '',
    spoke_with_anyone: false,
    spoke_with_whom: '',
    individual_location: '',
    individual_location_other: '',
    facility_name: '',
    facility_city: '',
    facility_state: '',
    expected_return_date: '',
    admission_date: '',
    admission_reason: '',
    additional_info: ''
  });

  useEffect(() => {
    fetchPatient();
  }, [patientId]);

  const fetchPatient = async () => {
    try {
      const response = await patientsAPI.get(patientId);
      setPatient(response.data);
    } catch (error) {
      toast.error('Failed to load patient');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.attempt_location) {
      toast.error('Please select where you attempted to contact');
      return;
    }
    if (!formData.individual_location) {
      toast.error('Please select where the individual is');
      return;
    }
    
    setSaving(true);
    try {
      await unableToContactAPI.create(formData);
      toast.success('Unable to contact record saved');
      navigate(`/patients/${patientId}`);
    } catch (error) {
      toast.error('Failed to save record');
    } finally {
      setSaving(false);
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
    <div className="min-h-screen bg-slate-50" data-testid="unable-to-contact-page">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
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
                <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center">
                  <PhoneOff className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="font-bold text-slate-900">Unable to Contact</h1>
                  <p className="text-sm text-slate-500">{patient?.full_name}</p>
                </div>
              </div>
            </div>
            
            <Button 
              className="bg-amber-600 hover:bg-amber-500"
              onClick={handleSubmit}
              disabled={saving}
              data-testid="save-btn"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Record'}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Reason for Visit (Prefilled) */}
          <Card className="bg-white border-slate-100">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-eggplant-700" />
                Reason for Visit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-eggplant-50 border border-eggplant-200 rounded-lg p-4">
                <p className="text-eggplant-800 font-medium">{getVisitTypeLabel()}</p>
                <p className="text-sm text-eggplant-600 mt-1">
                  {patient?.permanent_info?.organization && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {patient.permanent_info.organization}
                    </span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* When did you attempt to visit */}
          <Card className="bg-white border-slate-100">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-eggplant-700" />
                When did you attempt to visit?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={formData.attempt_date}
                    onChange={(e) => updateField('attempt_date', e.target.value)}
                    className="mt-1"
                    required
                    data-testid="attempt-date-input"
                  />
                </div>
                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={formData.attempt_time}
                    onChange={(e) => updateField('attempt_time', e.target.value)}
                    className="mt-1"
                    data-testid="attempt-time-input"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Where */}
          <Card className="bg-white border-slate-100">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-eggplant-700" />
                Where did you attempt to contact?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={formData.attempt_location}
                onValueChange={(value) => updateField('attempt_location', value)}
              >
                <SelectTrigger data-testid="attempt-location-select">
                  <SelectValue placeholder="Select location type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">Home</SelectItem>
                  <SelectItem value="day_program">Day Program</SelectItem>
                  <SelectItem value="telephone">By Telephone (Voice)</SelectItem>
                  <SelectItem value="virtual">Virtual (Video)</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              
              {formData.attempt_location === 'other' && (
                <div className="animate-fade-in">
                  <Label>Please specify</Label>
                  <Input
                    value={formData.attempt_location_other}
                    onChange={(e) => updateField('attempt_location_other', e.target.value)}
                    placeholder="Enter location details"
                    className="mt-1"
                    data-testid="attempt-location-other-input"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Did you speak with anyone */}
          <Card className="bg-white border-slate-100">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-eggplant-700" />
                Did you speak with anyone?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="spokeWithAnyone"
                  checked={formData.spoke_with_anyone}
                  onCheckedChange={(checked) => updateField('spoke_with_anyone', checked)}
                  data-testid="spoke-with-anyone-checkbox"
                />
                <Label htmlFor="spokeWithAnyone" className="cursor-pointer">
                  Yes, I spoke with someone
                </Label>
              </div>
              
              {formData.spoke_with_anyone && (
                <div className="animate-fade-in">
                  <Label>Who did you speak with?</Label>
                  <Input
                    value={formData.spoke_with_whom}
                    onChange={(e) => updateField('spoke_with_whom', e.target.value)}
                    placeholder="Name and relationship to patient"
                    className="mt-1"
                    data-testid="spoke-with-whom-input"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Where is the individual */}
          <Card className="bg-white border-slate-100">
            <CardHeader>
              <CardTitle className="text-lg">Where is the individual?</CardTitle>
              <CardDescription>Select the reason they were unavailable</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={formData.individual_location}
                onValueChange={(value) => updateField('individual_location', value)}
              >
                <SelectTrigger data-testid="individual-location-select">
                  <SelectValue placeholder="Select reason..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admitted">Admitted to Medical Facility</SelectItem>
                  <SelectItem value="moved_temporarily">Moved Temporarily</SelectItem>
                  <SelectItem value="moved_permanently">Moved Permanently</SelectItem>
                  <SelectItem value="vacation">On Vacation with Family</SelectItem>
                  <SelectItem value="deceased">Deceased</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              
              {formData.individual_location === 'other' && (
                <div className="animate-fade-in">
                  <Label>Please specify</Label>
                  <Input
                    value={formData.individual_location_other}
                    onChange={(e) => updateField('individual_location_other', e.target.value)}
                    placeholder="Enter details"
                    className="mt-1"
                    data-testid="individual-location-other-input"
                  />
                </div>
              )}
              
              {/* If admitted to medical facility */}
              {formData.individual_location === 'admitted' && (
                <div className="space-y-4 animate-fade-in pt-4 border-t border-slate-100">
                  <h4 className="font-medium text-slate-700">Medical Facility Admission Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Facility Name</Label>
                      <Input
                        value={formData.facility_name}
                        onChange={(e) => updateField('facility_name', e.target.value)}
                        placeholder="Hospital or facility name"
                        className="mt-1"
                        data-testid="facility-name-input"
                      />
                    </div>
                    <div>
                      <Label>City</Label>
                      <Input
                        value={formData.facility_city}
                        onChange={(e) => updateField('facility_city', e.target.value)}
                        placeholder="City"
                        className="mt-1"
                        data-testid="facility-city-input"
                      />
                    </div>
                    <div>
                      <Label>State</Label>
                      <Input
                        value={formData.facility_state}
                        onChange={(e) => updateField('facility_state', e.target.value)}
                        placeholder="State (e.g., CA)"
                        className="mt-1"
                        maxLength={2}
                        data-testid="facility-state-input"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>When were they admitted?</Label>
                    <Input
                      type="date"
                      value={formData.admission_date}
                      onChange={(e) => updateField('admission_date', e.target.value)}
                      className="mt-1"
                      data-testid="admission-date-input"
                    />
                  </div>
                  <div>
                    <Label>Why were they admitted?</Label>
                    <Textarea
                      value={formData.admission_reason}
                      onChange={(e) => updateField('admission_reason', e.target.value)}
                      placeholder="Reason for admission..."
                      className="mt-1"
                      rows={2}
                      data-testid="admission-reason-input"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expected Return Date - Moved to the end, before Additional Information */}
          {['moved_temporarily', 'vacation', 'admitted'].includes(formData.individual_location) && (
            <Card className="bg-white border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg">When are they expected to return?</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="date"
                  value={formData.expected_return_date}
                  onChange={(e) => updateField('expected_return_date', e.target.value)}
                  className="h-11"
                  data-testid="expected-return-input"
                />
              </CardContent>
            </Card>
          )}

          {/* Additional Information */}
          <Card className="bg-white border-slate-100">
            <CardHeader>
              <CardTitle className="text-lg">Additional Information</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.additional_info}
                onChange={(e) => updateField('additional_info', e.target.value)}
                placeholder="Any other relevant information..."
                className="min-h-[100px]"
                data-testid="additional-info-input"
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button 
              type="submit"
              className="bg-amber-600 hover:bg-amber-500 h-12 px-8"
              disabled={saving}
              data-testid="submit-btn"
            >
              <Save className="w-5 h-5 mr-2" />
              {saving ? 'Saving...' : 'Save Record'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
