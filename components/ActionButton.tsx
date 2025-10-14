
import React from 'react';

interface ActionButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  Icon: React.ElementType;
}

const ActionButton: React.FC<ActionButtonProps> = ({ label, onClick, disabled = false, className, Icon }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-white font-bold text-lg shadow-lg transform transition-transform duration-150 ease-in-out focus:outline-none focus:ring-4 focus:ring-opacity-50 ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-100'}`}
    >
      <Icon className="w-6 h-6"/>
      {label}
    </button>
  );
};

export default ActionButton;
