import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import DonorView from './views/DonorView';
import HospitalDashboard from './views/HospitalDashboard';

function App() {
  return (
    <div className="min-h-screen bg-rose-50 flex flex-col font-sans text-slate-800 selection:bg-rose-200 selection:text-rose-900 relative">
      
      {/* THAY ĐỔI BACKGROUND SANG DẠNG LƯỚI TẾ BÀO (HEXAGON) VÀ ÁNH SÁNG MỀM */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-rose-50/80"></div>
      
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.85] filter contrast-125 saturate-[1.2]" 
           style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/hexellence.png')` }}>
      </div>
      
      {/* Hiệu ứng ánh sáng nền mềm mại (Soft Mesh Gradient) */}
      <div className="fixed top-[-20%] left-[-10%] w-[70%] h-[70%] bg-gradient-to-br from-rose-200/60 to-transparent rounded-full mix-blend-multiply filter blur-[100px] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-gradient-to-tl from-rose-200/40 to-transparent rounded-full mix-blend-multiply filter blur-[100px] pointer-events-none z-0"></div>

      {/* Navbar with Glassmorphism */}
      <nav className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 border-b border-rose-100/50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <img src="/logo2.jpg" alt="BloodBridge Logo" className="h-14 sm:h-16 object-contain mix-blend-multiply" />
            </div>
            <div className="flex space-x-2 h-full py-5">
              <NavLink
                to="/"
                className={({ isActive }) => `px-4 py-2 rounded-full text-sm font-bold uppercase transition-all duration-300 ${isActive ? 'bg-rose-100 text-rose-700 shadow-inner' : 'text-slate-500 hover:bg-rose-50 hover:text-rose-600'}`}
              >
                DONOR
              </NavLink>
              <NavLink
                to="/hospital"
                className={({ isActive }) => `px-4 py-2 rounded-full text-sm font-bold uppercase transition-all duration-300 ${isActive ? 'bg-rose-100 text-rose-700 shadow-inner' : 'text-slate-500 hover:bg-rose-50 hover:text-rose-600'}`}
              >
                Bệnh Viện (Admin)
              </NavLink>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-10 relative">
        <div className="relative z-10 w-full">
          <Routes>
            <Route path="/" element={<DonorView />} />
            <Route path="/hospital" element={<HospitalDashboard />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
