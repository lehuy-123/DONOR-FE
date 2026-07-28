import React, { useState } from 'react';

const HospitalView = ({ currentUser }) => {
  const [loading, setLoading] = useState(false);
  const [bloodType, setBloodType] = useState('O+');

  const handleEmergency = async () => {
    setLoading(true);
    // In a real app, this would hit your backend / Cloud Function
    // Since Firebase Client SDK can't easily push messages due to security,
    // we simulate an API call here.
    
    // Giả lập lưu vào bảng emergency_requests và gọi API
    console.log("Saving emergency request to DB...");
    console.log(`Need Blood Type: ${bloodType} around ${currentUser.name}`);
    
    setTimeout(() => {
        alert("Đã phát tín hiệu khẩn cấp đến các người có nhóm máu " + bloodType + " ở gần.");
        setLoading(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-full bg-white rounded-xl shadow-lg p-6 space-y-6">
        <h2 className="text-2xl font-bold text-gray-800 text-center">🏥 {currentUser?.name}</h2>
        
        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
          <h3 className="text-lg font-semibold text-red-700 mb-4">Phát Tín Hiệu Khẩn Cấp</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nhóm máu cần (Khẩn cấp)
            </label>
            <select
              title="Select Blood Type"
              value={bloodType}
              onChange={(e) => setBloodType(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm rounded-md shadow-sm bg-white"
            >
              <option value="O+">O+</option>
              <option value="O-">O-</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
            </select>
          </div>

          <button 
            onClick={handleEmergency}
            disabled={loading}
            className={`w-full ${loading ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'} text-white font-bold py-4 px-4 rounded-lg transition-transform transform active:scale-95 shadow-md flex justify-center items-center gap-2 text-lg`}
          >
            {loading ? 'Đang phát tín hiệu...' : '🚨 PHÁT TÍN HIỆU KHẨN CẤP'}
          </button>
        </div>

        <div>
          <h4 className="font-semibold text-gray-700 mb-3">Lịch sử báo động</h4>
          <ul className="space-y-3">
             <li className="bg-gray-100 p-3 rounded-md text-sm text-gray-700 flex justify-between">
                <span>01/12/2023 - Cần (O+)</span>
                <span className="text-green-600 font-medium">Hoàn tất</span>
             </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HospitalView;
