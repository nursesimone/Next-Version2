import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { 
  Stethoscope, 
  Activity, 
  FileText, 
  LogOut,
  ChevronRight,
  BarChart3,
  Syringe
} from 'lucide-react';

export default function VisitTypePage() {
  const { nurse, logout } = useAuth();
  const navigate = useNavigate();
  const [visitType, setVisitType] = useState('');

  const handleProceed = () => {
    if (!visitType) return;
    
    // Store selection in sessionStorage for the visit form to use
    sessionStorage.setItem('visitType', visitType);
    
    // Navigate to dashboard to select patient
    navigate('/dashboard');
  };

  const handleReports = () => {
    navigate('/reports');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visitTypes = [
    {
      id: 'nurse_visit',
      title: 'Nurse Visit',
      description: 'Complete nursing assessment with all documentation',
      icon: Stethoscope
    },
    {
      id: 'patient_intervention',
      title: 'Patient Intervention',
      description: 'Injections, tests, treatments, and procedures',
      icon: Syringe
    },
    {
      id: 'vitals_only',
      title: 'Vital Signs ONLY',
      description: 'Quick vital signs check without full assessment',
      icon: Activity
    },
    {
      id: 'daily_note',
      title: "Resident's Daily Note",
      description: 'Daily observation and notes for resident',
      icon: FileText
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50" data-testid="visit-type-page">
      {/* Header */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-eggplant-700 rounded-xl flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">POSH-Able Living</span>
            </div>
            
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                onClick={handleReports}
                className="hidden sm:flex"
                data-testid="reports-btn"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Monthly Reports
              </Button>
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
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Select Visit Type</h1>
          <p className="text-slate-600">Choose the type of documentation you need to complete</p>
        </div>

        {/* Visit Type Selection */}
        <div className="space-y-6">
          <RadioGroup value={visitType} onValueChange={setVisitType} className="space-y-4">
            {visitTypes.map((type) => {
              const Icon = type.icon;
              return (
                <Card 
                  key={type.id}
                  className={`cursor-pointer transition-all ${
                    visitType === type.id 
                      ? 'border-eggplant-500 ring-2 ring-eggplant-500/20' 
                      : 'border-slate-200 hover:border-eggplant-200'
                  }`}
                  onClick={() => setVisitType(type.id)}
                  data-testid={`visit-type-${type.id}`}
                >
                  <CardContent className="flex items-center gap-4 p-6">
                    <RadioGroupItem value={type.id} id={type.id} className="sr-only" />
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                      visitType === type.id ? 'bg-eggplant-700' : 'bg-eggplant-50'
                    }`}>
                      <Icon className={`w-7 h-7 ${
                        visitType === type.id ? 'text-white' : 'text-eggplant-700'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-slate-900">{type.title}</h3>
                      <p className="text-sm text-slate-500">{type.description}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      visitType === type.id 
                        ? 'border-eggplant-700 bg-eggplant-700' 
                        : 'border-slate-300'
                    }`}>
                      {visitType === type.id && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </RadioGroup>

          {/* Proceed Button */}
          <div className="flex justify-center pt-6">
            <Button 
              className="h-12 px-8 bg-eggplant-700 hover:bg-eggplant-600"
              onClick={handleProceed}
              disabled={!visitType}
              data-testid="proceed-btn"
            >
              Select Patient
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>

          {/* Mobile Reports Button */}
          <div className="flex justify-center pt-4 sm:hidden">
            <Button 
              variant="outline" 
              onClick={handleReports}
              data-testid="reports-btn-mobile"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Monthly Reports
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
