'use client';

import React, { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hoverEffect?: boolean;
  onClick?: () => void;
}

export default function GlassCard({ children, className = '', hoverEffect = true, onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`glass-card p-6 rounded-2xl ${hoverEffect ? 'glass-card-hover' : ''} ${
        onClick ? 'cursor-pointer active:scale-98' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
