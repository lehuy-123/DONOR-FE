import React, { useState, useEffect, useMemo, useRef } from 'react';
import { scanDonors } from '../utils/scanner';
import { generateMockData } from '../utils/firestore';
import { io } from "socket.io-client";

// Khởi tạo Socket.io client kết nối tới Node.js Backend
const socket = io("https://donor-be.onrender.com");
const HOSPITALS = [
  { id: 'choray', name: 'Bệnh Viện Chợ Rẫy', lat: 10.7583, lng: 106.6570, color: 'from-blue-700 to-blue-900', avatar: '/bvchoray.png', isLogo: true },
  { id: 'nd115', name: 'Nhân Dân 115', lat: 10.7758, lng: 106.6666, color: 'from-emerald-700 to-emerald-900', avatar: '/bv115.png', isLogo: true },
  { id: 'giadinh', name: 'Nhân Dân Gia Định', lat: 10.8062, lng: 106.6917, color: 'from-rose-800 to-rose-900', avatar: '/bvgiadinh.jpg' }
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

  // --- BROADCAST STATE ---
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState("ALL");
  const [broadcasts, setBroadcasts] = useState([]);
  const [selectedResponder, setSelectedResponder] = useState(null);

  useEffect(() => {
    fetch(`https://donor-be.onrender.com/api/broadcasts`)
      .then(res => res.json())
      .then(data => data.broadcasts && setBroadcasts(data.broadcasts.filter(b => b.hospitalId === hospitalUser?.id)))
      .catch(e => console.error(e));

    socket.on('broadcast-update', (updated) => {
      setBroadcasts(prev => prev.map(b => b.id === updated.id ? { ...b, responders: updated.responders } : b));
    });
    return () => socket.off('broadcast-update');
  }, [hospitalUser]);

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return alert("Vui lòng nhập nội dung phát khẩn!");
    const bloodTypes = broadcastTarget === 'ALL' ? ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] : [broadcastTarget];

    if (!window.confirm(`Xác nhận phát bảng tin khẩn cấp tới TOÀN LÃNH THỔ cho nhóm máu: ${broadcastTarget}?`)) return;

    try {
      const res = await fetch(`https://donor-be.onrender.com/api/broadcasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId: hospitalUser.id,
          hospitalName: hospitalUser.name,
          bloodTypes, message: broadcastMsg
        })
      });
      const data = await res.json();
      if (data.success) {
        setBroadcasts([data.broadcast, ...broadcasts]);
        setBroadcastMsg("");
        alert("Đã kết nối và phát lệnh Toàn Tuyến thành công!");
      }
    } catch (e) { alert("Lỗi khi phát lệnh khẩn cấp!") }
  };

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
  const [filterMode, setFilterMode] = useState('distance');

  const processedDonors = useMemo(() => {
    let result = [...donors];

    // Lọc theo thời gian hiến máu >= 3 tháng
    if (filterMode === 'eligible') {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      result = result.filter(d => {
        if (!d.lastDonationDate) return true; 
        return new Date(d.lastDonationDate) <= threeMonthsAgo;
      });
    }

    // Luôn ưu tiên sắp xếp theo khoảng cách (Khoảng cách mặc định)
    result.sort((a, b) => (parseFloat(a.distance) || 0) - (parseFloat(b.distance) || 0));

    return result;
  }, [donors, filterMode]);

  // Modal State
  const [selectedDonor, setSelectedDonor] = useState(null);
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [inVideoCall, setInVideoCall] = useState(false);
  const fileInputRef = useRef(null);
  const [inboxUsers, setInboxUsers] = useState([]);
  const [showInbox, setShowInbox] = useState(false);
  const [donorAddress, setDonorAddress] = useState("Đang phân tích định vị không gian...");
  const [emergencyResponders, setEmergencyResponders] = useState([]);

  // Lắng nghe toàn bộ users để gom Hộp Thư
  // Lấy dữ liệu 1 lần lúc vào trang (API cần quét toàn bộ user để lấy history, trong dự án thật sẽ có 1 api /inbox riêng)
  const fetchInbox = async () => {
    if (!hospitalUser) return;
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
        if (!lastA) return 1; if (!lastB) return -1;
        return new Date(lastB.time) - new Date(lastA.time);
      });
      setInboxUsers(usersWithChats);
    } catch (e) { }
  };

  useEffect(() => {
    fetchInbox();
  }, [hospitalUser]);

  useEffect(() => {
    if (!hospitalUser) return;
    fetch(`https://donor-be.onrender.com/api/emergency-missions?hospitalId=${hospitalUser.id}`)
      .then(res => res.json())
      .then(data => {
         if (data.missions) {
            // Tính toán distance cho từng mission ngay khi tải
            const initMissions = data.missions.map(m => {
                if (m.user?.location?.lat && hospitalUser?.lat && !m.user.distance) {
                    const r = 6371; const p = Math.PI / 180;
                    const a = 0.5 - Math.cos((m.user.location.lat - hospitalUser.lat) * p) / 2 +
                      Math.cos(hospitalUser.lat * p) * Math.cos(m.user.location.lat * p) *
                      (1 - Math.cos((m.user.location.lng - hospitalUser.lng) * p)) / 2;
                    const km = 2 * r * Math.asin(Math.sqrt(a));
                    m.user.distance = km.toFixed(1);
                }
                return m;
            });
            setEmergencyResponders(initMissions);
         }
      })
      .catch(e => console.log(e));
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

    const emergencyResponseListener = (payload) => {
        if (payload.isCompleted) {
           setEmergencyResponders(prev => prev.filter(p => p.id !== payload.id));
           return;
        }

        // Tự động tính toán khoảng cách từ tọa độ của người hiến tới Bệnh viện
        if (payload.user?.location?.lat && hospitalUser?.lat && !payload.user.distance) {
            const r = 6371; const p = Math.PI / 180;
            const a = 0.5 - Math.cos((payload.user.location.lat - hospitalUser.lat) * p) / 2 +
              Math.cos(hospitalUser.lat * p) * Math.cos(payload.user.location.lat * p) *
              (1 - Math.cos((payload.user.location.lng - hospitalUser.lng) * p)) / 2;
            const km = 2 * r * Math.asin(Math.sqrt(a));
            payload.user.distance = km.toFixed(1);
        }

        setEmergencyResponders(prev => {
           // Dùng id của logic mission mới thay vì payload.user.id
           const filtered = prev.filter(p => p.id !== payload.id);
           return [payload, ...filtered];
        });
    };

    socket.on('receive-message', messageListener);
    socket.on('emergency-mission-update', emergencyResponseListener);
    return () => {
        socket.off('receive-message', messageListener);
        socket.off('emergency-mission-update', emergencyResponseListener);
    };
  }, [hospitalUser, selectedDonor]);

  // Nạp lịch sử từ Backend mỗi khi mở Profile Modal
  useEffect(() => {
    if (!selectedDonor) return;
    fetch(`https://donor-be.onrender.com/api/users/${selectedDonor.id}/chats`)
      .then(res => res.json())
      .then(data => setMessages(data.chats || []))
      .catch(e => console.error(e));

    // Phân tích ngược tọa độ thành địa chỉ thật
    if (selectedDonor.location) {
      setDonorAddress("Đang phân tích định vị không gian...");
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${selectedDonor.location.lat}&lon=${selectedDonor.location.lng}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.display_name) {
            setDonorAddress(data.display_name);
          } else {
            setDonorAddress(`${selectedDonor.location.lat}, ${selectedDonor.location.lng}`);
          }
        })
        .catch(() => setDonorAddress(`${selectedDonor.location.lat}, ${selectedDonor.location.lng}`));
    }
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
    if (!donor.pushSubscription) {
      alert("Người dùng chưa cấp quyền Push Notification qua Node Push!");
      return;
    }
    if (!window.confirm(`Phát lệnh báo động khẩn cấp tới thiết bị của ${donor.name}?`)) return;

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

  const handleCallAll = async () => {
    const pushableDonors = processedDonors.filter(d => d.pushSubscription);
    if (pushableDonors.length === 0) {
      alert("Không có vệ tinh nào trong danh sách hiện tại đã cấp quyền Push Notification!");
      return;
    }

    if (!window.confirm(`Phát lệnh báo động đồng loạt tới ${pushableDonors.length} vệ tinh? Động thái này sẽ làm rung thiết bị của họ!`)) return;

    try {
      await Promise.all(pushableDonors.map(donor =>
        fetch("https://donor-be.onrender.com/api/emergency/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: donor.id,
            bloodType: donor.bloodType,
            hospitalName: hospitalUser.name,
            hospitalId: hospitalUser.id
          })
        })
      ));
      alert(`🔔 Đã hoàn tất phủ sóng tin nhắn khẩn cấp tới ${pushableDonors.length} vệ tinh!`);
    } catch (e) {
      alert("Đã xảy ra lỗi khi gửi thư tín hàng loạt.");
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
              <div className={`w-24 h-24 mx-auto rounded-full bg-gradient-to-br ${h.color} flex items-center justify-center text-3xl mb-4 shadow-lg overflow-hidden border-4 border-slate-50`}>
                {h.avatar ? (
                  <img src={h.avatar} alt={h.name} className={`w-full h-full ${h.isLogo ? 'object-contain p-3 bg-white' : 'object-cover'}`} />
                ) : (
                  <span>🏥</span>
                )}
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
                  {hospitalUser.avatar ? (
                    <img src={hospitalUser.avatar} alt="Avatar" className={`w-36 h-20 sm:w-48 sm:h-24 shadow-2xl rounded-2xl p-1.5 backdrop-blur-sm border-2 ${hospitalUser.isLogo ? 'object-contain bg-white border-white/50' : 'object-cover bg-white/10 border-white/30'}`} />
                  ) : (
                    <span className="text-5xl shadow-2xl rounded-2xl bg-white/10 p-4 backdrop-blur-sm border-2 border-white/30">🏥</span>
                  )}
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
                {generating ? 'Đang tạo...' : 'Chonthuii'}
              </button>
              <button onClick={() => { setHospitalUser(null); setScanned(false); setDonors([]); }} className="bg-white text-rose-600 hover:bg-rose-50 font-black px-6 py-3 rounded-xl text-sm transition-all shadow-xl flex-1 border-b-4 border-slate-200 uppercase tracking-widest flex items-center justify-center gap-2">
                Đăng Xuất Tài Khoản Bệnh Viện <span className="text-lg leading-none"></span>
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

        {/* BÊN TRÁI: THAO TÁC (w-1/2) */}
        <div className="w-full xl:w-[45%] flex flex-col gap-6">

          {/* BROADCAST KHẨN CẤP */}
          <div className="bg-gradient-to-br from-rose-500 to-rose-700 p-6 rounded-3xl shadow-xl shadow-rose-500/20 border border-rose-400 relative overflow-hidden isolate">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-2xl rounded-full"></div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-white animate-ping"></span> Mạng Lưới Khẩn Cấp Toàn Lãnh Thổ
            </h3>
            <div className="space-y-3 relative z-10">
              <div className="flex gap-2">
                <select value={broadcastTarget} onChange={e => setBroadcastTarget(e.target.value)} className="bg-white/20 text-white font-bold text-xs p-3 rounded-xl border border-white/30 outline-none w-1/3">
                  <option value="ALL" className="text-slate-800">CẦN TẤT CẢ (ALL)</option>
                  <option value="O+" className="text-slate-800">Chỉ mảng: O+</option>
                  <option value="O-" className="text-slate-800">Chỉ mảng: O-</option>
                  <option value="A+" className="text-slate-800">Chỉ mảng: A+</option>
                  <option value="A-" className="text-slate-800">Chỉ mảng: A-</option>
                  <option value="B+" className="text-slate-800">Chỉ mảng: B+</option>
                  <option value="B-" className="text-slate-800">Chỉ mảng: B-</option>
                  <option value="AB+" className="text-slate-800">Chỉ mảng: AB+</option>
                  <option value="AB-" className="text-slate-800">Chỉ mảng: AB-</option>
                </select>
                <input type="text" value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Nhập tóm tắt tình trạng khẩn cấp..." className="w-2/3 bg-white/20 border border-white/30 p-3 rounded-xl text-white placeholder-white/60 font-medium text-sm focus:outline-none focus:bg-white/30 transition-all" />
              </div>
              <button onClick={handleBroadcast} className="w-full bg-white text-rose-600 hover:bg-rose-50 font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-xs transition-all active:scale-95 flex justify-center items-center gap-2">
                <span className="text-xl">📡</span> BẮN TÍN HIỆU CẦU CỨU
              </button>
            </div>

            {/* Danh sách người tiếp nhận Broadcast */}
            {broadcasts.length > 0 && (
              <div className="mt-6 border-t border-white/20 pt-4 space-y-2">
                <p className="text-[10px] uppercase font-bold text-white/50 tracking-widest">Đội Ứng Cứu Đã Phản Hồi ({broadcasts[0].responders?.length || 0})</p>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                  {broadcasts[0].responders?.map((r, i) => (
                    <button key={i} onClick={() => r.status === 'Đồng Ý' && setSelectedResponder(r)} className={`w-full text-left bg-white p-2.5 rounded-xl flex items-center justify-between text-xs hover:bg-slate-50 transition-colors ${r.status !== 'Đồng Ý' && 'cursor-default'}`}>
                      <div className="font-bold text-slate-700 flex gap-2 w-full truncate"><span className="text-rose-600">[{r.bloodType}]</span> {r.name}</div>
                      {r.status === 'Đồng Ý' ? (
                        <span className="bg-emerald-100 text-emerald-600 font-bold px-2 py-1 rounded-md ml-2 shrink-0">✅ Xem Chi Tiết</span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 font-bold px-2 py-1 rounded-md ml-2 shrink-0">❌ Từ chối</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* MODAL CHI TIẾT RESPONDER FORM */}
          {selectedResponder && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white max-w-sm w-full rounded-[2rem] p-6 shadow-2xl relative animate-in zoom-in-95 duration-300 max-h-[95vh] overflow-y-auto hide-scrollbar">
                <button onClick={() => setSelectedResponder(null)} className="absolute top-4 right-4 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors">✕</button>
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mb-4 shadow-inner">
                  📋
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-1">Chi Tiết Viện Trợ</h3>
                <p className="text-xs font-bold text-emerald-600 mb-6 uppercase tracking-widest">{selectedResponder.supportType || 'Cá nhân hỗ trợ'}</p>

                {(() => {
                  let etaInfo = null;
                  if (selectedResponder.helperLat && selectedResponder.helperLng && hospitalUser?.lat && hospitalUser?.lng) {
                    const r = 6371; const p = Math.PI / 180;
                    const a = 0.5 - Math.cos((selectedResponder.helperLat - hospitalUser.lat) * p) / 2 +
                      Math.cos(hospitalUser.lat * p) * Math.cos(selectedResponder.helperLat * p) *
                      (1 - Math.cos((selectedResponder.helperLng - hospitalUser.lng) * p)) / 2;
                    const km = (2 * r * Math.asin(Math.sqrt(a))).toFixed(1);
                    etaInfo = { km, time: Math.ceil(km * 2) };
                  }
                  return (
                    <div className="space-y-4">
                      {etaInfo && (
                        <>
                          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg shadow-blue-500/30">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-blue-100 mb-1">Đang Di Chuyển</p>
                              <p className="text-xl font-black">{etaInfo.time} <span className="text-sm font-medium">phút</span></p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-black uppercase tracking-widest text-blue-100 mb-1">Khoảng Cách</p>
                              <p className="text-lg font-bold">{etaInfo.km} <span className="text-xs font-medium">KM</span></p>
                            </div>
                          </div>
                          <div className="w-full h-32 rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative isolate pointer-events-none">
                            <iframe width="100%" height="100%" frameBorder="0" style={{ border: 0, filter: 'contrast(1.2)' }} src={`https://maps.google.com/maps?q=${selectedResponder.helperLat},${selectedResponder.helperLng}&z=15&output=embed`} />
                          </div>
                        </>
                      )}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Người Xuất Phát Đi</p>
                        <p className="text-sm font-bold text-slate-800">{selectedResponder.helperName || selectedResponder.name}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Liên Lạc</p>
                          <p className="text-sm font-bold text-slate-800">{selectedResponder.helperPhone || selectedResponder.phone}</p>
                        </div>
                        <a href={`tel:${selectedResponder.helperPhone || selectedResponder.phone}`} className="w-10 h-10 bg-emerald-500 text-white rounded-xl shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all">📞</a>
                      </div>
                      <div className="bg-rose-50 text-rose-700 p-4 rounded-2xl border border-rose-100 flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-widest">Loại Máu</p>
                        <p className="text-2xl font-black">{selectedResponder.helperBloodType || selectedResponder.bloodType}</p>
                      </div>
                    </div>
                  )
                })()}

                <div className="flex gap-2 mt-6">
                  <button onClick={() => {
                    let distance = null, etaTime = null;
                    if (selectedResponder.helperLat && selectedResponder.helperLng && hospitalUser?.lat && hospitalUser?.lng) {
                      const r = 6371; const p = Math.PI / 180;
                      const a = 0.5 - Math.cos((selectedResponder.helperLat - hospitalUser.lat) * p) / 2 +
                        Math.cos(hospitalUser.lat * p) * Math.cos(selectedResponder.helperLat * p) *
                        (1 - Math.cos((selectedResponder.helperLng - hospitalUser.lng) * p)) / 2;
                      distance = (2 * r * Math.asin(Math.sqrt(a))).toFixed(1);
                      etaTime = Math.ceil(distance * 2);
                    }
                    setSelectedDonor({
                      id: selectedResponder.userId, name: selectedResponder.name,
                      phone: selectedResponder.phone, bloodType: selectedResponder.bloodType,
                      distance, etaTime,
                      location: (selectedResponder.helperLat && selectedResponder.helperLng) ? { lat: selectedResponder.helperLat, lng: selectedResponder.helperLng } : null
                    });
                    setSelectedResponder(null);
                  }} className="flex-1 bg-blue-100 text-blue-700 font-black py-4 rounded-xl shadow-sm hover:bg-blue-200 uppercase tracking-widest text-xs active:scale-95 transition-all text-center">
                    💬 NHẮN TIN
                  </button>
                  <button onClick={() => setSelectedResponder(null)} className="flex-1 bg-slate-800 text-white font-black py-4 rounded-xl shadow-lg uppercase tracking-widest text-xs active:scale-95 transition-all text-center">
                    ĐÃ XONG
                  </button>
                </div>
              </div>
            </div>
          )}

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
                  <button onClick={handleCallAll} className="text-[10px] bg-white px-3 py-1.5 border border-rose-200 rounded-full shadow-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-bold uppercase transition-all tracking-wider flex items-center gap-1 active:scale-95">
                    🚨 Gọi Tất Cả
                  </button>
                </div>
                <div className="flex gap-2">
                  <select value={filterMode} onChange={e => setFilterMode(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-600 outline-none focus:ring-1 focus:ring-blue-500 shadow-sm w-full cursor-pointer">
                    <option value="distance">📍 Ưu tiên: Khoảng cách (Mặc định)</option>
                    <option value="eligible">⏰ Đủ điều kiện: Hiến máu ≥ 3 tháng</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {emergencyResponders.length > 0 && (
                  <div className="mb-2 bg-red-50 bg-[url('https://www.transparenttextures.com/patterns/diagonal-stripes.png')] p-5 rounded-2xl border-2 border-red-200 shadow-inner">
                    <h4 className="text-red-700 font-black tracking-widest text-xs uppercase mb-3 flex items-center gap-2"><span className="animate-pulse text-lg">🚨</span> Phản Hồi Lệnh Báo Động Khẩn Cấp</h4>
                    <div className="flex flex-col gap-3">
                      {emergencyResponders.map((resp, i) => (
                        <div key={i} onClick={() => setSelectedDonor(resp.user)} className="bg-white cursor-pointer hover:border-red-300 rounded-xl p-4 shadow-sm border border-red-100 flex items-center justify-between transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-100 to-rose-200 border-2 border-white shadow-sm flex items-center justify-center font-black text-red-600">
                               {resp.user.bloodType}
                            </div>
                            <div>
                               <p className="font-bold text-slate-800 text-sm">{resp.user.name}</p>
                               <p className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">📞 {resp.user.phone}</p>
                            </div>
                          </div>
                          <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                            resp.status === 'ĐẾN NGAY' ? 'bg-red-500 text-white border-red-600 shadow-md animate-pulse' : 
                            resp.status === 'CHẤP NHẬN' ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}>
                            {resp.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
          <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2rem] shadow-2xl flex flex-col md:flex-row relative animate-in zoom-in-95 duration-300">

            {/* Nut tat */}
            <button onClick={() => setSelectedDonor(null)} className="absolute top-4 right-4 z-50 w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold">X</button>

            {/* Left: Info */}
            <div className="w-full md:w-5/12 bg-slate-50 p-4 sm:p-6 border-r border-slate-200 flex flex-col items-center text-center overflow-y-auto hide-scrollbar">
              <div className="w-24 h-24 bg-gradient-to-br from-slate-700 to-slate-900 shadow-xl shadow-slate-500/30 rounded-full border-4 border-white flex justify-center items-center font-black text-white text-3xl mb-4">
                {selectedDonor.bloodType}
              </div>
              <h2 className="text-2xl font-black text-slate-800">{selectedDonor.name}</h2>
              <p className="text-sm font-medium text-slate-500 mb-6">{selectedDonor.email}</p>

              <div className="w-full grid grid-cols-2 gap-2 mt-4 text-left">
                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">SĐT</span>
                  <span className="font-bold text-slate-800 text-xs">{selectedDonor.phone}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Khoảng cách (Lộ trình)</span>
                  <span className="font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md text-xs w-max">{selectedDonor.distance ? `~${(parseFloat(selectedDonor.distance) * 1.3).toFixed(1)} KM` : '...'}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Thời gian ETA</span>
                  <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md text-xs w-max">{selectedDonor.etaTime || (selectedDonor.distance ? Math.round(parseFloat(selectedDonor.distance) * 1.3 * 4.5) : '--')} phút</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Lịch sử hiến</span>
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md text-xs w-max">{selectedDonor.donationCount || 0} lần</span>
                </div>
                {selectedDonor.age && (
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center col-span-2 sm:col-span-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Thể Trạng</span>
                    <span className="font-bold text-slate-800 text-xs">{selectedDonor.age}t / {selectedDonor.weight}kg / {selectedDonor.height}cm</span>
                  </div>
                )}
                {selectedDonor.lastDonationDate && (
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center col-span-2 sm:col-span-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Hiến gần nhất</span>
                    <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md text-xs w-max">{new Date(selectedDonor.lastDonationDate).toLocaleDateString('vi-VN')}</span>
                  </div>
                )}
              </div>

              {/* BẢN ĐỒ MINI XÁC KHẢO VỊ TRÍ VỆ TINH VÀ LỘ TRÌNH */}
              {selectedDonor.location && (
                <div className="w-full mt-4 flex flex-col gap-2">
                  <div className="w-full rounded-2xl overflow-hidden border-2 border-slate-200 shadow-md relative h-32 group animate-in zoom-in-95 duration-700">
                    <iframe
                      width="100%" height="100%" frameBorder="0" style={{ border: 0, filter: 'contrast(1.1)' }}
                      src={`https://maps.google.com/maps?saddr=${selectedDonor.location.lat},${selectedDonor.location.lng}&daddr=${hospitalUser?.lat},${hospitalUser?.lng}&output=embed`}
                    />
                    <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md shadow-lg">
                      Lộ trình Không gian
                    </div>
                  </div>
                  <div className="bg-white border flex items-start gap-2 border-slate-200 rounded-xl p-3 shadow-sm text-left">
                    <span className="text-xl">📍</span>
                    <p className="text-[10px] font-medium text-slate-600 leading-relaxed max-h-12 overflow-y-auto custom-scrollbar pr-1">{donorAddress}</p>
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
                <button
                  onClick={async () => {
                    await fetch(`https://donor-be.onrender.com/api/users/${selectedDonor.id}/chats`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        text: `📍 ĐỘI CẤP CỨU ĐÃ MỞ ĐƯỜNG ƯU TIÊN. Chạy theo định vị sau: https://maps.google.com/?q=${hospitalUser.lat},${hospitalUser.lng}`,
                        sender: hospitalUser.name,
                        hospitalId: hospitalUser.id
                      })
                    });
                  }}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-md active:scale-95 flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700`}>
                  📍 GỬI TỌA ĐỘ BỆNH VIỆN
                </button>
              </div>

              {/* Chat box */}
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
                          <h4 className="font-bold text-sm text-slate-800 truncate">{u.name || (u.id.substring(0, 8).toUpperCase())}</h4>
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
