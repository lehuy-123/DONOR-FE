export const scanDonors = async (requiredBloodType, radiusInKm, hospitalLocation) => {
    try {
        const queryParams = new URLSearchParams({
            bloodType: requiredBloodType,
            radius: radiusInKm,
            lat: hospitalLocation?.lat || '',
            lng: hospitalLocation?.lng || ''
        }).toString();

        const response = await fetch(`http://localhost:5000/api/users/scan?${queryParams}`);
        const data = await response.json();
        
        return data.donors || [];
    } catch (e) {
        console.error("Lỗi gọi Server Scan:", e);
        return []; 
    }
}
