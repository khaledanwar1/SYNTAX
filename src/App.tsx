import { Phone, PhoneOff } from 'lucide-react';
import { useLiveAPI } from './useLiveAPI';
import { useEffect, useState } from 'react';
import SparkyBall from './SparkyBall';

export default function App() {
  const { connect, disconnect, isConnected, isConnecting, isSpeaking, analyser } = useLiveAPI();
  const [glitch, setGlitch] = useState(false);

  // Random glitch effect
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      if (Math.random() > 0.8) {
        setGlitch(true);
        setTimeout(() => setGlitch(false), 150);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isConnected]);

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-100 font-mono flex flex-col items-center justify-between p-8 overflow-hidden relative">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-0"></div>

      {/* 3D Ball - Full Screen Background */}
      <div className="absolute inset-0 z-0">
        <div className={`absolute inset-0 blur-3xl transition-colors duration-500 ${isSpeaking ? 'bg-blue-800/30' : isConnected ? 'bg-blue-900/10' : 'bg-zinc-900/5'}`} />
        <SparkyBall analyser={analyser} isSpeaking={isSpeaking} isConnected={isConnected} />
      </div>

      {/* Top Text */}
      <h1 className={`relative z-10 text-2xl font-black tracking-[0.3em] uppercase transition-transform duration-75 ${glitch ? 'text-red-500 translate-x-1 -translate-y-1' : 'text-blue-600'}`}>
        SYNTAX
      </h1>

      {/* Bottom Action Button */}
      <button
        onClick={isConnected ? disconnect : connect}
        disabled={isConnecting}
        className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95
          ${isConnected
            ? 'bg-red-600 text-white hover:bg-red-500 shadow-[0_0_30px_rgba(220,38,38,0.4)]'
            : 'bg-blue-700 text-zinc-100 hover:bg-blue-600 shadow-[0_0_30px_rgba(29,78,216,0.5)]'
          }
          ${isConnecting ? 'opacity-50 cursor-wait animate-pulse' : ''}
        `}
      >
        {isConnected ? <PhoneOff className="w-6 h-6" /> : <Phone className="w-6 h-6 ml-1" />}
      </button>
    </div>
  );
}
