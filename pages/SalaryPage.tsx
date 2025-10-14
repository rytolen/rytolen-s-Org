import React, { useState } from 'react';
import { SalarySlip } from '../types';

interface SalaryPageProps {
  slips: SalarySlip[];
  onBack: () => void;
}

const SalaryCard: React.FC<{ slip: SalarySlip }> = ({ slip }) => {
    const [isOpen, setIsOpen] = useState(false);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    }

    return (
        <li className="bg-white rounded-xl shadow-sm overflow-hidden transition-all duration-300">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full text-left p-4 flex justify-between items-center hover:bg-slate-50">
                <div>
                    <p className="font-bold text-slate-800">Gaji Periode {slip.period}</p>
                    <p className="text-lg font-mono text-sky-600">{formatCurrency(slip.netSalary)}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            <div className={`transition-max-height duration-500 ease-in-out overflow-hidden ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
                <div className="px-4 pb-4 border-t border-slate-100">
                    <h4 className="font-semibold text-slate-600 mt-3 mb-2">Rincian Pendapatan:</h4>
                    <div className="flex justify-between text-slate-700"><span>Gaji Pokok</span> <span>{formatCurrency(slip.basicSalary)}</span></div>
                    <div className="flex justify-between text-slate-700"><span>Tunjangan</span> <span>{formatCurrency(slip.allowance)}</span></div>
                    
                    <h4 className="font-semibold text-slate-600 mt-4 mb-2">Potongan:</h4>
                    <div className="flex justify-between text-red-600"><span>Potongan BPJS & Pajak</span> <span>- {formatCurrency(slip.deductions)}</span></div>
                    
                    <div className="border-t border-slate-200 mt-4 pt-2 flex justify-between font-bold text-slate-800">
                      <span>Total Diterima</span> <span>{formatCurrency(slip.netSalary)}</span>
                    </div>
                </div>
            </div>
        </li>
    );
};


const SalaryPage: React.FC<SalaryPageProps> = ({ slips, onBack }) => {
  return (
    <div className="bg-slate-50 min-h-screen">
        <header className="p-4 pt-6 bg-white/80 backdrop-blur-lg border-b border-slate-200 flex items-center sticky top-0 z-10">
            <button onClick={onBack} className="mr-4 text-slate-600 hover:text-slate-900 p-2 rounded-full hover:bg-slate-200 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <h1 className="text-xl font-bold text-slate-800">Pendapatan</h1>
        </header>
        <div className="p-4">
            <h3 className="text-xl font-bold text-slate-700 mb-4">Slip Gaji</h3>
            {slips.length > 0 ? (
                <ul className="space-y-3">
                    {slips.map((slip, index) => <SalaryCard key={slip.id} slip={slip} />)}
                </ul>
            ) : (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                    <p className="text-slate-500">Data gaji tidak ditemukan.</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default SalaryPage;