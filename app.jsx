import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Clock, 
  Lock, 
  Unlock, 
  DollarSign, 
  UploadCloud, 
  ShieldCheck, 
  Wallet,
  Calendar,
  AlertCircle,
  Hammer,
  User,
  Briefcase,
  LogIn,
  Building2,
  ArrowRight,
  Zap,
  Bot,
  Globe,
  BarChart3,
  Key,
  Mail,
  UserPlus,
  LogOut,
  LockKeyhole
} from 'lucide-react';

// Import Firebase Web SDKs (V9+)
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  signInWithCustomToken,
  signInAnonymously
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  updateDoc 
} from 'firebase/firestore';

// Retrieve configuration injected by the collaborative environment or default to placeholder
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "demo-api-key",
      authDomain: "demo-project.firebaseapp.com",
      projectId: "demo-project",
      storageBucket: "demo-project.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:1234:web:1234"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'tranchepay-production-v1';

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('signin'); // 'signin', 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Application Roles and Settings
  const [role, setRole] = useState('payer'); // 'payer' (Investor) or 'receiver' (Founder)
  const [industry, setIndustry] = useState('vc'); // 'vc' or 'construction'
  
  // Isolated Project Data State
  const [project, setProject] = useState(null);
  const [tranches, setTranches] = useState([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedTranche, setSelectedTranche] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle, processing, success
  const [paymentMethod, setPaymentMethod] = useState('usdc'); // usdc, wire, iban
  const [activeAdvice, setActiveAdvice] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        }
      } catch (err) {
        console.warn("Custom token authentication failed, falling back to session-based listener:", err);
      }
    };
    initAuth();

    // Listen to Auth State Changes
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      setAuthLoading(false);
      if (!usr) {
        // Clear secure states on logout
        setProject(null);
        setTranches([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Secure Profile Setup & Real-time State listener
    // RULE 1: Strict User Isolation Path /artifacts/{appId}/users/{userId}/...
    const profileDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'config');
    const unsubscribeProfile = onSnapshot(profileDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRole(data.role || 'payer');
        setIndustry(data.industry || 'vc');
      } else {
        // Create initial default configuration if first time logging in
        setDoc(profileDocRef, { role, industry });
      }
    }, (err) => console.error("Profile listen blocked or failed:", err));

    // Listen and sync Isolated Projects
    const projectDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'projects', 'main');
    const unsubscribeProject = onSnapshot(projectDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setProject(docSnap.data());
      } else {
        // Seed default template matching selected industry to create immediate value
        const initialProj = industry === 'vc' 
          ? { company: "KilimoTech Agro Ltd", name: "AI Soil Analysis Expansion", totalValue: 50000, disbursed: 10000 }
          : { company: "BuildIt Solutions Ltd", name: "Luxury Office Fit-out", totalValue: 75000, disbursed: 15000 };
        setDoc(projectDocRef, initialProj);
      }
    }, (err) => console.error("Unauthorized access to project document prevented:", err));

    // Listen and sync Isolated Milestones (Tranches)
    const tranchesColRef = collection(db, 'artifacts', appId, 'users', user.uid, 'tranches');
    const unsubscribeTranches = onSnapshot(tranchesColRef, (querySnap) => {
      if (!querySnap.empty) {
        const items = [];
        querySnap.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() });
        });
        // Rule 2: Sort safely in memory to prevent complex index errors
        items.sort((a, b) => Number(a.id) - Number(b.id));
        setTranches(items);
      } else {
        // Seed initial templates safely on first user authentication
        const defaultTranches = industry === 'vc' ? [
          { id: "1", title: "Initial Setup & Incorporation", amount: 10000, status: "disbursed", deadline: "2026-04-01", health: "healthy" },
          { id: "2", title: "MVP Development", amount: 15000, status: "pending_submission", deadline: "2026-06-30", health: "at_risk" },
          { id: "3", title: "Market Scale-up", amount: 25000, status: "locked", deadline: "2026-12-31", health: "healthy" }
        ] : [
          { id: "1", title: "Deposit & Mobilization", amount: 15000, status: "disbursed", deadline: "2026-04-01", health: "healthy" },
          { id: "2", title: "Structural Framework", amount: 30000, status: "pending_submission", deadline: "2026-05-15", health: "critical" },
          { id: "3", title: "Finishing & Handover", amount: 30000, status: "locked", deadline: "2026-07-20", health: "healthy" }
        ];

        defaultTranches.forEach(item => {
          setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tranches', item.id), {
            title: item.title,
            amount: item.amount,
            status: item.status,
            deadline: item.deadline,
            health: item.health
          });
        });
      }
    }, (err) => console.error("Access restriction applied safely to query results:", err));

    // Dynamic AI Co-Pilot logic matching current active state
    if (industry === 'vc') {
      setActiveAdvice({
        title: "Risk Detected: Milestone 2",
        message: "Current evidence submission lag is 12% higher than similar AgTech projects. Founder may need support on certification documentation.",
        action: "Provide Regulatory Checklist"
      });
    } else {
      setActiveAdvice({
        title: "Critical: Supply Chain Stall",
        message: "Steel prices in your region have spiked 15%. This milestone is at risk of exceeding the budget. Release partial funds for material lock-in?",
        action: "Initiate Early Material Payout"
      });
    }

    return () => {
      unsubscribeProfile();
      unsubscribeProject();
      unsubscribeTranches();
    };
  }, [user, industry]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (authMode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        
        // Save initial user profile
        const profileDocRef = doc(db, 'artifacts', appId, 'users', newUser.uid, 'profile', 'config');
        await setDoc(profileDocRef, { role, industry });
      }
    } catch (err) {
      setAuthError(err.message.replace("Firebase:", ""));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAction = (t) => {
    if (role === 'receiver' && t.status === 'pending_submission') {
      // Receiver submits proof
      const trancheDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'tranches', t.id);
      updateDoc(trancheDocRef, { status: 'reviewing' });
    } else if (role === 'payer' && t.status === 'reviewing') {
      setSelectedTranche(t);
      setIsPaymentModalOpen(true);
    }
  };

  const processPayment = async () => {
    setPaymentStatus('processing');
    
    setTimeout(async () => {
      try {
        // Complete current tranche
        const currentTrancheRef = doc(db, 'artifacts', appId, 'users', user.uid, 'tranches', selectedTranche.id);
        await updateDoc(currentTrancheRef, { status: 'disbursed', dateDisbursed: 'Today', health: 'healthy' });

        // Unlock next milestone sequentially
        const nextId = (Number(selectedTranche.id) + 1).toString();
        const nextTrancheRef = doc(db, 'artifacts', appId, 'users', user.uid, 'tranches', nextId);
        const nextSnap = await getDoc(nextTrancheRef);
        if (nextSnap.exists()) {
          await updateDoc(nextTrancheRef, { status: 'pending_submission' });
        }

        // Update total disbursed aggregates
        const projectDocRef = doc(db, 'artifacts', appId, 'users', user.uid, 'projects', 'main');
        await updateDoc(projectDocRef, {
          disbursed: project.disbursed + selectedTranche.amount
        });

        setPaymentStatus('success');
        setTimeout(() => {
          setIsPaymentModalOpen(false);
          setPaymentStatus('idle');
        }, 1200);

      } catch (err) {
        console.error("Payment execution error:", err);
        setPaymentStatus('idle');
      }
    }, 2000);
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-6 font-sans selection:bg-emerald-500/30">
        <div className="mb-12 text-center">
          <div className="flex items-center justify-center gap-3 font-black text-5xl text-emerald-500 mb-3 tracking-tighter">
            <ShieldCheck className="w-12 h-12" /> TranchePay
          </div>
          <p className="text-emerald-500/60 font-bold tracking-[0.2em] uppercase text-[10px]">Secure Institutional Trust Architecture</p>
        </div>

        <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl shadow-emerald-500/10 border border-white/10 overflow-hidden">
          {authMode === 'signup' && (
            <div className="flex border-b border-slate-100">
              <button onClick={() => setIndustry('vc')} className={`flex-1 py-5 text-xs font-black transition-all flex items-center justify-center gap-2 ${industry === 'vc' ? 'text-emerald-600 bg-emerald-50/50' : 'text-slate-400'}`}>
                <Briefcase className="w-4 h-4" /> VENTURE
              </button>
              <button onClick={() => setIndustry('construction')} className={`flex-1 py-5 text-xs font-black transition-all flex items-center justify-center gap-2 ${industry === 'construction' ? 'text-emerald-600 bg-emerald-50/50' : 'text-slate-400'}`}>
                <Hammer className="w-4 h-4" /> CONSTRUCTION
              </button>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="p-10">
            <h2 className="text-2xl font-black text-slate-800 mb-2">
              {authMode === 'signin' ? 'Portal Sign In' : 'Register Account'}
            </h2>
            <p className="text-slate-400 text-sm mb-8">
              {authMode === 'signin' ? 'Verify your identity to unlock sandbox vaults.' : 'Create isolated sandbox instance.'}
            </p>

            {authError && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 text-xs font-bold rounded-2xl flex items-center gap-2 border border-red-100">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}
            
            <div className="space-y-5">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Select Your Role</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button type="button" onClick={() => setRole('receiver')} className={`p-4 rounded-2xl border-2 text-sm font-bold flex flex-col items-center gap-2 transition-all ${role === 'receiver' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-100 text-slate-400'}`}>
                      <User className="w-5 h-5" /> {industry === 'vc' ? 'Founder' : 'Contractor'}
                    </button>
                    <button type="button" onClick={() => setRole('payer')} className={`p-4 rounded-2xl border-2 text-sm font-bold flex flex-col items-center gap-2 transition-all ${role === 'payer' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-100 text-slate-400'}`}>
                      <Briefcase className="w-5 h-5" /> {industry === 'vc' ? 'Investor' : 'Client'}
                    </button>
                  </div>
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-4 top-4 text-slate-400 w-5 h-5" />
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Institutional Email" 
                  className="w-full p-4 pl-12 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm font-semibold" 
                />
              </div>

              <div className="relative">
                <Key className="absolute left-4 top-4 text-slate-400 w-5 h-5" />
                <input 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Master Security Password" 
                  className="w-full p-4 pl-12 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm font-semibold" 
                />
              </div>

              <button className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3">
                {authLoading ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5" /> 
                    {authMode === 'signin' ? 'AUTHORIZE PORTAL' : 'CREATE INSTANCE'}
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="bg-slate-50 p-6 border-t border-slate-100 text-center">
            <button 
              onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
              className="text-xs font-black text-emerald-600 uppercase tracking-widest hover:underline"
            >
              {authMode === 'signin' ? 'Create new secure account' : 'Already have an account? Sign In'}
            </button>
          </div>
        </div>
        <p className="mt-8 text-slate-500 text-xs font-bold uppercase tracking-widest">© 2026 TranchePay. All rights reserved.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-500/20">
      <nav className="bg-white border-b sticky top-0 z-40 px-8 py-4 flex justify-between items-center shadow-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 font-black text-2xl text-emerald-600 tracking-tighter leading-none">
            <ShieldCheck className="w-8 h-8" /> TranchePay
          </div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] ml-10 mt-1">
            Scaling Investments of Tomorrow
          </span>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-full border border-slate-100 text-slate-500 text-xs font-bold">
            <LockKeyhole className="w-4 h-4 text-emerald-500" />
            <span className="text-slate-400 font-semibold">Security UID:</span> 
            {/* Displaying raw full UID for exact tenant discovery */}
            <span className="font-mono text-slate-700 bg-white border px-2 py-0.5 rounded text-[10px]">
              {user.uid}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
            <Zap className="w-4 h-4 text-emerald-500 fill-emerald-500" />
            <span className="text-xs font-black text-slate-600 tracking-tight uppercase">Isolated Session</span>
          </div>

          <button onClick={handleSignOut} className="text-slate-400 hover:text-red-500 transition-colors flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </nav>

      {}
      <main className="flex-grow max-w-5xl mx-auto mt-10 px-6 w-full grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
        
        {/* Left 2 Columns: Project & Tranches */}
        <div className="lg:col-span-2 space-y-8">
          {project ? (
            <div className="bg-white rounded-[2rem] p-10 shadow-sm border border-slate-200">
              <h1 className="text-4xl font-black text-slate-900 mb-2">{project.company}</h1>
              <div className="flex items-center gap-2 text-emerald-600 font-black text-xs bg-emerald-50 px-4 py-1.5 rounded-full w-fit uppercase tracking-wider mb-8">
                <Building2 className="w-3.5 h-3.5" /> {project.name}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Committed</p>
                  <p className="text-xl font-black">${project.totalValue.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl">
                  <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Total Disbursed</p>
                  <p className="text-xl font-black text-emerald-700">${project.disbursed.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl col-span-2 md:col-span-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Settlement Speed</p>
                  <p className="text-xl font-black text-slate-700">~ 2.4 Seconds</p>
                </div>
              </div>

              <div className="relative">
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-2">
                  <span>Deployment Progress</span>
                  <span className="text-emerald-600">{Math.round((project.disbursed/project.totalValue)*100)}% Verified</span>
                </div>
                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden p-1 border border-slate-200/50">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out" style={{width: `${(project.disbursed/project.totalValue)*100}%`}} />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] p-10 shadow-sm border border-slate-200 animate-pulse h-64" />
          )}

          {}
          <div className="space-y-4">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Active Funding Milestones
            </h2>
            {tranches.length > 0 ? (
              tranches.map((t) => (
                <div key={t.id} className={`group bg-white border-2 rounded-3xl p-6 transition-all ${t.status === 'disbursed' ? 'border-emerald-50 bg-slate-50/20 opacity-70' : 'border-slate-100 shadow-sm'}`}>
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                    <div className="flex gap-5 items-start">
                      <div className={`p-4 rounded-2xl ${t.status === 'disbursed' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {t.status === 'disbursed' ? <CheckCircle /> : industry === 'vc' ? <DollarSign /> : <Hammer />}
                      </div>
                      <div>
                        <h3 className="font-black text-xl text-slate-800 leading-tight">Tranche {t.id}: {t.title}</h3>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-sm font-bold text-slate-400 flex items-center gap-1.5 uppercase">
                            <Calendar className="w-4 h-4" /> {new Date(t.deadline).toLocaleDateString()}
                          </span>
                          <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${t.health === 'healthy' ? 'bg-emerald-50 text-emerald-600' : t.health === 'at_risk' ? 'bg-amber-50 text-amber-600 animate-pulse' : 'bg-red-50 text-red-600 underline'}`}>
                            {t.health.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-center sm:text-right min-w-[140px]">
                      <p className="text-2xl font-black text-slate-900 mb-2">${t.amount.toLocaleString()}</p>
                      <button 
                        onClick={() => handleAction(t)}
                        disabled={t.status === 'locked' || t.status === 'disbursed'}
                        className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                          ${t.status === 'pending_submission' ? 'bg-emerald-600 text-white hover:scale-105' : 
                            t.status === 'reviewing' ? 'bg-amber-500 text-white' : 
                            t.status === 'disbursed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-300'}
                        `}
                      >
                        {t.status === 'pending_submission' ? (role === 'receiver' ? 'Submit Assets' : 'Verify') :
                         t.status === 'reviewing' ? (role === 'payer' ? 'Approve' : 'Syncing') : t.status}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-3xl p-6 border border-slate-200 h-32 animate-pulse" />
            )}
          </div>
        </div>

        {}
        <div className="space-y-8">
          {/* AI Co-Pilot Panel */}
          <div className="bg-slate-900 text-white rounded-[2rem] p-8 shadow-xl shadow-emerald-900/10 border border-emerald-500/20 overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Bot size={80} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase tracking-widest mb-6">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                Predictive De-risking Engine
              </div>
              <h4 className="text-xl font-black mb-3">{activeAdvice?.title}</h4>
              <p className="text-slate-400 text-sm leading-relaxed mb-8">
                {activeAdvice?.message}
              </p>
              <button className="w-full py-4 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
                {activeAdvice?.action}
              </button>
            </div>
          </div>

          {/* Performance Ledger Summary */}
          <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Performance Score</h4>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-4xl font-black text-slate-900">882</span>
              <span className="text-emerald-500 font-bold mb-1">/ 1000</span>
            </div>
            <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
              Based on historical milestone reliability across {industry === 'vc' ? '3 venture rounds' : '2 industrial projects'}.
            </p>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-400">Reliability Rate</span>
                <span className="text-slate-800">94.2%</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-400">Avg. Delay Offset</span>
                <span className="text-emerald-600">-1.2 Days</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {}
      <footer className="py-20 px-8 text-center bg-slate-50 border-t border-slate-200">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-2 text-emerald-600 font-black text-xl mb-2">
            <ShieldCheck /> TranchePay
          </div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">
            Scaling Investments of Tomorrow
          </p>
          <p className="text-slate-400 text-[9px] font-bold opacity-60">
            © 2026 TRANCHEPAY GLOBAL. ALL RIGHTS RESERVED.
          </p>
        </div>
      </footer>

      {/* Institutional Settlement Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl scale-in-center overflow-hidden">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3 text-emerald-600 font-black text-xl">
                <Globe className="w-6 h-6" /> GLOBAL SETTLEMENT
              </div>
              <div className="text-xs font-black text-slate-400">SESSION ID: #{Math.floor(Math.random()*1000000)}</div>
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-8">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-black text-slate-400 uppercase">Settlement Asset</span>
                <span className="text-xs font-black text-emerald-600 uppercase">Verified Progress Check Passed</span>
              </div>
              <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200">
                <div className="bg-blue-600 text-white p-2 rounded-full">
                  <DollarSign size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-slate-900">USDC Stablecoin</p>
                  <p className="text-[10px] text-slate-400 font-bold">Near-Instant Cross-Border Settlement</p>
                </div>
                <p className="text-lg font-black text-slate-900">${selectedTranche?.amount.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-10">
              <button onClick={() => setPaymentMethod('usdc')} className={`p-4 rounded-2xl border-2 text-[10px] font-black transition-all ${paymentMethod === 'usdc' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-100 text-slate-400'}`}>USDC</button>
              <button onClick={() => setPaymentMethod('wire')} className={`p-4 rounded-2xl border-2 text-[10px] font-black transition-all ${paymentMethod === 'wire' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-100 text-slate-400'}`}>SWIFT</button>
              <button onClick={() => setPaymentMethod('iban')} className={`p-4 rounded-2xl border-2 text-[10px] font-black transition-all ${paymentMethod === 'iban' ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-100 text-slate-400'}`}>IBAN</button>
            </div>
            
            {paymentStatus === 'idle' ? (
              <div className="flex flex-col gap-4">
                <button onClick={processPayment} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-3">
                  Authorize Institutional Payout <ArrowRight className="w-5 h-5" />
                </button>
                <button onClick={() => setIsPaymentModalOpen(false)} className="w-full py-3 font-black text-slate-300 text-[10px] tracking-widest hover:text-slate-500 transition-colors">CANCEL SETTLEMENT</button>
              </div>
            ) : (
              <div className="py-10 text-center">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                <p className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] animate-pulse">Syncing with Liquidity Rails...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Custom animations
const style = document.createElement('style');
style.textContent = `
  @keyframes scale-in-center {
    0% { transform: scale(0.9); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  .scale-in-center {
    animation: scale-in-center 0.3s cubic-bezier(0.250, 0.460, 0.450, 0.940) both;
  }
`;
document.head.append(style);
