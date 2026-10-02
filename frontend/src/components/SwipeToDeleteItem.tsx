import React, { useRef, useState } from 'react';

interface SwipeToDeleteItemProps {
  onDelete: () => void;
  children: React.ReactNode;
}

export const SwipeToDeleteItem: React.FC<SwipeToDeleteItemProps> = ({ onDelete, children }) => {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const currentX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;
    
    // Only allow swipe left
    if (diff < 0) {
      // Add resistance after a certain point
      const boundedDiff = diff < -100 ? -100 + (diff + 100) * 0.2 : diff;
      setOffset(boundedDiff);
    }
  };

  const handleTouchEnd = () => {
    if (offset < -60) {
      // Trigger delete if swiped past threshold
      onDelete();
    }
    // Snap back
    setOffset(0);
    startX.current = null;
    currentX.current = null;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl w-full shrink-0">
      {/* Background action (Delete) */}
      <div className="absolute inset-0 bg-rose-600 flex items-center justify-end px-4 z-0">
        <span className="text-white font-bold text-xs uppercase tracking-wider">Eliminar</span>
      </div>
      
      {/* Foreground content */}
      <div 
        className="relative z-10 transition-transform duration-200 ease-out bg-slate-950/80 border border-slate-800/80 rounded-2xl"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};
