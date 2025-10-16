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
const DETECTION_INTERVAL = 150; 
const FACE_MATCH_DISTANCE = 0.45;
const NUM_CHALLENGES = 2;
const REQUIRED_CONSECUTIVE_FRAMES = 3; // Key to ignoring jitter

// --- Liveness Detection Constants ---
const TURN_THRESHOLD_PERCENT = 0.16;
const NOD_THRESHOLD_PERCENT = 0.07;
const NO_FACE_RESET_THRESHOLD = 10;

// --- State Machine ---
type ChallengeType = 'TURN_LEFT' | 'TURN_RIGHT' | 'NOD';
const ALL_CHALLENGES: ChallengeType[] = ['TURN_LEFT', 'TURN_RIGHT', 'NOD'];

type DetectionState = 'INITIALIZING' | 'WAITING_FOR_FACE' | 'CAPTURING_BASELINE' | 'AWAITING_CHALLENGE' | 'CHALLENGE_TRANSITION' | 'PROCESSING';
type ChallengePhase = 'waiting_for_move' | 'waiting_for_return';

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

    // Refs for state management
    const detectionStateRef = useRef<DetectionState>('INITIALIZING');
    const challengeSequenceRef = useRef<ChallengeType[]>([]);
    const challengeStepRef = useRef<number>(0);
    const consecutiveNoFaceFramesRef = useRef<number>(0);
    const baselineRef = useRef<{ nose: {x: number, y: number}; faceWidth: number; } | null>(null);
    const isFailureHandledRef = useRef(false);

    // REWRITTEN Liveness State Refs
    const challengePhaseRef = useRef<ChallengePhase>('waiting_for_move');
    const consecutiveActionFramesRef = useRef<number>(0);


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
    
    const resetLivenessState = useCallback((resetText = true) => {
        if(resetText) updateStatusText('Posisikan wajah Anda di tengah.');
        detectionStateRef.current = 'WAITING_FOR_FACE';
        baselineRef.current = null;
        challengeSequenceRef.current = [];
        challengeStepRef.current = 0;
        challengePhaseRef.current = 'waiting_for_move';
        consecutiveActionFramesRef.current = 0;
    }, [updateStatusText]);

    const runDetection = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended || !faceapi || ['PROCESSING', 'CHALLENGE_TRANSITION'].includes(detectionStateRef.current)) {
            return;
        }
        
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.5 });
        const detection = await faceapi.detectSingleFace(canvas, detectorOptions)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            consecutiveNoFaceFramesRef.current++;
            if (consecutiveNoFaceFramesRef.current >= NO_FACE_RESET_THRESHOLD && ['CAPTURING_BASELINE', 'AWAITING_CHALLENGE'].includes(detectionStateRef.current)) {
                resetLivenessState();
            }
            return;
        }

        consecutiveNoFaceFramesRef.current = 0;
        const currentState = detectionStateRef.current;
        const noseTip = detection.landmarks.getNose()[3];

        if (mode === 'register') {
            updateStatusText('Wajah terdeteksi, memproses...');
            detectionStateRef.current = 'PROCESSING';
            stopAllProcesses();
            onRegisterSuccess(detection.descriptor);
            return;
        }

        if (currentState === 'WAITING_FOR_FACE') {
            updateStatusText('Tahan posisi, melihat ke depan.');
            detectionStateRef.current = 'CAPTURING_BASELINE';
        } else if (currentState === 'CAPTURING_BASELINE') {
            baselineRef.current = {
                nose: { x: noseTip.x, y: noseTip.y },
                faceWidth: detection.detection.box.width,
            };
            
            if (challengeSequenceRef.current.length === 0) {
                let sequence: ChallengeType[] = [];
                let availableChallenges = [...ALL_CHALLENGES];
                for (let i = 0; i < NUM_CHALLENGES; i++) {
                    const randomIndex = Math.floor(Math.random() * availableChallenges.length);
                    sequence.push(availableChallenges.splice(randomIndex, 1)[0]);
                }
                challengeSequenceRef.current = sequence;
            }
            
            detectionStateRef.current = 'AWAITING_CHALLENGE';
            const firstChallenge = challengeSequenceRef.current[0];
            updateStatusText(getChallengeInstruction(firstChallenge));
        
        } else if (currentState === 'AWAITING_CHALLENGE') {
            const baseline = baselineRef.current;
            if (!baseline) return resetLivenessState();

            const currentStep = challengeStepRef.current;
            const challenge = challengeSequenceRef.current[currentStep];
            const phase = challengePhaseRef.current;

            const horizontalThreshold = baseline.faceWidth * TURN_THRESHOLD_PERCENT;
            const verticalThreshold = baseline.faceWidth * NOD_THRESHOLD_PERCENT;

            const isPastThreshold = () => {
                switch (challenge) {
                    case 'TURN_RIGHT': return noseTip.x < baseline.nose.x - horizontalThreshold;
                    case 'TURN_LEFT': return noseTip.x > baseline.nose.x + horizontalThreshold;
                    case 'NOD': return noseTip.y > baseline.nose.y + verticalThreshold;
                    default: return false;
                }
            };

            const isNearBaseline = () => {
                const returnThreshold = 0.5; // Must return at least halfway
                const dx = Math.abs(noseTip.x - baseline.nose.x);
                const dy = Math.abs(noseTip.y - baseline.nose.y);
                if (challenge === 'TURN_LEFT' || challenge === 'TURN_RIGHT') return dx < horizontalThreshold * returnThreshold;
                if (challenge === 'NOD') return dy < verticalThreshold * returnThreshold;
                return false;
            };

            if (phase === 'waiting_for_move') {
                if (isPastThreshold()) {
                    consecutiveActionFramesRef.current++;
                } else {
                    consecutiveActionFramesRef.current = 0;
                }

                if (consecutiveActionFramesRef.current >= REQUIRED_CONSECUTIVE_FRAMES) {
                    challengePhaseRef.current = 'waiting_for_return';
                    consecutiveActionFramesRef.current = 0;
                }
            } else if (phase === 'waiting_for_return') {
                if (isNearBaseline()) {
                    consecutiveActionFramesRef.current++;
                } else {
                    consecutiveActionFramesRef.current = 0;
                }

                if (consecutiveActionFramesRef.current >= REQUIRED_CONSECUTIVE_FRAMES) {
                    // --- CHALLENGE PASSED ---
                    setChallengeFeedback('success');
                    setTimeout(() => setChallengeFeedback(null), 500);

                    const nextStep = currentStep + 1;
                    if (nextStep >= NUM_CHALLENGES) {
                        detectionStateRef.current = 'PROCESSING';
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
                        detectionStateRef.current = 'CHALLENGE_TRANSITION';
                        challengeStepRef.current = nextStep;
                        updateStatusText('Bagus! Kembali ke posisi tengah...');
                        
                        setTimeout(() => {
                            challengePhaseRef.current = 'waiting_for_move';
                            consecutiveActionFramesRef.current = 0;
                            baselineRef.current = {
                                nose: { x: noseTip.x, y: noseTip.y },
                                faceWidth: detection.detection.box.width,
                            };
                            const nextChallenge = challengeSequenceRef.current[nextStep];
                            updateStatusText(getChallengeInstruction(nextChallenge));
                            detectionStateRef.current = 'AWAITING_CHALLENGE';
                        }, 750);
                    }
                }
            }
        }
    }, [mode, onRegisterSuccess, onVerifySuccess, registeredDescriptor, stopAllProcesses, resetLivenessState, updateStatusText, handleFailure]);

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
        if (areModelsLoaded && isVideoReady) {
            isFailureHandledRef.current = false;
            resetLivenessState(false);
            updateStatusText('Posisikan wajah Anda di tengah.');

            if (mode === 'verify') {
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

    }, [areModelsLoaded, isVideoReady, mode, runDetection, resetLivenessState, updateStatusText, handleFailure, stopAllProcesses]);


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
