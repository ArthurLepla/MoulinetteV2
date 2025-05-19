'use client';
import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const { apiUrl, isAuthenticated, isLoading } = useAuth();

  return (
    <div className="w-full flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-gray-700 dark:text-gray-200">IIH: {apiUrl || <span className='italic text-gray-400'>Non défini</span>}</span>
      </div>
      <div className="flex items-center gap-1">
        {isLoading ? (
          <span className="text-xs text-gray-500 italic">Vérification...</span>
        ) : isAuthenticated ? (
          <span className="flex items-center text-green-600 gap-1"><CheckCircle2 size={16} /> Connecté</span>
        ) : (
          <span className="flex items-center text-red-500 gap-1"><AlertCircle size={16} /> Déconnecté</span>
        )}
      </div>
    </div>
  );
};

export default StatusBar;
