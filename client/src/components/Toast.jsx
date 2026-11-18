import React from 'react';
import { Info, X } from 'lucide-react';

export function Toast({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="toast-container">
      <div className="toast">
        <Info size={18} color="#0ea5e9" />
        <span>{message}</span>
        <button 
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', marginLeft: 8 }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
