import React from 'react';

interface InstallPwaPromptProps {
    onInstall: () => void;
    onDismiss: () => void;
}

const InstallPwaPrompt: React.FC<InstallPwaPromptProps> = ({ onInstall, onDismiss }) => {
    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
        >
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center transform animate-scale-in">
                <div className="flex justify-center mb-4">
                     <div className="w-16 h-16 p-3 bg-sky-100 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0284c7">
                            <path fillRule="evenodd" d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm4.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm7.5-1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-5.25 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clipRule="evenodd" />
                            <path d="M11.25 6.75a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                        </svg>
                    </div>
                </div>
                <h2 id="install-title" className="text-xl font-bold text-slate-800">Install Aplikasi</h2>
                <p className="text-slate-500 mt-2 mb-6">
                    Akses cepat & offline dari layar utama perangkat Anda.
                </p>
                <div className="space-y-3">
                    <button
                        onClick={onInstall}
                        className="w-full bg-sky-600 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:bg-sky-700 transition-transform transform active:scale-95"
                    >
                        Install
                    </button>
                    <button
                        onClick={onDismiss}
                        className="w-full bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl hover:bg-slate-300 transition-colors"
                    >
                        Nanti Saja
                    </button>
                </div>
            </div>
             <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }

                @keyframes scale-in {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default InstallPwaPrompt;
