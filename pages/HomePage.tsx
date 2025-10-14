import React from 'react';
import { UserProfile, AttendanceRecord, Page } from '../types';
import Clock from '../components/Clock';
import StatusDisplay from '../components/StatusDisplay';
import ActionButton from '../components/ActionButton';
import AttendanceLog from '../components/AttendanceLog';

interface HomePageProps {
  user: UserProfile;
  hasClockedInToday: boolean;
  attendanceLog: AttendanceRecord[];
  onScanClick: () => void;
  onNavigate: (page: Page) => void;
  isFaceRegistered: boolean;
  isLoading: boolean;
}

// --- Icons ---
const FaceScanIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM8.541 15.142a.75.75 0 0 1 0-1.061l1.173-1.172a.75.75 0 0 1 1.06 0l1.173 1.172a.75.75 0 0 1 0 1.061l-1.173 1.172a.75.75 0 0 1-1.06 0L8.54 15.142ZM14.25 10.5a.75.75 0 0 0 0 1.5h.008a.75.75 0 0 0 0-1.5H14.25ZM9.75 12a.75.75 0 0 1-.75-.75V9.75a.75.75 0 0 1 1.5 0v1.5a.75.75 0 0 1-.75.75Zm4.509 3.098a.75.75 0 0 1 .019 1.06l-1.172 1.172a.75.75 0 1 1-1.06-1.06l1.172-1.172a.75.75 0 0 1 1.041-.001Z" />
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
        <div className="h-8 bg-slate-200 rounded-full w-48 mx-auto my-4"></div> {/* Placeholder for StatusDisplay */}
        <div className="h-14 bg-slate-200 rounded-xl mt-4"></div> {/* Placeholder for ActionButton */}
    </div>
);


const HomePage: React.FC<HomePageProps> = ({ user, hasClockedInToday, attendanceLog, onScanClick, onNavigate, isFaceRegistered, isLoading }) => {
    return (
        <div className="bg-slate-100 min-h-screen">
            {/* --- Header --- */}
            <header className="bg-sky-600 px-6 pt-6 pb-20 rounded-b-3xl text-white shadow-lg">
                <div className="flex items-center gap-4">
                    <img src={user.avatarUrl} alt={user.name} className="w-14 h-14 rounded-full border-2 border-white/50" />
                    <div>
                        <p className="text-sky-200">Selamat datang,</p>
                        <h1 className="text-xl font-bold">{user.name}</h1>
                    </div>
                </div>
            </header>

            {/* --- Main Action Panel --- */}
            <div className="px-4 -mt-10">
                <div className="bg-white rounded-2xl shadow-xl p-4 text-center">
                    <Clock />
                    {isLoading ? (
                        <ActionPanelSkeleton />
                    ) : (
                        <>
                            <StatusDisplay hasClockedInToday={hasClockedInToday} />
                            <div className="mt-4">
                                <ActionButton
                                    label={hasClockedInToday ? "Anda Sudah Absen" : "Absen Hari Ini"}
                                    onClick={onScanClick}
                                    className={hasClockedInToday ? "bg-green-600" : "bg-sky-600 focus:ring-sky-500"}
                                    Icon={FaceScanIcon}
                                    disabled={!isFaceRegistered || hasClockedInToday}
                                />
                                {!isFaceRegistered && <p className="text-xs text-red-500 mt-2">Daftarkan wajah Anda di menu Profil terlebih dahulu.</p>}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* --- Menu Grid --- */}
            <div className="p-6">
                 <div className="grid grid-cols-4 gap-4">
                    <MenuItem label="Riwayat" icon={<HistoryIcon className="w-8 h-8 text-sky-600"/>} onClick={() => onNavigate(Page.HISTORY)} />
                    <MenuItem label="Cuti" icon={<LeaveIcon className="w-8 h-8 text-green-600"/>} onClick={() => onNavigate(Page.LEAVE)} />
                    <MenuItem label="Gaji" icon={<SalaryIcon className="w-8 h-8 text-yellow-600"/>} onClick={() => onNavigate(Page.SALARY)} />
                    <MenuItem label="Profil" icon={<ProfileIcon className="w-8 h-8 text-indigo-600"/>} onClick={() => onNavigate(Page.PROFILE)} />
                </div>
            </div>

            {/* --- Recent Activity --- */}
            <div className="pb-6">
                <AttendanceLog records={attendanceLog} title="Aktivitas Terbaru" showEmptyState={true} />
            </div>
        </div>
    );
};

export default HomePage;