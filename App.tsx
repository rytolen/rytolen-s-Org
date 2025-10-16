import React, { useState, useEffect, useCallback, useRef } from 'react';
import HomePage from './pages/HomePage';
import HistoryPage from './pages/HistoryPage';
import LeavePage from './pages/LeavePage';
import SalaryPage from './pages/SalaryPage';
import ProfilePage from './pages/ProfilePage';
import Toast from './components/Toast';
import LoginPage from './pages/LoginPage';
import DivisionSelectionModal from './components/DivisionSelectionModal';
import InstallPwaPrompt from './components/InstallPwaPrompt';
import FaceScanner from './components/FaceScanner';
import { supabase } from './lib/supabase';

import { AttendanceRecord, Page, UserProfile, LeaveRequest, LeaveStatus, SalarySlip, AturanAbsensi, FaceDescriptor } from './types';
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

// --- Geolocation Helpers ---
const haversineDistance = (coords1: {lat: number, lon: number}, coords2: {lat: number, lon: number}): number => {
    const R = 6371e3; // metres
    const φ1 = coords1.lat * Math.PI/180; // φ, λ in radians
    const φ2 = coords2.lat * Math.PI/180;
    const Δφ = (coords2.lat-coords1.lat) * Math.PI/180;
    const Δλ = (coords2.lon-coords1.lon) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
}

// --- Anti Mock Location Stub ---
const isMockLocation = (): boolean => {
    // All fake GPS protections are temporarily disabled.
    return false;
};


// --- Routing Helpers ---
const pageToHash: Record<Page, string> = {
    [Page.HOME]: '#/',
    [Page.HISTORY]: '#/history',
    [Page.LEAVE]: '#/leave',
    [Page.SALARY]: '#/salary',
    [Page.PROFILE]: '#/profile',
};

const hashToPage = (hash: string): Page => {
    switch (hash) {
        case '#/history': return Page.HISTORY;
        case '#/leave': return Page.LEAVE;
        case '#/salary': return Page.SALARY;
        case '#/profile': return Page.PROFILE;
        case '#/':
        case '':
        default:
            return Page.HOME;
    }
};

export const App: React.FC = () => {
    const [activePage, setActivePage] = useState<Page>(() => hashToPage(window.location.hash));
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(true);
    const [isHomePageLoading, setIsHomePageLoading] = useState(true);

    const [hasClockedInToday, setHasClockedInToday] = useState(false);
    const [recentAttendanceLog, setRecentAttendanceLog] = useState<AttendanceRecord[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(MOCK_LEAVE_REQUESTS);
    
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    
    // Geolocation and Division State
    const [currentLocation, setCurrentLocation] = useState<GeolocationCoordinates | null>(null);
    const [locationStatus, setLocationStatus] = useState<'checking' | 'allowed' | 'denied' | 'out_of_range'>('checking');
    const [availableAttendanceRules, setAvailableAttendanceRules] = useState<AturanAbsensi[]>([]);
    const [allAttendanceRules, setAllAttendanceRules] = useState<AturanAbsensi[]>([]);
    const [attendanceRulesError, setAttendanceRulesError] = useState<string | null>(null);
    const [isDivisionModalVisible, setDivisionModalVisible] = useState(false);
    
    // PWA Install Prompt State
    const [installPromptEvent, setInstallPromptEvent] = useState<Event | null>(null);
    const [isInstallPromptVisible, setInstallPromptVisible] = useState(false);

    // Face Scanner State
    const [isFaceScannerVisible, setFaceScannerVisible] = useState(false);
    const [faceScannerMode, setFaceScannerMode] = useState<'register' | 'verify'>('verify');
    const [isFaceRegistered, setIsFaceRegistered] = useState(false);
    const [faceDescriptor, setFaceDescriptor] = useState<FaceDescriptor | null>(null);
    const attendanceRuleForVerificationRef = useRef<AturanAbsensi | null>(null);

    // --- PWA Install Logic ---
    useEffect(() => {
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setInstallPromptEvent(e);
        // Show the prompt after a short delay to not be intrusive
        setTimeout(() => setInstallPromptVisible(true), 3000); 
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }, []);
    
    const handleInstall = async () => {
        if (!installPromptEvent) return;
        (installPromptEvent as any).prompt();
        const { outcome } = await (installPromptEvent as any).userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted the A2HS prompt');
        } else {
            console.log('User dismissed the A2HS prompt');
        }
        setInstallPromptEvent(null);
        setInstallPromptVisible(false);
    };

    const handleDismissInstall = () => {
        setInstallPromptEvent(null);
        setInstallPromptVisible(false);
    };


    // --- Navigation Logic ---
    const handleNavigate = useCallback((page: Page) => {
        const newHash = pageToHash[page];
        if (window.location.hash !== newHash) {
            window.location.hash = newHash;
        }
    }, []);

    useEffect(() => {
        const handleHashChange = () => {
            setActivePage(hashToPage(window.location.hash));
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);
    
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
    
     const showToast = useCallback((message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    }, []);

    // Geolocation watcher
    useEffect(() => {
        if (!currentUser || hasClockedInToday) {
            return;
        }

        setLocationStatus('checking');

        const watcher = navigator.geolocation.watchPosition(
            (position) => {
                // Since protection is disabled, we directly trust and set the location.
                if (isMockLocation()) { // This will always be false
                    setLocationStatus('denied');
                    showToast('Lokasi tidak valid terdeteksi.', 'error');
                    setCurrentLocation(null);
                    return;
                }
                setCurrentLocation(position.coords);
            },
            (error) => {
                console.error("Geolocation error:", error);
                setLocationStatus('denied');
                showToast('Akses lokasi ditolak.', 'error');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );

        return () => {
             navigator.geolocation.clearWatch(watcher);
        }
    }, [currentUser, hasClockedInToday, showToast]);


    // Location validation logic
    useEffect(() => {
        if (!currentLocation || !currentUser || isHomePageLoading) {
            return;
        }
    
        if (attendanceRulesError || allAttendanceRules.length === 0) {
            setLocationStatus('out_of_range');
            setAvailableAttendanceRules([]);
            return;
        }
        
        const activeRules = allAttendanceRules.filter(rule => {
            const parseNumber = (value: any): number => {
                if (typeof value === 'number') return value;
                if (typeof value !== 'string') return NaN;
                return parseFloat(value.replace(',', '.'));
            };

            const ruleLat = parseNumber(rule.latitude);
            const ruleLon = parseNumber(rule.longitude);
            const ruleRadius = parseNumber(rule.radius_meter);

            if (isNaN(ruleLat) || isNaN(ruleLon) || isNaN(ruleRadius)) return false;

            const distance = haversineDistance(
                { lat: currentLocation.latitude, lon: currentLocation.longitude },
                { lat: ruleLat, lon: ruleLon }
            );
            return distance <= ruleRadius;
        });
    
        if (activeRules.length > 0) {
            setLocationStatus('allowed');
            setAvailableAttendanceRules(activeRules);
        } else {
            setLocationStatus('out_of_range');
            setAvailableAttendanceRules([]);
        }
    
    }, [currentLocation, currentUser, allAttendanceRules, isHomePageLoading, attendanceRulesError, hasClockedInToday]);


    // Set up real-time listeners when user logs in
    useEffect(() => {
        if (!currentUser) return;

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
                        
                        const deletedRecord = recentAttendanceLog.find(r => r.id === deletedId);
                        setRecentAttendanceLog(prevLog => prevLog.filter(record => record.id !== deletedId));

                        if (deletedRecord && getUtcDateString(new Date(deletedRecord.timestamp)) === todayUtc) {
                            setHasClockedInToday(false);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(attendanceChannel);
        };

    }, [currentUser, recentAttendanceLog]);

    const fetchAndSetUserData = async (employeeId: string) => {
        const { data: karyawanData, error } = await supabase
            .from('karyawan')
            .select('id, nama, status, tanggal_bergabung, jabatan(nama_jabatan)')
            .ilike('id', employeeId)
            .single();

        if (error || !karyawanData) {
            throw new Error(`Error: ${error?.message || "ID Karyawan tidak ditemukan."}`);
        }
        
        const userRecord = karyawanData as any;

        if (userRecord.status.toLowerCase() !== 'aktif') {
            throw new Error(`Login ditolak. Status karyawan: "${userRecord.status}".`);
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
    
    // REVAMPED: More robust data loading function
    const loadUserSpecificData = async (userId: string) => {
        setIsHomePageLoading(true);
        setAttendanceRulesError(null);

        try {
            // Fetch attendance rules
            const { data: allRulesData, error: allRulesError } = await supabase
                .from('aturan_absensi')
                .select('*');
            
            if (allRulesError) {
                console.error("Gagal memuat aturan absensi:", allRulesError);
                setAttendanceRulesError(allRulesError.message);
                setAllAttendanceRules([]);
            } else {
                setAllAttendanceRules(allRulesData || []);
            }

            // Fetch attendance history
            const { data: attendanceData, error: attendanceError } = await supabase
                .from('riwayat_absensi')
                .select('id, timestamp_masuk')
                .eq('karyawan_id', userId)
                .order('timestamp_masuk', { ascending: false })
                .limit(5);

            if (attendanceError) {
                console.error("Gagal memuat riwayat absensi:", attendanceError);
                setRecentAttendanceLog([]);
                setHasClockedInToday(false);
            } else {
                const formattedLog = attendanceData.map(log => ({ id: log.id, timestamp: log.timestamp_masuk }));
                setRecentAttendanceLog(formattedLog);
                const todayUtc = getUtcDateString(new Date());
                const hasClockedIn = formattedLog.some(record => getUtcDateString(new Date(record.timestamp)) === todayUtc);
                setHasClockedInToday(hasClockedIn);
                if (hasClockedIn) {
                    setLocationStatus('allowed');
                }
            }

             // Fetch face data
            const { data: faceData, error: faceError } = await supabase
                .from('wajah_karyawan')
                .select('descriptor')
                .eq('karyawan_id', userId)
                .maybeSingle();

            if (faceError) {
                console.error("Gagal memuat data wajah:", faceError);
                setIsFaceRegistered(false);
                setFaceDescriptor(null);
            } else if (faceData && faceData.descriptor) {
                const descriptorArray = JSON.parse(faceData.descriptor);
                setFaceDescriptor(new Float32Array(descriptorArray));
                setIsFaceRegistered(true);
            } else {
                setIsFaceRegistered(false);
                setFaceDescriptor(null);
            }

        } catch (error) {
            console.error("Terjadi error kritis saat memuat data:", error);
            setAttendanceRulesError("Gagal memuat semua data aplikasi.");
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
        handleNavigate(Page.HOME);
        localStorage.removeItem('loggedInUserId');
        setIsHomePageLoading(true);
        setCurrentLocation(null);
        setAvailableAttendanceRules([]);
        setAllAttendanceRules([]);
    };
    
    const handleAttendance = useCallback(async (rule: AturanAbsensi | null) => {
        if (!currentUser || !currentLocation || !rule) return;

        const newRecord = {
            karyawan_id: currentUser.employeeId,
            timestamp_masuk: new Date().toISOString(),
            latitude_absen: currentLocation.latitude,
            longitude_absen: currentLocation.longitude,
            divisi_nama: rule.nama_divisi,
        };

        const { error } = await supabase.from('riwayat_absensi').insert(newRecord);

        if (error) {
            const isDuplicate = (error as PostgrestError).code === '23505';
            if (isDuplicate) {
                setHasClockedInToday(true);
                return;
            }
            console.error("Gagal menyimpan absensi:", error);
            showToast('Gagal menyimpan absensi.', 'error');
            return;
        }
        
        showToast('Absen Masuk Berhasil!', 'success');
    }, [currentUser, showToast, currentLocation]);
    
    const handleOpenDivisionModal = () => {
        if (availableAttendanceRules.length > 0) {
            setDivisionModalVisible(true);
        }
    };

    const handleRuleSelected = (rule: AturanAbsensi) => {
        setDivisionModalVisible(false);
        attendanceRuleForVerificationRef.current = rule;
        setFaceScannerMode('verify');
        setFaceScannerVisible(true);
    };

    const handleFaceVerificationSuccess = () => {
        setFaceScannerVisible(false);
        handleAttendance(attendanceRuleForVerificationRef.current);
        attendanceRuleForVerificationRef.current = null;
    };

    const handleRegisterFace = async (descriptor: FaceDescriptor) => {
        if (!currentUser) return;
        setFaceScannerVisible(false);

        const descriptorArray = Array.from(descriptor);
        
        const { error } = await supabase
            .from('wajah_karyawan')
            .upsert({ 
                karyawan_id: currentUser.employeeId, 
                descriptor: JSON.stringify(descriptorArray)
            }, { onConflict: 'karyawan_id' });

        if (error) {
            console.error('Gagal menyimpan data wajah:', error);
            showToast('Gagal menyimpan data wajah.', 'error');
        } else {
            setFaceDescriptor(descriptor);
            setIsFaceRegistered(true);
            showToast('Pendaftaran wajah berhasil!', 'success');
        }
    };
    
    const handleOpenFaceRegistration = () => {
        setFaceScannerMode('register');
        setFaceScannerVisible(true);
    };

    const handleAddLeaveRequest = (request: Omit<LeaveRequest, 'id' | 'status'>) => {
        const newRequest: LeaveRequest = { ...request, id: `L${Date.now()}`, status: LeaveStatus.PENDING };
        setLeaveRequests(prev => [newRequest, ...prev]);
        showToast('Pengajuan cuti berhasil dikirim!', 'success');
        handleNavigate(Page.HOME);
    };

    if (isAuthenticating) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-100"><p>Loading...</p></div>;
    }

    if (!currentUser) {
        return <LoginPage onLogin={handleLogin} />;
    }

    const renderPage = () => {
        const onBack = () => handleNavigate(Page.HOME);

        switch (activePage) {
            case Page.HOME:
                return <HomePage
                    user={currentUser}
                    hasClockedInToday={hasClockedInToday}
                    attendanceLog={recentAttendanceLog}
                    onOpenDivisionModal={handleOpenDivisionModal}
                    onNavigate={handleNavigate}
                    isLoading={isHomePageLoading}
                    availableAttendanceRules={availableAttendanceRules}
                    locationStatus={locationStatus}
                    attendanceRulesError={attendanceRulesError}
                    isFaceRegistered={isFaceRegistered}
                />;
            case Page.HISTORY:
                return <HistoryPage user={currentUser} onBack={onBack} />;
            case Page.LEAVE:
                return <LeavePage requests={leaveRequests} onSubmit={handleAddLeaveRequest} onBack={onBack} />;
            case Page.SALARY:
                return <SalaryPage slips={MOCK_SALARY_SLIPS} onBack={onBack} />;
            case Page.PROFILE:
                return <ProfilePage 
                  user={currentUser} 
                  onBack={onBack} 
                  onLogout={handleLogout}
                  onRegisterFace={handleOpenFaceRegistration}
                  isFaceRegistered={isFaceRegistered}
                />;
            default:
                 return <HomePage
                    user={currentUser}
                    hasClockedInToday={hasClockedInToday}
                    attendanceLog={recentAttendanceLog}
                    onOpenDivisionModal={handleOpenDivisionModal}
                    onNavigate={handleNavigate}
                    isLoading={isHomePageLoading}
                    availableAttendanceRules={availableAttendanceRules}
                    locationStatus={locationStatus}
                    attendanceRulesError={attendanceRulesError}
                    isFaceRegistered={isFaceRegistered}
                />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 font-sans">
            <main>
                {renderPage()}
            </main>

            {isFaceScannerVisible && (
                <FaceScanner 
                    mode={faceScannerMode}
                    onSuccess={(descriptor) => {
                        if (faceScannerMode === 'register' && descriptor) {
                            handleRegisterFace(descriptor);
                        } else {
                            handleFaceVerificationSuccess();
                        }
                    }}
                    onCancel={() => setFaceScannerVisible(false)}
                    registeredDescriptor={faceDescriptor}
                />
            )}

            {isInstallPromptVisible && installPromptEvent && (
                <InstallPwaPrompt onInstall={handleInstall} onDismiss={handleDismissInstall} />
            )}

            {isDivisionModalVisible && (
                <DivisionSelectionModal
                    rules={availableAttendanceRules}
                    onSelect={handleRuleSelected}
                    onClose={() => setDivisionModalVisible(false)}
                />
            )}

            {toast && <Toast key={Date.now()} message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
        </div>
    );
};