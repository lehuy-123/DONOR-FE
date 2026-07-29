import React, { useState, useEffect, useRef } from 'react';
import { useWebPush } from '../hooks/useWebPush';
import { useGeolocation } from '../hooks/useGeolocation';
import { loginOrRegisterDonor, updateDonorProfile } from '../utils/firestore';
import { io } from "socket.io-client";

// Khởi tạo Socket.io client kết nối tới Node.js Backend
const socket = io("http://localhost:5000");

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
  const [broadcasts, setBroadcasts] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState('choray');
  const fileInputRef = useRef(null);
  const previousMessagesLength = useRef(0);
  const [emergencyAlert, setEmergencyAlert] = useState(null);
  const [activeBroadcastForm, setActiveBroadcastForm] = useState(null);
  const [supportForm, setSupportForm] = useState({ type: 'Cá nhân hỗ trợ', helperName: '', helperPhone: '', helperBloodType: 'O+' });
  const [broadcastPage, setBroadcastPage] = useState(1);
  const broadcastsPerPage = 10;
  const [bulletinTab, setBulletinTab] = useState('daily');
  const [now, setNow] = useState(Date.now());
  const [activeMission, setActiveMission] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000); // Cập nhật mảng mỗi 15s để làm timer xóa 3 phút
    return () => clearInterval(interval);
  }, []);

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
    const activeId = user?.id || user?._id;
    if (!activeId) return;

    // Lấy lịch sử chat bằng REST API
    fetch(`http://localhost:5000/api/users/${activeId}/chats`)
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

    fetch(`http://localhost:5000/api/broadcasts`)
      .then(res => res.json())
      .then(data => {
        if (data.broadcasts) setBroadcasts(data.broadcasts);
      })
      .catch(e => console.error(e));

    // Lắng nghe Real-time bằng Socket.io thay vì onSnapshot
    socket.emit('join-donor', activeId);

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
          } catch (e) { console.error("Lỗi show OS Push:", e) }
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

    const broadcastListener = (b) => {
      setBroadcasts(prev => [b, ...prev.filter(x => x.id !== b.id)]);
    };

    const missionUpdateListener = (payload) => {
      if (payload.userId === activeId) {
        if (payload.isCompleted) setActiveMission(null);
        else setActiveMission(payload);
      }
    };

    socket.on('receive-message', messageListener);
    socket.on('force-logout', forceLogoutListener);
    socket.on('new-broadcast', broadcastListener);
    socket.on('emergency-mission-update', missionUpdateListener);

    return () => {
      socket.off('receive-message', messageListener);
      socket.off('force-logout', forceLogoutListener);
      socket.off('new-broadcast', broadcastListener);
      socket.off('emergency-mission-update', missionUpdateListener);
    };
  }, [user?.id, user?.bloodType]);

  // Load Active Mission once
  useEffect(() => {
    const activeId = user?.id || user?._id;
    if (!activeId) return;
    fetch(`http://localhost:5000/api/emergency-missions?userId=${activeId}`)
      .then(res => res.json())
      .then(data => {
        if (data.missions && data.missions.length > 0) {
          setActiveMission(data.missions[0]);
        }
      })
      .catch(e => console.error(e));
  }, [user?.id]);



  const handleAuth = (e) => {
    e.preventDefault();
    setLoading(true);

    const proceedLogin = async (finalLocation) => {
      try {
        const dbUser = await loginOrRegisterDonor({ ...loginData, location: finalLocation });
        localStorage.setItem('me_donor', JSON.stringify(dbUser));
        setUser(dbUser);

        // Vẫn gọi lại để cập nhật state hoặc fallback nếu cần
        updateLocation(dbUser.id || dbUser._id, true);
      } catch (err) {
        alert("Lệnh API thất bại!");
      } finally {
        setLoading(false);
      }
    };

    // ĐẶC BIỆT CHO IOS/SAFARI: Phải gọi getCurrentPosition NGAY LẬP TỨC trong cùng 1 tick của event onClick.
    // Nếu dùng await fetch() trước, iOS sẽ hủy bỏ User Gesture và block quyền truy cập GPS.
    if (navigator.geolocation && !location) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          proceedLogin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          proceedLogin(location || null);
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
      );
    } else {
      proceedLogin(location || null);
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

      {/* SUPPORT FORM MODAL */}
      {activeBroadcastForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-300">
            <button onClick={() => setActiveBroadcastForm(null)} className="absolute top-4 right-4 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-colors">✕</button>
            <h3 className="text-xl font-black text-slate-800 mb-1">Xác nhận hỗ trợ</h3>
            <p className="text-xs font-bold text-slate-500 mb-6">Mạng lưới 🚨 {activeBroadcastForm.hospitalName}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Hình thức hỗ trợ</label>
                <select value={supportForm.type} onChange={e => setSupportForm({ ...supportForm, type: e.target.value })} className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500">
                  <option value="Cá nhân hỗ trợ">Tự thân - Sẵn sàng xuất phát</option>
                  <option value="Giới thiệu người khác">Cử người khác, hoặc có người quen trúng nhóm máu</option>
                </select>
              </div>

              {supportForm.type === 'Giới thiệu người khác' && (
                <div className="space-y-3 p-4 bg-rose-50 border border-rose-100 rounded-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1">Thông tin người tuyến thay thế</p>
                  <input type="text" placeholder="Họ và Tên" value={supportForm.helperName} onChange={e => setSupportForm({ ...supportForm, helperName: e.target.value })} className="w-full bg-white border border-rose-200 p-2.5 rounded-lg text-sm text-slate-700 font-medium outline-none focus:ring-2 focus:ring-rose-400" />
                  <input type="text" placeholder="SĐT Liên lạc" value={supportForm.helperPhone} onChange={e => setSupportForm({ ...supportForm, helperPhone: e.target.value })} className="w-full bg-white border border-rose-200 p-2.5 rounded-lg text-sm text-slate-700 font-medium outline-none focus:ring-2 focus:ring-rose-400" />
                  <select value={supportForm.helperBloodType} onChange={e => setSupportForm({ ...supportForm, helperBloodType: e.target.value })} className="w-full bg-rose-600 border border-rose-700 text-white p-2.5 rounded-lg text-sm font-black outline-none focus:ring-2 focus:ring-rose-400">
                    <option value="O+">Nhóm O (+)</option><option value="O-">Nhóm O (-)</option>
                    <option value="A+">Nhóm A (+)</option><option value="A-">Nhóm A (-)</option>
                    <option value="B+">Nhóm B (+)</option><option value="B-">Nhóm B (-)</option>
                    <option value="AB+">Nhóm AB (+)</option><option value="AB-">Nhóm AB (-)</option>
                    <option value="Không Rõ">Chưa Xét Nghiệm Trực Tiếp</option>
                  </select>
                </div>
              )}

              {supportForm.type === 'Cá nhân hỗ trợ' ? (
                <div className="flex flex-col gap-2">
                  <button onClick={async () => {
                    try {
                      const payload = {
                        userId: user.id || user._id, status: 'Đồng Ý', supportType: 'TÔI SẼ ĐẾN NGAY',
                        helperName: user.name, helperPhone: user.phone, helperBloodType: user.bloodType,
                        helperLat: location?.lat || user.location?.lat || (10.7769 + (Math.random() * 0.1 - 0.05)),
                        helperLng: location?.lng || user.location?.lng || (106.7009 + (Math.random() * 0.1 - 0.05)),
                        respondedAt: new Date().toISOString()
                      };
                      await fetch(`http://localhost:5000/api/broadcasts/${activeBroadcastForm.id}/respond`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                      });
                      setBroadcasts(prev => prev.map(old => old.id === activeBroadcastForm.id ? { ...old, responders: [...(old.responders || []), payload] } : old));
                      setActiveBroadcastForm(null);
                    } catch (e) { alert("Lỗi kết nối về trung tâm!"); }
                  }} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-4 rounded-xl shadow-lg shadow-rose-500/30 uppercase tracking-widest text-sm active:scale-95 transition-all text-center flex items-center justify-center gap-2">
                    SẴN SÀNG ĐẾN
                  </button>
                </div>
              ) : (
                <button onClick={async () => {
                  try {
                    const payload = {
                      userId: user.id || user._id, status: 'Đồng Ý', supportType: supportForm.type,
                      helperName: supportForm.helperName, helperPhone: supportForm.helperPhone, helperBloodType: supportForm.helperBloodType,
                      respondedAt: new Date().toISOString()
                    };
                    await fetch(`http://localhost:5000/api/broadcasts/${activeBroadcastForm.id}/respond`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload)
                    });
                    setBroadcasts(prev => prev.map(old => old.id === activeBroadcastForm.id ? { ...old, responders: [...(old.responders || []), payload] } : old));
                    setActiveBroadcastForm(null);
                  } catch (e) { alert("Lỗi kết nối về trung tâm!"); }
                }} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-4 rounded-xl shadow-lg shadow-rose-500/30 uppercase tracking-widest text-sm active:scale-95 transition-all">
                  ĐĂNG KÝ NGƯỜI CHUYỂN TIẾP
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EMERGENCY OVERLAY PUSH */}
      {emergencyAlert && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-6 bg-rose-900/90 backdrop-blur-md animate-in fade-in duration-300">
          {/* Hiệu ứng chớp đỏ liên tục */}
          <div className="absolute inset-0 bg-red-600 mix-blend-overlay animate-pulse opacity-50"></div>

          <div className="bg-white max-w-lg w-full p-8 sm:p-10 rounded-[2rem] shadow-2xl relative z-10 flex flex-col items-center text-center animate-in zoom-in-50 duration-500 border border-red-100 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 to-rose-500"></div>

            <div className="w-20 h-20 bg-red-50 border border-red-100 text-red-600 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner animate-pulse">
              <span className="drop-shadow-md">⚠️</span>
            </div>

            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">THÔNG BÁO KHẨN CẤP</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6 font-mono bg-slate-50 px-3 py-1 rounded-md">CODE RED - CẤP CỨU Huyết Học</p>

            <div className="bg-red-50/50 border border-red-100 p-6 rounded-2xl w-full mb-8 text-left">
              <p className="text-slate-700 text-sm leading-relaxed mb-4">
                Trung tâm điều phối ghi nhận <span className="font-bold text-slate-900">{emergencyAlert.sender || "Tuyến Trên"}</span> đang phát đi lệnh báo động đỏ. Bệnh nhân đang trong tình trạng mất máu nguy kịch và cần truyền bổ sung khẩn cấp.
              </p>
              <div className="bg-white p-4 rounded-xl border border-red-50 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nhóm máu chỉ định</p>
                  <p className="font-black text-red-600 text-xl">{user?.bloodType}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mức độ ưu tiên</p>
                  <p className="font-bold text-slate-800 text-sm">Tối đa (Cấp 1)</p>
                </div>
              </div>
              <p className="text-xs text-rose-600 font-medium mt-4 italic text-center">
                * Vị trí của bạn được Radar nhận diện nằm trong "bán kính vàng" có thể ứng cứu kịp thời.
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full">
              <button disabled={loading} onClick={async () => {
                setLoading(true);
                try {
                  await fetch('http://localhost:5000/api/emergency-missions', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hospitalId: emergencyAlert.hospitalId, hospitalName: emergencyAlert.sender, userId: user.id || user._id, user: { ...user, id: user.id || user._id }, status: 'ĐANG ĐẾN' })
                  });
                } catch (e) { } finally { setLoading(false); setEmergencyAlert(null); }
              }} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 uppercase tracking-widest transition-all">
                {loading ? 'Đang kích hoạt...' : 'TÔI SẴN SÀNG ĐẾN NGAY'}
              </button>

              <button disabled={loading} onClick={async () => {
                setLoading(true);
                try {
                  await fetch('http://localhost:5000/api/emergency-missions', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hospitalId: emergencyAlert.hospitalId, hospitalName: emergencyAlert.sender, userId: user.id || user._id, user: { ...user, id: user.id || user._id }, status: 'CHẤP NHẬN' })
                  });
                } catch (e) { } finally { setLoading(false); setEmergencyAlert(null); }
              }} className="w-full bg-slate-800 hover:bg-black text-white font-black py-4 rounded-xl shadow-lg active:scale-95 uppercase tracking-widest transition-all">
                {loading ? 'Đang kích hoạt...' : 'CHẤP NHẬN VÀ LIÊN HỆ'}
              </button>

              <button onClick={() => {
                setEmergencyAlert(null);
              }} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold py-4 rounded-xl active:scale-95 uppercase tracking-widest transition-all">
                TỪ CHỐI
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 px-2 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Mỗi giọt máu trao đi - Một cuộc đời ở lại</h1>
          <p className="text-sm font-medium text-slate-500 flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Trực tuyến - Mạng lưới Hiến Máu Khẩn Cấp Bệnh Viện
          </p>
        </div>
        <button onClick={handleLogout} className="text-xs font-bold text-slate-600 hover:text-rose-600 bg-white px-5 py-2.5 rounded-full shadow-sm border border-slate-200 transition-all uppercase tracking-widest active:scale-95">
          Đăng Xuất
        </button>
      </div>

      {/* KHU VỰC THỰC THI NHIỆM VỤ KHẨN CẤP */}
      {activeMission && (
        <div className="mb-8 bg-gradient-to-r from-red-600 to-rose-700 rounded-3xl p-6 shadow-xl shadow-red-500/20 text-white relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-20 translate-x-10"></div>
          <h2 className="text-lg font-black uppercase tracking-widest mb-4 flex items-center gap-2"><span className="animate-pulse text-2xl">🚨</span> Nhiệm Vụ Điều Động Khẩn Cấp</h2>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-1 w-full">
              <p className="text-[10px] font-black text-red-200 uppercase tracking-widest mb-1">Mục Tiêu Di Chuyển</p>
              <p className="font-black text-2xl truncate drop-shadow-sm">{activeMission.hospitalName || "Bệnh Viện Tuyến Trên"}</p>
              <p className="text-sm text-red-100 mt-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-ping"></span>
                Trạng thái hiện tại: <span className="font-bold underline decoration-red-400 underline-offset-4">{activeMission.status}</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <button disabled={activeMission.status !== 'ĐANG ĐẾN' && activeMission.status !== 'CHẤP NHẬN'} onClick={async () => {
                await fetch(`http://localhost:5000/api/emergency-missions/${activeMission.id}/status`, {
                  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ĐÃ ĐẾN' })
                });
              }} className={`px-6 py-4 sm:py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${activeMission.status === 'ĐANG ĐẾN' || activeMission.status === 'CHẤP NHẬN' ? 'bg-white text-rose-600 hover:bg-slate-100 shadow-lg active:scale-95' :
                'bg-emerald-500 text-white border-2 border-emerald-400 opacity-80 cursor-not-allowed flex items-center gap-2'
                }`}>
                {activeMission.status === 'ĐANG ĐẾN' || activeMission.status === 'CHẤP NHẬN' ? 'Xác Nhận Đã Tới Viện' : '✔ Đã Tới Viện'}
              </button>

              <button disabled={activeMission.status !== 'ĐÃ ĐẾN'} onClick={async () => {
                if (!window.confirm('Xác nhận bạn đã hoàn tất quy trình lấy máu tại Bệnh viện?')) return;
                await fetch(`http://localhost:5000/api/emergency-missions/${activeMission.id}/status`, {
                  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ĐÃ HIẾN MÁU' })
                });
              }} className={`px-6 py-4 sm:py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${activeMission.status === 'ĐÃ ĐẾN' ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/30 active:scale-95' :
                'bg-white/10 text-white/50 border border-white/20 cursor-not-allowed'
                }`}>
                Hoàn Tất Hiến Máu
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <div className="font-mono text-sm tracking-wider font-bold">{(user.id || user._id || "NEWUSER").substring(0, 8).toUpperCase()}</div>
                </div>
              </div>

              {isEditing ? (
                <form onSubmit={handleUpdateInfo} className="bg-white/10 backdrop-blur-md rounded-xl p-4 mt-4 space-y-3 border border-white/20">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-black uppercase text-white/70 tracking-widest px-1 block mb-1">Họ Tên</label>
                      <input type="text" className="w-full bg-white/20 border border-white/30 p-2.5 rounded-lg text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-white" defaultValue={user.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-white/70 tracking-widest px-1 block mb-1">Điện thoại</label>
                      <input type="text" className="w-full bg-white/20 border border-white/30 p-2.5 rounded-lg text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-white" defaultValue={user.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] font-black uppercase text-white/70 tracking-widest px-1 block mb-1">Tuổi</label>
                      <input type="number" className="w-full bg-white/20 border border-white/30 p-2.5 rounded-lg text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-white" defaultValue={user.age} onChange={e => setEditData({ ...editData, age: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-white/70 tracking-widest px-1 block mb-1">Cân nặng(kg)</label>
                      <input type="number" className="w-full bg-white/20 border border-white/30 p-2.5 rounded-lg text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-white" defaultValue={user.weight} onChange={e => setEditData({ ...editData, weight: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-white/70 tracking-widest px-1 block mb-1">Cao(cm)</label>
                      <input type="number" className="w-full bg-white/20 border border-white/30 p-2.5 rounded-lg text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-white" defaultValue={user.height} onChange={e => setEditData({ ...editData, height: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-white/70 tracking-widest px-1 block mb-1">Hiến máu lần cuối</label>
                    <input type="date" className="w-full bg-white/20 border border-white/30 p-2.5 rounded-lg text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-white" defaultValue={user.lastDonationDate} onChange={e => setEditData({ ...editData, lastDonationDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-white/70 tracking-widest px-1 block mb-1">Nhóm Máu Thực Tế</label>
                    <select className="w-full bg-rose-600 border border-white/30 p-2.5 rounded-lg text-sm font-bold text-white focus:outline-none" defaultValue={user.bloodType} onChange={e => setEditData({ ...editData, bloodType: e.target.value })}>
                      <option value="O+">O (+)</option><option value="O-">O (-)</option>
                      <option value="A+">A (+)</option><option value="AB+">AB (+)</option>
                      <option value="B+">B (+)</option><option value="B-">B (-)</option>
                      <option value="Không Rõ">Không Rõ</option>
                    </select>
                  </div>
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
                      <p className="text-[10px] text-white/60 uppercase font-black">Tuổi / Cân nặng</p>
                      <p className="text-sm font-medium uppercase">{user.age ? `${user.age}t` : '-'} / {user.weight ? `${user.weight}kg` : '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/60 uppercase font-black">Chiều cao</p>
                      <p className="text-sm font-medium uppercase">{user.height ? `${user.height}cm` : '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/60 uppercase font-black">Hiến gần nhất</p>
                      <p className="text-sm font-medium uppercase">{user.lastDonationDate ? new Date(user.lastDonationDate).toLocaleDateString('vi-VN') : 'Chưa có'}</p>
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

          <div className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-5 shadow-inner flex flex-col max-h-[40rem]">
            <h3 className="text-sm font-black text-rose-700 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="text-lg">📢</span> BẢNG TIN BỆNH VIỆN
            </h3>

            {/* TAB CHUYỂN ĐỔI BẢNG TIN */}
            <div className="flex bg-white/60 p-1 rounded-xl mb-3 shadow-sm border border-rose-100 shrink-0">
              <button onClick={() => setBulletinTab('daily')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${bulletinTab === 'daily' ? 'bg-white text-orange-600 shadow border border-orange-100' : 'text-slate-500 hover:bg-white/40'}`}>
                Trong Ngày
              </button>
              <button onClick={() => setBulletinTab('schedule')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${bulletinTab === 'schedule' ? 'bg-white text-blue-600 shadow border border-blue-100' : 'text-slate-500 hover:bg-white/40'}`}>
                Đăng Kí Hiến Máu
              </button>
            </div>

            {broadcasts.length > 0 ? (
              <div className="space-y-3 overflow-y-auto pr-1 custom-scrollbar flex-1">
                {broadcasts
                  .filter(b => b.type === bulletinTab || (!b.type && bulletinTab === 'daily'))
                  .map(b => {
                    const responded = b.responders?.find(r => r.userId === (user?.id || user?._id));
                    const isSchedule = b.type === 'schedule' || bulletinTab === 'schedule';
                    const approvedCount = b.responders?.filter(r => r.status === 'Đồng Ý').length || 0;
                    const maxDonors = b.maxDonors || 0;
                    const isFull = maxDonors > 0 && approvedCount >= maxDonors;

                    // Nếu kín lịch và người này chưa đăng ký, ẩn bài đi.
                    if (isFull && !responded) return null;

                    return (
                      <div key={b.id} className={`bg-white rounded-2xl p-3 shadow-sm border ${isSchedule ? 'border-blue-100' : 'border-orange-100'} flex flex-col gap-2`}>
                        <div>
                          <div className="flex items-start justify-between mb-2">
                            <span className={`text-white px-2 py-0.5 rounded text-[10px] font-black uppercase ${isSchedule ? 'bg-blue-600' : 'bg-orange-500'}`}>{b.hospitalName}</span>
                            {isSchedule ? (
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-600 mb-1 border border-blue-100">
                                  📅 {b.scheduleDate}
                                </span>
                                <span className={`text-[9px] font-bold ${isFull ? 'text-rose-500' : 'text-slate-500'}`}>
                                  Đã đăng ký: {approvedCount} / {maxDonors === 0 ? '∞' : maxDonors} {isFull && '(Đã Kín)'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-100">
                                📣 TRONG NGÀY
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-bold text-slate-500 mb-1">
                            Nhóm máu ưu tiên: <span className="text-rose-600">[{b.bloodTypes.join(', ')}]</span>
                          </div>
                          <p className="text-xs font-medium text-slate-700 leading-relaxed border-l-2 border-slate-200 pl-2 ml-1">{b.message}</p>
                        </div>

                        {!responded ? (
                          <div className="flex gap-2 mt-1">
                            <button onClick={async () => {
                              if (isSchedule) {
                                if (window.confirm('Xác nhận đăng ký lịch hẹn hiến máu này?')) {
                                  const payload = {
                                    userId: user.id || user._id,
                                    name: user.name,
                                    phone: user.phone,
                                    bloodType: user.bloodType,
                                    status: 'Đồng Ý',
                                    supportType: 'Đăng ký Lịch hẹn',
                                    respondedAt: new Date().toISOString()
                                  };
                                  await fetch(`http://localhost:5000/api/broadcasts/${b.id}/respond`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(payload)
                                  });
                                  setBroadcasts(prev => prev.map(old => old.id === b.id ? { ...old, responders: [...(old.responders || []), payload] } : old));
                                }
                              } else {
                                setActiveBroadcastForm(b);
                              }
                            }} className={`flex-1 text-white text-[11px] font-black py-1.5 rounded-lg active:scale-95 transition-all ${isSchedule ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'}`}>
                              {isSchedule ? 'ĐĂNG KÝ LỊCH NÀY' : 'SẴN SÀNG HỖ TRỢ'}
                            </button>
                            <button onClick={async () => {
                              const payload = { userId: user.id || user._id, status: 'Từ Chối', respondedAt: new Date().toISOString() };
                              await fetch(`http://localhost:5000/api/broadcasts/${b.id}/respond`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                              });
                              setBroadcasts(prev => prev.map(old => old.id === b.id ? { ...old, responders: [...(old.responders || []), payload] } : old));
                            }} className="bg-slate-100 hover:bg-slate-200 text-slate-400 text-[11px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all">
                              BỎ QUA
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2 mt-1">
                            <div className={`flex-1 text-[11px] font-bold px-2 py-1.5 rounded-lg text-center ${responded.status === 'Đồng Ý' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                              {responded.status === 'Đồng Ý' ? '✅ ĐÃ LƯU XÁC NHẬN' : '❌ ĐÃ BỎ QUA'}
                            </div>
                            {responded.status === 'Đồng Ý' && (
                              <button onClick={() => {
                                setSelectedHospitalId(b.hospitalId);
                                document.getElementById('chat-room-section')?.scrollIntoView({ behavior: 'smooth' });
                              }} className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all flex items-center justify-center">
                                💬 LIÊN LẠC
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {Math.ceil(broadcasts.length / broadcastsPerPage) > 1 && (
                  <div className="flex justify-between items-center pt-2">
                    <button disabled={broadcastPage === 1} onClick={() => setBroadcastPage(prev => Math.max(1, prev - 1))} className="px-3 py-1 rounded bg-white border border-rose-200 text-rose-600 disabled:opacity-50 text-xs font-bold shadow-sm">Trước</button>
                    <span className="text-xs font-bold text-rose-500">{broadcastPage} / {Math.ceil(broadcasts.length / broadcastsPerPage)}</span>
                    <button disabled={broadcastPage === Math.ceil(broadcasts.length / broadcastsPerPage)} onClick={() => setBroadcastPage(prev => Math.min(Math.ceil(broadcasts.length / broadcastsPerPage), prev + 1))} className="px-3 py-1 rounded bg-white border border-rose-200 text-rose-600 disabled:opacity-50 text-xs font-bold shadow-sm">Sau</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-rose-200/50 bg-white/50 rounded-2xl p-6 text-center shadow-inner">
                <span className="text-3xl grayscale opacity-30">📡</span>
                <p className="text-sm font-bold text-rose-400 mt-2 uppercase tracking-tight">Khu vực hiện tại đang an toàn</p>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1">Chưa Nhận Lệnh Điều Động Khẩn Từ Các Tuyến</p>
              </div>
            )}
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
                  ACTIVE NOTIFICATION
                </div>
              ) : (
                <button onClick={async () => {
                  const token = await requestPermissionAndGetToken(user?.id || user?._id);
                  if (token) setUser({ ...user, fcmToken: token });
                }} className="w-full bg-slate-800 hover:bg-black text-white font-black py-3 rounded-xl shadow-md text-xs transition-all active:scale-95 flex items-center justify-center gap-2">
                  CHO PHÉP NHẬN THÔNG BÁO
                  <span className="bg-rose-500 px-1.5 rounded text-[9px] uppercase tracking-wider animate-pulse">Required</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: TRẠNG THÁI VÀ CHAT LIVE (Col 8/12) */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* STATS TIẾN TRÌNH */}
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Tổng Lượt Hiến Thống Kê</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-end gap-1">
                    <input
                      type="number"
                      value={user.donationCount || 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setUser(prev => ({ ...prev, donationCount: val }));
                      }}
                      className="text-4xl font-black text-rose-600 w-24 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 outline-none text-center focus:ring-2 focus:ring-rose-400 transition-all"
                    />
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Lần</span>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const val = user.donationCount || 0;
                        await fetch('http://localhost:5000/api/users/sync', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ ...user, donationCount: val, mockId: user.id || user._id })
                        });
                        localStorage.setItem('me_donor', JSON.stringify({ ...user, donationCount: val }));
                        alert('Đã cập nhật số lần hiến máu!');
                      } catch (err) {
                        alert('Lỗi khi cập nhật!');
                      }
                    }}
                    className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-md"
                  >
                    Lưu Lại
                  </button>
                </div>
              </div>
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center shadow-inner text-rose-500 text-3xl">🩸</div>
            </div>
          </div>

          {/* BẢNG TIN KHẨN TOÀN KHU VỰC */}

          {/* MESSAGE ROOM CHUYÊN NGHIỆP */}
          <div id="chat-room-section" className="bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col flex-1 min-h-[450px]">
            <div className="px-4 sm:px-8 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <img src="/hospital_avatar.png" alt="Phòng Trực Ban" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border border-slate-200 shadow-sm shrink-0" />
                <div className="flex-1 min-w-0">
                  <select value={selectedHospitalId} onChange={e => setSelectedHospitalId(e.target.value)} className="w-full font-black text-slate-800 text-sm sm:text-lg bg-transparent outline-none cursor-pointer hover:text-blue-600 transition-colors truncate">
                    <option value="choray">Phòng Trực Ban: Chợ Rẫy</option>
                    <option value="nd115">Phòng Trực Ban: N.Dân 115</option>
                    <option value="giadinh">Phòng Trực Ban: Nhân Dân Gia Định</option>
                  </select>
                  <p className="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-500 tracking-widest flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> KÊNH TRUYỀN DỮ LIỆU ĐỘC LẬP
                  </p>
                </div>
              </div>

              <button onClick={async () => {
                await fetch(`http://localhost:5000/api/users/${user?.id || user?._id}/chats`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: "🟢 TÔI KHỎE MẠNH! ĐÃ NHẬN TIẾP ĐƯỜNG VÀ SẴN SÀNG DI CHUYỂN NGAY LẬP TỨC.", sender: 'donor', hospitalId: selectedHospitalId })
                });
                alert("Đã gửi Báo Cáo Thể Trạng!");
              }} className="w-full sm:w-auto px-4 py-3 sm:py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
                ⚡ BÁO CÁO THỂ TRẠNG
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 flex flex-col relative" style={{ backgroundColor: '#f8fafc', backgroundImage: "url('https://www.transparenttextures.com/patterns/diagmonds-light.png')" }}>
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

            <div className="p-4 sm:p-5 bg-white border-t border-slate-100 rounded-b-[2rem]">
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!chatMessage.trim() || !user) return;
                const text = chatMessage;
                setChatMessage("");
                await fetch(`http://localhost:5000/api/users/${user?.id || user?._id}/chats`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text, sender: 'donor', hospitalId: selectedHospitalId })
                });
              }} className="flex gap-2 sm:gap-3 bg-slate-50 border border-slate-200 p-1.5 rounded-2xl relative shadow-inner">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-slate-200 hover:bg-slate-300 text-slate-600 w-12 flex items-center justify-center rounded-xl transition-all shadow-inner active:scale-95 text-xl cursor-pointer">
                  📷
                </button>
                <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (event) => {
                    await fetch(`http://localhost:5000/api/users/${user?.id || user?._id}/chats`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text: "📷 Hình ảnh từ rà soát", sender: 'donor', hospitalId: selectedHospitalId, image: event.target.result })
                    });
                  };
                  reader.readAsDataURL(file);
                }} />
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
