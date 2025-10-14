import React from 'react';
import { UserProfile } from '../types';

interface ProfilePageProps {
  user: UserProfile;
  onBack: () => void;
  isFaceRegistered: boolean;
  onRegisterFace: () => void;
  onLogout: () => void;
}

const InfoRow: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="flex items-start gap-4 py-4">
        <div className="text-slate-500 shrink-0">{icon}</div>
        <div>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="font-semibold text-slate-800">{value}</p>
        </div>
    </div>
);

const ProfilePage: React.FC<ProfilePageProps> = ({ user, onBack, isFaceRegistered, onRegisterFace, onLogout }) => {

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    
    const capitalize = (s: string) => {
        if (typeof s !== 'string') return ''
        return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    }

    return (
      <div className="bg-slate-100 min-h-screen">
          <div className="relative h-40 bg-sky-600">
               <button onClick={onBack} className="absolute top-6 left-4 text-white bg-black/20 rounded-full p-2 hover:bg-black/40 transition-colors z-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
              <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden">
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              </div>
          </div>
          
          <div className="pt-20 text-center px-4">
              <h1 className="text-2xl font-bold text-slate-800">{user.name}</h1>
              <p className="text-slate-500">{user.position}</p>
              <p className="text-sm text-slate-400 mt-1">ID: {user.employeeId}</p>
          </div>

          <div className="px-6 mt-10">
              <div className="bg-white rounded-xl shadow-sm p-4 divide-y divide-slate-200">
                  <InfoRow label="Tanggal Bergabung" value={formatDate(user.joinDate)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M-4.5 12h22.5" /></svg>} />
                  <InfoRow label="Status" value={capitalize(user.status)} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.998-.53 1.563-.43zM15.75 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /></svg>} />
                  <InfoRow label="Jabatan" value={user.position} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>} />
              </div>
          </div>

          <div className="p-6 mt-2 space-y-4">
              <button 
                onClick={onRegisterFace}
                disabled={isFaceRegistered}
                className="w-full flex items-center justify-center gap-3 py-3 px-6 rounded-xl text-sky-600 bg-sky-100 font-bold text-md transform transition-all duration-150 ease-in-out enabled:hover:bg-sky-200 enabled:active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                {isFaceRegistered ? 'Wajah Terdaftar' : 'Daftar Wajah'}
               </button>

               <button 
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-3 py-3 px-6 rounded-xl text-red-600 bg-red-100 font-bold text-md transform transition-transform duration-150 ease-in-out hover:bg-red-200 active:scale-95"
                >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
                Keluar
               </button>
          </div>

      </div>
    );
};

export default ProfilePage;