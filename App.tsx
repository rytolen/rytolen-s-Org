import React, { useState, useEffect, useCallback } from 'react';
import HomePage from './pages/HomePage';
import HistoryPage from './pages/HistoryPage';
import LeavePage from './pages/LeavePage';
import SalaryPage from './pages/SalaryPage';
import ProfilePage from './pages/ProfilePage';
import FaceScanner from './components/FaceScanner';
import Toast from './components/Toast';
import LoginPage from './pages/LoginPage';
import { supabase } from './lib/supabase';

import { AttendanceRecord, Page, UserProfile, LeaveRequest, LeaveStatus, SalarySlip, FaceDescriptor } from './types';
import type { RealtimeChannel, PostgrestError } from '@supabase/supabase-js';

// Mock Data for features not yet in DB
const MOCK_LEAVE_REQUESTS: LeaveRequest[] = [
    { id: 'L001', startDate: '2024-07-20', endDate: '2024-07-21', reason: 'Acara keluarga', status: LeaveStatus.APPROVED },
    { id: 'L002', startDate: '2024-06-10', endDate: '2024-06-10', reason: 'Sakit', status: LeaveStatus.APPROVED },
    { id: 'L003', startDate: '2024-08-01', endDate: '2024-08-05', reason: 'Liburan pribadi', status: LeaveStatus.PENDING },
];

const MOCK_SALARY_SLIPS: SalarySlip[] = [
    { id: 'S001', period: 'Juli 2024', basicSalary: 8000000, allowance: 1500000, deductions: 250000, netSalary: 9250000 },
    { id: 'S002', period: 'Juni 2024', basicSalary: 8000000, allowance: 1500000, deductions: 250000, netSalary: 9250000 },
    { id: 'S003', period: 'Mei 2024', basicSalary: 7500000, allowance: 1200000, deductions: 200000, netSalary: 8500000 },
];

// Helper to get date string in YYYY-MM-DD format based on UTC
const getUtcDateString = (d: Date): string => d.toISOString().split('T')[0];

const App: React.FC = () => {
    const [activePage, setActivePage] = useState<Page>(Page.HOME);
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(true);
    const [isHomePageLoading, setIsHomePageLoading] = useState(true);

    const [hasClockedInToday, setHasClockedInToday] = useState(false);
    const [recentAttendanceLog, setRecentAttendanceLog] = useState<AttendanceRecord[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(MOCK_LEAVE_REQUESTS);
    
    const [isScannerVisible, setScannerVisible] = useState(false);
    const [scannerMode, setScannerMode] = useState<'register' | 'verify'>('verify');
    const [userFaceDescriptor, setUserFaceDescriptor] = useState<FaceDescriptor | null>(null);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    
    // Check for existing session on initial load
    useEffect(() => {
        const checkSession = async () => {
            try {
                const loggedInUserId = localStorage.getItem('loggedInUserId');
                if (loggedInUserId) {
                    await fetchAndSetUserData(loggedInUserId);
                }
            } catch (error) {
                console.error("Session check failed:", error);
            } finally {
                setIsAuthenticating(false);
            }
        };
        checkSession();
    }, []);

    // Set up real-time listeners when user logs in
    useEffect(() => {
        if (!currentUser) return;

        // Listener for attendance records changes (INSERT, DELETE)
        const attendanceChannel: RealtimeChannel = supabase
            .channel(`public:riwayat_absensi:karyawan_id=eq.${currentUser.employeeId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'riwayat_absensi', filter: `karyawan_id=eq.${currentUser.employeeId}` },
                (payload) => {
                    const todayUtc = getUtcDateString(new Date());

                    if (payload.eventType === 'INSERT') {
                        const newRecord: AttendanceRecord = { id: payload.new.id, timestamp: payload.new.timestamp_masuk };
                        setRecentAttendanceLog(prevLog => [newRecord, ...prevLog]
                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                            .slice(0, 5));
                        
                        if (getUtcDateString(new Date(newRecord.timestamp)) === todayUtc) {
                            setHasClockedInToday(true);
                        }
                    } else if (payload.eventType === 'DELETE') {
                        const deletedId = payload.old.id as string;
                        if (!deletedId) return;

                        // Find the record in the current state before removing it.
                        const deletedRecord = recentAttendanceLog.find(r => r.id === deletedId);
                        
                        // Now remove it from the state.
                        setRecentAttendanceLog(prevLog => prevLog.filter(record => record.id !== deletedId));

                        // If we found the record, we can check its timestamp to update today's status.
                        if (deletedRecord && getUtcDateString(new Date(deletedRecord.timestamp)) === todayUtc) {
                            setHasClockedInToday(false);
                        }
                    }
                }
            )
            .subscribe();


        // Listener for face data updates
        const faceDataChannel: RealtimeChannel = supabase
             .channel(`public:wajah_karyawan:karyawan_id=eq.${currentUser.employeeId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'wajah_karyawan', filter: `karyawan_id=eq.${currentUser.employeeId}` },
                (payload) => {
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const newDescriptor = payload.new.descriptor;
                        setUserFaceDescriptor(new Float32Array(newDescriptor));
                    } else if (payload.eventType === 'DELETE') {
                        setUserFaceDescriptor(null);
                    }
                }
            )
            .subscribe();

        // Cleanup function to remove subscriptions
        return () => {
            supabase.removeChannel(attendanceChannel);
            supabase.removeChannel(faceDataChannel);
        };

    }, [currentUser, recentAttendanceLog]);

    const fetchAndSetUserData = async (employeeId: string) => {
        const { data: karyawanData, error } = await supabase
            .from('karyawan')
            .select('id, nama, status, tanggal_bergabung, jabatan(nama_jabatan)')
            .ilike('id', employeeId);

        if (error) {
            throw new Error(`Error dari Supabase: ${error.message}`);
        }
        
        if (!karyawanData || karyawanData.length === 0) {
            throw new Error("ID Karyawan tidak ditemukan di database.");
        }
        
        const userRecord = karyawanData[0] as any;

        if (userRecord.status.toLowerCase() !== 'aktif') {
            throw new Error(`Login ditolak. Status karyawan: "${userRecord.status}". Diperlukan status "aktif".`);
        }
        
        const positionName = userRecord.jabatan?.nama_jabatan || 'Jabatan tidak terdaftar';
        
        const userProfile: UserProfile = {
            employeeId: userRecord.id,
            name: userRecord.nama,
            position: positionName,
            joinDate: userRecord.tanggal_bergabung,
            status: userRecord.status,
            avatarUrl: `https://i.pravatar.cc/150?u=${userRecord.id}`,
            email: `${userRecord.nama.split(' ')[0].toLowerCase()}@perusahaan.com`,
            phone: '0812-0000-0000', // Placeholder
        };

        setCurrentUser(userProfile);
        await loadUserSpecificData(employeeId);
    };
    
    const loadUserSpecificData = async (userId: string) => {
        setIsHomePageLoading(true);
        try {
            const [attendanceResult, faceResult] = await Promise.all([
                supabase
                    .from('riwayat_absensi')
                    .select('id, timestamp_masuk')
                    .eq('karyawan_id', userId)
                    .order('timestamp_masuk', { ascending: false })
                    .limit(5),
                supabase
                    .from('wajah_karyawan')
                    .select('descriptor')
                    .eq('karyawan_id', userId)
                    .single()
            ]);

            // Process attendance data
            const { data: attendanceData, error: attendanceError } = attendanceResult;
            if (attendanceError) {
                console.error("Gagal memuat riwayat absensi:", attendanceError);
                setRecentAttendanceLog([]);
            } else {
                const formattedLog = attendanceData.map(log => ({ id: log.id, timestamp: log.timestamp_masuk }));
                setRecentAttendanceLog(formattedLog);
                const todayUtc = getUtcDateString(new Date());
                const hasClockedIn = formattedLog.some(record => getUtcDateString(new Date(record.timestamp)) === todayUtc);
                setHasClockedInToday(hasClockedIn);
            }

            // Process face data
            const { data: faceData, error: faceError } = faceResult;
            if (faceError && faceError.code !== 'PGRST116') { // Ignore no rows error
                console.warn("Data wajah belum ada atau gagal dimuat:", faceError.message);
                setUserFaceDescriptor(null);
            } else if (faceData && faceData.descriptor) {
                setUserFaceDescriptor(new Float32Array(faceData.descriptor as any));
            } else {
                setUserFaceDescriptor(null);
            }

        } catch (error) {
            console.error("Gagal memuat data spesifik pengguna:", error);
            setRecentAttendanceLog([]);
            setHasClockedInToday(false);
            setUserFaceDescriptor(null);
        } finally {
            setIsHomePageLoading(false);
        }
    };
    
    const handleLogin = async (employeeId: string): Promise<{ success: boolean; message: string }> => {
        try {
            await fetchAndSetUserData(employeeId);
            localStorage.setItem('loggedInUserId', employeeId);
            return { success: true, message: 'Login berhasil!' };
        } catch (error: any) {
            console.error("Login failed:", error);
            return { success: false, message: error.message || 'Login gagal, terjadi kesalahan tidak diketahui.' };
        }
    };

    const handleLogout = () => {
        supabase.removeAllChannels();
        setCurrentUser(null);
        setActivePage(Page.HOME);
        localStorage.removeItem('loggedInUserId');
        setUserFaceDescriptor(null);
        setIsHomePageLoading(true);
    };
    
    const showToast = useCallback((message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    }, []);
    
    const handleAttendance = useCallback(async () => {
        if (!currentUser) return;

        const newRecord = {
            karyawan_id: currentUser.employeeId,
            timestamp_masuk: new Date().toISOString()
        };

        const { error } = await supabase.from('riwayat_absensi').insert(newRecord);

        if (error) {
            const isDuplicate = (error as PostgrestError).code === '23505';
            if (isDuplicate) {
                console.warn('Attempted to clock in twice. UI state will be synced.');
                setHasClockedInToday(true);
                return;
            }

            console.error("Gagal menyimpan absensi:", error);
            showToast('Gagal menyimpan absensi.', 'error');
            return;
        }
        
        showToast('Absen Masuk Berhasil!', 'success');
    }, [currentUser, showToast]);
    
    const handleRegisterSuccess = async (descriptor: FaceDescriptor) => {
        if (!currentUser) return;
        
        const descriptorArray = Array.from(descriptor);
        
        const { error } = await supabase
            .from('wajah_karyawan')
            .upsert({ 
                karyawan_id: currentUser.employeeId, 
                descriptor: descriptorArray 
            }, { onConflict: 'karyawan_id' });

        if (error) {
            console.error('Error saving face data:', error);
            setScannerVisible(false);
            showToast('Gagal menyimpan data wajah!', 'error');
            return;
        }
        
        setScannerVisible(false);
        showToast('Wajah berhasil didaftarkan!', 'success');
    };

    const handleVerifySuccess = () => {
        setScannerVisible(false);
        handleAttendance();
    };

    const handleVerifyFailure = (error: string) => {
        setScannerVisible(false);
        showToast(error, 'error');
    };

    const handleAddLeaveRequest = (request: Omit<LeaveRequest, 'id' | 'status'>) => {
        const newRequest: LeaveRequest = { ...request, id: `L${Date.now()}`, status: LeaveStatus.PENDING };
        setLeaveRequests(prev => [newRequest, ...prev]);
        showToast('Pengajuan cuti berhasil dikirim!', 'success');
        setActivePage(Page.HOME);
    };

    const openScanner = (mode: 'register' | 'verify') => {
        setScannerMode(mode);
        setScannerVisible(true);
    }
    
    if (isAuthenticating) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-100"><p>Loading...</p></div>;
    }

    if (!currentUser) {
        return <LoginPage onLogin={handleLogin} />;
    }

    const renderPage = () => {
        if (activePage === Page.HOME) {
             return <HomePage
                user={currentUser}
                hasClockedInToday={hasClockedInToday}
                attendanceLog={recentAttendanceLog}
                onScanClick={() => openScanner('verify')}
                onNavigate={setActivePage}
                isFaceRegistered={!!userFaceDescriptor}
                isLoading={isHomePageLoading}
            />;
        }

        const onBack = () => setActivePage(Page.HOME);

        switch (activePage) {
            case Page.HISTORY:
                return <HistoryPage user={currentUser} onBack={onBack} />;
            case Page.LEAVE:
                return <LeavePage requests={leaveRequests} onSubmit={handleAddLeaveRequest} onBack={onBack} />;
            case Page.SALARY:
                return <SalaryPage slips={MOCK_SALARY_SLIPS} onBack={onBack} />;
            case Page.PROFILE:
                return <ProfilePage user={currentUser} onBack={onBack} isFaceRegistered={!!userFaceDescriptor} onRegisterFace={() => openScanner('register')} onLogout={handleLogout} />;
            default:
                 return <HomePage
                    user={currentUser}
                    hasClockedInToday={hasClockedInToday}
                    attendanceLog={recentAttendanceLog}
                    onScanClick={() => openScanner('verify')}
                    onNavigate={setActivePage}
                    isFaceRegistered={!!userFaceDescriptor}
                    isLoading={isHomePageLoading}
                />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 font-sans">
            <main>
                {renderPage()}
            </main>
            
            {isScannerVisible && (
                <FaceScanner
                    mode={scannerMode}
                    onClose={() => setScannerVisible(false)}
                    onRegisterSuccess={handleRegisterSuccess}
                    onVerifySuccess={handleVerifySuccess}
                    onVerifyFailure={handleVerifyFailure}
                    registeredDescriptor={userFaceDescriptor}
                />
            )}

            {toast && <Toast key={Date.now()} message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    );
};

export default App;