import React from 'react';
import { AturanAbsensi } from '../types';

// --- Icons ---
const BuildingOfficeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M4.5 2.25a.75.75 0 0 0 0 1.5v16.5a.75.75 0 0 0 1.5 0V21h12V3.75a.75.75 0 0 0 0-1.5h-15ZM15 6.75a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1-.75-.75V6.75ZM15 10.5a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1-.75-.75V10.5ZM15 14.25a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1-.75-.75v-.008ZM10.5 6.75a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1-.75-.75V6.75ZM10.5 10.5a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1-.75-.75V10.5ZM10.5 14.25a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1-.75-.75v-.008ZM6 6.75a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H6.75a.75.75 0 0 1-.75-.75V6.75ZM6 10.5a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H6.75a.75.75 0 0 1-.75-.75V10.5ZM6 14.25a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H6.75a.75.75 0 0 1-.75-.75v-.008Z" clipRule="evenodd" />
    </svg>
);

const ChevronRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
);


interface DivisionSelectionModalProps {
    rules: AturanAbsensi[];
    onSelect: (rule: AturanAbsensi) => void;
    onClose: () => void;
}

const DivisionSelectionModal: React.FC<DivisionSelectionModalProps> = ({ rules, onSelect, onClose }) => {
    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4 animate-fade-in" 
            onClick={onClose} 
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="division-modal-title"
        >
            <div 
                className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md flex flex-col transform animate-slide-up sm:animate-scale-in" 
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 text-center shrink-0">
                    <div className="flex justify-center mb-4">
                        <div className="w-14 h-14 bg-sky-100 rounded-full flex items-center justify-center">
                            <BuildingOfficeIcon className="w-8 h-8 text-sky-600" />
                        </div>
                    </div>
                    <h2 id="division-modal-title" className="text-xl font-bold text-slate-800 mb-2">Pilih Divisi</h2>
                    <p className="text-slate-500">Lokasi Anda terverifikasi. Pilih divisi untuk melanjutkan absensi.</p>
                </div>

                <div className="relative border-t border-b border-slate-200 overflow-hidden">
                    <div className="max-h-[40vh] overflow-y-auto custom-scrollbar">
                        <div className="divide-y divide-slate-100">
                            {rules.map((rule) => (
                                <button
                                    key={rule.id}
                                    onClick={() => onSelect(rule)}
                                    className="w-full flex justify-between items-center text-left py-4 px-6 group hover:bg-slate-50 transition-colors duration-150"
                                >
                                    <span className="font-semibold text-slate-700 group-hover:text-sky-600 transition-colors">{rule.nama_divisi}</span>
                                    <ChevronRightIcon className="w-5 h-5 text-slate-400 group-hover:text-sky-600 transition-transform duration-200 group-hover:translate-x-1" />
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Visual fade effect to indicate scrollability */}
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                </div>

                 <div className="p-4 bg-slate-50/50 rounded-b-2xl shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full bg-transparent text-slate-600 font-bold py-3 px-4 rounded-xl hover:bg-slate-200/60 transition-colors"
                    >
                        Batal
                    </button>
                 </div>
            </div>
             <style>{`
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                
                @keyframes scale-in { 
                    from { transform: scale(0.95); opacity: 0; } 
                    to { transform: scale(1); opacity: 1; } 
                }
                .sm\\:animate-scale-in { 
                    @media (min-width: 640px) {
                        animation: scale-in 0.3s ease-out forwards; 
                    }
                }

                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up { 
                    animation: slide-up 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; 
                }

                /* Custom scrollbar for modern browsers */
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1; /* slate-300 */
                    border-radius: 20px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: #94a3b8; /* slate-400 */
                }
                .custom-scrollbar {
                    scrollbar-width: thin;
                    scrollbar-color: #cbd5e1 transparent;
                }
            `}</style>
        </div>
    );
};

export default DivisionSelectionModal;