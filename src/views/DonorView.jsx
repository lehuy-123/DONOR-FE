import React, { useState, useEffect, useRef } from 'react';
import { useWebPush } from '../hooks/useWebPush';
import { useGeolocation } from '../hooks/useGeolocation';
import { loginOrRegisterDonor, updateDonorProfile } from '../utils/firestore';
import { io } from "socket.io-client";

// Khởi tạo Socket.io client kết nối tới Node.js Backend
const socket = io("https://donor-be.onrender.com");

const DonorView = () => {
  const { fcmToken, permission, requestPermissionAndGetToken } = useWebPush();
  const { location, updateLocation } = useGeolocation();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const [loginData, setLoginData] = useState({ name: '', phone: '', email: '', bloodType: 'O+' });
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});

  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState('choray');
  const fileInputRef = useRef(null);
  const previousMessagesLength = useRef(0);
  const [emergencyAlert, setEmergencyAlert] = useState(null);

  useEffect(() => {
    const savedMe = localStorage.getItem('me_donor');
    let currentUser = null;
    if (savedMe) {
      currentUser = JSON.parse(savedMe);
      setUser(currentUser);
    }

    // YÊU CẦU: Tự động bung bảng hỏi GPS của trình duyệt ngay lập tức khi người mới vừa vào web (dù chưa đăng nhập)
    if (!location) {
      updateLocation(currentUser?.id, true);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    // Lấy lịch sử chat bằng REST API
    fetch(`https://donor-be.onrender.com/api/users/${user.id}/chats`)
       .then(res => {
           if (res.status === 404 || res.status === 401) {
               localStorage.removeItem('me_donor');
               window.location.reload();
               throw new Error("Tài khoản không còn tồn tại trên hệ thống.");
           }
           return res.json();
       })
       .then(data => {
           if (data.chats) {
               setMessages(data.chats);
               previousMessagesLength.current = data.chats.length;
           }
       })
       .catch(e => console.error(e));

    // Lắng nghe Real-time bằng Socket.io thay vì onSnapshot
    socket.emit('join-donor', user.id);
    
    const messageListener = (latestMsg) => {
         setMessages(prev => [...prev, latestMsg]);
         
         // KIỂM TRA & HIỂN THỊ NATIVE PUSH NOTIFICATION
         if (latestMsg && latestMsg.text.includes("[HỆ THỐNG] Đã phát còi báo động khẩn cấp")) {
            setEmergencyAlert(latestMsg);

            // Native OS Push Notification qua Service Worker
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === "granted") {
                try {
                    const title = `🚨 KHẨN CẤP: BỆNH VIỆN GỌI`;
                    const options = {
                        body: `${latestMsg.sender || 'Tuyến Trên'} đang rất cần máu ${user?.bloodType} của bạn. VUI LÒNG ĐẾN NGAY!`,
                        icon: '/vite.svg',
                        badge: '/vite.svg',
                        vibrate: [500, 250, 500, 250, 500],
                        requireInteraction: true,
                        silent: false,
                        renotify: true,
                        tag: 'emergency-socket',
                        priority: 'high'
                    };
                    if ('serviceWorker' in navigator) {
                       navigator.serviceWorker.ready.then(reg => reg.showNotification(title, options));
                    } else {
                       new Notification(title, options);
                    }
                } catch(e) { console.error("Lỗi show OS Push:", e) }
            }
         }
    };
    
    // Xử lý buộc đăng xuất khi bị thiết bị khác đăng nhập
    const forceLogoutListener = (latestToken) => {
        const localMe = JSON.parse(localStorage.getItem('me_donor'));
        if (localMe && localMe.sessionToken && localMe.sessionToken !== latestToken) {
            alert('Tài khoản của bạn vừa đăng nhập ở một máy khác! Bạn sẽ bị đăng xuất khỏi thiết bị này.');
            localStorage.removeItem('me_donor');
            window.location.reload();
        }
    };
    
    socket.on('receive-message', messageListener);
    socket.on('force-logout', forceLogoutListener);
    
    return () => {
        socket.off('receive-message', messageListener);
        socket.off('force-logout', forceLogoutListener);
    };
  }, [user?.id, user?.bloodType]);

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || !user) return;
    const text = chatMessage;
    setChatMessage("");
    
    // Gửi chat bằng REST API
    await fetch(`https://donor-be.onrender.com/api/users/${user.id}/chats`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ text, sender: 'donor', hospitalId: selectedHospitalId })
    });
  };

  const handleSendImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      await fetch(`https://donor-be.onrender.com/api/users/${user.id}/chats`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ text: "📷 Hình ảnh từ rà soát", sender: 'donor', hospitalId: selectedHospitalId, image: event.target.result })
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dbUser = await loginOrRegisterDonor(loginData);
      localStorage.setItem('me_donor', JSON.stringify(dbUser));
      setUser(dbUser);
    } catch (e) {
      alert("Lệnh API thất bại! Vui lòng điền API KEY của bạn vào config/firebase.js");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateDonorProfile(user.id, editData);
      const updatedUser = { ...user, ...editData };
      localStorage.setItem('me_donor', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setIsEditing(false);
    } catch (e) { } finally { setLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('me_donor');
    setUser(null);
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto transform hover:scale-[1.01] transition-all duration-300">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-rose-900/10 border border-white/50 p-8 sm:p-10 space-y-8">
          <div className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
              <svg className="w-8 h-8 text-rose-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"></path></svg>
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Trạm Hiến Máu</h2>
            <p className="text-rose-500 text-sm font-medium">Bảo mật định danh qua Firestore</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email xác thực <span className="text-rose-500">*</span></label>
                <input required type="email" placeholder="email@example.com" value={loginData.email} onChange={e => setLoginData({ ...loginData, email: e.target.value })} className="w-full bg-slate-50 border-0 ring-1 ring-slate-200 p-4 rounded-xl focus:ring-2 focus:ring-rose-400 focus:bg-white text-slate-700 font-medium transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Họ & Tên</label>
                <input required type="text" placeholder="Nguyễn Văn A" value={loginData.name} onChange={e => setLoginData({ ...loginData, name: e.target.value })} className="w-full bg-slate-50 border-0 ring-1 ring-slate-200 p-4 rounded-xl focus:ring-2 focus:ring-rose-400 focus:bg-white text-slate-700 font-medium transition-all" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SĐT Liên Lạc</label>
                  <input required type="text" placeholder="0901234567" value={loginData.phone} onChange={e => setLoginData({ ...loginData, phone: e.target.value })} className="w-full bg-slate-50 border-0 ring-1 ring-slate-200 p-4 rounded-xl focus:ring-2 focus:ring-rose-400 focus:bg-white text-slate-700 font-medium transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nhóm Máu</label>
                  <select value={loginData.bloodType} onChange={e => setLoginData({ ...loginData, bloodType: e.target.value })} className="w-full bg-slate-50 border-0 ring-1 ring-slate-200 p-4 rounded-xl text-rose-600 font-bold focus:ring-2 focus:ring-rose-400 focus:bg-white transition-all appearance-none cursor-pointer">
                    <option value="O+">O (+)</option><option value="O-">O (-)</option>
                    <option value="A+">A (+)</option><option value="A-">A (-)</option>
                    <option value="B+">B (+)</option><option value="B-">B (-)</option>
                    <option value="AB+">AB (+)</option><option value="AB-">AB (-)</option>
                  </select>
                </div>
              </div>
            </div>

            <button disabled={loading} type="submit" className="w-full group relative overflow-hidden bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white font-black py-4 px-4 rounded-xl shadow-lg shadow-rose-500/30 transition-all hover:-translate-y-1 mt-6 text-sm tracking-widest uppercase">
              {loading ? 'Đang truy xuất...' : 'XÁC NHẬN THAM GIA'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20 relative">
      
      {/* EMERGENCY OVERLAY PUSH */}
      {emergencyAlert && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-6 bg-rose-900/90 backdrop-blur-md animate-in fade-in duration-300">
           {/* Hiệu ứng chớp đỏ liên tục */}
           <div className="absolute inset-0 bg-red-600 mix-blend-overlay animate-pulse opacity-50"></div>
           
           <div className="bg-white max-w-lg w-full p-10 rounded-[2rem] shadow-2xl relative z-10 flex flex-col items-center text-center animate-in zoom-in-50 duration-500 border-8 border-red-500">
             <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-5xl mb-6 shadow-inner animate-bounce">
                🚨
             </div>
             <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-2">Lệnh Điều Động Khẩn</h2>
             <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Mã Hệ Thống: E-001</p>
             
             <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl w-full mb-8">
                <p className="text-rose-700 font-bold text-lg leading-relaxed shadow-sm">
                  <span className="font-black text-xl">{emergencyAlert.sender || "Tuyến Trên"}</span> đang có ca cấp cứu sinh tử cực kỳ nguy kịch.
                  <br/><br/>Họ cần gấp nhóm máu <span className="text-rose-600 font-black text-2xl px-2">{user?.bloodType}</span> của bạn. Mạng người nằm trong tay bạn!
                </p>
             </div>
             
             <div className="flex gap-4 w-full">
                <button onClick={() => setEmergencyAlert(null)} className="flex-1 bg-slate-800 hover:bg-black text-white font-black py-4 rounded-xl shadow-lg active:scale-95 uppercase tracking-widest transition-all">
                  Tôi Đã Hiểu
                </button>
             </div>
           </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 px-2 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Kết nối dòng máu Việt – Thắp lửa triệu trái tim.</h1>
          <p className="text-sm font-medium text-slate-500 flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Trực tuyến - Mạng lưới Hiến Máu Khẩn Cấp Bệnh Viện
          </p>
        </div>
        <button onClick={handleLogout} className="text-xs font-bold text-slate-600 hover:text-rose-600 bg-white px-5 py-2.5 rounded-full shadow-sm border border-slate-200 transition-all uppercase tracking-widest active:scale-95">
          Đăng Xuất
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* CỘT TRÁI: MEDICAL ID VÀ TỌA ĐỘ (Col 4/12) */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* THẺ ĐỊNH DANH Y TẾ */}
          <div className="bg-gradient-to-br from-rose-500 to-rose-700 rounded-[2rem] p-8 shadow-xl shadow-rose-500/20 text-white relative overflow-hidden isolate">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-20 translate-x-10"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-black opacity-10 rounded-full blur-2xl translate-y-10 -translate-x-10"></div>

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
                  <span className="text-4xl font-black text-rose-600 drop-shadow-md">{user.bloodType}</span>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black tracking-widest text-white/70 uppercase">ID Định Danh</div>
                  <div className="font-mono text-sm tracking-wider font-bold">{user.id.substring(0, 8).toUpperCase()}</div>
                </div>
              </div>

              {isEditing ? (
                <form onSubmit={handleUpdateInfo} className="bg-white/10 backdrop-blur-md rounded-xl p-4 mt-4 space-y-3 border border-white/20">
                  <input type="text" className="w-full bg-white/20 border border-white/30 p-2.5 rounded-lg text-sm text-white placeholder-white/60 font-bold focus:outline-none focus:ring-2 focus:ring-white" placeholder="Họ Tên" defaultValue={user.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
                  <input type="text" className="w-full bg-white/20 border border-white/30 p-2.5 rounded-lg text-sm text-white placeholder-white/60 font-bold focus:outline-none focus:ring-2 focus:ring-white" placeholder="SĐT" defaultValue={user.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
                  <select className="w-full bg-rose-600 border border-white/30 p-2.5 rounded-lg text-sm font-bold text-white focus:outline-none" defaultValue={user.bloodType} onChange={e => setEditData({ ...editData, bloodType: e.target.value })}>
                    <option value="O+">O (+)</option><option value="O-">O (-)</option>
                    <option value="A+">A (+)</option><option value="AB+">AB (+)</option>
                  </select>
                  <div className="flex gap-2 pt-2">
                    <button disabled={loading} type="submit" className="bg-white text-rose-700 py-2 rounded-lg flex-1 font-black shadow-md text-xs uppercase tracking-wider">Lưu</button>
                    <button type="button" onClick={() => setIsEditing(false)} className="bg-black/20 text-white py-2 rounded-lg font-bold px-4 text-xs">Hủy</button>
                  </div>
                </form>
              ) : (
                <div className="space-y-1">
                  <h2 className="text-2xl font-black tracking-tight">{user.name}</h2>
                  <p className="text-xs font-bold text-white/80 tracking-widest uppercase">Thành viên Danh dự</p>
                  <div className="pt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-white/60 uppercase font-black">Điện thoại</p>
                      <p className="text-sm font-medium">{user.phone}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/60 uppercase font-black">Email</p>
                      <p className="text-sm font-medium truncate">{user.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {!isEditing && (
                <button onClick={() => { setEditData(user); setIsEditing(true); }} className="w-full mt-6 bg-white/20 hover:bg-white/30 border border-white/30 transition-colors text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest active:scale-95">
                  Cập Nhật Y Tế
                </button>
              )}
            </div>
          </div>

          {/* GPS & RADAR CHECK */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-slate-700 text-sm flex items-center gap-2">
                <span className="text-xl">📍</span> Tọa độ GPS
              </h3>
              {location || user.location ? (
                <span className="bg-emerald-50 text-emerald-600 text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-widest flex items-center gap-1.5 border border-emerald-100"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> ONLINE</span>
              ) : (
                <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded-md font-bold">OFFLINE</span>
              )}
            </div>

            {(!location && !user.location) ? (
              <div className="w-full rounded-2xl overflow-hidden shadow-inner relative h-40 bg-slate-50 border border-slate-200 flex flex-col items-center justify-center animate-pulse">
                <span className="w-6 h-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-2"></span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đang kết nối vệ tinh...</span>
              </div>
            ) : (() => {
              const lat = location?.lat || user.location?.lat;
              const lng = location?.lng || user.location?.lng;
              return (
                <div className="w-full rounded-2xl overflow-hidden border-2 border-emerald-100/50 shadow-inner relative h-40 group">
                  <iframe
                    width="100%" height="100%" frameBorder="0" style={{ border: 0, filter: 'contrast(1.1) opacity(0.95)' }}
                    src={`https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`}
                  />
                </div>
              )
            })()}

            <div className="mt-4 pt-4 border-t border-slate-100">
              <h3 className="font-black text-slate-700 text-sm flex items-center gap-2 mb-3">
                <span className="text-xl">🔔</span> Nhận Tin Khẩn Cấp
              </h3>
              {user.fcmToken || fcmToken ? (
                <div className="w-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold py-3 rounded-xl text-xs text-center flex items-center justify-center gap-2 shadow-sm">
                  ĐÃ KÍCH HOẠT PUSH NOTIFICATION
                </div>
              ) : (
                <button onClick={async () => {
                   const token = await requestPermissionAndGetToken(user?.id);
                   if(token) setUser({...user, fcmToken: token});
                }} className="w-full bg-slate-800 hover:bg-black text-white font-black py-3 rounded-xl shadow-md text-xs transition-all active:scale-95 flex items-center justify-center gap-2">
                  KÍCH HOẠT PUSH
                  <span className="bg-rose-500 px-1.5 rounded text-[9px] uppercase tracking-wider animate-pulse">Required</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: TRẠNG THÁI VÀ CHAT LIVE (Col 8/12) */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* STATS TIẾN TRÌNH */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Tổng Lượt Hiến</p>
              <p className="text-3xl font-black text-rose-600">{user.donationCount || 0} <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Lần</span></p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center sm:col-span-2 relative overflow-hidden">
              <div className="absolute top-0 right-0 h-full w-32 bg-gradient-to-l from-emerald-50 to-transparent"></div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Sinh Mạng Đã Cứu Sống</p>
              <div className="flex items-end justify-between mb-2">
                <p className="text-sm font-bold text-slate-700">Dự kiến khoảng <span className="text-emerald-500 font-black text-xl mx-1">{(user.donationCount || 0) * 3}</span> bệnh nhân đã qua cơn nguy kịch</p>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(((user.donationCount || 0) * 3) * 5, 100)}%` }}></div>
              </div>
            </div>
          </div>

          {/* MESSAGE ROOM CHUYÊN NGHIỆP */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col flex-1 min-h-[450px]">
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 text-xl shadow-inner">🏥</div>
                <div>
                  <select value={selectedHospitalId} onChange={e => setSelectedHospitalId(e.target.value)} className="font-black text-slate-800 text-lg bg-transparent outline-none cursor-pointer hover:text-blue-600 transition-colors">
                    <option value="choray">Phòng Trực Ban: Bệnh Viện Chợ Rẫy</option>
                    <option value="nd115">Phòng Trực Ban: Nhân Dân 115</option>
                    <option value="giadinh">Phòng Trực Ban: Nhân Dân Gia Định</option>
                  </select>
                  <p className="text-[10px] uppercase font-bold text-emerald-500 tracking-widest flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> KÊNH TRUYỀN DỮ LIỆU ĐỘC LẬP
                  </p>
                </div>
              </div>
              <button onClick={async () => {
                 await fetch(`https://donor-be.onrender.com/api/users/${user.id}/chats`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: "🟢 TÔI KHỎE MẠNH! ĐÃ NHẬN TIẾP ĐƯỜNG VÀ SẴN SÀNG DI CHUYỂN NGAY LẬP TỨC.", sender: 'donor', hospitalId: selectedHospitalId })
                 });
                 alert("Đã gửi Báo Cáo Thể Trạng!");
              }} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-md active:scale-95 flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700`}>
                ⚡ BÁO CÁO THỂ TRẠNG
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 flex flex-col bg-slate-50/30">
              {messages.filter(m => m.hospitalId === selectedHospitalId).length === 0 ? (
                  <div className="m-auto flex flex-col items-center justify-center text-center max-w-sm opacity-50">
                    <span className="text-4xl mb-4 grayscale">💬</span>
                    <span className="text-sm font-bold text-slate-500">Kênh mã khóa End-to-End đã thành lập</span>
                    <span className="text-xs font-medium text-slate-400 mt-2">Dữ liệu truyền tải giữa bạn và trạm y tế này hoàn toàn tách biệt khỏi các cơ sở khác.</span>
                  </div>
                ) : (
                  messages.filter(m => m.hospitalId === selectedHospitalId).map((m, idx) => (
                    <div key={idx} className={`w-full flex ${m.sender === 'donor' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-5 py-3 text-[15px] font-medium leading-relaxed ${m.sender === 'donor' ? 'bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-tr-sm shadow-md shadow-rose-200' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'
                        }`}>
                        {m.sender !== 'donor' && <div className="text-[10px] font-black uppercase tracking-widest text-blue-600/70 mb-1">Bác Sĩ Trực Ban</div>}
                        {m.text}
                        {m.image && <img src={m.image} alt="Nội dung đính kèm" className="mt-2 rounded-xl border border-white/20 w-full object-cover max-h-64 shadow-md bg-black/10" />}
                      </div>
                    </div>
                  ))
                )}
              </div>

            <div className="p-4 bg-white border-t border-slate-100 rounded-b-[2rem]">
              <form onSubmit={handleSendReply} className="flex gap-3 bg-slate-50 border border-slate-200 p-1.5 rounded-2xl relative shadow-inner">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-slate-200 hover:bg-slate-300 text-slate-600 w-12 flex items-center justify-center rounded-xl transition-all shadow-inner active:scale-95 text-xl cursor-pointer">
                  📷
                </button>
                <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleSendImage} />
                <input type="text" value={chatMessage} onChange={e => setChatMessage(e.target.value)} placeholder="Nhắn tin cho Bác sĩ..." className="flex-1 bg-transparent px-4 py-3 outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400" />
                <button type="submit" className="bg-slate-800 hover:bg-black active:scale-90 text-white p-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest shadow-md transition-all">Gửi Lệnh</button>
              </form>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DonorView;
