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
const LIVENESS_TIMEOUT = 35000; 
const DETECTION_INTERVAL = 100;
const FACE_MATCH_DISTANCE = 0.45;

// --- Liveness Detection Constants ---
const NO_FACE_RESET_THRESHOLD = 10;
const STABLE_FACE_FRAMES_REQUIRED = 5; 
const TURN_THRESHOLD_PERCENT = 0.18; 
const NOD_THRESHOLD_PERCENT = 0.08; 
const NUM_CHALLENGES = 3; 

// --- State Machine ---
type ChallengeType = 'TURN_LEFT' | 'TURN_RIGHT' | 'NOD';
const ALL_CHALLENGES: ChallengeType[] = ['TURN_LEFT', 'TURN_RIGHT', 'NOD'];

type DetectionState = 'INITIALIZING' | 'WAITING_FOR_FACE' | 'CAPTURING_BASELINE' | 'AWAITING_CHALLENGE' | 'CHALLENGE_TRANSITION' | 'PROCESSING';

const getChallengeInstruction = (challenge: ChallengeType | null): string => {
    if (!challenge) return 'Tahan posisi, melihat ke depan.';
    switch (challenge) {
        case 'TURN_LEFT': return `Menoleh ke kiri.`;
        case 'TURN_RIGHT': return `Menoleh ke kanan.`;
        case 'NOD': return `Mengangguk perlahan.`;
    }
}

const FaceScanner: React.FC<FaceScannerProps> = ({ mode, onRegisterSuccess, onVerifySuccess, onVerifyFailure, registeredDescriptor, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [statusText, setStatusText] = useState('Memuat model AI...');
    const [error, setError] = useState<string | null>(null);
    
    const [areModelsLoaded, setAreModelsLoaded] = useState(false);
    const [isVideoReady, setIsVideoReady] = useState(false);
    const [progress, setProgress] = useState(100);

    const intervalRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const progressIntervalRef = useRef<number | null>(null);

    // Refs for state management
    const detectionStateRef = useRef<DetectionState>('INITIALIZING');
    const challengeSequenceRef = useRef<ChallengeType[]>([]);
    const challengeStepRef = useRef<number>(0);

    const consecutiveFaceFramesRef = useRef<number>(0);
    const consecutiveNoFaceFramesRef = useRef<number>(0);
    const baselineRef = useRef<{ nose: {x: number, y: number}; faceWidth: number; } | null>(null);
    const challengeStateRef = useRef({ hasMoved: false });

    const stopAllProcesses = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }, []);
    
    const resetLivenessState = (resetText = true) => {
        if(resetText) setStatusText('Posisikan wajah Anda di tengah.');
        detectionStateRef.current = 'WAITING_FOR_FACE';
        baselineRef.current = null;
        challengeStateRef.current = { hasMoved: false };
        challengeSequenceRef.current = [];
        challengeStepRef.current = 0;
    }

    const runDetection = useCallback(async () => {
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended || !faceapi || detectionStateRef.current === 'PROCESSING' || detectionStateRef.current === 'CHALLENGE_TRANSITION') return;

        const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            consecutiveNoFaceFramesRef.current++;
            consecutiveFaceFramesRef.current = 0; 
            if (consecutiveNoFaceFramesRef.current >= NO_FACE_RESET_THRESHOLD) {
                const currentState = detectionStateRef.current;
                if (currentState === 'CAPTURING_BASELINE' || currentState === 'AWAITING_CHALLENGE') {
                    resetLivenessState();
                }
            }
            return;
        }

        consecutiveNoFaceFramesRef.current = 0;
        const currentState = detectionStateRef.current;
        const noseTip = detection.landmarks.getNose()[3];

        if (mode === 'register') {
            setStatusText('Wajah terdeteksi, memproses...');
            detectionStateRef.current = 'PROCESSING';
            stopAllProcesses();
            onRegisterSuccess(detection.descriptor);
            return;
        }

        if (currentState === 'WAITING_FOR_FACE') {
            consecutiveFaceFramesRef.current++;
            if (consecutiveFaceFramesRef.current >= STABLE_FACE_FRAMES_REQUIRED) {
                detectionStateRef.current = 'CAPTURING_BASELINE';
                setStatusText('Tahan posisi, melihat ke depan.');
            }
        } else if (currentState === 'CAPTURING_BASELINE') {
            baselineRef.current = {
                nose: { x: noseTip.x, y: noseTip.y },
                faceWidth: detection.detection.box.width,
            };
            
            // Generate a random sequence of challenges if not already generated
            if (challengeSequenceRef.current.length === 0) {
                let sequence: ChallengeType[] = [];
                let availableChallenges = [...ALL_CHALLENGES];
                for (let i = 0; i < NUM_CHALLENGES; i++) {
                    const randomIndex = Math.floor(Math.random() * availableChallenges.length);
                    const challenge = availableChallenges.splice(randomIndex, 1)[0];
                    sequence.push(challenge);
                }
                challengeSequenceRef.current = sequence;
                challengeStepRef.current = 0;
            }
            
            detectionStateRef.current = 'AWAITING_CHALLENGE';

            const firstChallenge = challengeSequenceRef.current[0];
            setStatusText(getChallengeInstruction(firstChallenge));
        
        } else if (currentState === 'AWAITING_CHALLENGE') {
            if (!baselineRef.current || challengeSequenceRef.current.length === 0) return;
            
            let livenessPassed = false;
            const currentStep = challengeStepRef.current;
            const challenge = challengeSequenceRef.current[currentStep];
            const challengeState = challengeStateRef.current;

            const horizontalThreshold = baselineRef.current.faceWidth * TURN_THRESHOLD_PERCENT;
            const verticalThreshold = baselineRef.current.faceWidth * NOD_THRESHOLD_PERCENT;

            // --- Adaptive Baseline Logic ---
            const isCentered = Math.abs(noseTip.x - baselineRef.current.nose.x) < horizontalThreshold / 3;
            if (isCentered && !challengeState.hasMoved) {
                const SMOOTHING_FACTOR = 0.5;
                baselineRef.current.nose.x = (SMOOTHING_FACTOR * baselineRef.current.nose.x) + ((1 - SMOOTHING_FACTOR) * noseTip.x);
                baselineRef.current.nose.y = (SMOOTHING_FACTOR * baselineRef.current.nose.y) + ((1 - SMOOTHING_FACTOR) * noseTip.y);
            }
            
            // Phase 1: Detect initial movement
            if (!challengeState.hasMoved) {
                // Due to video mirroring (scale-x-[-1]), the logic is inverted for horizontal movement.
                if (challenge === 'TURN_RIGHT' && noseTip.x < baselineRef.current.nose.x - horizontalThreshold) challengeState.hasMoved = true;
                if (challenge === 'TURN_LEFT' && noseTip.x > baselineRef.current.nose.x + horizontalThreshold) challengeState.hasMoved = true;
                if (challenge === 'NOD' && noseTip.y > baselineRef.current.nose.y + verticalThreshold) challengeState.hasMoved = true;
            }
            // Phase 2: Detect return to center
            else {
                if (challenge === 'TURN_RIGHT' && noseTip.x > baselineRef.current.nose.x - (horizontalThreshold / 2)) livenessPassed = true;
                if (challenge === 'TURN_LEFT' && noseTip.x < baselineRef.current.nose.x + (horizontalThreshold / 2)) livenessPassed = true;
                if (challenge === 'NOD' && noseTip.y < baselineRef.current.nose.y + (verticalThreshold / 2)) livenessPassed = true;
            }

            if (livenessPassed) {
                const nextStep = currentStep + 1;
                if (nextStep >= NUM_CHALLENGES) {
                    // All challenges completed
                    detectionStateRef.current = 'PROCESSING';
                    stopAllProcesses();
                    setStatusText('Memproses verifikasi...');
                    
                    if (!registeredDescriptor) return onVerifyFailure('Data wajah terdaftar tidak ditemukan.');
                    
                    const faceMatcher = new faceapi.FaceMatcher([registeredDescriptor]);
                    const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
                    
                    if (bestMatch.label !== 'unknown' && bestMatch.distance < FACE_MATCH_DISTANCE) {
                        onVerifySuccess();
                    } else {
                        onVerifyFailure('Verifikasi wajah gagal. Wajah tidak cocok.');
                    }
                } else {
                    // Move to the next challenge
                    detectionStateRef.current = 'CHALLENGE_TRANSITION';
                    challengeStepRef.current = nextStep;
                    setStatusText('Bagus! Kembali ke posisi tengah...');
                    
                    setTimeout(() => {
                        baselineRef.current = {
                            nose: { x: noseTip.x, y: noseTip.y },
                            faceWidth: detection.detection.box.width,
                        };
                        challengeStateRef.current = { hasMoved: false };
                        const nextChallenge = challengeSequenceRef.current[nextStep];
                        setStatusText(getChallengeInstruction(nextChallenge));
                        detectionStateRef.current = 'AWAITING_CHALLENGE';
                    }, 700);
                }
            }
        }
    }, [mode, onRegisterSuccess, onVerifySuccess, onVerifyFailure, registeredDescriptor, stopAllProcesses]);

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

                setStatusText('Mengaktifkan kamera...');
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
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
            if (videoRef.current && videoRef.current.srcObject) {
                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            }
        };
    }, [stopAllProcesses]);


    useEffect(() => {
        if (areModelsLoaded && isVideoReady) {
            resetLivenessState(false);
            setStatusText('Posisikan wajah Anda di tengah.');

            if (mode === 'verify') {
                timeoutRef.current = window.setTimeout(() => {
                    if (detectionStateRef.current !== 'PROCESSING') {
                        onVerifyFailure('Verifikasi gagal: Waktu habis.');
                    }
                }, LIVENESS_TIMEOUT);

                const startTime = Date.now();
                progressIntervalRef.current = window.setInterval(() => {
                    const elapsedTime = Date.now() - startTime;
                    const remainingTime = Math.max(0, LIVENESS_TIMEOUT - elapsedTime);
                    setProgress((remainingTime / LIVENESS_TIMEOUT) * 100);
                }, 100);
            }
            
            intervalRef.current = window.setInterval(runDetection, DETECTION_INTERVAL);
        }
    }, [areModelsLoaded, isVideoReady, mode, runDetection, onVerifyFailure]);


    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-50 p-4">
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
                                strokeWidth="4"
                                stroke="currentColor"
                                fill="transparent"
                                r="48"
                                cx="50"
                                cy="50"
                            />
                            <circle
                                className="text-sky-500 transition-all duration-300 ease-linear"
                                strokeWidth="4"
                                stroke="currentColor"
                                fill="transparent"
                                r="48"
                                cx="50"
                                cy="50"
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