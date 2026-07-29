const API_URL = 'https://donor-be.onrender.com/api';

// Đăng nhập hoặc Đăng ký (Dựa vào Email) - Đồng bộ Data
export const loginOrRegisterDonor = async (userData) => {
    try {
        const response = await fetch(`${API_URL}/users/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await response.json();
        if (data.error) {
            alert(data.error);
            return null;
        }
        return data.user;
    } catch(e) {
        console.error("Lỗi Đăng nhập Backend:", e);
        return null;
    }
};

// Cập nhật hồ sơ (Vị trí, Token, Thông tin cá nhân)
export const updateDonorProfile = async (userId, data) => {
    try {
        // Chúng ta có thể dùng lại /users/sync vì API hỗ trợ ghi đè theo user (nếu cần mockId logic)
        // Hoặc update API riêng. Ở Backend t cung cấp /sync với mockId
        const payload = { mockId: userId, ...data };
        await fetch(`${API_URL}/users/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return true;
    } catch(e) { return false; }
};

// Lấy thông tin user
export const getDonorProfile = async (userId) => {
    try {
        // Mặc định gọi lấy chats hoặc data (nếu backend support, hiện tại chỉ dùng loginOrRegisterDonor để lấy profile)
        return null;
    } catch(e) { return null; }
};

// Tạo 30 data giả lập rải rác quanh vị trí Bệnh viện
export const generateMockData = async () => {
    const bloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
    const names = ['Lê', 'Nguyễn', 'Trần', 'Phạm', 'Hoàng', 'Võ', 'Đặng', 'Bùi'];
    const firstNames = ['Anh', 'Bình', 'Huy', 'Khoa', 'Long', 'Linh', 'Minh', 'Ngọc', 'Nhi', 'Tuấn'];

    let count = 0;
    for(let i=0; i<30; i++) {
        const randomBlood = bloodTypes[Math.floor(Math.random() * bloodTypes.length)];
        const randomName = names[Math.floor(Math.random() * names.length)] + ' Văn ' + firstNames[Math.floor(Math.random() * firstNames.length)];
        const lat = 10.7769 + (Math.random() * 0.2 - 0.1); 
        const lng = 106.7009 + (Math.random() * 0.2 - 0.1);
        
        await fetch(`${API_URL}/users/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: randomName,
                phone: '09' + Math.floor(10000000 + Math.random() * 90000000),
                email: 'mock' + i + '_' + Date.now() + '@random.com',
                bloodType: randomBlood,
                donationCount: Math.floor(Math.random() * 15),
                isOnline: Math.random() > 0.5,
                location: { lat, lng }
            })
        });
        count++;
    }
    return count;
};
