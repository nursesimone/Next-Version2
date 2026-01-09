import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Stethoscope, Mail, Lock, User, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    license_number: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Add default title if not provided
      const registrationData = {
        ...formData,
        title: 'RN' // Default title
      };
      await register(registrationData);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="register-page">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md animate-fade-in">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-eggplant-700 rounded-xl flex items-center justify-center">
              <Stethoscope className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">POSH-Able Living</h1>
              <p className="text-sm text-slate-500">Home Nurse Visit Management</p>
            </div>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
              <CardDescription>Join POSH-Able Living to manage your patient visits</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="full_name"
                      name="full_name"
                      type="text"
                      placeholder="Jane Smith, RN"
                      value={formData.full_name}
                      onChange={handleChange}
                      className="pl-10 h-11"
                      required
                      data-testid="register-name-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="nurse@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      className="pl-10 h-11"
                      required
                      data-testid="register-email-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="license_number">License Number (Optional)</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="license_number"
                      name="license_number"
                      type="text"
                      placeholder="RN-123456"
                      value={formData.license_number}
                      onChange={handleChange}
                      className="pl-10 h-11"
                      data-testid="register-license-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Create a secure password"
                      value={formData.password}
                      onChange={handleChange}
                      className="pl-10 h-11"
                      required
                      minLength={6}
                      data-testid="register-password-input"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 bg-eggplant-700 hover:bg-eggplant-600"
                  disabled={loading}
                  data-testid="register-submit-btn"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-600">
                Already have an account?{' '}
                <Link to="/login" className="text-eggplant-700 font-medium hover:underline" data-testid="login-link">
                  Sign in
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right side - Hero Image */}
      <div 
        className="hidden lg:flex flex-1 relative bg-cover bg-center login-hero-overlay"
        style={{ backgroundImage: 'url(https://images.pexels.com/photos/7852543/pexels-photo-7852543.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)' }}
      >
        <div className="login-hero-content flex flex-col items-center justify-center w-full text-white p-12">
          <h2 className="text-4xl font-bold mb-4 text-center">Join Our Community<br />of Care Providers</h2>
          <p className="text-lg text-eggplant-100 text-center max-w-md">
            Create your account to start documenting patient visits with professional-grade assessment tools.
          </p>
        </div>
      </div>
    </div>
  );
}
