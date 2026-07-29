import React, { useState, useEffect } from 'react';

const mockArticles = [
  {
    id: 1,
    title: "Hành trình giọt máu - Cứu sống hàng ngàn sinh mệnh tại TP.HCM",
    summary: "Những câu chuyện cảm động từ những tình nguyện viên hiến máu thầm lặng, lan tỏa tình yêu thương đến cộng đồng và tiếp thêm hi vọng cho các bệnh nhân hiểm nghèo.",
    image: "https://images.unsplash.com/photo-1615461066841-6116e61058f4?q=80&w=600&auto=format&fit=crop",
    category: "Cộng Đồng",
    date: "29/07/2026"
  },
  {
    id: 2,
    title: "Cảnh báo cạn kiệt nhóm máu O do bùng phát dịch bệnh mùa mưa",
    summary: "Viện Huyết Học Trung Ương đưa ra lời kêu gọi khẩn cấp tới những người nhóm máu O tham gia hiến máu nhằm duy trì nguồn dự trữ cấp cứu.",
    image: "https://images.unsplash.com/photo-1579154204601-01588f351e67?q=80&w=600&auto=format&fit=crop",
    category: "Tin Tưc Y Tế",
    date: "28/07/2026"
  },
  {
    id: 3,
    title: "Chương trình Sắc Đỏ Mùa Hè 2026 - Tự hào tuổi trẻ",
    summary: "Đại học Y Dược phối hợp cùng bệnh viện Chợ Rẫy tổ chức ngày hội hiến máu quy mô lớn, dự kiến thu về hơn 2000 đơn vị máu.",
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=600&auto=format&fit=crop",
    category: "Sự Kiện",
    date: "27/07/2026"
  },
  {
    id: 4,
    title: "Lợi ích bất ngờ của việc hiến máu định kỳ đối với sức khỏe",
    summary: "Không chỉ cứu sống người khác, hiến máu định kỳ giúp thanh lọc cơ thể, tái tạo tế bào mới và giảm nguy cơ mắc các bệnh về tim mạch.",
    image: "https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?q=80&w=600&auto=format&fit=crop",
    category: "Kiến Thức",
    date: "26/07/2026"
  },
  {
    id: 5,
    title: "Công nghệ mới: Bảo quản khối hồng cầu lên đến 60 ngày",
    summary: "Ứng dụng khoa học kỹ thuật tiên tiến giúp nâng cao thời gian lưu trữ dung dịch máu, giải quyết vấn đề hao hụt trong vận chuyển.",
    image: "https://images.unsplash.com/photo-1530497610245-94d3c16cda28?q=80&w=600&auto=format&fit=crop",
    category: "Khoa Học",
    date: "25/07/2026"
  },
  {
    id: 6,
    title: "Người mẹ 45 lần hiến máu nhận giải thưởng trái tim nhân ái",
    summary: "Chị Hạnh, 52 tuổi ở Đồng Nai chia sẻ việc hiến máu đã trở thành thói quen mỗi 3 tháng suốt 20 năm qua.",
    image: "https://images.unsplash.com/photo-1551069613-1904dbdcda11?q=80&w=600&auto=format&fit=crop",
    category: "Câu Chuyện",
    date: "24/07/2026"
  },
  {
    id: 7,
    title: "Quy trình hiến máu chuẩn quốc tế được áp dụng tại các bệnh viện Hạng 1",
    summary: "Đảm bảo vô trùng tuyệt đối, sử dụng vật tư y tế 1 lần cao cấp, mang lại sự an tâm tuyệt đối cho người hiến.",
    image: "https://images.unsplash.com/photo-1582719471384-894fbb16e074?q=80&w=600&auto=format&fit=crop",
    category: "Tin Tưc Y Tế",
    date: "23/07/2026"
  },
  {
    id: 8,
    title: "Hướng dẫn chế độ dinh dưỡng trước và sau khi tham gia hiến máu",
    summary: "Những thực phẩm cần tránh và nhóm chất giàu sắt cần bổ sung để cơ thể nhanh chóng phục hồi. Lời khuyên từ chuyên gia.",
    image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=600&auto=format&fit=crop",
    category: "Kiến Thức",
    date: "22/07/2026"
  },
  {
    id: 9,
    title: "Mạng lưới ngân hàng máu trực tuyến liên kết toàn cầu đang được hiện thực hoá",
    summary: "Dự án mới giúp tối ưu hóa số lượng máu luân chuyển giữa các tỉnh thành và san sẻ với tổ chức Y tế thế giới.",
    image: "https://images.unsplash.com/photo-1551076805-e1869033e561?q=80&w=600&auto=format&fit=crop",
    category: "Tiêu Điểm",
    date: "21/07/2026"
  },
  {
    id: 10,
    title: "Làm thế nào để trở thành thành viên danh dự của Câu Lạc Bộ Hiến Máu?",
    summary: "Cơ chế tính điểm cống hiến, phần thưởng vinh danh hằng năm cho những tình nguyện viên tích cực.",
    image: "https://images.unsplash.com/photo-1542884748-2b87b36f6b90?q=80&w=600&auto=format&fit=crop",
    category: "Cộng Đồng",
    date: "20/07/2026"
  }
];

const MediaView = () => {
  const [schedules, setSchedules] = useState([]);
  const [activeArticle, setActiveArticle] = useState(null);

  useEffect(() => {
    // Fetch danh sách lịch hẹn sắp diễn ra từ backend
    fetch(`http://localhost:5000/api/broadcasts`)
      .then(res => res.json())
      .then(data => {
        if (data.broadcasts) {
          // Lọc ra các bài là lịch hẹn (schedules)
          const schedulePosts = data.broadcasts.filter(b => b.type === 'schedule');
          setSchedules(schedulePosts);
        }
      })
      .catch(e => console.error(e));
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start relative z-10 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* CUỘT BÊN TRÁI: DANH SÁCH BÁO CHÍ (70%) */}
      <div className="w-full lg:w-[65%] flex flex-col gap-6">
        {activeArticle ? (
          <div className="bg-white rounded-3xl p-6 md:p-10 shadow-lg border border-slate-100 animate-in slide-in-from-right-4 duration-500">
            <button onClick={() => setActiveArticle(null)} className="mb-6 flex items-center gap-2 text-rose-600 font-bold text-sm hover:text-rose-800 transition-colors bg-rose-50 px-4 py-2 rounded-full w-fit">
              ← Trở về
            </button>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-white text-[10px] font-bold uppercase px-3 py-1 rounded bg-rose-600">{activeArticle.category}</span>
                <span className="text-slate-400 text-xs font-medium">{activeArticle.date}</span>
              </div>
              <h1 className="text-2xl md:text-4xl font-black text-slate-800 leading-tight mb-4">{activeArticle.title}</h1>
              <p className="text-slate-500 font-medium italic border-l-4 border-slate-200 pl-4">{activeArticle.summary}</p>
            </div>
            <div className="w-full h-[300px] md:h-[400px] rounded-2xl overflow-hidden mb-8 shadow-inner">
              <img src={activeArticle.image} alt={activeArticle.title} className="w-full h-full object-cover" />
            </div>
            <div className="prose prose-slate max-w-none text-slate-700 leading-loose font-medium text-[15px]">
               <p className="mb-4">Trong bối cảnh hệ thống y tế đang đối mặt với nhiều thử thách, những chiến dịch y tế khẩn cấp thế này không chỉ mang ý nghĩa bổ sung nguồn dự trữ mà còn lan tỏa một thông điệp mạnh mẽ về sự đoàn kết của toàn xã hội.</p>
               <p className="mb-4">Hằng năm, hàng ngàn đơn vị máu đã được đóng góp thông qua các tình nguyện viên, giúp duy trì đường sống cho rất nhiều ca cấp cứu nghiêm trọng. Lượng tiêu thụ ngày càng cao đòi hỏi chúng ta phải có những công nghệ bảo quản tốt hơn và sự kết nối thường xuyên hơn giữa cộng đồng.</p>
               <p>Để tiếp tục duy trì những điều kỳ diệu này, mỗi người dân khỏe mạnh hãy sẵn sàng xắn tay áo, theo dõi lịch hiến thường xuyên trên ứng dụng. Giọt máu của bạn hôm nay chính là nhịp đập ngày mai của những người kém may mắn.</p>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-black text-rose-700 uppercase tracking-widest mb-2 flex items-center gap-3">
              <span className="text-3xl">📰</span> ĐIỂM TIN Y TẾ
            </h2>

            {/* Highlight Article (Bài đầu tiên) */}
            <div onClick={() => setActiveArticle(mockArticles[0])} className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-100 group cursor-pointer hover:shadow-2xl transition-all duration-300">
              <div className="h-64 sm:h-96 w-full overflow-hidden relative">
                <div className="absolute top-4 left-4 z-10 bg-rose-600 text-white text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg">
                  {mockArticles[0].category}
                </div>
                <img src={mockArticles[0].image} alt={mockArticles[0].title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/80 to-transparent"></div>
                <div className="absolute bottom-4 left-6 right-6">
                   <h3 className="text-white text-xl md:text-3xl font-black mb-2 leading-tight group-hover:text-rose-300 transition-colors">{mockArticles[0].title}</h3>
                   <p className="text-white/80 text-sm md:text-base font-medium line-clamp-2">{mockArticles[0].summary}</p>
                </div>
              </div>
            </div>

            {/* Lưới các bài báo còn lại (Grid 2 cột) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
              {mockArticles.slice(1).map(article => (
                <div key={article.id} onClick={() => setActiveArticle(article)} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 group cursor-pointer hover:shadow-md hover:border-rose-100 transition-all flex flex-col">
                  <div className="w-full h-40 rounded-xl overflow-hidden mb-4 relative">
                    <div className="absolute top-2 left-2 z-10 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold uppercase px-2 py-1 rounded">
                      {article.category}
                    </div>
                    <img src={article.image} alt={article.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 mb-2">{article.date}</p>
                  <h4 className="text-slate-800 font-black text-sm md:text-base mb-2 group-hover:text-rose-600 transition-colors leading-snug line-clamp-2">
                    {article.title}
                  </h4>
                  <p className="text-slate-500 text-xs font-medium line-clamp-3">
                    {article.summary}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* CỘT BÊN PHẢI: LỊCH HIẾN MÁU (35%) */}
      <div className="w-full lg:w-[35%] flex flex-col gap-6 sticky top-28">
        <div className="bg-gradient-to-b from-rose-50 to-white border-2 border-rose-200 rounded-3xl p-5 shadow-lg">
          <h3 className="text-sm font-black text-rose-700 uppercase tracking-widest mb-5 flex items-center gap-2 border-b border-rose-200 pb-3">
            <span className="text-lg">🗓️</span> Lịch Hiến Sắp Tới
          </h3>
          
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
            {schedules.length === 0 ? (
              <p className="text-center text-sm font-medium text-slate-500 py-10 opacity-70">
                Chưa có lịch hiến máu nào sắp khởi hành.
              </p>
            ) : (
              schedules.map(b => {
                const approvedCount = b.responders?.filter(r => r.status === 'Đồng Ý').length || 0;
                const maxDonors = b.maxDonors || 0;
                const isFull = maxDonors > 0 && approvedCount >= maxDonors;

                return (
                  <div key={b.id} className="bg-white rounded-2xl p-4 shadow-sm border border-blue-100 flex flex-col relative overflow-hidden group hover:shadow-md hover:border-blue-300 transition-all cursor-pointer">
                    {/* Background effect */}
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-full blur-2xl -translate-y-8 translate-x-8 group-hover:bg-blue-100 transition-colors"></div>
                    
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <span className="bg-rose-600 text-white px-2.5 py-1 rounded-md text-[10px] font-black uppercase shadow-sm">
                        {b.hospitalName}
                      </span>
                      <span className="text-[11px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                        📅 {b.scheduleDate}
                      </span>
                    </div>

                    <div className="relative z-10 border-l-2 border-slate-200 pl-3 ml-1 mb-3">
                      <div className="text-[11px] font-bold text-slate-500 mb-1.5 flex gap-2 items-center">
                        Nhóm máu: <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200">[{b.bloodTypes.join(', ')}]</span>
                      </div>
                      <p className="text-xs font-medium text-slate-700 leading-snug">{b.message}</p>
                    </div>

                    {/* Progress Bar (nếu có giới hạn) */}
                    <div className="mt-auto bg-slate-50 p-2 rounded-xl border border-slate-100 relative z-10">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest mb-1.5">
                        <span className={isFull ? 'text-rose-500' : 'text-slate-500'}>Slot Đăng Ký</span>
                        <span className={isFull ? 'text-rose-600' : 'text-blue-600'}>
                          {approvedCount} / {maxDonors === 0 ? '∞' : maxDonors}
                        </span>
                      </div>
                      {maxDonors > 0 && (
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${isFull ? 'bg-rose-500' : 'bg-blue-500'}`} 
                            style={{ width: `${Math.min((approvedCount / maxDonors) * 100, 100)}%` }}
                          ></div>
                        </div>
                      )}
                      
                      {isFull ? (
                        <p className="text-[9px] text-rose-500 font-bold uppercase mt-2 text-center bg-rose-50 py-1 rounded border border-rose-100">🚫 Đã Đủ Người</p>
                      ) : (
                        <p className="text-[9px] text-blue-500 font-bold uppercase mt-2 text-center bg-blue-50 py-1 rounded border border-blue-100">👉 Nhấn vào "DONOR" để Đăng ký</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaView;
