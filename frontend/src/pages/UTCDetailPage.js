import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ArrowLeft, PhoneOff, MapPin, Calendar, Clock, User, Download } from 'lucide-react';
import { formatDate } from '../lib/utils';
import axios from 'axios';
import jsPDF from 'jspdf';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

export default function UTCDetailPage() {
  const { utcId } = useParams();
  const navigate = useNavigate();
  const [utc, setUtc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUTC();
  }, [utcId]);

  const fetchUTC = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BACKEND_URL}/api/unable-to-contact/${utcId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUtc(response.data);
    } catch (error) {
      console.error('Failed to load UTC:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const margin = 20;
    let y = margin;

    // Header
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('POSH-Able Living', margin, y);
    y += 10;
    doc.setFontSize(14);
    doc.text('Unable to Contact Report', margin, y);
    y += 15;

    // Patient Info
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Patient:', margin, y);
    doc.setFont(undefined, 'normal');
    doc.text(utc.patient_name || 'N/A', margin + 30, y);
    y += 7;

    // Date & Time
    doc.setFont(undefined, 'bold');
    doc.text('Attempt Date:', margin, y);
    doc.setFont(undefined, 'normal');
    doc.text(formatDate(utc.attempt_date), margin + 35, y);
    y += 7;

    doc.setFont(undefined, 'bold');
    doc.text('Attempt Time:', margin, y);
    doc.setFont(undefined, 'normal');
    doc.text(utc.attempt_time || 'N/A', margin + 35, y);
    y += 7;

    // Location of Attempt
    doc.setFont(undefined, 'bold');
    doc.text('Location:', margin, y);
    doc.setFont(undefined, 'normal');
    doc.text(utc.attempt_location === 'other' ? utc.attempt_location_other : utc.attempt_location, margin + 30, y);
    y += 7;

    // Spoke with Anyone
    doc.setFont(undefined, 'bold');
    doc.text('Spoke with:', margin, y);
    doc.setFont(undefined, 'normal');
    doc.text(utc.spoke_with_anyone ? `Yes - ${utc.spoke_with_whom}` : 'No', margin + 35, y);
    y += 10;

    // Individual Location
    doc.setFont(undefined, 'bold');
    doc.text('Individual Location:', margin, y);
    y += 7;
    doc.setFont(undefined, 'normal');
    const locationMap = {
      admitted: 'Admitted to Medical Facility',
      moved_temporarily: 'Moved Temporarily',
      moved_permanently: 'Moved Permanently',
      vacation: 'On Vacation',
      deceased: 'Deceased',
      other: utc.individual_location_other || 'Other'
    };
    doc.text(locationMap[utc.individual_location] || utc.individual_location, margin + 5, y);
    y += 10;

    // Facility Details
    if (utc.individual_location === 'admitted' && utc.facility_name) {
      doc.setFont(undefined, 'bold');
      doc.text('Facility Name:', margin, y);
      doc.setFont(undefined, 'normal');
      doc.text(utc.facility_name, margin + 35, y);
      y += 7;

      if (utc.admission_date) {
        doc.setFont(undefined, 'bold');
        doc.text('Admission Date:', margin, y);
        doc.setFont(undefined, 'normal');
        doc.text(formatDate(utc.admission_date), margin + 40, y);
        y += 7;
      }
    }

    // Reason for visit
    if (utc.reason) {
      y += 5;
      doc.setFont(undefined, 'bold');
      doc.text('Reason for Visit:', margin, y);
      y += 7;
      doc.setFont(undefined, 'normal');
      const reasonLines = doc.splitTextToSize(utc.reason, 170);
      doc.text(reasonLines, margin + 5, y);
      y += reasonLines.length * 7;
    }

    // Footer
    y += 10;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y);

    // Save PDF
    const fileName = `UTC_${utc.patient_name?.replace(/\s+/g, '_')}_${formatDate(utc.attempt_date)}.pdf`;
    doc.save(fileName);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  if (!utc) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Unable to Contact record not found</p>
      </div>
    );
  }

  const locationMap = {
    admitted: 'Admitted to Medical Facility',
    moved_temporarily: 'Moved Temporarily',
    moved_permanently: 'Moved Permanently',
    vacation: 'On Vacation',
    deceased: 'Deceased',
    other: utc.individual_location_other || 'Other'
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold text-slate-900">Unable to Contact Details</h1>
          </div>
          <Button
            onClick={generatePDF}
            className="bg-eggplant-700 hover:bg-eggplant-600"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>

        {/* UTC Info Card */}
        <Card className="bg-white border-slate-100 mb-6">
          <CardHeader className="bg-amber-50 border-b border-amber-100">
            <CardTitle className="text-xl flex items-center gap-2">
              <PhoneOff className="w-6 h-6 text-amber-600" />
              Unable to Contact Record
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-500 flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4" />
                  Attempt Date
                </label>
                <p className="text-lg font-semibold text-slate-900">
                  {formatDate(utc.attempt_date)}
                </p>
              </div>
              <div>
                <label className="text-sm text-slate-500 flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4" />
                  Attempt Time
                </label>
                <p className="text-lg font-semibold text-slate-900">
                  {utc.attempt_time}
                </p>
              </div>
            </div>

            {/* Location of Attempt */}
            <div>
              <label className="text-sm text-slate-500 flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4" />
                Location of Attempt
              </label>
              <p className="text-slate-900">
                {utc.attempt_location === 'other' ? utc.attempt_location_other : utc.attempt_location}
              </p>
            </div>

            {/* Spoke with Anyone */}
            <div>
              <label className="text-sm text-slate-500 flex items-center gap-2 mb-1">
                <User className="w-4 h-4" />
                Spoke with Anyone?
              </label>
              <p className="text-slate-900">
                {utc.spoke_with_anyone ? `Yes - ${utc.spoke_with_whom}` : 'No'}
              </p>
            </div>

            {/* Individual Location */}
            <div className="pt-4 border-t border-slate-100">
              <label className="text-sm text-slate-500 mb-2 block font-medium">
                Where is the individual?
              </label>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-lg font-semibold text-amber-900">
                  {locationMap[utc.individual_location] || utc.individual_location}
                </p>
              </div>
            </div>

            {/* Facility Details (if admitted) */}
            {utc.individual_location === 'admitted' && (utc.facility_name || utc.admission_date) && (
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-slate-900">Medical Facility Details</h3>
                {utc.facility_name && (
                  <div>
                    <label className="text-sm text-slate-500">Facility Name</label>
                    <p className="text-slate-900">{utc.facility_name}</p>
                  </div>
                )}
                {(utc.facility_city || utc.facility_state) && (
                  <div>
                    <label className="text-sm text-slate-500">Location</label>
                    <p className="text-slate-900">
                      {utc.facility_city}{utc.facility_city && utc.facility_state ? ', ' : ''}{utc.facility_state}
                    </p>
                  </div>
                )}
                {utc.admission_date && (
                  <div>
                    <label className="text-sm text-slate-500">Admission Date</label>
                    <p className="text-slate-900">{formatDate(utc.admission_date)}</p>
                  </div>
                )}
                {utc.admission_reason && (
                  <div>
                    <label className="text-sm text-slate-500">Reason for Admission</label>
                    <p className="text-slate-900">{utc.admission_reason}</p>
                  </div>
                )}
              </div>
            )}

            {/* Expected Return Date */}
            {utc.expected_return_date && (
              <div>
                <label className="text-sm text-slate-500">Expected Return Date</label>
                <p className="text-slate-900 font-medium">{formatDate(utc.expected_return_date)}</p>
              </div>
            )}

            {/* Additional Information */}
            {utc.additional_info && (
              <div>
                <label className="text-sm text-slate-500">Additional Information</label>
                <p className="text-slate-900 whitespace-pre-wrap bg-slate-50 p-3 rounded">
                  {utc.additional_info}
                </p>
              </div>
            )}

            {/* Record Date */}
            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400">
                Record created: {formatDate(utc.created_at)}
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
