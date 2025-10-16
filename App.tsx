import React, { useState, useEffect, useCallback, useRef } from 'react';
import HomePage from './pages/HomePage';
import HistoryPage from './pages/HistoryPage';
import LeavePage from './pages/LeavePage';
import SalaryPage from './pages/SalaryPage';
import ProfilePage from './pages/ProfilePage';
import FaceScanner from './components/FaceScanner';
import Toast from './components/Toast';
import LoginPage from './pages/LoginPage';
import DivisionSelectionModal from './components/DivisionSelectionModal';
import { supabase } from './lib/supabase';

import { AttendanceRecord, Page, UserProfile, LeaveRequest, LeaveStatus, SalarySlip, FaceDescriptor, AturanAbsensi } from './types';
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

// --- Anti Mock Location Helpers ---
const STABILITY_THRESHOLD = 10; // Number of consecutive stable updates to be considered suspicious.
const MIN_VALID_READINGS_REQUIRED = 3; // Number of consecutive valid readings needed to trust the GPS signal.

const analyzeSignalStability = (
    history: GeolocationCoordinates[],
    stagnantCoordsCount: React.MutableRefObject<number>,
    stagnantAccuracyCount: React.MutableRefObject<number>
): boolean => {
    // We need at least two data points to compare behavior.
    if (history.length < 2) {
        return false;
    }

    const currentCoords = history[0];
    const previousCoords = history[1];

    // --- Coordinate Stability Check ---
    if (currentCoords.latitude === previousCoords.latitude && currentCoords.longitude === previousCoords.longitude) {
        stagnantCoordsCount.current++;
    } else {
        // Any movement, no matter how small, resets the counter. This prevents false positives for stationary users.
        stagnantCoordsCount.current = 0;
    }

    // --- Accuracy Stability Check ---
    if (currentCoords.accuracy === previousCoords.accuracy) {
        stagnantAccuracyCount.current++;
    } else {
        // Any fluctuation in accuracy also resets the counter.
        stagnantAccuracyCount.current = 0;
    }

    // --- Final Verdict ---
    if (stagnantCoordsCount.current >= STABILITY_THRESHOLD) {
        console.warn(`Lokasi tidak valid: Koordinat statis selama ${stagnantCoordsCount.current} pembaruan.`);
        return true;
    }
    if (stagnantAccuracyCount.current >= STABILITY_THRESHOLD) {
        console.warn(`Lokasi tidak valid: Akurasi statis selama ${stagnantAccuracyCount.current} pembaruan.`);
        return true;
    }

    return false;
};


const isMockLocation = (
    position: GeolocationPosition, 
    locationHistory: GeolocationCoordinates[],
    stagnantCoordsCount: React.MutableRefObject<number>,
    stagnantAccuracyCount: React.MutableRefObject<number>
): boolean => {
    // Layer 1: Check for the non-standard `isMock` flag.
    if ((position as any).isMock === true) {
        console.warn("Lokasi tidak valid terdeteksi via isMock flag.");
        return true;
    }

    // Layer 2: Check for overly precise accuracy. Real GPS is almost never perfect.
    // A threshold of strictly less than 1 meter catches most mock apps.
    if (position.coords.accuracy < 1) {
        console.warn(`Lokasi tidak valid: Akurasi tidak wajar ${position.coords.accuracy}m.`);
        return true;
    }

    // Layer 3: Check the timestamp. If it's too old, it might be a replayed location.
    const locationAge = Date.now() - position.timestamp;
    if (locationAge > 5000) { // More than 5 seconds old
        console.warn(`Lokasi tidak valid: Timestamp usang (${locationAge}ms).`);
        return true;
    }
    
    // Layer 4: Behavioral analysis of the GPS signal over time.
    if (analyzeSignalStability(locationHistory, stagnantCoordsCount, stagnantAccuracyCount)) {
        return true;
    }

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
    
    const [isScannerVisible, setScannerVisible] = useState(false);
    const [scannerMode, setScannerMode] = useState<'register' | 'verify'>('verify');
    const [userFaceDescriptor, setUserFaceDescriptor] = useState<FaceDescriptor | null>(null);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    
    // Geolocation and Division State
    const [currentLocation, setCurrentLocation] = useState<GeolocationCoordinates | null>(null);
    const [locationStatus, setLocationStatus] = useState<'checking' | 'allowed' | 'denied' | 'out_of_range'>('checking');
    const [availableAttendanceRules, setAvailableAttendanceRules] = useState<AturanAbsensi[]>([]);
    const [allAttendanceRules, setAllAttendanceRules] = useState<AturanAbsensi[]>([]);
    const [attendanceRulesError, setAttendanceRulesError] = useState<string | null>(null);
    const [isDivisionModalVisible, setDivisionModalVisible] = useState(false);
    const [selectedRuleForAttendance, setSelectedRuleForAttendance] = useState<AturanAbsensi | null>(null);
    const [locationHistory, setLocationHistory] = useState<GeolocationCoordinates[]>([]);
    
    // Refs for mock location detection
    const stagnantCoordsCountRef = useRef(0);
    const stagnantAccuracyCountRef = useRef(0);
    const consecutiveValidReadingsRef = useRef(0);
    

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
            // Stop watching if user is not logged in or has already clocked in
            stagnantCoordsCountRef.current = 0;
            stagnantAccuracyCountRef.current = 0;
            consecutiveValidReadingsRef.current = 0;
            return;
        }

        // Set initial status to checking
        setLocationStatus('checking');

        const watcher = navigator.geolocation.watchPosition(
            (position) => {
                const newHistory = [position.coords, ...locationHistory].slice(0, STABILITY_THRESHOLD);
                setLocationHistory(newHistory);
                
                if (isMockLocation(position, newHistory, stagnantCoordsCountRef, stagnantAccuracyCountRef)) {
                    consecutiveValidReadingsRef.current = 0; // Reset trust counter
                    setLocationStatus('denied');
                    showToast('Lokasi tidak valid terdeteksi.', 'error');
                    setCurrentLocation(null);
                    return;
                }
                
                // If the signal is valid, increment the trust counter
                consecutiveValidReadingsRef.current++;
                setCurrentLocation(position.coords);
            },
            (error) => {
                console.error("Geolocation error:", error);
                consecutiveValidReadingsRef.current = 0; // Reset trust counter
                setLocationStatus('denied');
                showToast('Akses lokasi ditolak.', 'error');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );

        return () => {
             navigator.geolocation.clearWatch(watcher);
             consecutiveValidReadingsRef.current = 0; // Reset on cleanup
        }
    }, [currentUser, hasClockedInToday, showToast, locationHistory]);

    // Location validation logic - REVAMPED to prevent loops
    useEffect(() => {
        // Do nothing if we don't have the necessary data yet. The status will remain 'checking'.
        if (!currentLocation || !currentUser || isHomePageLoading) {
            return;
        }
    
        // If there was an error loading rules or the rules are empty, set to out_of_range.
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
            // Only allow attendance if we have a few consecutive valid readings to trust the signal.
            if (consecutiveValidReadingsRef.current >= MIN_VALID_READINGS_REQUIRED) {
                setLocationStatus('allowed');
                setAvailableAttendanceRules(activeRules);
            }
            // If not trusted yet, the status implicitly remains 'checking'. No need to set it again.
        } else {
            // If in range of no rules, user is out of range.
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


        const faceDataChannel: RealtimeChannel = supabase
             .channel(`public:wajah_karyawan:karyawan_id=eq.${currentUser.employeeId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'wajah_karyawan', filter: `karyawan_id=eq.${currentUser.employeeId}` },
                (payload) => {
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        setUserFaceDescriptor(new Float32Array(payload.new.descriptor));
                    } else if (payload.eventType === 'DELETE') {
                        setUserFaceDescriptor(null);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(attendanceChannel);
            supabase.removeChannel(faceDataChannel);
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
                .limit(1);
                
            if (faceError) {
                console.warn("Gagal memuat data wajah:", faceError.message);
                setUserFaceDescriptor(null);
            } else if (faceData && faceData.length > 0 && faceData[0].descriptor) {
                setUserFaceDescriptor(new Float32Array(faceData[0].descriptor as any));
            } else {
                setUserFaceDescriptor(null);
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
        setUserFaceDescriptor(null);
        setIsHomePageLoading(true);
        setCurrentLocation(null);
        setAvailableAttendanceRules([]);
        setAllAttendanceRules([]);
        setLocationHistory([]);
        consecutiveValidReadingsRef.current = 0;
        stagnantCoordsCountRef.current = 0;
        stagnantAccuracyCountRef.current = 0;
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

    const openScanner = (mode: 'register' | 'verify') => {
        setScannerMode(mode);
        setScannerVisible(true);
    };

    const handleVerifySuccess = () => {
        setScannerVisible(false);
        handleAttendance(selectedRuleForAttendance);
    };

    const handleVerifyFailure = (error: string) => {
        setScannerVisible(false);
        showToast(error, 'error');
    };

    const handleOpenDivisionModal = () => {
        if (availableAttendanceRules.length > 0) {
            setDivisionModalVisible(true);
        }
    };

    const handleRuleSelected = (rule: AturanAbsensi) => {
        setSelectedRuleForAttendance(rule);
        setDivisionModalVisible(false);
        openScanner('verify');
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
                    isFaceRegistered={!!userFaceDescriptor}
                    isLoading={isHomePageLoading}
                    availableAttendanceRules={availableAttendanceRules}
                    locationStatus={locationStatus}
                    attendanceRulesError={attendanceRulesError}
                />;
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
                    onOpenDivisionModal={handleOpenDivisionModal}
                    onNavigate={handleNavigate}
                    isFaceRegistered={!!userFaceDescriptor}
                    isLoading={isHomePageLoading}
                    availableAttendanceRules={availableAttendanceRules}
                    locationStatus={locationStatus}
                    attendanceRulesError={attendanceRulesError}
                />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 font-sans">
            <main>
                {renderPage()}
            </main>

            {isDivisionModalVisible && (
                <DivisionSelectionModal
                    rules={availableAttendanceRules}
                    onSelect={handleRuleSelected}
                    onClose={() => setDivisionModalVisible(false)}
                />
            )}

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