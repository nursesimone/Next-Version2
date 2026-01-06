import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { patientsAPI, visitsAPI } from '../lib/api';
import { formatDate } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { ArrowLeft, FileText, Printer, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function DailyNotesReportPage() {
  const navigate = useNavigate();
  const { nurse } = useAuth();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patientId');
  
  const [patient, setPatient] = useState(null);
  const [dailyNotes, setDailyNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));

  useEffect(() => {
    if (patientId) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [patientId, selectedMonth]);

  const fetchData = async () => {
    try {
      const patientRes = await patientsAPI.get(patientId);
      setPatient(patientRes.data);

      const visitsRes = await visitsAPI.list(patientId);
      const notes = visitsRes.data
        .filter(v => v.visit_type === 'daily_note')
        .filter(v => v.visit_date.startsWith(selectedMonth))
        .sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date)); // Ascending order
      
      setDailyNotes(notes);
    } catch (error) {
      toast.error('Failed to load daily notes');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getMonthYearLabel = () => {
    const date = new Date(selectedMonth + '-01');
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
      {/* Header - Hidden when printing */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-bold text-slate-900">Daily Notes Report</h1>
                {patient && <p className="text-sm text-slate-500">{patient.full_name}</p>}
              </div>
            </div>
            
            <Button 
              onClick={handlePrint}
              className="bg-eggplant-700 hover:bg-eggplant-600"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Report
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters - Hidden when printing */}
        <Card className="mb-6 print:hidden">
          <CardContent className="pt-6">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label>Select Month</Label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  max={new Date().toISOString().substring(0, 7)}
                  className="mt-1 h-11 w-full px-3 rounded-md border border-slate-200"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Content */}
        <Card className="print:shadow-none print:border-0">
          <CardHeader className="print:pb-4">
            <div className="text-center">
              <CardTitle className="text-2xl mb-2">Daily Notes Journal</CardTitle>
              <p className="text-lg font-semibold text-slate-700">{patient?.full_name}</p>
              <p className="text-slate-600">{getMonthYearLabel()}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {dailyNotes.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No daily notes found for this period</p>
              </div>
            ) : (
              dailyNotes.map((note, index) => (
                <div key={note.id} className="border-b border-slate-200 pb-4 mb-4 last:border-0 break-inside-avoid">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium text-slate-900">
                      {formatDate(note.visit_date)}
                    </p>
                  </div>
                  <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {note.daily_note_content}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Print footer */}
        <div className="hidden print:block mt-8 text-center text-sm text-slate-500">
          <p>Printed by: {nurse?.full_name}, {nurse?.title}</p>
          <p>Date: {new Date().toLocaleDateString()}</p>
        </div>
      </main>

      <style jsx>{`
        @media print {
          @page {
            margin: 0.75in;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-0 {
            border: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
