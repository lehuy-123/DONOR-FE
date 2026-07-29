import React, { useState, useEffect, useMemo, useRef } from 'react';
import { scanDonors } from '../utils/scanner';
import { generateMockData } from '../utils/firestore';
import { io } from "socket.io-client";

// Khởi tạo Socket.io client kết nối tới Node.js Backend
const socket = io("https://donor-be.onrender.com");
const HOSPITALS = [
  { id: 'choray', name: 'Bệnh Viện Chợ Rẫy', lat: 10.7583, lng: 106.6570, color: 'from-blue-700 to-blue-900' },
  { id: 'nd115', name: 'Nhân Dân 115', lat: 10.7758, lng: 106.6666, color: 'from-emerald-700 to-emerald-900' },
  { id: 'giadinh', name: 'Nhân Dân Gia Định', lat: 10.8062, lng: 106.6917, color: 'from-rose-800 to-rose-900' }
];

const HospitalDashboard = () => {
  const [hospitalUser, setHospitalUser] = useState(() => {
    const saved = localStorage.getItem('active_hospital');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (hospitalUser) {
      localStorage.setItem('active_hospital', JSON.stringify(hospitalUser));
    } else {
      localStorage.removeItem('active_hospital');
    }
  }, [hospitalUser]);

  const DEFAULT_INVENTORY = {
    'choray': [
      { type: 'O+', qty: 150 }, { type: 'O-', qty: 35 },
      { type: 'A+', qty: 90 }, { type: 'A-', qty: 15 },
      { type: 'B+', qty: 85 }, { type: 'B-', qty: 10 },
      { type: 'AB+', qty: 50 }, { type: 'AB-', qty: 8 },
    ],
    'nd115': [
      { type: 'O+', qty: 45 }, { type: 'O-', qty: 5 },
      { type: 'A+', qty: 20 }, { type: 'A-', qty: 2 },
      { type: 'B+', qty: 35 }, { type: 'B-', qty: 8 },
      { type: 'AB+', qty: 15 }, { type: 'AB-', qty: 1 },
    ],
    'giadinh': [
      { type: 'O+', qty: 85 }, { type: 'O-', qty: 15 },
      { type: 'A+', qty: 60 }, { type: 'A-', qty: 5 },
      { type: 'B+', qty: 70 }, { type: 'B-', qty: 12 },
      { type: 'AB+', qty: 40 }, { type: 'AB-', qty: 2 },
    ]
  };

  const [inventories, setInventories] = useState(() => {
    const saved = localStorage.getItem('hospital_inventories');
    return saved ? JSON.parse(saved) : DEFAULT_INVENTORY;
  });

  const inventory = hospitalUser ? inventories[hospitalUser.id] : [];

  const updateInventory = (type, amount) => {
    if (!hospitalUser) return;
    setInventories(prev => {
      const currentHospInv = prev[hospitalUser.id];
      const updatedHospInv = currentHospInv.map(item => {
        if (item.type === type) return { ...item, qty: Math.max(0, item.qty + amount) };
        return item;
      });
      const newState = { ...prev, [hospitalUser.id]: updatedHospInv };
      localStorage.setItem('hospital_inventories', JSON.stringify(newState));
      return newState;
    });
  };

  const [bloodType, setBloodType] = useState('O+');
  const [radius, setRadius] = useState(15);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [donors, setDonors] = useState([]);
  const [scanned, setScanned] = useState(false);
  const [sortBy, setSortBy] = useState('distance');
  const [filterBy, setFilterBy] = useState('all');

  const processedDonors = useMemo(() => {
    let result = [...donors];

    // Filtering
    if (filterBy === 'reliable') {
      result = result.filter(d => (d.donationCount || 0) >= 3);
    }

    // Sorting
    if (sortBy === 'distance') {
      result.sort((a, b) => a.distance - b.distance);
    } else if (sortBy === 'donations') {
      result.sort((a, b) => (b.donationCount || 0) - (a.donationCount || 0));
    } else if (sortBy === 'status') {
      result.sort((a, b) => {
        const aActive = a.fcmToken || a.isMock === undefined ? 1 : 0;
        const bActive = b.fcmToken || b.isMock === undefined ? 1 : 0;
        return bActive - aActive;
      });
    }
    return result;
  }, [donors, filterBy, sortBy]);

  // Modal State
  const [selectedDonor, setSelectedDonor] = useState(null);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [inVideoCall, setInVideoCall] = useState(false);
  const fileInputRef = useRef(null);
  const [inboxUsers, setInboxUsers] = useState([]);
  const [showInbox, setShowInbox] = useState(false);

  // Lắng nghe toàn bộ users để gom Hộp Thư
  // Lấy dữ liệu 1 lần lúc vào trang (API cần quét toàn bộ user để lấy history, trong dự án thật sẽ có 1 api /inbox riêng)
  const fetchInbox = async () => {
     if(!hospitalUser) return;
     try {
       const res = await fetch(`https://donor-be.onrender.com/api/users/scan?bloodType=all`);
       const data = await res.json();
       const usersWithChats = [];
       (data.donors || []).forEach(userData => {
          if (userData.chats && userData.chats.some(m => m.hospitalId === hospitalUser.id)) {
            usersWithChats.push(userData);
          }
       });
       usersWithChats.sort((a, b) => {
          const lastA = a.chats.filter(m => m.hospitalId === hospitalUser.id).pop();
          const lastB = b.chats.filter(m => m.hospitalId === hospitalUser.id).pop();
          if(!lastA) return 1; if(!lastB) return -1;
          return new Date(lastB.time) - new Date(lastA.time);
       });
       setInboxUsers(usersWithChats);
     } catch(e) {}
  };

  useEffect(() => {
    fetchInbox();
  }, [hospitalUser]);

  // Lắng nghe tin nhắn Socket.io
  useEffect(() => {
    if (!hospitalUser) return;
    
    socket.emit('join-hospital', hospitalUser.id);
    
    const messageListener = ({ userId, msg }) => {
        // Cập nhật messages nếu đang chat với userId này
        if (selectedDonor && selectedDonor.id === userId) {
            setMessages(prev => [...prev, msg]);
        }
        // Cập nhật lại inbox (Reload nôm na cho nhanh)
        fetchInbox();
    };

    socket.on('receive-message', messageListener);
    return () => socket.off('receive-message', messageListener);
  }, [hospitalUser, selectedDonor]);

  // Nạp lịch sử từ Backend mỗi khi mở Profile Modal
  useEffect(() => {
     if (!selectedDonor) return;
     fetch(`https://donor-be.onrender.com/api/users/${selectedDonor.id}/chats`)
        .then(res => res.json())
        .then(data => setMessages(data.chats || []))
        .catch(e => console.error(e));
  }, [selectedDonor]);

  const handleGenerateMock = async () => {
    if (!window.confirm("Bơm 30 dữ liệu ảo nằm rải rác vào Database?")) return;
    setGenerating(true);
    try {
      await generateMockData();
      alert("Đã bơm 30 vệ tinh ảo xung quanh bệnh viện.");
    } catch (e) { } finally { setGenerating(false); }
  };

  const handleQuickScan = (type) => {
    setBloodType(type);
    handleScanForce(type);
  };

  const handleScanForce = async (overrideType) => {
    setLoading(true); setScanned(false);

    // Add artificial delay for the radar UX effect
    await new Promise(r => setTimeout(r, 2500));

    // TRUYỀN PARAMETER hospitalUser VÀO HÀM SCAN ĐỂ SO SÁNH KHOẢNG CÁCH TỪ ĐÚNG BỆNH VIỆN ĐÓ!
    const results = await scanDonors(overrideType || bloodType, parseFloat(radius), hospitalUser);
    setDonors(results || []);
    setScanned(true); setLoading(false);
  };

  const [selectedInventory, setSelectedInventory] = useState(null);
  const [inventoryDonors, setInventoryDonors] = useState([]);

  const handleViewInventoryDetail = async (item) => {
    setSelectedInventory(item);
    setInventoryDonors([]); // loading state
    // Scan bán kính 9999km để lấy TOÀN BỘ sinh viên/người hiến máu trên hệ thống thuộc nhóm này
    const results = await scanDonors(item.type, 99999, hospitalUser);
    setInventoryDonors(results || []);
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || !selectedDonor) return;

    const text = chatMessage;
    setChatMessage("");
    await fetch(`https://donor-be.onrender.com/api/users/${selectedDonor.id}/chats`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ text, sender: hospitalUser.name, hospitalId: hospitalUser.id })
    });
  };

  const handleSendImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      await fetch(`https://donor-be.onrender.com/api/users/${selectedDonor.id}/chats`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ text: "📷 Hình ảnh Y khoa đính kèm", sender: hospitalUser.name, hospitalId: hospitalUser.id, image: event.target.result })
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendPush = async (donor) => {
    if(!donor.pushSubscription) {
       alert("Người dùng chưa cấp quyền Push Notification qua Node Push!");
       return;
    }
    if(!window.confirm(`Phát lệnh báo động khẩn cấp tới thiết bị của ${donor.name}?`)) return;
    
    try {
      const res = await fetch("https://donor-be.onrender.com/api/emergency/push", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            userId: donor.id,
            bloodType: donor.bloodType,
            hospitalName: hospitalUser.name,
            hospitalId: hospitalUser.id
         })
      });
      const data = await res.json();
      if (data.success) {
         alert("Đã bắn Lệnh Khẩn Cấp Bằng Node.js Web-Push!");
      }
    } catch (e) {
      alert("Đã xảy ra lỗi khi gửi API.");
    }
  };

  const renderBloodBag = (item) => {
    const isCrit = item.qty < 10;
    const isWarn = item.qty >= 10 && item.qty <= 25;
    const heightPercent = item.qty > 100 ? 100 : item.qty;
    return (
      <div key={item.type} className={`relative p-5 rounded-3xl border flex flex-col justify-between transition-all bg-white overflow-hidden shadow-sm hover:shadow-lg
            ${isCrit ? 'border-red-400' : isWarn ? 'border-orange-300' : 'border-slate-200'}`}>

        <div className="z-10 flex justify-between items-start mb-4">
          <div className="flex flex-col">
            <h3 className={`text-4xl font-black ${isCrit ? 'text-red-700' : 'text-slate-800'}`}>{item.type}</h3>
            <span className={`text-[10px] uppercase font-bold tracking-widest mt-1 ${isCrit ? 'text-red-500' : isWarn ? 'text-orange-500' : 'text-emerald-500'}`}>
              {isCrit ? 'KHẨN CẤP' : isWarn ? 'CẢNH BÁO' : 'AN TOÀN'}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button onClick={() => updateInventory(item.type, 5)} className="w-8 h-8 rounded-full bg-slate-50 border hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 text-slate-400 flex items-center justify-center font-bold transition-colors">+</button>
            <div className={`px-2 py-1 rounded-xl text-sm font-black shadow-inner border w-16 text-center ${isCrit ? 'bg-red-600 text-white border-red-700 animate-pulse' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {item.qty} L
            </div>
            <button onClick={() => updateInventory(item.type, -5)} className="w-8 h-8 rounded-full bg-slate-50 border hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-400 flex items-center justify-center font-bold transition-colors">-</button>
          </div>
        </div>

        <div className="relative w-full h-28 bg-slate-100 rounded-xl overflow-hidden shadow-inner border border-slate-200 isolate mt-2">
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <button onClick={() => handleViewInventoryDetail(item)} className={`px-5 py-2 rounded-xl backdrop-blur-md shadow-xl border text-[10px] font-black uppercase transition-all hover:scale-105 active:scale-95 bg-white/95 text-blue-600 border-blue-200 ${item.qty < 20 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              📋 TRUY XUẤT NGUỒN
            </button>
          </div>
          <div
            className={`absolute bottom-0 left-0 w-full transition-all duration-1000 ease-out bg-gradient-to-t 
                    ${isCrit ? 'from-red-700 to-red-500' : isWarn ? 'from-orange-500 to-orange-400' : 'from-rose-500 to-rose-400'}`}
            style={{ height: `${heightPercent}%` }}
          >
            <div className="absolute top-0 w-full h-3 bg-white/20"></div>
          </div>
        </div>
      </div>
    )
  };

  // MÀN HÌNH CHỌN BỆNH VIỆN NẾU CHƯA ĐĂNG NHẬP
  if (!hospitalUser) {
    return (
      <div className="max-w-4xl mx-auto py-10 animate-in zoom-in-95 duration-500">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-slate-800">Cổng Điện Tử Liên Viện</h2>
          <p className="text-slate-500 font-medium">Bảo mật cấp quốc gia. Chọn cơ sở để truy cập hệ thống radar.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {HOSPITALS.map(h => (
            <div key={h.id} className="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 text-center hover:-translate-y-2 transition-transform duration-300">
              <div className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-br ${h.color} flex items-center justify-center text-3xl mb-4 shadow-lg`}>
                🏥
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">{h.name}</h3>
              <p className="text-xs text-slate-500 font-mono mb-6 border border-slate-100 bg-slate-50 py-1 rounded-xl">📍 {h.lat} , {h.lng}</p>
              <button onClick={() => setHospitalUser(h)} className={`w-full py-4 rounded-2xl text-white font-bold tracking-widest bg-gradient-to-r ${h.color} shadow-lg active:scale-95 transition-transform uppercase text-sm`}>
                Đăng Nhập
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // MÀN HÌNH DASHBOARD BỆNH VIỆN
  return (
    <div className="space-y-8 pb-20">

      {/* KHỐI 1: TỦ QUẢN LÝ TỒN KHO */}
      <section className="bg-white/90 backdrop-blur-3xl rounded-3xl shadow-xl shadow-rose-900/5 border border-white overflow-hidden">

        {/* HEADER CHIẾN LƯỢC */}
        <div className={`bg-gradient-to-br ${hospitalUser.color} p-6 flex flex-col lg:flex-row gap-6`}>
          {/* Hospital Info & Stats */}
          <div className="flex-1 flex flex-col justify-between text-white">
            <div>
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-black bg-clip-text flex items-center gap-4">
                  <span className="text-4xl shadow-2xl rounded-2xl bg-white/10 p-3 backdrop-blur-sm border border-white/20">🏥</span>
                  <div>
                    {hospitalUser.name}
                    <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-300 mt-1.5 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      Trung tâm điều phối khẩn cấp
                    </div>
                  </div>
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <div className="bg-white/10 p-3 rounded-2xl border border-white/20 backdrop-blur text-center">
                  <div className="text-[9px] uppercase font-bold text-white/70 tracking-widest mb-1">Tổng Dự Trữ</div>
                  <div className="text-2xl font-black">{inventory.reduce((a, b) => a + b.qty, 0)}<span className="text-sm">L</span></div>
                </div>
                <div className="bg-black/20 p-3 rounded-2xl border border-rose-400/30 backdrop-blur text-center relative overflow-hidden">
                  <div className="text-[9px] uppercase font-bold text-rose-200 tracking-widest mb-1">Mức Khẩn Cấp</div>
                  <div className="text-2xl font-black text-rose-400">{inventory.filter(i => i.qty < 10).length} <span className="text-sm">Kho</span></div>
                  {inventory.filter(i => i.qty < 10).length > 0 && <div className="absolute top-0 right-0 w-8 h-full bg-rose-500/20 skew-x-12 animate-pulse"></div>}
                </div>
                <div className="bg-white/10 p-3 rounded-2xl border border-orange-400/30 backdrop-blur text-center">
                  <div className="text-[9px] uppercase font-bold text-orange-200 tracking-widest mb-1">Đang Cảnh Báo</div>
                  <div className="text-2xl font-black text-orange-300">{inventory.filter(i => i.qty >= 10 && i.qty <= 25).length} <span className="text-sm">Kho</span></div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleGenerateMock} disabled={generating} className="bg-black/20 hover:bg-black/40 text-white/90 active:scale-95 text-[10px] font-bold px-4 py-3 rounded-xl transition-all shadow-inner border border-white/10 text-center uppercase tracking-widest">
                {generating ? 'Đang tạo...' : '💉 Giả Lập Data'}
              </button>
              <button onClick={() => { setHospitalUser(null); setScanned(false); setDonors([]); }} className="bg-white text-rose-600 hover:bg-rose-50 font-black px-6 py-3 rounded-xl text-sm transition-all shadow-xl flex-1 border-b-4 border-slate-200 uppercase tracking-widest flex items-center justify-center gap-2">
                Đăng Xuất Cơ Sở <span className="text-lg leading-none">🚪</span>
              </button>
            </div>
          </div>

          {/* Minimap Gốc */}
          <div className="w-full lg:w-5/12 bg-white/5 rounded-3xl border border-white/20 overflow-hidden relative shadow-inner p-1.5 h-64 lg:h-auto min-h-[220px]">
            <div className="w-full h-full rounded-[1.25rem] overflow-hidden relative isolate">
              <iframe
                title="Hospital Map" width="100%" height="100%" frameBorder="0" style={{ border: 0, filter: 'opacity(0.85) contrast(1.2)' }}
                src={`https://maps.google.com/maps?q=${hospitalUser.lat},${hospitalUser.lng}&z=16&output=embed`}
              />
              <div className="absolute bottom-2 left-2 right-2 bg-slate-900/80 backdrop-blur border border-slate-700 shadow-2xl rounded-xl p-2.5 flex items-center justify-between text-white">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mb-0.5"> Radar</p>
                  <p className="text-xs font-mono font-bold tracking-tight">{hospitalUser.lat}, {hospitalUser.lng}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
                  <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LAYOUT CHIA ĐÔI MÀN HÌNH CHÍNH */}
      <div className="flex flex-col xl:flex-row gap-6 items-start">

        {/* BÊN TRÁI: KHO MÁU (w-1/2) */}
        <div className="w-full xl:w-[45%] flex flex-col">
          <div className="bg-white/60 p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-white relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <span className="text-rose-500">🩸</span> Phân Bổ Tồn Kho
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-2 gap-4 group relative z-10">
              {inventory.map(renderBloodBag)}
            </div>
          </div>
        </div>

        {/* BÊN PHẢI: RADAR & BỆNH NHÂN (w-1/2) */}
        <div className="w-full xl:w-[55%] flex flex-col gap-6">

          {/* KHỐI 2: RADAR CONTROL */}
          <section className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-xl shadow-slate-200/50 border border-white p-8">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <div className="flex-1 space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lọc Nhóm Máu</label>
                <select value={bloodType} onChange={(e) => setBloodType(e.target.value)} className="w-full bg-slate-50 border-0 ring-1 ring-slate-200 text-slate-700 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none">
                  <option value="O+">O (+)</option><option value="O-">O (-)</option>
                  <option value="A+">A (+)</option><option value="A-">A (-)</option>
                  <option value="B+">B (+)</option><option value="B-">B (-)</option>
                  <option value="AB+">AB (+)</option><option value="AB-">AB (-)</option>
                </select>
              </div>

              <div className="flex-1 space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bán kính quét</label>
                <div className="relative flex items-center">
                  <input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} className="w-full bg-slate-50 border-0 ring-1 ring-slate-200 text-slate-700 rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none" />
                  <span className="absolute right-4 text-xs font-bold text-slate-400">KM</span>
                </div>
              </div>

              <button onClick={() => handleScanForce()} disabled={loading} className={`w-full md:w-auto px-8 py-3.5 rounded-xl text-xs font-black tracking-widest uppercase transition-all shadow-lg text-white h-[48px]
                    ${loading ? 'bg-blue-400' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-blue-500/30 hover:-translate-y-0.5 active:scale-95'}`}>
                {loading ? 'Đang...' : '📡 QUÉT'}
              </button>
            </div>
          </section>

          {/* KHỐI 3: DANH SÁCH KẾT QUẢ RADAR */}
          {loading ? (
            <section className="bg-rose-50/80 backdrop-blur-xl rounded-3xl border-2 border-white p-6 shadow-xl shadow-rose-200/50 h-[500px] flex flex-col items-center justify-center relative overflow-hidden isolate animate-in zoom-in-95 duration-500">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-rose-50/50 to-rose-100 z-0 opacity-80"></div>

              {/* Vòng Radar CSS Mềm Mại */}
              <div className="relative w-64 h-64 mb-4 rounded-full border border-rose-200 flex items-center justify-center z-10 shadow-[0_0_80px_rgba(244,63,94,0.1)]">
                <div className="absolute w-full h-full rounded-full border border-rose-200 bg-rose-500/5"></div>
                <div className="absolute w-[75%] h-[75%] rounded-full border border-rose-200 bg-rose-500/5"></div>
                <div className="absolute w-[50%] h-[50%] rounded-full border border-rose-300 bg-rose-500/10"></div>
                <div className="absolute w-[25%] h-[25%] rounded-full border border-rose-400 bg-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.3)] backdrop-blur-sm flex items-center justify-center z-20">
                  <span className="text-xl animate-pulse drop-shadow-md">❤️</span>
                </div>

                {/* Tia quét */}
                <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,_transparent_70%,_rgba(244,63,94,0.25)_100%)] animate-[spin_1.5s_linear_infinite] z-10"></div>

                <div className="absolute top-[20%] right-[30%] w-2 h-2 rounded-full bg-rose-400 animate-ping shadow-[0_0_10px_#f43f5e]"></div>
                <div className="absolute bottom-[30%] left-[20%] w-1.5 h-1.5 rounded-full bg-rose-300 animate-ping shadow-[0_0_8px_#f43f5e]" style={{ animationDelay: '0.5s' }}></div>
                <div className="absolute top-[50%] left-[15%] w-2 h-2 rounded-full bg-rose-400 animate-ping shadow-[0_0_10px_#f43f5e]" style={{ animationDelay: '1.2s' }}></div>
              </div>

              <div className="z-10 mt-6 text-center bg-white/80 backdrop-blur-md px-6 py-4 rounded-3xl border border-rose-100 shadow-sm min-w-[250px]">
                <h3 className="text-rose-600 font-extrabold tracking-widest uppercase text-[11px] mb-2">Đang quét vệ tinh {bloodType}...</h3>
                <div className="flex justify-between text-slate-500 text-[9px] font-mono font-bold mt-3">
                  <p>BÁN KÍNH: {radius} KM</p>
                  <p>TÂM ĐIỂM HOẠT ĐỘNG</p>
                </div>
                <div className="w-full bg-rose-100 h-1.5 mt-2 rounded-full overflow-hidden">
                  <div className="bg-rose-500 h-full w-full origin-left opacity-80" style={{ animation: 'progress 2.5s linear infinite' }}></div>
                </div>
              </div>
            </section>
          ) : scanned ? (
            <section className="bg-slate-50/80 rounded-3xl border border-white p-6 shadow-inner animate-in slide-in-from-bottom-8 fade-in duration-700 h-[500px] overflow-y-auto custom-scrollbar">
              <div className="sticky top-0 bg-slate-50/90 backdrop-blur-md pb-4 z-20">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">
                    Lọc được <span className="text-rose-600 font-black px-2 mx-1 bg-white shadow-sm border rounded-lg">{processedDonors.length}</span> vệ tinh
                  </h3>
                  <button className="text-[10px] bg-white px-3 py-1.5 border rounded-full shadow-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 font-bold uppercase transition-all tracking-wider">
                    Gọi Tất Cả
                  </button>
                </div>
                <div className="flex gap-2">
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 shadow-sm flex-1 cursor-pointer">
                    <option value="distance">📍 Ưu tiên: Gần nhất (Mặc định)</option>
                    <option value="donations">⭐ Số lần hiến (cao-thấp)</option>
                    <option value="status">🟢 Đang online </option>
                  </select>
                  <select value={filterBy} onChange={e => setFilterBy(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 shadow-sm flex-1 cursor-pointer">
                    <option value="all">⚡ Thể trạng: Toàn bộ danh sách</option>
                    <option value="reliable">🛡️ Thể trạng: Chuyên gia (≥ 3 lần)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {processedDonors.map((donor) => {
                  const isOnline = donor.pushSubscription || donor.isOnline;
                  return (
                    <div key={donor.id} onClick={() => setSelectedDonor(donor)} className="group bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer relative flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 border-2 border-white shadow-sm rounded-full flex justify-center items-center font-black text-slate-700 text-base">
                          {donor.bloodType}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">{donor.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 rounded-md">⭐ Đã hiến {donor.donationCount || 0}</span>
                            <span className="text-[10px] text-rose-500 font-bold bg-rose-50 px-2 rounded-md">📍 {donor.distance} km</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg">
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
                          <span className={`text-[9px] uppercase tracking-widest font-bold ${isOnline ? 'text-emerald-700' : 'text-slate-500'}`}>{isOnline ? 'ON' : 'OFF'}</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all shadow-sm">
                          💬
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ) : (
            <section className="bg-slate-50/50 rounded-3xl border border-white p-6 shadow-inner h-[650px] flex flex-col items-center justify-center opacity-60">
              <span className="text-6xl mb-6 grayscale opacity-30 animate-bounce">📡</span>
              <h3 className="font-black text-xl text-slate-400">TRẠNG THÁI CHỜ</h3>
              <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mt-2">Vui lòng thiết lập tham số khởi động</p>
            </section>
          )}
        </div>
      </div>

      {/* MODAL CHI TIẾT VÀ CHAT */}
      {selectedDonor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl max-h-screen overflow-hidden rounded-[2rem] shadow-2xl flex flex-col md:flex-row relative animate-in zoom-in-95 duration-300">

            {/* Nut tat */}
            <button onClick={() => setSelectedDonor(null)} className="absolute top-4 right-4 z-50 w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold">X</button>

            {/* Left: Info */}
            <div className="w-full md:w-5/12 bg-slate-50 p-8 border-r border-slate-200 flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-slate-700 to-slate-900 shadow-xl shadow-slate-500/30 rounded-full border-4 border-white flex justify-center items-center font-black text-white text-3xl mb-4">
                {selectedDonor.bloodType}
              </div>
              <h2 className="text-2xl font-black text-slate-800">{selectedDonor.name}</h2>
              <p className="text-sm font-medium text-slate-500 mb-6">{selectedDonor.email}</p>

              <div className="w-full space-y-3 mt-4 text-left">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">SĐT</span>
                  <span className="font-bold text-slate-800">{selectedDonor.phone}</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Khoảng cách</span>
                  <span className="font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md">{selectedDonor.distance} KM</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lịch sử hiến</span>
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">{selectedDonor.donationCount || 0} lần</span>
                </div>
              </div>

              {/* BẢN ĐỒ MINI XÁC KHẢO VỊ TRÍ VỆ TINH */}
              {selectedDonor.location && (
                <div className="w-full mt-4 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-md relative h-32 group animate-in zoom-in-95 duration-700">
                  <iframe
                    width="100%" height="100%" frameBorder="0" style={{ border: 0, filter: 'contrast(1.1)' }}
                    src={`https://maps.google.com/maps?q=${selectedDonor.location.lat},${selectedDonor.location.lng}&z=15&output=embed`}
                  />
                  <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md shadow-lg">
                    Tọa độ Vệ tinh
                  </div>
                </div>
              )}

              <button onClick={() => handleSendPush(selectedDonor)} className="w-full mt-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black py-4 rounded-xl shadow-lg shadow-red-500/30 transition-all active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                <span className="text-xl animate-pulse">🚨</span> PHÁT LỆNH CỨU VIỆN (PUSH)
              </button>
            </div>

            {/* Right: Trực Tôn Chat */}
            <div className="w-full md:w-7/12 bg-white flex flex-col h-[500px] md:h-auto">
              <div className="px-6 py-4 border-b border-slate-100 shadow-sm z-10 flex items-center justify-between">
                <div className="flex gap-3 items-center">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">💬</div>
                  <div>
                    <h4 className="font-bold text-slate-800 leading-tight">Liên hệ khẩn cấp</h4>
                    <p className="text-[10px] uppercase font-bold text-emerald-500 tracking-widest">Giao thức bảo mật với {hospitalUser.name}</p>
                  </div>
                </div>
                <button onClick={() => setInVideoCall(!inVideoCall)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-md active:scale-95 flex items-center gap-2 ${inVideoCall ? 'bg-rose-500 text-white' : 'bg-slate-800 text-white hover:bg-black'}`}>
                   {inVideoCall ? 'ĐÓNG KẾT NỐI' : '📞 GỌI KHẨN CẤP'}
                </button>
              </div>

              {/* Chat box */}
              {inVideoCall ? (
                 <div className="flex-1 bg-slate-900 overflow-hidden relative">
                     <iframe 
                        allow="camera; microphone; fullscreen; display-capture; autoplay"
                        src={`https://meet.jit.si/bloodconnect_${selectedDonor.id}_${hospitalUser.id}`}
                        style={{ height: '100%', width: '100%', border: 0 }}
                     ></iframe>
                  </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                  <div className="w-full text-center text-xs text-slate-400 font-medium mb-8">Cuộc hội thoại được mã hóa</div>

                  {messages.filter(m => m.hospitalId === hospitalUser.id).length === 0 ? (
                    <div className="text-sm font-medium text-slate-400 text-center py-10">Chưa có tin nhắn nào. Bắt đầu phiên liên lạc 2 chiều ngay!</div>
                  ) : (
                    messages.filter(m => m.hospitalId === hospitalUser.id).map((m, idx) => (
                      <div key={idx} className={`w-full flex ${m.sender !== 'donor' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm font-medium ${m.sender !== 'donor' ? 'bg-blue-600 text-white rounded-tr-sm shadow-md' : 'bg-white border text-slate-700 rounded-tl-sm shadow-sm'
                          }`}>
                          {m.sender !== 'donor' && <div className="text-[9px] text-blue-200 mb-0.5">{m.sender}</div>}
                          {m.text}
                          {m.image && <img src={m.image} alt="Đính kèm" className="mt-2 rounded-xl border border-white/20 w-full object-cover max-h-64 shadow-md bg-black/10" />}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Chat Input */}
              <div className="p-4 border-t border-slate-100 bg-white">
                <form onSubmit={handleSendChat} className="flex gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-slate-100 hover:bg-slate-200 text-slate-600 w-12 flex items-center justify-center rounded-xl transition-all shadow-inner active:scale-95 text-xl cursor-pointer">
                    📷
                  </button>
                  <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleSendImage} />
                  <input type="text" value={chatMessage} onChange={e => setChatMessage(e.target.value)} placeholder="Nhập yêu cầu khẩn cấp tới Vệ tinh..." className="flex-1 bg-slate-100 border-0 text-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium" />
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white p-3 rounded-xl shadow-md font-bold transition-all px-6">GỬI</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHI TIẾT NGUỒN KHO MÁU */}
      {selectedInventory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-[2rem] shadow-2xl flex flex-col relative animate-in zoom-in-95 duration-300">
            <button onClick={() => setSelectedInventory(null)} className="absolute top-4 right-4 z-50 w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold">X</button>

            <div className="p-8 border-b border-slate-100 bg-slate-50 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600 to-rose-800 border-4 border-white shadow-lg flex items-center justify-center text-white font-black text-2xl">
                {selectedInventory.type}
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800">Kho lưu trữ {selectedInventory.type}</h2>
                <p className="text-sm font-medium text-slate-500">Toàn bộ danh sách người đóng góp (Dự kiến: {selectedInventory.qty} Lít)</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              {inventoryDonors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <span className="w-8 h-8 rounded-full border-4 border-slate-300 border-t-slate-800 animate-spin mb-4"></span>
                  <p className="font-bold text-slate-500">Đang quét truy xuất nguồn gốc vệ tinh...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inventoryDonors.map(donor => (
                    <div key={donor.id} className="bg-white border border-slate-100 p-4 rounded-2xl flex justify-between items-center hover:shadow-md transition-shadow group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-lg font-black text-slate-600">👤</div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-base">{donor.name}</h4>
                          <p className="text-xs font-medium text-slate-500 flex items-center gap-2">
                            <span>📍 {donor.distance} km</span>
                            <span>•</span>
                            <span className="text-emerald-600 font-bold">Đã hiến: {donor.donationCount || 0} lần</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="bg-red-50 text-red-600 font-black text-xs px-2 py-1 rounded-md">
                          🩸 1 LÍT
                        </div>
                        <button onClick={() => { setSelectedInventory(null); setSelectedDonor(donor); }} className="text-[10px] font-bold bg-slate-800 text-white px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          GỌI KHẨN CẤP
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* NÚT INBOX GÓC PHẢI DƯỚI */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
        {showInbox && (
          <div className="bg-white w-[90vw] sm:w-80 md:w-96 rounded-3xl shadow-2xl border border-slate-100 mb-4 overflow-hidden animate-in fade-in slide-in-from-bottom-5">
            <div className="p-5 bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-between border-b-4 border-rose-500">
              <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                <span className="text-2xl drop-shadow-md">📥</span> INBOX BỆNH VIỆN
              </h3>
              <button onClick={() => setShowInbox(false)} className="text-slate-400 hover:text-white font-bold text-2xl leading-none">×</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto bg-slate-50">
              {inboxUsers.length === 0 ? (
                <div className="p-8 text-center text-sm font-medium text-slate-400">
                  <span className="text-4xl opacity-50 block mb-2">📭</span>
                  Chưa có tin nhắn khẩn cấp nào từ các Vệ tinh.
                </div>
              ) : (
                inboxUsers.map(u => {
                  const myMessages = u.chats.filter(m => m.hospitalId === hospitalUser.id);
                  const lastMessage = myMessages[myMessages.length - 1];
                  return (
                    <div key={u.id} onClick={() => { setSelectedDonor(u); setShowInbox(false); }} className="p-4 border-b border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full border-2 border-slate-100 shadow-sm flex items-center justify-center font-black text-rose-600 bg-rose-50 min-w-[3rem] text-lg">
                        👤
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="font-bold text-sm text-slate-800 truncate">{u.name || (u.id.substring(0,8).toUpperCase())}</h4>
                        </div>
                        <p className={`text-xs font-medium truncate ${lastMessage?.sender === 'donor' ? 'text-slate-800 font-bold' : 'text-slate-500'}`}>
                          {lastMessage?.sender === 'donor' ? 'Khách: ' : 'Bạn: '}
                          {lastMessage?.image ? '[Hình Ảnh]' : lastMessage?.text || "..."}
                        </p>
                      </div>
                      <div className="bg-rose-500 text-white text-[9px] font-black px-2 py-1 h-5 rounded-full flex items-center justify-center shadow-md">
                        {myMessages.length} tin
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
        
        <button onClick={() => setShowInbox(!showInbox)} className="w-16 h-16 bg-gradient-to-tr from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white rounded-full shadow-2xl flex items-center justify-center text-2xl transition-all active:scale-95 hover:-translate-y-1 border-4 border-white relative z-50">
          💬
          {inboxUsers.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-emerald-500 border-2 border-white text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full animate-bounce shadow-md">
              {inboxUsers.length}
            </span>
          )}
        </button>
      </div>

    </div>
  );
};

export default HospitalDashboard;
