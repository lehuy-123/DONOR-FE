import { useState } from 'react';
import { updateDonorProfile } from '../utils/firestore';

export const useGeolocation = () => {
  const [location, setLocation] = useState(null);

  const updateLocation = async (userId, silent = false) => {
    if (!navigator.geolocation) {
      if(!silent) alert('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLocation({ lat, lng });
        
        if (userId) {
          await updateDonorProfile(userId, { location: { lat, lng } }); // Lên DTB
          
          const me = JSON.parse(localStorage.getItem('me_donor'));
          localStorage.setItem('me_donor', JSON.stringify({...me, location: {lat,lng}}));
          console.log('Firebase: Đã cập nhật định vị thật!');
        }
      },
      async (error) => {
        console.error('Lỗi lấy vị trí:', error);
        if(!silent) alert('Trình duyệt đã TRÌNH KHÓA quyền định vị! ❌\n\n📌 Cách mở:\n1. Nhìn lên thanh địa chỉ trang web (chỗ nhập localhost:5173)\n2. Bấm vào biểu tượng Ổ Khóa 🔒 (hoặc Cài đặt trang)\n3. Tìm dòng Location (Vị trí) và chọn ALLOW (Cho phép)\n4. F5 tải lại trang là xong!');
      },
      {
         enableHighAccuracy: false, // Desktop thường không có chip GPS xịn, bật true dễ bị Timeout
         timeout: 30000, 
         maximumAge: 0
      }
    );
  };

  return { location, updateLocation };
};
