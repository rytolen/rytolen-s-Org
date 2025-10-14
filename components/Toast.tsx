import React, { useState, useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onDismiss: () => void;
}

// --- Icons ---
const SuccessIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ErrorIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CloseIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);


const Toast: React.FC<ToastProps> = ({ message, type, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, 3000); // Auto dismiss after 3 seconds

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    // Wait for exit animation to complete before calling onDismiss
    setTimeout(() => {
      onDismiss();
    }, 300); // Must match animation duration
  };

  const config = {
    success: {
      bgColor: 'bg-green-500',
      icon: <SuccessIcon />,
    },
    error: {
      bgColor: 'bg-red-500',
      icon: <ErrorIcon />,
    },
  };
  
  const currentConfig = config[type];
  const animationClass = isExiting ? 'animate-toast-out' : 'animate-toast-in';

  return (
    <>
      <div 
        role="alert"
        aria-live="assertive"
        className={`fixed top-5 left-1/2 -translate-x-1/2 w-11/12 max-w-sm z-50 ${animationClass}`}
      >
        <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-white font-semibold shadow-2xl ${currentConfig.bgColor}`}>
            <div className="flex items-center gap-3">
                {currentConfig.icon}
                <span>{message}</span>
            </div>
            <button onClick={handleDismiss} className="p-1 rounded-full hover:bg-white/20 transition-colors">
                <CloseIcon />
            </button>
        </div>
      </div>
      <style>{`
        @keyframes toast-in {
          from {
            transform: translate(-50%, -100px);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
        @keyframes toast-out {
          from {
            transform: translate(-50%, 0);
            opacity: 1;
          }
          to {
            transform: translate(-50%, -100px);
            opacity: 0;
          }
        }
        .animate-toast-in {
          animation: toast-in 0.3s ease-out forwards;
        }
        .animate-toast-out {
          animation: toast-out 0.3s ease-in forwards;
        }
      `}</style>
    </>
  );
};

export default Toast;