import React from "react";

export const WaveLines = ({ className = "" }) => (
  <div
    className={`flex space-x-2 h-12 items-end ${className}`}
    aria-label="wave-lines-loader"
  >
    {[0, 0.3, 0.9, 1.2, 1.5].map((delay, i) => (
      <div
        key={i}
        className="w-1.5 bg-blue-500 rounded-full animate-[wave_1s_ease-in-out_infinite]"
        style={{ animationDelay: `${delay}s` }}
      />
    ))}
  </div>
);

export default function GlobalLoader() {
  return (
    <div className="p-10 space-y-15 font-sans">
      <style>{`
        @keyframes ripple { 0% { transform: scale(0.8); opacity: 1;} 100% { transform: scale(2.5); opacity: 0;} }
        @keyframes fade { 0%, 100% { opacity: 0.2;} 50% { opacity: 1;} }
        @keyframes fill { 0%, 100% { height: 20%;} 50% { height: 100%;} }
        @keyframes wave { 0%, 100% { height: 40%;} 50% { height: 100%;} }
        @keyframes rotateCube { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }
        .delay-300 { animation-delay: 0.3s; }
      `}</style>

      <div className="flex items-center gap-4">
        <WaveLines />
      </div>
    </div>
  );
}
