'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layers, AlertTriangle, CheckCircle2, ArrowRight, ArrowLeft, KeyRound, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SignupPage() {
  const router = useRouter();

  // Step state: 'form' | 'otp' | 'success'
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form');

  // Input states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Status/Validation states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (step === 'success') {
      const timer = setTimeout(() => {
        router.push('/login');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [step, router]);

  // Request verification code (Step 1)
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setErrorMsg('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    setErrorMsg(null);
    setIsPending(true);

    try {
      // Sign up the user via Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role: 'USER'
          }
        }
      });

      if (error) {
        setErrorMsg(error.message || 'Failed to sign up.');
      } else {
        // If the email confirmation is disabled in Supabase, data.session will be returned immediately
        if (data?.session) {
          setStep('success');
        } else {
          // Go to OTP step (Supabase sends verification email automatically)
          setStep('otp');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to communicate with authorization server.');
    } finally {
      setIsPending(false);
    }
  };


  const handleGoogleSignUp = async () => {
    setIsPending(true);
    setErrorMsg(null);
    try {
      const { error: oAuthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/login`,
        },
      });
      if (oAuthError) {
        setErrorMsg(oAuthError.message);
        setIsPending(false);
      }
    } catch (err) {
      setErrorMsg('Something went wrong. Please try again.');
      setIsPending(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4">
      {/* Brand logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-4">
          <Layers className="w-6 h-6 text-white" />
        </div>
        <h2 className="font-extrabold text-2xl tracking-tight text-white">Create your WealthOS Account</h2>
        <p className="text-gray-500 text-xs mt-1">Begin tracking your unified portfolio</p>
      </div>

      {/* Signup Card */}
      <div className="glass-panel border border-white/5 p-8 rounded-2xl shadow-2xl relative overflow-hidden bg-black/35 backdrop-blur-md">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl" />

        {step === 'success' ? (
          <div className="flex flex-col items-center py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white text-base">Account Verified & Created!</h3>
            <p className="text-gray-400 text-xs">Redirecting you to the login screen...</p>
          </div>
        ) : (
          <>
            {errorMsg && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 text-rose-400 text-xs mb-4">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{errorMsg}</p>
              </div>
            )}

            {step === 'form' ? (
              // Step 1 Form
              <>
                <form onSubmit={handleSendOtp} className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full glass-input px-3.5 py-2.5 rounded-xl text-white placeholder-gray-600"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full glass-input px-3.5 py-2.5 rounded-xl text-white placeholder-gray-600"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full glass-input px-3.5 py-2.5 rounded-xl text-white placeholder-gray-600"
                      required
                    />
                    <p className="text-[10px] text-gray-500 mt-1 leading-normal">
                      Must be at least 8 characters.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full glass-btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 text-white"
                  >
                    {isPending ? 'Sending Verification Link...' : 'Send Verification Link'}
                    {!isPending && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>

                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/5"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
                    <span className="bg-[#030308] px-2 text-gray-500">Or continue with</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignUp}
                  disabled={isPending}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white font-bold transition-all text-xs cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                  </svg>
                  Sign Up with Google
                </button>

                <div className="mt-6 text-center text-xs text-gray-500">
                  Already have an account?{' '}
                  <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline">
                    Sign In
                  </Link>
                </div>
              </>
            ) : (
              // Step 2: Show check your email confirmation link message
              <div className="flex flex-col items-center py-4 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Mail className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="font-bold text-white text-base">Check your email inbox</h3>
                <p className="text-gray-400 text-xs leading-relaxed max-w-xs">
                  We sent a confirmation link to <strong className="text-indigo-300">{email}</strong>. 
                  Please check your inbox and click the verification link inside to activate your account.
                </p>
                <div className="pt-4 flex gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('form');
                      setErrorMsg(null);
                    }}
                    className="w-1/3 py-3 rounded-xl border border-white/10 text-gray-400 font-bold hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-1 bg-transparent cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <Link 
                    href="/login" 
                    className="w-2/3 glass-btn-primary py-3 rounded-xl font-bold text-center text-white flex items-center justify-center gap-1.5"
                  >
                    Go to Sign In <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
