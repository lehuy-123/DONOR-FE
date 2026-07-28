// src/utils/localDb.js

// Lấy toàn bộ danh sách donor (Đóng vai trò như Collection users trên Firestore)
export const getLocalDonors = () => {
  return JSON.parse(localStorage.getItem('app_donors') || '[]');
};

// Cập nhật thông tin cho 1 user
export const updateLocalDonor = (donorId, newData) => {
  let donors = getLocalDonors();
  let index = donors.findIndex(d => d.id === donorId);
  
  if (index >= 0) {
      donors[index] = { ...donors[index], ...newData };
  } else {
      donors.push({ id: donorId, ...newData });
  }
  
  localStorage.setItem('app_donors', JSON.stringify(donors));
};
