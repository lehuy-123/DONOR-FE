import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import DonorView from './views/DonorView';
import HospitalDashboard from './views/HospitalDashboard';

function App() {
  return (
    <div className="min-h-screen bg-rose-50/30 flex flex-col font-sans text-slate-800 selection:bg-rose-200 selection:text-rose-900">
      {/* Navbar with Glassmorphism */}
      <nav className="bg-white/70 backdrop-blur-lg sticky top-0 z-50 border-b border-rose-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-rose-600 shadow-lg shadow-rose-200 flex items-center justify-center text-white font-black text-xl">
                🩸
              </div>
              <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-red-500 text-2xl tracking-tight leading-none">
                Chẻ em
              </span>
            </div>
            <div className="flex space-x-2 h-full py-4">
              <NavLink
                to="/"
                className={({ isActive }) => `px-4 py-2 rounded-full text-sm font-bold uppercase transition-all duration-300 ${isActive ? 'bg-rose-100 text-rose-700 shadow-inner' : 'text-slate-500 hover:bg-rose-50 hover:text-rose-600'}`}
              >
                Khách Hiến
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
        {/* Background decorative blobs */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-rose-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none"></div>
        <div className="absolute top-0 right-10 w-72 h-72 bg-red-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000 pointer-events-none"></div>

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
