import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FaceDescriptor } from '../types';

declare const faceapi: any;

interface FaceScannerProps {
    mode: 'register' | 'verify';
    onClose: () => void;
    onRegisterSuccess: (descriptor: FaceDescriptor) => void;
    onVerifySuccess: () => void;
    onVerifyFailure: (error: string) => void;
    registeredDescriptor: FaceDescriptor | null;
}

// --- Constants ---
const LIVENESS_TIMEOUT = 25000;
const DETECTION_INTERVAL = 200; // Adjusted for better mobile performance
const FACE_MATCH_DISTANCE = 0.45;
const NUM_CHALLENGES = 2;

// --- Liveness Detection Constants ---
const TURN_THRESHOLD_PERCENT = 0.16;
const NOD_THRESHOLD_PERCENT = 0.07;
const RETURN_THRESHOLD_MULTIPLIER = 0.5;
const NO_FACE_WARNING_THRESHOLD = 15; // ~3 seconds with 200ms interval

// --- State Machine ---
type ChallengeType = 'TURN_LEFT' | 'TURN_RIGHT' | 'NOD';
const ALL_CHALLENGES: ChallengeType[] = ['TURN_LEFT', 'TURN_RIGHT', 'NOD'];

type Baseline = { nose: {x: number, y: number}; faceWidth: number; };
type LivenessState = 
  | { name: 'INITIALIZING' }
  | { name: 'AWAITING_STABLE_FACE' }
  | { name: 'AWAITING_MOVE', challenge: ChallengeType, baseline: Baseline }
  | { name: 'AWAITING_RETURN', challenge: ChallengeType, baseline: Baseline }
  | { name: 'TRANSITIONING' }
  | { name: 'VERIFYING' };

const getChallengeInstruction = (challenge: ChallengeType | null): string => {
    if (!challenge) return 'Tahan posisi, melihat ke depan.';
    switch (challenge) {
        case 'TURN_LEFT': return `Menoleh ke kiri.`;
        case 'TURN_RIGHT': return `Menoleh ke kanan.`;
        case 'NOD': return `Mengangguk perlahan.`;
        default: return 'Posisikan wajah Anda.';
    }
}

const FaceScanner: React.FC<FaceScannerProps> = ({ mode, onRegisterSuccess, onVerifySuccess, onVerifyFailure, registeredDescriptor, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null); 
    const [statusText, setStatusText] = useState('Memuat model AI...');
    const [error, setError] = useState<string | null>(null);
    
    const [areModelsLoaded, setAreModelsLoaded] = useState(false);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [progress, setProgress] = useState(100);
    const [challengeFeedback, setChallengeFeedback] = useState<'success' | null>(null);

    const detectionIntervalRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const progressIntervalRef = useRef<number | null>(null);

    // --- State Refs for the new, robust state machine ---
    const livenessStateRef = useRef<LivenessState>({ name: 'INITIALIZING' });
    const challengeSequenceRef = useRef<ChallengeType[]>([]);
    const challengeStepRef = useRef<number>(0);
    const consecutiveNoFaceFramesRef = useRef<number>(0);
    const isFailureHandledRef = useRef(false);

    const updateStatusText = useCallback((newText: string) => {
        setStatusText(newText);
    }, []);

    const stopAllProcesses = useCallback(() => {
        if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        detectionIntervalRef.current = null;
        timeoutRef.current = null;
        progressIntervalRef.current = null;
    }, []);

    const handleFailure = useCallback((errorMsg: string) => {
        if (isFailureHandledRef.current) return;
        isFailureHandledRef.current = true;
        stopAllProcesses();
        onVerifyFailure(errorMsg);
    }, [onVerifyFailure, stopAllProcesses]);

    const runDetection = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended || !faceapi || ['VERIFYING', 'TRANSITIONING', 'INITIALIZING'].includes(livenessStateRef.current.name)) {
            return;
        }
        
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 128, scoreThreshold: 0.5 }); // Optimized for mobile
        const detection = await faceapi.detectSingleFace(canvas, detectorOptions)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (mode === 'register') {
            if (detection) {
                updateStatusText('Wajah terdeteksi, memproses...');
                livenessStateRef.current = { name: 'VERIFYING' };
                stopAllProcesses();
                onRegisterSuccess(detection.descriptor);
            }
            return;
        }

        if (!detection) {
            consecutiveNoFaceFramesRef.current++;
            if (consecutiveNoFaceFramesRef.current > NO_FACE_WARNING_THRESHOLD) {
                updateStatusText("Wajah tidak terdeteksi...");
            }
            return;
        }

        if (consecutiveNoFaceFramesRef.current > NO_FACE_WARNING_THRESHOLD) {
            const currentState = livenessStateRef.current;
            if (currentState.name === 'AWAITING_MOVE' || currentState.name === 'AWAITING_RETURN') {
                updateStatusText(getChallengeInstruction(currentState.challenge));
            } else if (currentState.name === 'AWAITING_STABLE_FACE') {
                updateStatusText('Tahan posisi, melihat ke depan.');
            }
        }
        consecutiveNoFaceFramesRef.current = 0;
        
        const noseTip = detection.landmarks.getNose()[3];
        const faceWidth = detection.detection.box.width;
        const currentState = livenessStateRef.current;

        switch (currentState.name) {
            case 'AWAITING_STABLE_FACE': {
                updateStatusText('Tahan posisi, melihat ke depan.');
                const baseline: Baseline = { nose: { x: noseTip.x, y: noseTip.y }, faceWidth };

                if (challengeSequenceRef.current.length === 0) {
                     let sequence: ChallengeType[] = [];
                     let availableChallenges = [...ALL_CHALLENGES];
                     for (let i = 0; i < NUM_CHALLENGES; i++) {
                         const randomIndex = Math.floor(Math.random() * availableChallenges.length);
                         sequence.push(availableChallenges.splice(randomIndex, 1)[0]);
                     }
                     challengeSequenceRef.current = sequence;
                     challengeStepRef.current = 0;
                }
                
                const currentChallenge = challengeSequenceRef.current[challengeStepRef.current];
                updateStatusText(getChallengeInstruction(currentChallenge));
                livenessStateRef.current = { name: 'AWAITING_MOVE', challenge: currentChallenge, baseline };
                break;
            }

            case 'AWAITING_MOVE': {
                const horizontalThreshold = currentState.baseline.faceWidth * TURN_THRESHOLD_PERCENT;
                const verticalThreshold = currentState.baseline.faceWidth * NOD_THRESHOLD_PERCENT;

                let moved = false;
                switch (currentState.challenge) {
                    case 'TURN_RIGHT': moved = noseTip.x < currentState.baseline.nose.x - horizontalThreshold; break;
                    case 'TURN_LEFT': moved = noseTip.x > currentState.baseline.nose.x + horizontalThreshold; break;
                    case 'NOD': moved = noseTip.y > currentState.baseline.nose.y + verticalThreshold; break;
                }
                
                if (moved) {
                    updateStatusText("Bagus, kembali ke tengah.");
                    livenessStateRef.current = { name: 'AWAITING_RETURN', challenge: currentState.challenge, baseline: currentState.baseline };
                }
                break;
            }

            case 'AWAITING_RETURN': {
                const hThresholdReturn = currentState.baseline.faceWidth * TURN_THRESHOLD_PERCENT * RETURN_THRESHOLD_MULTIPLIER;
                const vThresholdReturn = currentState.baseline.faceWidth * NOD_THRESHOLD_PERCENT * RETURN_THRESHOLD_MULTIPLIER;

                let returned = false;
                const dx = Math.abs(noseTip.x - currentState.baseline.nose.x);
                const dy = Math.abs(noseTip.y - currentState.baseline.nose.y);

                if (currentState.challenge === 'TURN_LEFT' || currentState.challenge === 'TURN_RIGHT') {
                    returned = dx < hThresholdReturn;
                } else if (currentState.challenge === 'NOD') {
                    returned = dy < vThresholdReturn;
                }

                if (returned) {
                    setChallengeFeedback('success');
                    setTimeout(() => setChallengeFeedback(null), 500);

                    const nextStep = challengeStepRef.current + 1;
                    
                    if (nextStep >= NUM_CHALLENGES) {
                        livenessStateRef.current = { name: 'VERIFYING' };
                        stopAllProcesses();
                        updateStatusText('Memproses verifikasi...');

                        if (!registeredDescriptor) return handleFailure('Data wajah terdaftar tidak ditemukan.');
                        const faceMatcher = new faceapi.FaceMatcher([registeredDescriptor]);
                        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

                        if (bestMatch.label !== 'unknown' && bestMatch.distance < FACE_MATCH_DISTANCE) {
                            onVerifySuccess();
                        } else {
                            handleFailure('Verifikasi wajah gagal. Wajah tidak cocok.');
                        }
                    } else {
                        livenessStateRef.current = { name: 'TRANSITIONING' };
                        challengeStepRef.current = nextStep;
                        updateStatusText('Gerakan selanjutnya...');

                        setTimeout(() => {
                            livenessStateRef.current = { name: 'AWAITING_STABLE_FACE' };
                        }, 750);
                    }
                }
                break;
            }
        }
    }, [mode, onRegisterSuccess, onVerifySuccess, registeredDescriptor, stopAllProcesses, updateStatusText, handleFailure]);

    useEffect(() => {
        const setup = async () => {
            try {
                if (!faceapi.nets.tinyFaceDetector.params) {
                    const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
                    await Promise.all([
                        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                    ]);
                }
                setAreModelsLoaded(true);
                updateStatusText('Mengaktifkan kamera...');
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch (err) {
                console.error("Setup failed:", err);
                const errorMessage = (err as Error).name === 'NotAllowedError' 
                    ? 'Izin kamera ditolak. Aktifkan di pengaturan browser.'
                    : 'Gagal memuat komponen. Periksa koneksi internet.';
                setError(errorMessage);
                stopAllProcesses();
            }
        };
        setup();
        return () => {
            stopAllProcesses();
            if (videoRef.current?.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            }
        };
    }, [stopAllProcesses, updateStatusText]);

    useEffect(() => {
        // This effect starts the detection loop and timers.
        // It runs once when the component is ready.
        if (areModelsLoaded && isVideoReady) {
            isFailureHandledRef.current = false;
            
            if (mode === 'register') {
                livenessStateRef.current = { name: 'AWAITING_STABLE_FACE' };
                updateStatusText('Posisikan wajah Anda di tengah.');
            } else { // verify mode
                livenessStateRef.current = { name: 'AWAITING_STABLE_FACE' };
                challengeSequenceRef.current = []; // Reset challenges
                updateStatusText('Posisikan wajah Anda di tengah.');

                timeoutRef.current = window.setTimeout(() => handleFailure('Verifikasi gagal: Waktu habis.'), LIVENESS_TIMEOUT);
                const startTime = Date.now();
                progressIntervalRef.current = window.setInterval(() => {
                    const remainingTime = Math.max(0, LIVENESS_TIMEOUT - (Date.now() - startTime));
                    setProgress((remainingTime / LIVENESS_TIMEOUT) * 100);
                }, 100);
            }
            
            detectionIntervalRef.current = window.setInterval(runDetection, DETECTION_INTERVAL);
        }
        
        return () => stopAllProcesses();

    }, [areModelsLoaded, isVideoReady, mode, runDetection, updateStatusText, handleFailure, stopAllProcesses]);


    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-50 p-4">
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div className="relative w-full max-w-sm aspect-square bg-slate-800 rounded-full overflow-hidden shadow-xl border-4 border-slate-700">
                <video 
                    ref={videoRef} 
                    autoPlay 
                    muted 
                    playsInline 
                    onCanPlay={() => setIsVideoReady(true)}
                    className="w-full h-full object-cover scale-x-[-1]"
                ></video>
                 <div className="absolute inset-0 border-[10px] border-black/20 rounded-full"></div>
                 {mode === 'verify' && (
                    <div className="absolute inset-0">
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                            <circle
                                className="text-slate-700/50"
                                strokeWidth="4" stroke="currentColor" fill="transparent"
                                r="48" cx="50" cy="50"
                            />
                            <circle
                                className={`transition-all duration-300 ease-linear ${
                                    challengeFeedback === 'success' ? 'text-green-500' : 'text-sky-500'
                                }`}
                                strokeWidth="4" stroke="currentColor" fill="transparent"
                                r="48" cx="50" cy="50"
                                strokeDasharray={2 * Math.PI * 48}
                                strokeDashoffset={(2 * Math.PI * 48) - (progress / 100) * (2 * Math.PI * 48)}
                                strokeLinecap="round"
                                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                            />
                        </svg>
                    </div>
                )}
            </div>
            
            <div className="text-center mt-6 text-white px-4 h-12">
                {error ? (
                    <p className="text-lg font-semibold text-red-400">{error}</p>
                ) : (
                    <p className="text-lg font-semibold animate-pulse">{statusText}</p>
                )}
            </div>

            <button onClick={onClose} className="absolute top-6 right-6 text-white bg-black/30 p-2 rounded-full hover:bg-black/50 transition-colors z-10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};

export default FaceScanner;