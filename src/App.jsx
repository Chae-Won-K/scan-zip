import React, { useState, useRef, useEffect } from 'react';
import { Camera, Scissors, Type, Save, Plus, Image as ImageIcon, RotateCcw, X, MapPin, HardDrive, Smile, StickyNote, Globe, FolderOpen } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

// 🚨 [필수] 여기에 발급받은 'AIza...' API 키를 넣어주세요!
const API_KEY = "AIzaSyCtzK0ZBVr2G4uYgZpixUCNCqbo92m8u-s"; 

// --- 🎨 스타일 (Y2K 레트로 & 폴더 디자인) ---
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=VT323&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap');

  /* 기본 설정 */
  body, html { 
    overscroll-behavior: none;
    touch-action: manipulation;
    font-family: 'Gaegu', cursive;
    background-color: #fdfbf7;
  }
  
  .font-pixel { font-family: 'VT323', monospace; }
  .font-hand { font-family: 'Gaegu', cursive; }
  
  /* 🗂️ 폴더 탭 스타일 (핵심 디자인) */
  .folder-tab {
    position: relative;
    width: 100%;
    height: 120px;
    border-radius: 15px 15px 0 0; /* 위쪽만 둥글게 */
    border: 3px solid black;
    box-shadow: 0px -4px 0px rgba(0,0,0,0.1); /* 입체감 */
    transition: transform 0.2s ease;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-left: 20px;
    margin-top: -60px; /* 겹치는 효과 (세로 스택) */
    cursor: pointer;
    background-color: white; 
  }
  .folder-tab:hover { transform: translateY(-15px); }
  .folder-tab:active { transform: translateY(-5px); }

  /* 탭 라벨 (오른쪽 귀퉁이) */
  .tab-ear {
    position: absolute;
    top: -30px;
    right: 0;
    width: 100px;
    height: 30px;
    border-top: 3px solid black;
    border-right: 3px solid black;
    border-left: 3px solid black;
    border-radius: 10px 10px 0 0;
    background-color: inherit; /* 부모 색상 상속 */
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'VT323', monospace;
    font-size: 1.2rem;
    z-index: -1;
  }

  /* 배경 패턴 */
  .bg-grid-pattern {
    background-image: 
      linear-gradient(#ccc 1px, transparent 1px),
      linear-gradient(90deg, #ccc 1px, transparent 1px);
    background-size: 20px 20px;
    background-color: #fdfbf7;
  }
  
  /* 📸 스캔 효과 */
  .scan-overlay {
    background: linear-gradient(to bottom, transparent 50%, rgba(0, 255, 0, 0.1) 51%, transparent 52%);
    background-size: 100% 10px;
    animation: scan 0.5s linear infinite;
  }
  @keyframes scan { 0% { background-position: 0 0; } 100% { background-position: 0 100px; } }

  /* 레트로 버튼 */
  .retro-btn {
    box-shadow: 4px 4px 0px 0px #000;
    border: 3px solid black;
    transition: all 0.1s;
    background-color: white;
    color: black;
  }
  .retro-btn:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0px 0px #000;
  }

  /* 스크롤바 숨기기 */
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
`;

// --- 파일 변환 도우미 ---
async function fileToGenerativePart(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result.split(',')[1];
      resolve({ inlineData: { data: base64Data, mimeType: file.type } });
    };
    reader.readAsDataURL(file);
  });
}

// --- 드래그 아이템 ---
const DraggableItem = ({ item, isSelected, onSelect, onUpdate, canvasRef }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleStart = (clientX, clientY) => {
    onSelect(item.id);
    setIsDragging(true);
    const rect = canvasRef.current.getBoundingClientRect(); // 캔버스 기준 좌표 계산 수정
    // 아이템의 현재 화면상 위치
    // 여기서는 간단히 이벤트 좌표와 아이템의 상대적 위치를 계산하지 않고
    // 캔버스 내에서의 좌표로만 계산합니다. (더 정교한 드래그를 위해선 event target rect 필요)
    // 편의상 오프셋은 0으로 잡고 클릭한 위치가 아이템 중심이 되도록 이동시키는 방식도 가능하지만,
    // 기존 로직 유지를 위해:
    // (실제 구현에서는 e.target.getBoundingClientRect()가 필요할 수 있음)
  };

  const handleMouseDown = (e) => {
    e.stopPropagation();
    handleStart(e.clientX, e.clientY);
    // 오프셋 계산 보정 (아이템 내부 클릭 위치 유지)
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleTouchStart = (e) => {
    e.stopPropagation();
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({ x: touch.clientX - rect.left, y: touch.clientY - rect.top });
  };

  useEffect(() => {
    const handleMove = (clientX, clientY) => {
      if (!isDragging || !canvasRef.current) return;
      const canvasRect = canvasRef.current.getBoundingClientRect();
      onUpdate(item.id, { 
        x: clientX - canvasRect.left - dragOffset.x, 
        y: clientY - canvasRect.top - dragOffset.y 
      });
    };

    const handleMouseMove = (e) => handleMove(e.clientX, e.clientY);
    const handleTouchMove = (e) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); };
    const handleEnd = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragOffset, item.id, onUpdate, canvasRef]);

  const getStyle = () => ({
    transform: `translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg) scale(${item.scale})`,
    zIndex: item.zIndex,
    position: 'absolute',
    cursor: isDragging ? 'grabbing' : 'grab',
    pointerEvents: item.type === 'tape' ? 'none' : 'auto',
    opacity: item.type === 'tape' ? 0.8 : 1,
  });

  return (
    <div 
      style={getStyle()} 
      onMouseDown={handleMouseDown} 
      onTouchStart={handleTouchStart}
      className={isSelected ? 'drop-shadow-2xl z-50' : 'drop-shadow-md'}
    >
      {item.type === 'image' && (
        <div className="relative group bg-white p-2 pb-5 shadow-sm border-2 border-black transform rotate-1">
          <img src={item.content} alt="scanned" className="max-w-[150px] max-h-[200px] object-contain select-none pointer-events-none block" />
          {/* 마스킹 테이프 효과 */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-yellow-200/90 rotate-[-2deg] shadow-sm border-l border-r border-white/50"></div>
        </div>
      )}
      {item.type === 'text' && (
        <div className="bg-[#fff0f5] border-2 border-black px-4 py-2 font-hand text-xl text-black min-w-[100px] max-w-[220px] text-center shadow-[4px_4px_0_rgba(0,0,0,1)]">
          {item.content}
        </div>
      )}
      {item.type === 'sticker' && <div className="text-6xl drop-shadow-lg filter contrast-125 select-none">{item.content}</div>}
      {item.type === 'tape' && <div className="w-32 h-8 bg-green-300/60 -rotate-3 shadow-sm backdrop-blur-sm"></div>}
      
      {isSelected && (
        <div className="absolute -top-12 right-0 bg-black text-white text-xs px-2 py-1 font-pixel flex gap-2 border-2 border-white shadow-lg z-50 rounded-sm">
          <button onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { zIndex: item.zIndex + 1 }); }} className="px-1 active:text-yellow-300">UP</button>
          <div className="w-[1px] bg-gray-500"></div>
          <button onClick={(e) => { e.stopPropagation(); onUpdate(item.id, { delete: true }); }} className="px-1 text-red-400 active:text-red-200">DEL</button>
        </div>
      )}
    </div>
  );
};

// --- 메인 앱 ---
const App = () => {
  const [view, setView] = useState('home'); 
  const [activeTrip, setActiveTrip] = useState(null);
  // Y2K 형광 컬러 팔레트
  const [trips, setTrips] = useState([
    { id: 1, title: 'OSAKA 23\'', location: 'Osaka', color: 'bg-[#ff9ff3]', date: '2023.12.24' },
    { id: 2, title: 'PARIS 24\'', location: 'Paris', color: 'bg-[#54a0ff]', date: '2024.05.10' },
    { id: 3, title: 'SEOUL 25\'', location: 'Seoul', color: 'bg-[#5f27cd]', date: '2025.01.15' },
  ]);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null); 
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // 새 여행 만들기
  const createTrip = () => {
    const locationName = prompt("여행지 이름 (영어)", "New York");
    if (!locationName) return;

    const colors = ['bg-[#ff9ff3]', 'bg-[#feca57]', 'bg-[#ff6b6b]', 'bg-[#48dbfb]', 'bg-[#1dd1a1]'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newTrip = { 
        id: Date.now(), 
        title: `${locationName.toUpperCase().substring(0, 8)} 25'`, 
        location: locationName,
        color: randomColor,
        date: new Date().toLocaleDateString() 
    };
    setTrips([newTrip, ...trips]); // 새 여행을 맨 위로
  };

  const triggerCamera = () => fileInputRef.current.click();

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsScanning(true);
    const imageUrl = URL.createObjectURL(file); 
    let text = "";
    const fallbacks = ["이 순간 박제! 📸", "너무 예쁘다 ✨", "다시 가고 싶어 ✈️", "맛있으면 0칼로리 😋", "감성 충전 완료 🔋"];

    try {
      if (!API_KEY || API_KEY.includes("YOUR_API_KEY_HERE")) throw new Error("API Key missing");
      const genAI = new GoogleGenerativeAI(API_KEY.trim());
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const imagePart = await fileToGenerativePart(file);
      const prompt = "이 사진을 다이어리에 붙일 거야. 아주 짧고 감성적인 한글 코멘트(반말, 15자 이내)를 써줘. 이모지 1개 필수.";
      const result = await model.generateContent([prompt, imagePart]);
      text = result.response.text();
    } catch (error) {
      console.error("AI Error:", error);
      text = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    } finally {
      // 중앙 배치
      const centerX = window.innerWidth / 2 - 75; 
      const centerY = window.innerHeight / 3;
      const newImage = { id: Date.now(), type: 'image', content: imageUrl, x: centerX, y: centerY, rotation: Math.random() * 10 - 5, scale: 1, zIndex: items.length + 1 };
      const newText = { id: Date.now()+1, type: 'text', content: text.trim(), x: centerX, y: centerY + 220, rotation: Math.random() * 10 - 5, scale: 1, zIndex: items.length + 2 };
      setItems(prev => [...prev, newImage, newText]);
      setIsScanning(false);
      event.target.value = ''; 
    }
  };

  const addText = () => setItems([...items, { id: Date.now(), type: 'text', content: 'Note 🖍️', x: 100, y: 150, rotation: -5, scale: 1, zIndex: items.length + 1 }]);
  const addSticker = () => setItems([...items, { id: Date.now(), type: 'sticker', content: ['❤️','🔥','✨','✈️','🍔'][Math.floor(Math.random()*5)], x: 120, y: 200, rotation: 0, scale: 1, zIndex: items.length + 1 }]);
  const addTape = () => setItems([...items, { id: Date.now(), type: 'tape', content: '', x: 140, y: 100, rotation: 45, scale: 1, zIndex: items.length + 10 }]);
  const updateItem = (id, changes) => {
    if (changes.delete) setItems(items.filter(i => i.id !== id));
    else setItems(items.map(i => i.id === id ? { ...i, ...changes } : i));
  };

  // --- 1. 홈 화면 (Y2K 폴더 탭 스타일) ---
  if (view === 'home') {
    return (
      <div className="w-full h-screen bg-grid-pattern flex flex-col items-center overflow-hidden relative">
        <style>{styles}</style>
        
        {/* 헤더 */}
        <div className="mt-12 mb-4 z-20 text-center w-full px-4 flex flex-col items-center">
           <div className="bg-yellow-300 border-4 border-black p-3 shadow-[6px_6px_0_0_rgba(0,0,0,1)] mb-4 transform rotate-[-3deg]">
             <HardDrive size={48} strokeWidth={2} color="black" />
           </div>
           <h1 className="text-6xl font-pixel text-black tracking-widest drop-shadow-[2px_2px_0_#fff]">scan.zip</h1>
           <p className="text-gray-500 font-mono mt-2 text-sm tracking-widest bg-white/80 px-2">DIGITAL MEMORY ARCHIVE</p>
        </div>

        {/* 파일 탭 리스트 (세로 스택 효과) */}
        <div className="w-full max-w-md px-6 flex-1 overflow-y-auto pt-16 pb-32 scrollbar-hide relative z-10">
          {trips.map((trip, index) => (
            <div 
              key={trip.id}
              onClick={() => { setActiveTrip(trip); setItems([]); setView('editor'); }}
              className={`folder-tab ${trip.color}`}
              style={{ zIndex: trips.length - index }} // 아래쪽이 깔리도록
            >
              {/* 탭 귀퉁이 (인덱스) */}
              <div className="tab-ear" style={{backgroundColor: 'inherit'}}>
                  {trip.title.substring(0,3)}
              </div>

              <div className="flex justify-between items-center pr-4">
                 <div>
                    <h2 className="text-4xl font-bold text-black/90 font-pixel drop-shadow-sm">{trip.title}</h2>
                    <div className="flex items-center gap-2 mt-1 opacity-80">
                        <MapPin size={18} />
                        <span className="font-mono text-sm font-bold">{trip.location.toUpperCase()}</span>
                    </div>
                 </div>
                 <div className="text-right">
                    <span className="font-mono text-xs bg-black text-white px-2 py-1 rounded-sm">{trip.date}</span>
                 </div>
              </div>
            </div>
          ))}
        </div>

        {/* 플로팅 버튼 */}
        <button 
          onClick={createTrip}
          className="absolute bottom-10 z-50 w-16 h-16 bg-black text-white rounded-full border-4 border-white shadow-[4px_4px_0_0_rgba(0,0,0,0.5)] flex items-center justify-center hover:scale-110 transition-transform retro-btn"
        >
          <Plus size={32} />
        </button>
      </div>
    );
  }

  // --- 2. 에디터 화면 ---
  if (view === 'editor') {
    return (
      <div className="w-full h-screen bg-[#f0f0f0] flex flex-col relative overflow-hidden fixed inset-0">
        <style>{styles}</style>
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />

        {/* 상단 바 */}
        <div className="bg-white border-b-4 border-black h-16 px-4 flex items-center justify-between z-50 font-pixel shrink-0">
          <button onClick={() => setView('home')} className="flex items-center gap-1 text-xl retro-btn px-2 py-1"><RotateCcw size={18} /> BACK</button>
          <div className="text-xl font-bold">{activeTrip?.title}</div>
          <button onClick={() => setView('print')} className="bg-[#5f27cd] text-white px-4 py-2 retro-btn flex items-center gap-2 text-sm font-bold">SAVE <Save size={16} /></button>
        </div>

        {/* 캔버스 */}
        <div className="flex-1 relative bg-grid-pattern touch-none" ref={canvasRef} onClick={() => setSelectedId(null)}>
           {isScanning && (
             <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 scan-overlay text-[#00ff00] font-pixel">
               <p className="text-5xl animate-pulse mb-6 tracking-widest">SCANNING...</p>
               <div className="w-64 h-8 bg-gray-800 border-4 border-[#00ff00] p-1">
                 <div className="h-full bg-[#00ff00] animate-[width_2s_ease-in-out_infinite]" style={{width: '0%'}}></div>
               </div>
             </div>
           )}
           
           {items.length === 0 && !isScanning && (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 pointer-events-none">
                <div className="w-64 h-64 border-[8px] border-dashed border-gray-300 rounded-3xl flex items-center justify-center mb-4 animate-pulse bg-white/50">
                  <Camera size={80} className="opacity-30" />
                </div>
                <p className="font-pixel text-3xl opacity-50 text-black">TAP SCAN BUTTON 👇</p>
             </div>
           )}
           
           {items.map(item => <DraggableItem key={item.id} item={item} isSelected={selectedId === item.id} onSelect={setSelectedId} onUpdate={updateItem} canvasRef={canvasRef} />)}
        </div>

        {/* 하단 툴바 */}
        <div className="h-24 bg-[#dcdde1] border-t-4 border-black px-4 flex justify-around items-center z-50 shadow-lg shrink-0 safe-area-pb">
          <button onClick={triggerCamera} className="flex flex-col items-center justify-center w-16 h-16 retro-btn bg-gray-200 rounded-xl active:bg-gray-300">
             <div className="w-10 h-10 bg-[#ff6b6b] rounded-full border-2 border-black flex items-center justify-center shadow-sm"><Camera color="white" size={20}/></div>
             <span className="text-xs font-pixel mt-1 font-bold">SCAN</span>
          </button>
          
          <div className="w-[2px] h-12 bg-black/20"></div>
          
          {[{icon:Type, label:"TEXT", fn:addText, color:"#feca57"}, {icon:Smile, label:"STICKER", fn:addSticker, color:"#1dd1a1"}, {icon:StickyNote, label:"TAPE", fn:addTape, color:"#a29bfe"}].map((tool, i) => (
             <button key={i} onClick={tool.fn} className="flex flex-col items-center justify-center w-14 h-14 active:scale-90 transition-transform">
                <div className={`w-10 h-10 flex items-center justify-center border-2 border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)] rounded-lg`} style={{backgroundColor: tool.color}}>
                  <tool.icon size={20} color="black" />
                </div>
                <span className="text-[10px] font-pixel mt-1 font-bold">{tool.label}</span>
             </button>
          ))}
        </div>
      </div>
    );
  }

  // --- 3. 공유 화면 (다이어리 & 지도) ---
  if (view === 'print') {
    return (
      <div className="w-full h-screen bg-[#2d3436] flex flex-col items-center p-4 overflow-y-auto">
        <style>{styles}</style>
        
        <div className="w-full max-w-lg flex justify-end mb-4 pt-2">
          <button onClick={() => setView('editor')} className="bg-white rounded-full p-2 shadow-lg active:scale-90 border-2 border-black"><X/></button>
        </div>

        {/* 다이어리 본체 */}
        <div className="w-full max-w-lg bg-[#fdfbf7] rounded-xl shadow-2xl border-[6px] border-[#5d4037] flex flex-col overflow-hidden mb-8 relative">
           <div className="absolute top-0 left-4 right-4 h-6 flex justify-between z-20 pointer-events-none">
             {[...Array(6)].map((_,i) => <div key={i} className="w-3 h-6 bg-[#2d3436] rounded-full -mt-3 border-2 border-gray-500"></div>)}
          </div>

          {/* 1페이지 */}
          <div className="relative p-6 min-h-[400px] border-b-2 border-dashed border-[#00000020] pt-10">
             <div className="absolute top-2 right-4 font-pixel text-gray-400 text-lg">PAGE 01</div>
             
             {/* 지도 폴라로이드 */}
             <div className="relative mx-auto w-64 h-72 bg-white p-3 pb-12 shadow-md rotate-1 border border-gray-300 mb-8 mt-2 transform hover:scale-105 transition-transform">
                <img 
                  src={`https://source.unsplash.com/500x500/?map,${activeTrip?.location}`} 
                  onError={(e) => e.target.src='https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=500&q=60'}
                  className="w-full h-full object-cover border border-gray-200 filter sepia-[0.2]" alt="map"
                />
                <div className="absolute bottom-3 left-0 right-0 text-center font-hand text-2xl font-bold">{activeTrip?.location.toUpperCase()}</div>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-8 bg-red-400/60 rotate-[-3deg] shadow-sm backdrop-blur-sm"></div>
             </div>

             <div className="w-full border-t-2 border-gray-300 my-4"></div>
             <p className="font-hand text-xl text-gray-600 text-center mt-2">"{trips[0].date}의 기록"</p>
          </div>

          {/* 2페이지 */}
          <div className="relative p-6 min-h-[400px] bg-[#fffbf0]">
             <div className="absolute top-2 right-4 font-pixel text-gray-400 text-lg">PAGE 02</div>
             <div className="grid grid-cols-2 gap-4 mt-6">
               {items.map((item) => (
                  <div key={item.id} className="relative flex justify-center items-center p-2">
                    {item.type === 'image' ? <img src={item.content} className="w-full border-4 border-white shadow-md rotate-1" alt=""/> : 
                     item.type === 'text' ? <span className="font-hand bg-yellow-200 px-3 py-2 text-lg shadow-md -rotate-2 border border-black/10">{item.content}</span> : 
                     item.type !== 'tape' && <span className="text-4xl drop-shadow-sm animate-bounce">{item.content}</span>}
                  </div>
               ))}
             </div>
          </div>
        </div>

        <button onClick={() => alert('저장되었습니다! (갤러리 확인)')} className="w-full max-w-lg bg-[#00b894] text-white font-pixel text-2xl py-4 rounded-xl border-4 border-black shadow-[4px_4px_0_0_#000] active:shadow-none active:translate-x-1 active:translate-y-1 mb-12 flex justify-center items-center gap-3 transition-all">
          SAVE TO GALLERY <Save size={24} />
        </button>
      </div>
    );
  }
  return null;
};

export default App;