import React from 'react';
import { UserProfile, AttendanceRecord, Page, AturanAbsensi } from '../types';
import Clock from '../components/Clock';
import StatusDisplay from '../components/StatusDisplay';
import ActionButton from '../components/ActionButton';
import AttendanceLog from '../components/AttendanceLog';

interface HomePageProps {
  user: UserProfile;
  hasClockedInToday: boolean;
  attendanceLog: AttendanceRecord[];
  onOpenDivisionModal: () => void;
  onNavigate: (page: Page) => void;
  isLoading: boolean;
  availableAttendanceRules: AturanAbsensi[];
  locationStatus: 'checking' | 'allowed' | 'denied' | 'out_of_range';
  attendanceRulesError: string | null;
  isFaceRegistered: boolean;
}

// --- Icons ---
const FingerPrintIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM4.5 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM15.75 15.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0zM8.25 15.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0zM4.5 15.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0z" clipRule="evenodd" />
    </svg>
);


const HistoryIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12 2.25a.75.75 0 01.75.75v9a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75z" />
        <path fillRule="evenodd" d="M12 21a9 9 0 100-18 9 9 0 000 18zm.75-10.5a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0v-4.5z" clipRule="evenodd" />
    </svg>
);

const LeaveIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3-3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zM5.25 6.75c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h13.5c.621 0 1.125-.504 1.125-1.125V7.875c0-.621-.504-1.125-1.125-1.125H5.25z" clipRule="evenodd" />
    </svg>
);

const SalaryIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M4.5 3.75a3 3 0 00-3 3v.75h21v-.75a3 3 0 00-3-3h-15z" />
        <path fillRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 003 3h15a3 3 0 003-3v-7.5zm-18 3.75a.75.75 0 01.75-.75h6a.75.75 0 010 1.5h-6a.75.75 0 01-.75-.75z" clipRule="evenodd" />
    </svg>
);

const ProfileIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
    </svg>
);

// --- Components ---
const MenuItem: React.FC<{ label: string; icon: React.ReactNode; onClick: () => void }> = ({ label, icon, onClick }) => (
    <button onClick={onClick} className="flex flex-col items-center justify-center gap-2 group">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-sky-50 transition-colors">
            {icon}
        </div>
        <p className="text-sm font-semibold text-slate-600 group-hover:text-sky-600 transition-colors">{label}</p>
    </button>
);

const ActionPanelSkeleton: React.FC = () => (
    <div className="animate-pulse py-1">
        <div className="h-8 bg-slate-200 rounded-full w-48 mx-auto my-4"></div>
        <div className="h-8 bg-slate-200 rounded-lg w-full mt-2 mb-4"></div>
        <div className="h-14 bg-slate-200 rounded-xl mt-4"></div>
    </div>
);

const LocationStatusIndicator: React.FC<{ status: HomePageProps['locationStatus'], isLoading: boolean }> = ({ status, isLoading }) => {
    const effectiveStatus = isLoading ? 'checking' : status;
    const configs = {
        checking: { text: 'Mengecek lokasi...', color: 'text-slate-500', icon: <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>},
        allowed: { text: 'Anda berada di lokasi', color: 'text-green-600', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> },
        denied: { text: 'Akses lokasi ditolak', color: 'text-red-600', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg> },
        out_of_range: { text: 'Anda di luar jangkauan', color: 'text-yellow-600', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.636-1.21 2.37-1.21 3.006 0l5.429 10.372c.63 1.203-.284 2.629-1.503 2.629H4.331c-1.22 0-2.133-1.426-1.503-2.629L8.257 3.099zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg> }
    };
    const current = configs[effectiveStatus];
    return <div className={`flex items-center justify-center gap-2 text-sm font-semibold ${current.color}`}>
        {current.icon}
        <span>{current.text}</span>
    </div>
}

const HomePage: React.FC<HomePageProps> = ({ 
    user, hasClockedInToday, attendanceLog, onOpenDivisionModal, onNavigate, 
    isLoading, availableAttendanceRules,
    locationStatus, attendanceRulesError, isFaceRegistered
}) => {
    
    const isLocationAllowed = locationStatus === 'allowed' && availableAttendanceRules.length > 0;

    const getButtonLabel = () => {
        if (isLoading) return "Memuat data...";
        if (hasClockedInToday) return "Anda Sudah Absen";
        if (locationStatus === 'checking') return "Mengecek Lokasi...";
        if (locationStatus === 'denied') return "Akses Lokasi Ditolak";
        if (locationStatus === 'out_of_range') return "Anda di Luar Jangkauan";
        if (!isFaceRegistered) return "Wajah Belum Terdaftar";
        if (isLocationAllowed) return "Absen Hari Ini";
        return "Tunggu..."; // Fallback for intermediate states
    };
    
    return (
        <div className="bg-slate-100 min-h-screen">
            <header className="bg-sky-600 px-6 pt-6 pb-20 rounded-b-3xl text-white shadow-lg">
                <div className="flex items-center gap-4">
                    <img src={user.avatarUrl} alt={user.name} className="w-14 h-14 rounded-full border-2 border-white/50" />
                    <div>
                        <p className="text-sky-200">Selamat datang,</p>
                        <h1 className="text-xl font-bold">{user.name}</h1>
                    </div>
                </div>
            </header>

            <div className="px-4 -mt-10">
                <div className="bg-white rounded-2xl shadow-xl p-4 text-center">
                    <Clock />
                    {isLoading ? (
                        <ActionPanelSkeleton />
                    ) : (
                        <>
                            <StatusDisplay hasClockedInToday={hasClockedInToday} />
                            <div className="my-4 h-6">
                                <LocationStatusIndicator status={locationStatus} isLoading={locationStatus === 'checking'} />
                            </div>
                            <div className="mt-2">
                                <ActionButton
                                    label={getButtonLabel()}
                                    onClick={onOpenDivisionModal}
                                    className={hasClockedInToday ? "bg-green-600" : "bg-sky-600 focus:ring-sky-500"}
                                    Icon={FingerPrintIcon}
                                    disabled={hasClockedInToday || !isLocationAllowed || !isFaceRegistered || isLoading}
                                />
                                {!hasClockedInToday && !isFaceRegistered && !isLoading && (
                                     <p className="text-xs text-yellow-600 mt-2">Daftarkan wajah Anda di halaman Profil untuk absen.</p>
                                )}
                                {!hasClockedInToday && locationStatus === 'out_of_range' && !isLoading && isFaceRegistered &&
                                    <p className="text-xs text-yellow-600 mt-2">Tidak ada divisi yang tersedia untuk absen di lokasi Anda saat ini.</p>
                                }
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="p-6">
                 <div className="grid grid-cols-4 gap-4">
                    <MenuItem label="Riwayat" icon={<HistoryIcon className="w-8 h-8 text-sky-600"/>} onClick={() => onNavigate(Page.HISTORY)} />
                    <MenuItem label="Cuti" icon={<LeaveIcon className="w-8 h-8 text-green-600"/>} onClick={() => onNavigate(Page.LEAVE)} />
                    <MenuItem label="Gaji" icon={<SalaryIcon className="w-8 h-8 text-yellow-600"/>} onClick={() => onNavigate(Page.SALARY)} />
                    <MenuItem label="Profil" icon={<ProfileIcon className="w-8 h-8 text-indigo-600"/>} onClick={() => onNavigate(Page.PROFILE)} />
                </div>
            </div>

            <div className="pb-6">
                <AttendanceLog records={attendanceLog} title="Aktivitas Terbaru" showEmptyState={true} />
            </div>
        </div>
    );
};

export default HomePage;