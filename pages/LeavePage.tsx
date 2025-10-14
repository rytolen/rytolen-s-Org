import React, { useState } from 'react';
import { LeaveRequest, LeaveStatus } from '../types';
import ActionButton from '../components/ActionButton';

interface LeavePageProps {
    requests: LeaveRequest[];
    onSubmit: (request: Omit<LeaveRequest, 'id' | 'status'>) => void;
    onBack: () => void;
}

const LeaveStatusBadge: React.FC<{ status: LeaveStatus }> = ({ status }) => {
    const config = {
        [LeaveStatus.PENDING]: { text: 'Menunggu', bg: 'bg-yellow-100', text_color: 'text-yellow-800' },
        [LeaveStatus.APPROVED]: { text: 'Disetujui', bg: 'bg-green-100', text_color: 'text-green-800' },
        [LeaveStatus.REJECTED]: { text: 'Ditolak', bg: 'bg-red-100', text_color: 'text-red-800' },
    };
    const current = config[status];
    return <span className={`px-3 py-1 text-xs font-bold rounded-full ${current.bg} ${current.text_color}`}>{current.text}</span>;
};

const PlusIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
);


const LeavePage: React.FC<LeavePageProps> = ({ requests, onSubmit, onBack }) => {
    const [isFormVisible, setFormVisible] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!startDate || !endDate || !reason) {
            alert("Harap isi semua kolom.");
            return;
        }
        onSubmit({ startDate, endDate, reason });
        // Reset form and close it is handled by the parent component navigating away
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    return (
        <div className="bg-slate-50 min-h-screen">
            <header className="p-4 pt-6 bg-white/80 backdrop-blur-lg border-b border-slate-200 flex items-center sticky top-0 z-10">
                <button onClick={onBack} className="mr-4 text-slate-600 hover:text-slate-900 p-2 rounded-full hover:bg-slate-200 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-xl font-bold text-slate-800">Pengajuan Cuti</h1>
            </header>
            
            <div className="p-4">
                {!isFormVisible && (
                    <ActionButton
                        label="Ajukan Cuti Baru"
                        onClick={() => setFormVisible(true)}
                        className="bg-sky-600 focus:ring-sky-500"
                        Icon={PlusIcon}
                    />
                )}
                
                {isFormVisible && (
                    <div className="bg-white p-6 rounded-2xl shadow-md animate-fade-in">
                        <h2 className="text-xl font-bold mb-4 text-slate-700">Form Pengajuan Cuti</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="startDate" className="block text-sm font-medium text-slate-600 mb-1">Tanggal Mulai</label>
                                <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-sky-500 focus:border-sky-500" />
                            </div>
                            <div>
                                <label htmlFor="endDate" className="block text-sm font-medium text-slate-600 mb-1">Tanggal Selesai</label>
                                <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-sky-500 focus:border-sky-500" />
                            </div>
                            <div>
                                <label htmlFor="reason" className="block text-sm font-medium text-slate-600 mb-1">Alasan</label>
                                <textarea id="reason" value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-sky-500 focus:border-sky-500"></textarea>
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button type="button" onClick={() => setFormVisible(false)} className="w-full py-3 px-4 rounded-xl text-slate-700 bg-slate-200 font-bold transition-colors hover:bg-slate-300">Batal</button>
                                <button type="submit" className="w-full py-3 px-4 rounded-xl text-white bg-sky-600 font-bold transition-colors hover:bg-sky-700">Kirim</button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="mt-8">
                    <h3 className="text-xl font-bold text-slate-700 mb-4">Riwayat Pengajuan</h3>
                    <ul className="space-y-3">
                        {requests.length > 0 ? requests.map(req => (
                            <li key={req.id} className="bg-white p-4 rounded-xl shadow-sm">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-slate-800">{formatDate(req.startDate)} - {formatDate(req.endDate)}</p>
                                        <p className="text-sm text-slate-500 mt-1">{req.reason}</p>
                                    </div>
                                    <LeaveStatusBadge status={req.status} />
                                </div>
                            </li>
                        )) : (
                           <p className="text-center text-slate-500 py-8">Belum ada riwayat pengajuan cuti.</p>
                        )}
                    </ul>
                </div>
            </div>
             <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

export default LeavePage;