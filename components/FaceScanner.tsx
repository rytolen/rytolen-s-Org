import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { FaceDescriptor } from '../types';

interface FaceScannerProps {
    mode: 'register' | 'verify';
    onSuccess: (descriptor?: FaceDescriptor) => void;
    onCancel: () => void;
    registeredDescriptor?: FaceDescriptor | null;
}

type LivenessChallenge = 'turnLeft' | 'turnRight' | 'nodUp' | 'nodDown';
type ChallengeStatus = 'waiting' | 'in_progress' | 'returning' | 'success' | 'failed';
type DetectionState = 'detecting' | 'paused' | 'success' | 'failed';

const challenges: LivenessChallenge[] = ['turnLeft', 'turnRight', 'nodUp', 'nodDown'];

const getChallengeInstruction = (challenge: LivenessChallenge | null): string => {
    switch (challenge) {
        case 'turnLeft': return 'Tolehkan Wajah ke Kiri';
        case 'turnRight': return 'Tolehkan Wajah ke Kanan';
        case 'nodUp': return 'Anggukkan Wajah ke Atas';
        case 'nodDown': return 'Tundukkan Wajah ke Bawah';
        default: return 'Posisikan wajah di tengah';
    }
};

const TINY_FACE_OPTIONS = new faceapi.TinyFaceDetectorOptions({ inputSize: 128 });
const DETECTION_INTERVAL = 200; 
const SMOOTHING_BUFFER_SIZE = 3; // Average over the last 3 frames to smooth out jitter

const FaceScanner: React.FC<FaceScannerProps> = ({ mode, onSuccess, onCancel, registeredDescriptor }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [instruction, setInstruction] = useState('Memuat model AI...');
    const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
    const [livenessChallenges, setLivenessChallenges] = useState<LivenessChallenge[]>([]);
    const [challengeStatus, setChallengeStatus] = useState<ChallengeStatus>('waiting');
    const [detectionState, setDetectionState] = useState<DetectionState>('detecting');

    const baselineRef = useRef<{ yaw: number; pitch: number } | null>(null);
    const isFailureHandledRef = useRef(false);
    const angleHistoryRef = useRef<{ yaw: number; pitch: number }[]>([]);

    useEffect(() => {
        const loadModels = async () => {
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';
            try {
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);
                setModelsLoaded(true);
            } catch (error) {
                console.error("Failed to load face-api models:", error);
                setInstruction("Gagal memuat model AI.");
                setDetectionState('failed');
            }
        };
        loadModels();
    }, []);

    useEffect(() => {
        if (!modelsLoaded) return;

        const setupCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' }
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setInstruction('Posisikan wajah di tengah');
                }
            } catch (err) {
                console.error("Camera access denied:", err);
                setInstruction("Akses kamera ditolak.");
                setDetectionState('failed');
            }
        };
        setupCamera();

        return () => {
            const stream = videoRef.current?.srcObject as MediaStream;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [modelsLoaded]);
    
    useEffect(() => {
        const shuffled = [...challenges].sort(() => 0.5 - Math.random());
        setLivenessChallenges(shuffled.slice(0, 2));
    }, []);

    const handleFailure = useCallback((reason: string) => {
        if (isFailureHandledRef.current) return;
        isFailureHandledRef.current = true;
        
        setDetectionState('failed');
        setInstruction(reason);
        setTimeout(() => {
            onCancel();
        }, 2000);
    }, [onCancel]);


    useEffect(() => {
        if (!modelsLoaded || detectionState !== 'detecting') return;

        let detectionIntervalId: number;
        const timeoutTimer = setTimeout(() => handleFailure('Verifikasi gagal: Waktu habis.'), 15000);

        const detect = async () => {
            if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
                return;
            }

            const detections = await faceapi.detectSingleFace(videoRef.current, TINY_FACE_OPTIONS)
                .withFaceLandmarks()
                .withFaceDescriptor();
            
            if (canvasRef.current && videoRef.current) {
                const displaySize = { width: videoRef.current.clientWidth, height: videoRef.current.clientHeight };
                faceapi.matchDimensions(canvasRef.current, displaySize);
                 const context = canvasRef.current.getContext('2d');
                context?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                if (detections) {
                    const resizedDetections = faceapi.resizeResults(detections, displaySize);
                    faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
                }
            }

            if (!detections) {
                 return;
            }

            if (mode === 'register' && challengeStatus === 'success') {
                setDetectionState('success');
                setInstruction("Pendaftaran Wajah Berhasil!");
                setTimeout(() => onSuccess(detections.descriptor), 1000);
                return;
            }

            if(mode === 'verify' && challengeStatus === 'success') {
                if (!registeredDescriptor) {
                    handleFailure('Verifikasi Gagal: Data tidak ditemukan.');
                    return;
                }
                const faceMatcher = new faceapi.FaceMatcher([registeredDescriptor]);
                const bestMatch = faceMatcher.findBestMatch(detections.descriptor);

                if (bestMatch.label !== 'person 1' || bestMatch.distance > 0.45) {
                    handleFailure('Verifikasi Gagal: Wajah tidak cocok.');
                } else {
                    setDetectionState('success');
                    setInstruction("Verifikasi Berhasil!");
                    setTimeout(() => onSuccess(), 1000);
                }
                return;
            }
            
            // --- Signal Smoothing Logic ---
            const { yaw: rawYaw, pitch: rawPitch } = getHeadAngles(detections.landmarks.getNose(), detections.landmarks.getJawOutline());
            
            angleHistoryRef.current.push({ yaw: rawYaw, pitch: rawPitch });
            if (angleHistoryRef.current.length > SMOOTHING_BUFFER_SIZE) {
                angleHistoryRef.current.shift();
            }

            const smoothedYaw = angleHistoryRef.current.reduce((acc, v) => acc + v.yaw, 0) / angleHistoryRef.current.length;
            const smoothedPitch = angleHistoryRef.current.reduce((acc, v) => acc + v.pitch, 0) / angleHistoryRef.current.length;


            const currentChallenge = livenessChallenges[currentChallengeIndex];

            if (challengeStatus === 'waiting') {
                baselineRef.current = { yaw: smoothedYaw, pitch: smoothedPitch };
                setChallengeStatus('in_progress');
                setInstruction(getChallengeInstruction(currentChallenge));
                angleHistoryRef.current = []; // Reset for new challenge
            } else if (challengeStatus === 'in_progress') {
                let moved = false;
                const YAW_THRESHOLD = 0.35; // Slightly more generous threshold
                const PITCH_THRESHOLD = 0.25;
                
                switch(currentChallenge) {
                    case 'turnLeft': moved = smoothedYaw - baselineRef.current!.yaw > YAW_THRESHOLD; break;
                    case 'turnRight': moved = smoothedYaw - baselineRef.current!.yaw < -YAW_THRESHOLD; break;
                    case 'nodUp': moved = smoothedPitch - baselineRef.current!.pitch < -PITCH_THRESHOLD; break;
                    case 'nodDown': moved = smoothedPitch - baselineRef.current!.pitch > PITCH_THRESHOLD; break;
                }

                if (moved) {
                    setChallengeStatus('returning');
                    setInstruction('Kembali ke posisi semula');
                }
            } else if (challengeStatus === 'returning') {
                const returned = Math.abs(smoothedYaw - baselineRef.current!.yaw) < 0.2 && Math.abs(smoothedPitch - baselineRef.current!.pitch) < 0.15;
                if (returned) {
                    const nextIndex = currentChallengeIndex + 1;
                    if (nextIndex >= livenessChallenges.length) {
                        setChallengeStatus('success');
                        setInstruction(mode === 'register' ? 'Menyimpan data...' : 'Memverifikasi...');
                    } else {
                        setCurrentChallengeIndex(nextIndex);
                        setChallengeStatus('waiting');
                    }
                }
            }
        };

        detectionIntervalId = setInterval(detect, DETECTION_INTERVAL);

        return () => {
            clearInterval(detectionIntervalId);
            clearTimeout(timeoutTimer);
        };
    }, [modelsLoaded, detectionState, challengeStatus, currentChallengeIndex, livenessChallenges, handleFailure, mode, onSuccess, registeredDescriptor]);

    const getHeadAngles = (nose: faceapi.Point[], jaw: faceapi.Point[]): { yaw: number, pitch: number } => {
        const noseTip = nose[3];
        const jawLeft = jaw[0];
        const jawRight = jaw[16];
        const jawCenter = jaw[8];
        
        const yaw = (noseTip.x - jawCenter.x) / (jawRight.x - jawLeft.x);
        const pitch = (noseTip.y - jawCenter.y) / ((jawLeft.y + jawRight.y)/2 - jawCenter.y);
        
        return { yaw, pitch };
    };
    
    const progress = (currentChallengeIndex / livenessChallenges.length) * 100;

    return (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
            <div className="relative w-full max-w-sm aspect-square rounded-full overflow-hidden border-4 border-slate-500 shadow-lg">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50" />
            </div>
            <p className="mt-6 text-white text-xl font-bold text-center px-4">{instruction}</p>
            <div className="w-64 bg-slate-600 rounded-full h-2.5 mt-4">
                <div className="bg-sky-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${detectionState === 'success' ? 100 : progress}%` }}></div>
            </div>
            <button onClick={onCancel} className="mt-8 text-slate-300 font-semibold bg-white/10 px-6 py-2 rounded-full">
                Batal
            </button>
        </div>
    );
};

export default FaceScanner;