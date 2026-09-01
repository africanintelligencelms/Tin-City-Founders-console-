import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Copy, 
  Check, 
  ExternalLink, 
  Smartphone, 
  Maximize, 
  Minimize, 
  Camera, 
  CameraOff, 
  RefreshCw, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ScanLine, 
  UserCheck, 
  ArrowRight,
  Tv,
  HelpCircle
} from 'lucide-react';
import jsQR from 'jsqr';
import { PlateauProblem, AttendeeProfile, NavigationTab } from '../types';
import { BrandLogo } from './BrandLogo';

interface JoinQRProps {
  attendeesCount?: number;
  latestProblem?: PlateauProblem | null;
  onOpenCheckIn?: () => void;
  onSaveProfile?: (profile: AttendeeProfile) => void;
  onNavigateTab?: (tab: NavigationTab) => void;
  onOpenAnalytics?: () => void;
}

export const JoinQR: React.FC<JoinQRProps> = ({
  attendeesCount = 4,
  latestProblem,
  onOpenCheckIn,
  onSaveProfile,
  onNavigateTab,
  onOpenAnalytics
}) => {
  // Mode: 'display' (Projector/Screen QR) vs 'scanner' (Camera viewfinder for scanning)
  const [viewMode, setViewMode] = useState<'display' | 'scanner'>('display');
  const [activeSlot, setActiveSlot] = useState<'console' | 'wa' | 'form'>('console');
  
  const [urls, setUrls] = useState<{ console: string; wa: string; form: string }>({
    console: typeof window !== 'undefined' ? window.location.href : 'https://tincityfounders.jos',
    wa: 'https://chat.whatsapp.com/TinCityFoundersGroup',
    form: 'https://forms.gle/TinCityGiveAndAskForm'
  });
  const [inputUrl, setInputUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Camera Scanner State
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [parsedFounderData, setParsedFounderData] = useState<Partial<AttendeeProfile> | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);

  // Refs for camera video feed and canvas processing
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load saved URLs on mount
  useEffect(() => {
    try {
      const currentOrigin = window.location.href;
      const saved = localStorage.getItem('tcf_urls');
      if (saved) {
        const parsed = JSON.parse(saved);
        setUrls({
          console: parsed.console || currentOrigin,
          wa: parsed.wa || 'https://chat.whatsapp.com/TinCityFoundersGroup',
          form: parsed.form || 'https://forms.gle/TinCityGiveAndAskForm'
        });
      } else {
        setUrls(prev => ({ ...prev, console: currentOrigin }));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    setInputUrl(urls[activeSlot]);
  }, [activeSlot, urls]);

  // Audio tone synthesizer for QR scan success
  const playScanBeep = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12); // E6

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.18);

      if (navigator.vibrate) {
        navigator.vibrate([60, 40, 80]);
      }
    } catch (e) {
      // Audio context might be restricted before interaction
    }
  }, []);

  // Parse scanned payload to check if it has founder check-in parameters or JSON
  const handleDecodedQR = useCallback((decodedText: string) => {
    if (!decodedText || decodedText === scannedResult) return;

    playScanBeep();
    setScannedResult(decodedText);

    // Try parsing as JSON (e.g. founder badge QR)
    try {
      if (decodedText.startsWith('{') && decodedText.endsWith('}')) {
        const parsed = JSON.parse(decodedText);
        if (parsed.name || parsed.title || parsed.tags) {
          setParsedFounderData({
            name: parsed.name || '',
            title: parsed.title || '',
            tags: Array.isArray(parsed.tags) ? parsed.tags : (parsed.tags ? [parsed.tags] : []),
            bio: parsed.bio || '',
            giveAsk: parsed.giveAsk || '',
            location: parsed.location || 'Jos Central'
          });
          setScanSuccessMessage(`Founder badge detected for "${parsed.name || 'Attendee'}"!`);
          return;
        }
      }
    } catch (e) {
      // Not JSON, continue to URL query parsing
    }

    // Try parsing as URL with params
    try {
      if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
        const urlObj = new URL(decodedText);
        const nameParam = urlObj.searchParams.get('name') || urlObj.searchParams.get('founder');
        const titleParam = urlObj.searchParams.get('title') || urlObj.searchParams.get('role');
        const tagParam = urlObj.searchParams.get('tag') || urlObj.searchParams.get('tags');
        const bioParam = urlObj.searchParams.get('bio');

        if (nameParam || titleParam || tagParam) {
          setParsedFounderData({
            name: nameParam || '',
            title: titleParam || '',
            tags: tagParam ? tagParam.split(',') : [],
            bio: bioParam || '',
            location: urlObj.searchParams.get('location') || 'Jos'
          });
          setScanSuccessMessage(`Found check-in credentials for ${nameParam || 'Meetup Founder'}!`);
          return;
        }

        setScanSuccessMessage('Tin City QR link detected! Ready to proceed.');
        return;
      }
    } catch (e) {
      // Not a full URL
    }

    setScanSuccessMessage('QR code successfully scanned and verified.');
  }, [scannedResult, playScanBeep]);

  // Frame scanning loop using jsQR + canvas
  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });

        if (code && code.data) {
          handleDecodedQR(code.data);
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  }, [handleDecodedQR]);

  // Stop camera media stream cleanly
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Start camera media stream with MediaDevices API
  const startCamera = useCallback(async (desiredFacing: 'environment' | 'user' = facingMode, deviceId?: string) => {
    stopCamera();
    setCameraError(null);

    // Check if mediaDevices is supported in current environment
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported by this browser. You can still upload a QR image.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: desiredFacing },
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 }
            }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS Safari
        await videoRef.current.play();
        setCameraActive(true);
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }

      // Enumerate cameras for switching
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        setAvailableDevices(videoInputs);
      } catch (e) {
        // Enumerate fallback
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in browser settings to scan live QR codes.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No video camera was detected on this device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Camera is currently in use by another application.');
      } else {
        setCameraError('Could not start camera video stream. Try switching cameras or uploading an image.');
      }
      setCameraActive(false);
    }
  }, [facingMode, scanFrame, stopCamera]);

  // Flip camera between front & back
  const handleToggleFacingMode = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  // Switch camera if user selects another video device from dropdown
  const handleDeviceChange = (devId: string) => {
    setSelectedDeviceId(devId);
    startCamera(facingMode, devId);
  };

  // Process uploaded QR code image fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
          });

          if (code && code.data) {
            handleDecodedQR(code.data);
          } else {
            setCameraError('Could not detect a valid QR code in the uploaded image. Please try a clearer screenshot.');
          }
        }
        setIsProcessingFile(false);
      };
      img.onerror = () => {
        setCameraError('Failed to load the selected image file.');
        setIsProcessingFile(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Manage camera lifecycle when switching view modes or unmounting
  useEffect(() => {
    if (viewMode === 'scanner') {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [viewMode, startCamera, stopCamera, facingMode]);

  const handleSaveUrl = () => {
    const trimmed = inputUrl.trim();
    if (!trimmed) return;
    const updated = { ...urls, [activeSlot]: trimmed };
    setUrls(updated);
    try {
      localStorage.setItem('tcf_urls', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const currentUrl = urls[activeSlot];
  const qrCodeImgUrl = `https://quickchart.io/qr?text=${encodeURIComponent(currentUrl)}&size=360&margin=2&dark=0D4734&light=FFFFFF`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Perform 1-click check in if QR payload contained founder data
  const handleQuickCheckInFromQR = () => {
    if (!parsedFounderData) {
      if (onOpenCheckIn) onOpenCheckIn();
      return;
    }

    const newProfile: AttendeeProfile = {
      id: `attendee-${Date.now()}`,
      name: parsedFounderData.name || 'Tin City Founder',
      title: parsedFounderData.title || 'Tech Founder',
      tags: parsedFounderData.tags && parsedFounderData.tags.length > 0 ? parsedFounderData.tags : ['Founder', 'Jos Tech'],
      bio: parsedFounderData.bio || 'Checked in via Tin City QR Scanner.',
      giveAsk: parsedFounderData.giveAsk || '',
      location: parsedFounderData.location || 'Jos, Plateau State',
      avatarColor: '#0D4734',
      checkedInAt: new Date().toISOString()
    };

    if (onSaveProfile) {
      onSaveProfile(newProfile);
    }

    if (onNavigateTab) {
      onNavigateTab('attendees');
    }
  };

  const handleResetScanner = () => {
    setScannedResult(null);
    setParsedFounderData(null);
    setScanSuccessMessage(null);
    setCameraError(null);
    if (!cameraActive) {
      startCamera(facingMode);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 sm:py-6 text-center">
      {/* Hidden processing canvas for jsQR analysis */}
      <canvas ref={canvasRef} className="hidden" />
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Top Header Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-white border border-[#09251B]/20 rounded-2xl p-2.5 shadow-sm">
        {/* Primary View Toggle: Projector Screen vs Live Camera Scanner */}
        <div className="inline-flex items-center p-1 bg-[#F4EFE6] border border-[#09251B]/15 rounded-xl shadow-inner mx-auto sm:mx-0">
          <button
            onClick={() => {
              setViewMode('display');
              setScannedResult(null);
            }}
            className={`font-display font-black text-xs sm:text-sm px-3.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 select-none ${
              viewMode === 'display'
                ? 'bg-[#0D4734] text-[#FAF6EE] shadow-sm ring-1 ring-[#0D4734]'
                : 'text-[#09251B]/75 hover:text-[#09251B] hover:bg-white/80'
            }`}
          >
            <Tv className="w-3.5 h-3.5 text-[#E5A93C]" />
            <span>Display QR / Projector</span>
          </button>
          
          <button
            onClick={() => {
              setViewMode('scanner');
              setScannedResult(null);
            }}
            className={`font-display font-black text-xs sm:text-sm px-3.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 select-none ${
              viewMode === 'scanner'
                ? 'bg-[#0D4734] text-[#FAF6EE] shadow-sm ring-1 ring-[#0D4734]'
                : 'text-[#09251B]/75 hover:text-[#09251B] hover:bg-white/80'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-[#E5A93C]" />
            <span>Camera QR Scanner</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
          </button>
        </div>

        {/* Action Controls (Fullscreen & Info) */}
        <div className="flex items-center gap-2 mx-auto sm:mx-0">
          <button
            onClick={toggleFullscreen}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-[#FAF8F4] border border-[#09251B]/25 px-3 py-1.5 rounded-xl text-xs font-display font-bold text-[#09251B] cursor-pointer shadow-xs transition active:scale-95"
            title="Toggle fullscreen projector mode"
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>

          <button
            onClick={onOpenAnalytics}
            className="inline-flex items-center gap-1.5 bg-[#EBF3EF] hover:bg-[#DEF0E7] border border-[#0D4734]/30 px-3 py-1.5 rounded-xl text-xs font-display font-bold text-[#0D4734] cursor-pointer shadow-xs transition active:scale-95 group"
            title="Click to explore real-time Room Intelligence & Collective Analytics"
          >
            <span className="w-2 h-2 rounded-full bg-[#0D4734] animate-ping" />
            <span>{attendeesCount} In Room</span>
            <span className="text-[10px] bg-[#0D4734] text-[#FAF6EE] px-1.5 py-0.2 rounded-md font-mono font-bold">Analytics</span>
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: CAMERA QR SCANNER */}
      {viewMode === 'scanner' && (
        <div className="w-full max-w-2xl mx-auto space-y-4">
          <div className="bg-white border-2 border-[#09251B] rounded-3xl p-5 sm:p-7 shadow-lg text-center relative overflow-hidden">
            {/* Header */}
            <div className="mb-4">
              <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-100 to-amber-200 border border-amber-400/80 text-[#09251B] px-3.5 py-1 rounded-full text-xs font-display font-black tracking-wide uppercase shadow-xs mb-2">
                <ScanLine className="w-3.5 h-3.5 text-amber-700" />
                <span>MediaDevices Live QR Scanner</span>
              </div>
              <h2 className="font-display font-black text-2xl sm:text-3xl text-[#09251B]">
                Scan QR to <span className="text-[#0D4734]">Join & Check In</span>
              </h2>
              <p className="text-xs sm:text-sm text-[#09251B]/70 font-medium max-w-md mx-auto mt-1">
                Point your device camera at any Tin City meetup QR code, console URL, or attendee badge to check in instantly.
              </p>
            </div>

            {/* Viewfinder Container */}
            <div className="relative w-full max-w-md mx-auto aspect-square bg-[#09251B] rounded-2xl overflow-hidden border-3 border-[#09251B] shadow-inner flex items-center justify-center">
              {/* Live Video Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraActive && !scannedResult ? 'block' : 'hidden'}`}
              />

              {/* Live Scanning UI Overlay */}
              {cameraActive && !scannedResult && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-6">
                  {/* Top Status */}
                  <div className="bg-[#09251B]/80 backdrop-blur-sm text-[#FAF6EE] text-[11px] font-mono px-3 py-1 rounded-full border border-white/20 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Searching for QR codes...</span>
                  </div>

                  {/* Center Reticle Box & Animated Laser */}
                  <div className="relative w-48 h-48 sm:w-56 sm:h-56 border-2 border-dashed border-[#E5A93C]/80 rounded-2xl flex items-center justify-center">
                    {/* Corner Guides */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-3 border-l-3 border-[#E5A93C] rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-3 border-r-3 border-[#E5A93C] rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-3 border-l-3 border-[#E5A93C] rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-3 border-r-3 border-[#E5A93C] rounded-br-lg" />
                    
                    {/* Animated Scanning Laser Line */}
                    <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-[#E5A93C] to-transparent shadow-[0_0_8px_#E5A93C] animate-bounce duration-1000" />
                  </div>

                  {/* Bottom Guide */}
                  <div className="text-[11px] text-white/80 font-medium bg-[#09251B]/70 px-3 py-0.5 rounded-lg">
                    Align QR code inside the box
                  </div>
                </div>
              )}

              {/* Scanned Success Overlay */}
              {scannedResult && (
                <div className="absolute inset-0 bg-[#0D4734]/95 text-[#FAF6EE] p-6 flex flex-col items-center justify-center gap-3 z-10">
                  <div className="w-14 h-14 rounded-2xl bg-[#E5A93C] text-[#09251B] flex items-center justify-center shadow-lg animate-scale">
                    <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
                  </div>
                  <h3 className="font-display font-black text-lg sm:text-xl text-[#FAF6EE]">
                    QR Code Detected!
                  </h3>
                  <p className="text-xs text-white/90 font-mono bg-[#09251B]/60 p-2.5 rounded-xl max-w-xs break-all border border-white/10">
                    {scannedResult}
                  </p>
                  {scanSuccessMessage && (
                    <span className="text-xs font-bold text-[#E5A93C]">{scanSuccessMessage}</span>
                  )}
                </div>
              )}

              {/* Camera Error / Inactive State */}
              {(!cameraActive || cameraError) && !scannedResult && (
                <div className="p-6 text-center text-[#FAF6EE] space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center mx-auto">
                    <CameraOff className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-sm text-white">Camera Offline</h4>
                    <p className="text-xs text-white/70 mt-1 max-w-xs mx-auto">
                      {cameraError || 'Allow camera permissions in your browser to start scanning live QR codes.'}
                    </p>
                  </div>
                  <button
                    onClick={() => startCamera(facingMode)}
                    className="bg-gradient-to-r from-[#F59E0B] to-[#E5A93C] hover:from-[#E5A93C] hover:to-[#D97706] text-[#09251B] font-display font-black text-xs px-4 py-2 rounded-xl shadow-sm cursor-pointer transition active:scale-95 inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Try Enabling Camera</span>
                  </button>
                </div>
              )}
            </div>

            {/* Camera Control Buttons */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              {cameraActive && !scannedResult && (
                <>
                  <button
                    onClick={handleToggleFacingMode}
                    className="bg-[#FAF8F4] hover:bg-[#F4EFE6] text-[#09251B] border border-[#09251B]/25 font-display font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer transition flex items-center gap-1.5 shadow-xs active:scale-95"
                    title="Switch between front and back cameras"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#0D4734]" />
                    <span>Switch Camera ({facingMode === 'environment' ? 'Back' : 'Front'})</span>
                  </button>

                  <button
                    onClick={stopCamera}
                    className="bg-white hover:bg-red-50 text-red-700 border border-red-200 font-display font-bold text-xs px-3 py-2 rounded-xl cursor-pointer transition flex items-center gap-1.5 shadow-xs active:scale-95"
                  >
                    <CameraOff className="w-3.5 h-3.5" />
                    <span>Turn Off</span>
                  </button>
                </>
              )}

              {/* Upload QR screenshot alternative */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFile}
                className="bg-[#FAF8F4] hover:bg-[#F4EFE6] text-[#09251B] border border-[#09251B]/25 font-display font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer transition flex items-center gap-1.5 shadow-xs active:scale-95"
              >
                <Upload className="w-3.5 h-3.5 text-[#0D4734]" />
                <span>{isProcessingFile ? 'Analyzing...' : 'Scan Image / Screenshot'}</span>
              </button>

              {/* Device Selector dropdown if multiple webcams */}
              {availableDevices.length > 1 && (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => handleDeviceChange(e.target.value)}
                  className="bg-[#FAF8F4] text-[#09251B] text-xs font-bold border border-[#09251B]/25 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0D4734] cursor-pointer"
                >
                  <option value="">Default Camera</option>
                  {availableDevices.map((dev, idx) => (
                    <option key={dev.deviceId} value={dev.deviceId}>
                      {dev.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Post-Scan Action Center */}
            {scannedResult && (
              <div className="mt-5 p-4 bg-[#EBF3EF] border border-[#0D4734]/30 rounded-2xl text-left space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#0D4734] font-display font-black text-sm">
                    <UserCheck className="w-4 h-4" />
                    <span>Check-In Ready</span>
                  </div>
                  <button
                    onClick={handleResetScanner}
                    className="text-xs font-bold text-[#09251B]/70 hover:text-[#09251B] underline cursor-pointer"
                  >
                    Scan Another QR
                  </button>
                </div>

                {parsedFounderData && (
                  <div className="bg-white p-3 rounded-xl border border-[#09251B]/15 text-xs space-y-1">
                    <div className="font-display font-black text-sm text-[#09251B]">
                      {parsedFounderData.name || 'Founder Profile'}
                    </div>
                    {parsedFounderData.title && (
                      <div className="text-[#0D4734] font-bold">{parsedFounderData.title}</div>
                    )}
                    {parsedFounderData.tags && parsedFounderData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {parsedFounderData.tags.map((t, i) => (
                          <span key={i} className="bg-[#EBF3EF] text-[#0D4734] px-2 py-0.5 rounded-md text-[10px] font-bold">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={handleQuickCheckInFromQR}
                    className="flex-1 bg-gradient-to-r from-[#F59E0B] via-[#E5A93C] to-[#D97706] hover:from-[#E5A93C] hover:to-[#B45309] text-[#09251B] font-display font-black text-xs sm:text-sm py-2.5 px-4 rounded-xl border border-amber-600 shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
                  >
                    <Sparkles className="w-4 h-4 fill-current" />
                    <span>{parsedFounderData?.name ? `Check In as ${parsedFounderData.name}` : 'Complete Meetup Check-In'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {scannedResult.startsWith('http') && (
                    <a
                      href={scannedResult}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-[#0D4734] hover:bg-[#125B43] text-[#FAF6EE] font-display font-bold text-xs py-2.5 px-4 rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer transition active:scale-95"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#E5A93C]" />
                      <span>Open Link</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: DISPLAY QR / PROJECTOR */}
      {viewMode === 'display' && (
        <div className="space-y-6">
          <div className="flex justify-center my-2">
            <BrandLogo variant="icon-only" size="lg" />
          </div>

          <h1 className="font-display font-black text-3xl sm:text-5xl lg:text-6xl text-[#09251B] mb-2 leading-tight">
            SCAN TO JOIN <span className="text-[#0D4734] underline decoration-[#E5A93C] decoration-8">THE CONSOLE</span>
          </h1>

          <p className="text-xs sm:text-base font-bold text-[#09251B]/70 mb-4 max-w-xl mx-auto">
            Scan with your phone camera or use the live scanner tab to check in, tag your skills, and collaborate on Plateau challenges!
          </p>

          {/* Mode Switcher Buttons */}
          <div className="inline-flex items-center gap-1.5 bg-[#F4EFE6]/90 border border-[#09251B]/20 p-1.5 rounded-2xl mb-6 shadow-inner flex-wrap justify-center">
            <button
              onClick={() => setActiveSlot('console')}
              className={`font-display font-black text-xs sm:text-sm px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5 select-none ${
                activeSlot === 'console'
                  ? 'bg-[#0D4734] text-[#FAF6EE] shadow-sm ring-1 ring-[#0D4734]'
                  : 'text-[#09251B]/75 hover:text-[#09251B] hover:bg-white/80'
              }`}
            >
              <Smartphone className="w-4 h-4 text-[#E5A93C]" />
              <span>Console & Check-in QR</span>
            </button>
            <button
              onClick={() => setActiveSlot('wa')}
              className={`font-display font-black text-xs sm:text-sm px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5 select-none ${
                activeSlot === 'wa'
                  ? 'bg-[#0D4734] text-[#FAF6EE] shadow-sm ring-1 ring-[#0D4734]'
                  : 'text-[#09251B]/75 hover:text-[#09251B] hover:bg-white/80'
              }`}
            >
              <span>WhatsApp Group</span>
            </button>
            <button
              onClick={() => setActiveSlot('form')}
              className={`font-display font-black text-xs sm:text-sm px-4 py-2 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5 select-none ${
                activeSlot === 'form'
                  ? 'bg-[#0D4734] text-[#FAF6EE] shadow-sm ring-1 ring-[#0D4734]'
                  : 'text-[#09251B]/75 hover:text-[#09251B] hover:bg-white/80'
              }`}
            >
              <span>Give / Ask Form</span>
            </button>
          </div>

          {/* Main Screen Layout: QR + Live Steps & Ticker */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-center max-w-4xl mx-auto">
            {/* Left / Center: QR Card */}
            <div className="md:col-span-6 flex flex-col items-center">
              <div className="bg-white w-72 h-72 sm:w-80 sm:h-80 rounded-3xl p-5 flex items-center justify-center shadow-lg border-2 border-[#09251B]/30 relative">
                <img
                  src={qrCodeImgUrl}
                  alt={`QR Code for ${activeSlot}`}
                  className="w-full h-full object-contain rounded-2xl"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Quick Actions Under QR */}
              <div className="flex items-center gap-2.5 mt-4">
                <button
                  onClick={copyToClipboard}
                  className="bg-white hover:bg-[#FAF8F4] text-[#09251B] border border-[#09251B]/25 font-display font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#0D4734] stroke-[3]" /> : <Copy className="w-3.5 h-3.5 text-[#0D4734] stroke-[3]" />}
                  <span>{copied ? 'Copied Link' : 'Copy Link'}</span>
                </button>

                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#0D4734] hover:bg-[#125B43] text-[#FAF6EE] font-display font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs active:scale-95"
                >
                  <ExternalLink className="w-3.5 h-3.5 stroke-[3] text-[#E5A93C]" />
                  <span>Open Link</span>
                </a>
              </div>
            </div>

            {/* Right: Steps & Room Status */}
            <div className="md:col-span-6 text-left space-y-3.5">
              {/* Step Cards */}
              <div className="bg-white border border-[#09251B]/20 rounded-2xl p-4 shadow-sm flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#E5A93C] text-[#09251B] flex items-center justify-center font-display font-black text-xs shrink-0 shadow-xs">
                  1
                </div>
                <div>
                  <h4 className="font-display font-black text-xs sm:text-sm text-[#09251B]">Scan QR Code</h4>
                  <p className="text-xs text-[#09251B]/70 font-medium">Use phone camera or the built-in scanner to join the live room.</p>
                </div>
              </div>

              <div className="bg-white border border-[#09251B]/20 rounded-2xl p-4 shadow-sm flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#BF7E1D] text-white flex items-center justify-center font-display font-black text-xs shrink-0 shadow-xs">
                  2
                </div>
                <div>
                  <h4 className="font-display font-black text-xs sm:text-sm text-[#09251B]">Tag Skills & Profile</h4>
                  <p className="text-xs text-[#09251B]/70 font-medium">Add your Jos area, venture tags (AI, Agritech, Energy), and bio.</p>
                </div>
              </div>

              <div className="bg-white border border-[#09251B]/20 rounded-2xl p-4 shadow-sm flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#0D4734] text-[#E5A93C] flex items-center justify-center font-display font-black text-xs shrink-0 shadow-xs">
                  3
                </div>
                <div>
                  <h4 className="font-display font-black text-xs sm:text-sm text-[#09251B]">Collaborate & Form Squads</h4>
                  <p className="text-xs text-[#09251B]/70 font-medium">Upvote Plateau problems, join active squads, and connect.</p>
                </div>
              </div>

              {/* Room Live Stat Pill */}
              <button
                onClick={onOpenAnalytics}
                className="w-full bg-gradient-to-r from-[#EBF3EF] to-[#DEF0E7] hover:from-[#DEF0E7] hover:to-[#D2EADB] border border-[#0D4734]/30 rounded-2xl p-3.5 shadow-xs flex items-center justify-between cursor-pointer transition active:scale-95 group text-left"
                title="Click to open Room Live Analytics & Collective Visualization"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0D4734] animate-ping" />
                  <div>
                    <span className="font-display font-black text-xs text-[#09251B] block">
                      Room Live Status & Velocity
                    </span>
                    <span className="text-[10px] text-[#0D4734] font-bold">
                      Click for Collective Visualization & Analytics →
                    </span>
                  </div>
                </div>
                <span className="font-display font-black text-xs bg-[#0D4734] text-[#FAF6EE] px-2.5 py-1.5 rounded-lg shadow-xs group-hover:bg-[#125B43] transition">
                  {attendeesCount} In Room
                </span>
              </button>
            </div>
          </div>

          {/* Custom URL Input Bar for Host */}
          <div className="mt-8 max-w-md mx-auto">
            <div className="flex items-center gap-2 bg-white border border-[#09251B]/25 rounded-2xl p-1.5 shadow-sm">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveUrl()}
                placeholder={`Custom URL for ${activeSlot}...`}
                className="flex-1 bg-transparent px-3 text-xs text-[#09251B] focus:outline-none placeholder-[#09251B]/40 font-mono font-medium truncate"
              />
              <button
                onClick={handleSaveUrl}
                className="bg-gradient-to-r from-[#F59E0B] to-[#E5A93C] hover:from-[#E5A93C] hover:to-[#D97706] text-[#09251B] font-display font-black text-xs px-3.5 py-1.5 rounded-xl cursor-pointer shadow-xs active:scale-95 transition"
              >
                Save URL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
