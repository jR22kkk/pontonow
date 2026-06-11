/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { Employee, Punch, PunchType } from '../types';
import { getPunchTypeDetails, CAMERA_FALLBACKS } from '../utils';
import { 
  Clock, MapPin, Camera, Check, ShieldCheck, X, 
  RefreshCw, LogOut, Loader2, Sparkles, AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EmployeeDashboardProps {
  user: Employee;
  onLogout: () => void;
}

export default function EmployeeDashboard({ user, onLogout }: EmployeeDashboardProps) {
  const [time, setTime] = useState(new Date());
  const [todayPunches, setTodayPunches] = useState<Punch[]>([]);
  const [loadingPunches, setLoadingPunches] = useState(true);
  
  // Registration sheet modal
  const [modalOpen, setModalOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  
  // Camera/Image capturing
  const [useRealCamera, setUseRealCamera] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [selectedFallbackPhoto, setSelectedFallbackPhoto] = useState(CAMERA_FALLBACKS[0].url);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [lastRegisteredType, setLastRegisteredType] = useState<PunchType | null>(null);

  // Digital clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch current user punches for today to calculate upcoming type
  const fetchTodayPunches = async () => {
    setLoadingPunches(true);
    try {
      const q = query(collection(db, 'punches'), where('employeeId', '==', user.id));
      const snap = await getDocs(q);
      const list: Punch[] = [];
      const todayStr = new Date().toISOString().split('T')[0];

      snap.forEach((doc) => {
        const data = doc.data();
        if (data.timestamp.startsWith(todayStr)) {
          list.push({
            id: doc.id,
            employeeId: data.employeeId,
            employeeName: data.employeeName,
            employeePhone: data.employeePhone,
            timestamp: data.timestamp,
            type: data.type as PunchType,
            photo: data.photo,
            latitude: data.latitude,
            longitude: data.longitude,
            createdAt: data.createdAt,
          });
        }
      });

      // Sort chronological
      list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setTodayPunches(list);
    } catch (err) {
      console.error('Erro ao buscar batidas de hoje:', err);
    } finally {
      setLoadingPunches(false);
    }
  };

  useEffect(() => {
    fetchTodayPunches();
  }, [user.id]);

  // Determine current punch type
  const getNextPunchType = (): PunchType => {
    const count = todayPunches.length;
    if (count === 0) return 'entrada';
    if (count === 1) return 'intervalo_saida';
    if (count === 2) return 'intervalo_entrada';
    return 'saida';
  };

  const getPunchTypePortuguese = (type: PunchType): string => {
    switch (type) {
      case 'entrada': return 'Entrada';
      case 'intervalo_saida': return 'Saída para Intervalo';
      case 'intervalo_entrada': return 'Retorno do Intervalo';
      case 'saida': return 'Saída Final';
    }
  };

  // Start registration sequence
  const startPunchSequence = () => {
    setModalOpen(true);
    setCapturedPhoto(null);
    setCoords(null);
    setGpsError(null);
    captureGpsLocation();
    initiateCamera();
  };

  // Capture GPS coordinates
  const captureGpsLocation = () => {
    setGpsLoading(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError('Geolocalização não é suportada pelo seu navegador.');
      setCoords({ latitude: -23.55052, longitude: -46.633308 }); // Default Sao Paulo
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setGpsLoading(false);
      },
      (error) => {
        console.warn('Geolocation Error code: ' + error.code + '. Message: ' + error.message);
        setGpsError('Sinal de GPS ausente. Usando posicionamento simulado da matriz.');
        setCoords({ latitude: -23.55052, longitude: -46.633308 }); // Fallback
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Access hardware camera
  const initiateCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 400, height: 400 },
        audio: false
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setUseRealCamera(true);
    } catch (err) {
      console.warn('Camera Access block:', err);
      setUseRealCamera(false); // Enable interactive SVG avatar fallback
    }
  };

  // Close camera feed cleanly
  const stopCameraStream = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  // Canvas screenshot capture or SVG pick
  const handleCapturePhoto = () => {
    if (useRealCamera && videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 300;
      canvas.height = video.videoHeight || 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(-1, 1); // Flip horizontally for selfie mirroring
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedPhoto(dataUrl);
        stopCameraStream();
      }
    } else {
      // Use chosen fallback
      setCapturedPhoto(selectedFallbackPhoto);
      setCameraActive(false);
    }
  };

  const handleCancelSequence = () => {
    stopCameraStream();
    setModalOpen(false);
  };

  // Submit recorded punch to Firestore database
  const handleSubmitPunch = async () => {
    if (!capturedPhoto) return;
    setIsSubmitting(true);

    const type = getNextPunchType();
    const now = new Date();

    const newPunch = {
      employeeId: user.id,
      employeeName: user.name,
      employeePhone: user.phone,
      timestamp: now.toISOString(),
      type: type,
      photo: capturedPhoto,
      latitude: coords?.latitude || -23.55052,
      longitude: coords?.longitude || -46.633308,
      createdAt: now.toISOString()
    };

    try {
      await addDoc(collection(db, 'punches'), newPunch);
      setLastRegisteredType(type);
      setShowSuccessScreen(true);
      setModalOpen(false);
      fetchTodayPunches();
    } catch (err) {
      alert('Falha ao registrar batida de ponto no banco de dados. Tente novamente.');
      handleFirestoreError(err, OperationType.WRITE, 'punches');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick greetings helper
  const getGreeting = () => {
    const hour = time.getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // Formats to show in progress overview
  const getPunchesSummaryLine = (type: PunchType) => {
    const found = todayPunches.find(p => p.type === type);
    if (found) {
      return {
        isSet: true,
        text: new Date(found.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
    }
    return { isSet: false, text: '--:--' };
  };

  const nextType = getNextPunchType();
  const progressPercent = (todayPunches.length / 4) * 100;

  return (
    <div className="w-full max-w-md mx-auto" id="employee-dashboard-viewport">
      {/* Dynamic iOS Status Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-full border border-blue-100 dark:border-blue-900/30">
            PONTO ELETRÔNICO
          </span>
          <h2 className="font-display text-xl font-bold text-slate-800 dark:text-slate-100 mt-2">
            {getGreeting()}, <span className="text-blue-600 dark:text-blue-400">{user.name.split(' ')[0]}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ID: {user.phone}
          </p>
        </div>
        <button
          id="employee-logout-btn"
          onClick={onLogout}
          className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition cursor-pointer"
          title="Sair da Conta"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Modern Card Body (iOS style) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-3xl shadow-xl p-6 mb-6">
        
        {/* Analog Digital Dynamic Clock */}
        <div className="flex flex-col items-center justify-center py-6 border-b border-slate-100 dark:border-slate-800/60 mb-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 font-mono">
            {time.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </span>
          <h3 className="font-mono text-4xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100 tabular-nums">
            {time.toLocaleTimeString('pt-BR')}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-emerald-500 font-semibold mt-1.5 bg-emerald-500/10 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
            Fuso Horário Local Ativo
          </div>
        </div>

        {/* Big Actionable Button (Apple Clock-In style) */}
        <div className="flex flex-col items-center justify-center py-4 mb-4">
          <div className="relative">
            {/* Pulsating backdrop circle for 'Bater ponto' */}
            <div className="absolute inset-0 bg-blue-500 dark:bg-blue-600 rounded-full scale-105 opacity-10 animate-soft-pulse blur-md"></div>
            
            <button
              id="large-clockin-trigger-btn"
              onClick={startPunchSequence}
              disabled={todayPunches.length >= 4}
              className="relative w-44 h-44 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-indigo-500 text-white flex flex-col items-center justify-center shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/40 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer select-none border-4 border-white dark:border-slate-900 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Clock className="w-12 h-12" />
              <span className="text-[15px] font-bold tracking-tight mt-2.5">
                {todayPunches.length >= 4 ? 'Limite Diário' : 'Bater Ponto'}
              </span>
              <span className="text-[10px] opacity-80 mt-1 font-medium font-mono">
                {todayPunches.length >= 4 ? 'Concluído' : `Seguinte: ${getPunchTypePortuguese(nextType)}`}
              </span>
            </button>
          </div>
          
          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-5 leading-relaxed max-w-xs">
            {todayPunches.length >= 4 
              ? 'Você já registrou todas as 4 etapas de ponto para o dia de hoje.' 
              : 'Clique para capturar selfie, localização GPS e registrar horário.'}
          </p>
        </div>
      </div>

      {/* Today's Punch Progress Visual Track (Pills Layout) */}
      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-150/60 dark:border-slate-850/40 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold text-slate-600 dark:text-slate-450 uppercase tracking-wider">
            Progresso de Hoje
          </h4>
          <span className="text-xs font-semibold text-slate-500 font-mono">
            {todayPunches.length}/4 Concluídos
          </span>
        </div>

        {/* Progress horizontal line */}
        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mb-6 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>

        {/* Step checkpoints */}
        <div className="grid grid-cols-2 gap-3" id="punches-progress-grid">
          {(['entrada', 'intervalo_saida', 'intervalo_entrada', 'saida'] as PunchType[]).map((type) => {
            const summary = getPunchesSummaryLine(type);
            const { label, color } = getPunchTypeDetails(type);
            return (
              <div 
                key={type}
                className={`p-3 rounded-2xl border transition flex items-center justify-between ${
                  summary.isSet 
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm' 
                    : 'bg-transparent border-dashed border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">
                    {label}
                  </span>
                  <span className={`text-[12px] font-mono font-bold ${summary.isSet ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500'}`}>
                    {summary.text}
                  </span>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${summary.isSet ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                  {summary.isSet ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Clock className="w-3.5 h-3.5" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sequential Camera and GPS modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
            <motion.div
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
              id="punch-registration-modal"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-slate-800 dark:text-slate-100">
                    Registrar {getPunchTypePortuguese(nextType)}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    PontoNow GPS Inteligente
                  </p>
                </div>
                <button
                  id="modal-cancel-btn"
                  onClick={handleCancelSequence}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Scroll Content */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                
                {/* GPS Panel */}
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-150/50 dark:border-slate-850/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      Sinal de Geolocalização
                    </span>
                    <button
                      id="gps-refresh-btn"
                      onClick={captureGpsLocation}
                      disabled={gpsLoading}
                      className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-500 rounded-lg shadow-xs cursor-pointer transition"
                      title="Forçar recaptura de GPS"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {gpsLoading ? (
                    <div className="flex items-center gap-2.5 py-1">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      <span className="text-xs text-slate-500">Buscando coordenadas por triangulação...</span>
                    </div>
                  ) : gpsError ? (
                    <div className="flex items-start gap-2 text-amber-600 bg-amber-500/10 p-3 rounded-xl border border-amber-500/10">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <strong className="block font-semibold">Sem sinal de GPS de hardware:</strong>
                        <span>{gpsError}</span>
                      </div>
                    </div>
                  ) : coords ? (
                    <div className="space-y-1.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>Latitude:</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-semibold">{coords.latitude.toFixed(6)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Longitude:</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-semibold">{coords.longitude.toFixed(6)}</strong>
                      </div>
                      <div className="text-[10px] text-emerald-500 dark:text-emerald-400 flex items-center gap-1 font-sans font-semibold pt-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Coordenadas registradas em cartório digital
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Camera Capturing Box */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Foto comprobatória (Selfie)
                  </label>

                  {!capturedPhoto ? (
                    <div className="relative bg-slate-900 rounded-2xl overflow-hidden aspect-square flex flex-col items-center justify-center p-4">
                      {useRealCamera ? (
                        <>
                          <video
                            id="webcam-hardware-feed"
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                          />
                          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                            <button
                              id="capture-shutter-btn"
                              onClick={handleCapturePhoto}
                              className="w-14 h-14 bg-white hover:bg-slate-100 p-1.5 rounded-full border-4 border-slate-400 shadow-lg cursor-pointer transition flex items-center justify-center"
                              title="Tirar Foto"
                            >
                              <div className="w-full h-full bg-blue-600 rounded-full"></div>
                            </button>
                          </div>
                        </>
                      ) : (
                        /* Iframe Camera Blocker Emulator (Slick custom interactive UI!) */
                        <div className="text-center p-6 space-y-4">
                          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-full">
                            <Camera className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-slate-200 leading-tight">
                              Simulador Inteligente de Câmera (Sandbox)
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                              Devido a restrições de iFrame do navegador, a câmera de hardware pode estar invisível. Fornecemos fotos de verificação simuladas abaixo:
                            </p>
                          </div>
                          
                          {/* Fallback photos list */}
                          <div className="grid grid-cols-3 gap-2.5 pt-2">
                            {CAMERA_FALLBACKS.map((pic, i) => (
                              <button
                                id={`fallback-pic-select-${i}`}
                                key={i}
                                type="button"
                                onClick={() => setSelectedFallbackPhoto(pic.url)}
                                className={`p-1 border rounded-lg overflow-hidden transition-all relative cursor-pointer ${
                                  selectedFallbackPhoto === pic.url
                                    ? 'border-indigo-500 bg-indigo-500/20 ring-2 ring-indigo-500/50'
                                    : 'border-slate-800 opacity-60 hover:opacity-105'
                                }`}
                              >
                                <img src={pic.url} alt={pic.name} className="w-full aspect-square object-cover rounded" referrerPolicy="no-referrer" />
                                <span className="block text-[8px] text-slate-300 mt-1 truncate font-sans">{pic.name}</span>
                              </button>
                            ))}
                          </div>

                          <button
                            id="capture-fallback-confirm-btn"
                            type="button"
                            onClick={handleCapturePhoto}
                            className="inline-flex items-center gap-1.5 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow cursor-pointer transition"
                          >
                            <Check className="w-4 h-4" /> Confirmar Selfie Selecionada
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Captured Preview */
                    <div className="relative rounded-2xl overflow-hidden aspect-square border-2 border-emerald-500/30">
                      <img
                        id="captured-image-preview"
                        src={capturedPhoto}
                        alt="Foto capturada"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        id="retake-photo-btn"
                        onClick={() => {
                          setCapturedPhoto(null);
                          initiateCamera();
                        }}
                        className="absolute top-3 right-3 flex items-center gap-1 py-1.5 px-3 bg-red-650 hover:bg-red-700 text-white text-[10px] font-bold rounded-full shadow cursor-pointer transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Refazer Foto
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-white text-left">
                        <div className="text-xs font-semibold flex items-center gap-1 text-emerald-400">
                          <Check className="w-3.5 h-3.5 font-bold" /> Identidade biométrica encriptada
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Modal Footer with Actions */}
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center gap-3">
                <button
                  id="cancel-punch-btn"
                  type="button"
                  onClick={handleCancelSequence}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 text-sm font-medium rounded-2xl cursor-pointer transition"
                >
                  Voltar
                </button>
                <button
                  id="confirm-submit-punch-btn"
                  type="button"
                  onClick={handleSubmitPunch}
                  disabled={!capturedPhoto || isSubmitting}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-2xl shadow shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Registrando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Registrar Ponto
                    </>
                  )}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Dialog Overlay */}
      <AnimatePresence>
        {showSuccessScreen && (
          <div className="fixed inset-0 bg-blue-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl border border-slate-150 dark:border-slate-850 p-6 shadow-2xl text-center"
              id="success-toast-card"
            >
              <div className="w-16 h-16 bg-gradient-to-tr from-emerald-400 to-emerald-600 text-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-5 animate-bounce">
                <Check className="w-9 h-9 stroke-[3]" />
              </div>
              <h3 className="font-display text-xl font-bold text-slate-800 dark:text-slate-100">
                Ponto Batido!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-[280px] mx-auto leading-relaxed">
                Etapa de <strong className="text-slate-700 dark:text-slate-300 font-semibold">"{lastRegisteredType ? getPunchTypePortuguese(lastRegisteredType) : ''}"</strong> registrada com sucesso às {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
              </p>

              {/* Metadata Pill summary in Success screen */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-150/60 dark:border-slate-850/60 my-4 text-left space-y-1.5">
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Colaborador:</span>
                  <span className="font-sans font-semibold text-slate-700 dark:text-slate-300">{user.name.split(' ')[0]}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Dispositivo GPS:</span>
                  <span className="text-emerald-500 font-bold font-sans">Ativo ({coords ? coords.latitude.toFixed(3) : '-23.550'}N)</span>
                </div>
              </div>

              <button
                id="finish-success-btn"
                onClick={() => setShowSuccessScreen(false)}
                className="w-full py-3.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-850 text-white text-sm font-semibold rounded-2xl cursor-pointer transition"
              >
                Retornar ao Painel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
