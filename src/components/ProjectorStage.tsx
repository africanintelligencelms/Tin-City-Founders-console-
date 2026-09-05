import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Wifi,
  Users,
  Vote,
  Flame,
  Scale,
  BarChart2,
  Trophy,
  Moon,
  Sun,
  Radio,
  Clock,
  ShieldCheck,
  Award,
  Layers,
  HelpCircle
} from 'lucide-react';
import jsQR from 'jsqr';
import { PlateauProblem, AttendeeProfile, NavigationTab, TrusteeCandidate, RoomSessionState } from '../types';
import { BrandLogo } from './BrandLogo';
import { TRUSTEE_SEATS, INITIAL_TRUSTEE_CANDIDATES } from '../data/trusteeSeatsData';
import { StageConductorBar } from './StageConductorBar';

interface ProjectorStageProps {
  attendeesCount?: number;
  latestProblem?: PlateauProblem | null;
  problems?: PlateauProblem[];
  attendees?: AttendeeProfile[];
  trusteeCandidates?: TrusteeCandidate[];
  sessionState?: RoomSessionState;
  onUpdateSessionState?: (partial: Partial<RoomSessionState>) => Promise<void>;
  onBroadcastAnnouncement?: (message: string) => Promise<void>;
  connectedClientsCount?: number;
  onOpenCheckIn?: () => void;
  onSaveProfile?: (profile: AttendeeProfile) => void;
  onNavigateTab?: (tab: NavigationTab) => void;
  onOpenAnalytics?: () => void;
}

export type StageSlideId = 'qr' | 'problems' | 'trustees' | 'sectors' | 'founders';

interface SlideConfig {
  id: StageSlideId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SLIDES: SlideConfig[] = [
  { id: 'qr', label: 'Room Check-In & Join QR', shortLabel: 'Join QR', icon: Smartphone },
  { id: 'problems', label: 'Trending Problem Statements', shortLabel: 'Problems', icon: Flame },
  { id: 'trustees', label: 'Founding Trustees Board (CAMA 2020)', shortLabel: 'Trustees (12)', icon: Scale },
  { id: 'sectors', label: 'Sector Priorities Heatmap', shortLabel: 'Sectors', icon: BarChart2 },
  { id: 'founders', label: 'Live Founder Spotlight', shortLabel: 'Founders', icon: Users },
];

/**
 * The join QR is the single point of failure for the whole room: if it encodes a
 * stale address, every phone that scans it fails and the screen still looks
 * correct. So a cached join URL is trusted only while its origin matches the
 * server currently serving this page; anything else (a saved localhost, an old
 * tunnel, a malformed string) falls back to the live origin.
 */
function sameOriginOrLive(savedUrl: unknown, liveUrl: string): string {
  if (typeof savedUrl !== 'string' || !savedUrl.trim()) return liveUrl;
  try {
    return new URL(savedUrl).origin === window.location.origin ? savedUrl : liveUrl;
  } catch (e) {
    // Not a parseable absolute URL — never put it on the projector.
    return liveUrl;
  }
}

export const ProjectorStage: React.FC<ProjectorStageProps> = ({
  attendeesCount = 4,
  latestProblem,
  problems = [],
  attendees = [],
  trusteeCandidates: liveTrusteeCandidates,
  sessionState,
  onUpdateSessionState,
  onBroadcastAnnouncement,
  connectedClientsCount = 1,
  onOpenCheckIn,
  onSaveProfile,
  onNavigateTab,
  onOpenAnalytics
}) => {
  // Mode: 'broadcast' (Projector Stage) vs 'scanner' (Host Camera Viewfinder)
  const [stageMode, setStageMode] = useState<'broadcast' | 'scanner'>('broadcast');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isAutoCycling, setIsAutoCycling] = useState<boolean>(true);
  const [cycleDuration, setCycleDuration] = useState<number>(12); // seconds
  const [cycleProgress, setCycleProgress] = useState<number>(0); // 0 to 100%
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Active QR URL Slot
  const [activeSlot, setActiveSlot] = useState<'console' | 'wa' | 'form'>('console');
  const [urls, setUrls] = useState<{ console: string; wa: string; form: string }>({
    console: typeof window !== 'undefined' ? `${window.location.origin}?mode=audience` : 'https://tincityfounders.jos?mode=audience',
    wa: 'https://chat.whatsapp.com/TinCityFoundersGroup',
    form: 'https://forms.gle/TinCityGiveAndAskForm'
  });
  const [inputUrl, setInputUrl] = useState<string>('');

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

  // Trustee Candidates from storage or defaults
  const [trusteeCandidates, setTrusteeCandidates] = useState<TrusteeCandidate[]>(() => {
    try {
      const saved = localStorage.getItem('tcf_trustee_candidates_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_TRUSTEE_CANDIDATES;
  });

  // Live server snapshot (via SSE in App) beats the local cache
  useEffect(() => {
    if (liveTrusteeCandidates && liveTrusteeCandidates.length > 0) {
      setTrusteeCandidates(liveTrusteeCandidates);
    }
  }, [liveTrusteeCandidates]);

  // Refs for video feed and canvas
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load saved URLs
  useEffect(() => {
    try {
      const defaultAudienceOrigin = `${window.location.origin}?mode=audience`;
      const saved = localStorage.getItem('tcf_urls');
      if (saved) {
        const parsed = JSON.parse(saved);
        setUrls({
          // A cached join URL is only honoured while it still points at THIS
          // server. A projector that once saved http://localhost:3000 would
          // otherwise render a perfectly scannable QR for an address nobody in
          // the room can reach — 100 phones, connection refused, and nothing on
          // screen looking wrong. The live origin always wins on a mismatch.
          console: sameOriginOrLive(parsed.console, defaultAudienceOrigin),
          // wa and form are deliberately external links; leave them as saved.
          wa: parsed.wa || 'https://chat.whatsapp.com/TinCityFoundersGroup',
          form: parsed.form || 'https://forms.gle/TinCityGiveAndAskForm'
        });
      } else {
        setUrls(prev => ({ ...prev, console: defaultAudienceOrigin }));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    setInputUrl(urls[activeSlot]);
  }, [activeSlot, urls]);

  // Fullscreen change detection listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Auto-Cycle Timer Effect
  useEffect(() => {
    if (!isAutoCycling || stageMode !== 'broadcast') {
      setCycleProgress(0);
      return;
    }

    const intervalStepMs = 100;
    const totalSteps = (cycleDuration * 1000) / intervalStepMs;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = Math.min(100, (step / totalSteps) * 100);
      setCycleProgress(progress);

      if (step >= totalSteps) {
        step = 0;
        setCycleProgress(0);
        setCurrentSlideIndex(prev => (prev + 1) % SLIDES.length);
      }
    }, intervalStepMs);

    return () => clearInterval(timer);
  }, [isAutoCycling, cycleDuration, stageMode]);

  // Calculations for Live Ticker and Slides
  const totalVotesCount = useMemo(() => problems.reduce((acc, p) => acc + (p.upvotes || 0), 0), [problems]);
  const totalSquadsCount = useMemo(() => problems.reduce((acc, p) => acc + (p.commitments || 0), 0), [problems]);
  
  const sortedProblems = useMemo(() => {
    return [...problems].sort((a, b) => (b.upvotes + b.commitments * 2) - (a.upvotes + a.commitments * 2));
  }, [problems]);

  const sectorCounts = useMemo(() => {
    const map: Record<string, { count: number; votes: number }> = {};
    problems.forEach(p => {
      const cat = p.category || 'General';
      if (!map[cat]) map[cat] = { count: 0, votes: 0 };
      map[cat].count += 1;
      map[cat].votes += p.upvotes;
    });
    return Object.entries(map).sort((a, b) => b[1].votes - a[1].votes);
  }, [problems]);

  const topSector = sectorCounts[0]?.[0] || 'Agro-Tech & Cold Chain';

  // Audio tone synthesizer for QR scan success
  const playScanBeep = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.18);

      if (navigator.vibrate) {
        navigator.vibrate([60, 40, 80]);
      }
    } catch (e) {}
  }, []);

  // Parse scanned QR
  const handleDecodedQR = useCallback((decodedText: string) => {
    if (!decodedText || decodedText === scannedResult) return;

    playScanBeep();
    setScannedResult(decodedText);

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
    } catch (e) {}

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
          setScanSuccessMessage(`Check-in detected for ${nameParam || 'Meetup Founder'}!`);
          return;
        }
        setScanSuccessMessage('Tin City QR link detected! Ready to proceed.');
        return;
      }
    } catch (e) {}

    setScanSuccessMessage('QR code verified successfully.');
  }, [scannedResult, playScanBeep]);

  // Frame scanning loop
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

  // Camera Management
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async (desiredFacing: 'environment' | 'user' = facingMode, deviceId?: string) => {
    stopCamera();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported on this browser. You can still upload a QR image.');
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
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        setAvailableDevices(videoInputs);
      } catch (e) {}
    } catch (err: any) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in browser settings.');
      } else {
        setCameraError('Could not start camera feed. Please check camera permissions.');
      }
      setCameraActive(false);
    }
  }, [facingMode, scanFrame, stopCamera]);

  const handleToggleFacingMode = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  const handleDeviceChange = (devId: string) => {
    setSelectedDeviceId(devId);
    startCamera(facingMode, devId);
  };

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
            setCameraError('Could not detect a valid QR code in the uploaded image.');
          }
        }
        setIsProcessingFile(false);
      };
      img.onerror = () => {
        setCameraError('Failed to load image.');
        setIsProcessingFile(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (stageMode === 'scanner') {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [stageMode, startCamera, stopCamera, facingMode]);

  const handleSaveUrl = () => {
    const trimmed = inputUrl.trim();
    if (!trimmed) return;
    const updated = { ...urls, [activeSlot]: trimmed };
    setUrls(updated);
    try {
      localStorage.setItem('tcf_urls', JSON.stringify(updated));
    } catch (e) {}
  };

  const currentUrl = urls[activeSlot];
  const qrCodeImgUrl = `https://quickchart.io/qr?text=${encodeURIComponent(currentUrl)}&size=400&margin=2&dark=0D4734&light=FFFFFF`;

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

  const handleQuickCheckInFromQR = () => {
    if (!parsedFounderData) {
      if (onOpenCheckIn) onOpenCheckIn();
      return;
    }

    const newProfile: AttendeeProfile = {
      id: `attendee-${Date.now()}`,
      name: parsedFounderData.name || 'Tin City Founder',
      // Only what the scanned badge actually carried. A blank field stays blank
      // so the directory shows real detail, not the same invented line on
      // every card — the attendee can fill it in from their profile sheet.
      title: parsedFounderData.title || '',
      tags: parsedFounderData.tags && parsedFounderData.tags.length > 0 ? parsedFounderData.tags : [],
      bio: parsedFounderData.bio || '',
      giveAsk: parsedFounderData.giveAsk || '',
      location: parsedFounderData.location || '',
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

  const isDark = themeMode === 'dark';

  return (
    <div className={`w-full transition-colors duration-300 ${
      isDark ? 'bg-[#061811] text-[#FAF6EE]' : 'bg-[#F6F3EC] text-[#09251B]'
    } min-h-[calc(100vh-140px)] rounded-3xl p-3 sm:p-6 lg:p-8 flex flex-col justify-between shadow-2xl border ${
      isDark ? 'border-[#0D4734]/50' : 'border-[#09251B]/20'
    }`}>
      {/* Hidden processing canvas & file input */}
      <canvas ref={canvasRef} className="hidden" />
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Stage Conductor Remote Control for Host */}
      {sessionState && onUpdateSessionState && (
        <div className="mb-4">
          <StageConductorBar
            sessionState={sessionState}
            onUpdateSessionState={onUpdateSessionState}
            onBroadcastAnnouncement={onBroadcastAnnouncement || (async () => {})}
            connectedClientsCount={connectedClientsCount}
            isCompact={false}
          />
        </div>
      )}

      {/* TOP BAR: Controls & Stage Switchers */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E5A93C]/20 mb-4">
        {/* Left: Mode Switcher & Stage Indicator */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className={`inline-flex items-center p-1 rounded-2xl border shadow-inner ${
            isDark ? 'bg-[#09251B]/80 border-white/10' : 'bg-[#F4EFE6] border-[#09251B]/15'
          }`}>
            <button
              onClick={() => {
                setStageMode('broadcast');
                setScannedResult(null);
              }}
              className={`font-display font-black text-xs sm:text-sm px-3.5 py-1.5 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5 select-none ${
                stageMode === 'broadcast'
                  ? 'bg-gradient-to-r from-[#0D4734] to-[#166E52] text-[#FAF6EE] shadow-md ring-1 ring-[#E5A93C]/40'
                  : isDark ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-[#09251B]/75 hover:text-[#09251B] hover:bg-white/80'
              }`}
            >
              <Tv className="w-4 h-4 text-[#E5A93C]" />
              <span>Projector Broadcast Stage</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            </button>
            
            <button
              onClick={() => {
                setStageMode('scanner');
                setScannedResult(null);
              }}
              className={`font-display font-black text-xs sm:text-sm px-3.5 py-1.5 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-1.5 select-none ${
                stageMode === 'scanner'
                  ? 'bg-gradient-to-r from-[#0D4734] to-[#166E52] text-[#FAF6EE] shadow-md ring-1 ring-[#E5A93C]/40'
                  : isDark ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-[#09251B]/75 hover:text-[#09251B] hover:bg-white/80'
              }`}
            >
              <Camera className="w-4 h-4 text-[#E5A93C]" />
              <span>Camera Viewfinder Scanner</span>
            </button>
          </div>

          <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold border ${
            isDark ? 'bg-[#0D4734]/40 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-[#0D4734]'
          }`}>
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span>LIVE 1080P/4K STAGE BROADCAST</span>
          </div>
        </div>

        {/* Right: Stage Presentation Utility Buttons */}
        <div className="flex items-center gap-2">
          {/* Theme Switcher */}
          <button
            onClick={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-xs ${
              isDark ? 'bg-[#09251B] text-[#E5A93C] border-white/10 hover:bg-[#0D4734]' : 'bg-white text-[#09251B] border-[#09251B]/20 hover:bg-[#FAF8F4]'
            }`}
            title="Toggle Boardroom Dark / Stage Light Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="hidden sm:inline">{isDark ? 'Stage Light' : 'Boardroom Dark'}</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className={`px-3 py-2 rounded-xl border text-xs font-display font-black flex items-center gap-1.5 cursor-pointer transition shadow-xs active:scale-95 ${
              isDark ? 'bg-[#E5A93C] text-[#09251B] border-amber-600 hover:bg-[#D4952B]' : 'bg-[#0D4734] text-[#FAF6EE] border-[#0D4734] hover:bg-[#125B43]'
            }`}
            title="Toggle Stage Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            <span>{isFullscreen ? 'Exit Stage Fullscreen' : 'Launch Fullscreen Stage'}</span>
          </button>
        </div>
      </div>

      {/* CONTINUOUS LIVE ROOM TICKER */}
      <div className={`w-full overflow-hidden py-2 px-3 rounded-xl mb-4 border flex items-center gap-3 ${
        isDark ? 'bg-[#09251B]/90 border-emerald-500/20 text-[#FAF6EE]' : 'bg-[#EBF3EF] border-[#0D4734]/30 text-[#0D4734]'
      }`}>
        <div className="flex items-center gap-1.5 font-display font-black text-xs shrink-0 text-[#E5A93C] uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-[#E5A93C] animate-ping" />
          <span>Room Live Ticker</span>
        </div>
        <div className="flex-1 overflow-x-auto whitespace-nowrap text-xs font-mono font-medium scrollbar-none flex items-center gap-6">
          <span className="inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-[#E5A93C]" />
            <strong>{attendeesCount}</strong> Founders In Room
          </span>
          <span className="text-[#E5A93C]">◆</span>
          <span className="inline-flex items-center gap-1">
            <Vote className="w-3.5 h-3.5 text-[#E5A93C]" />
            <strong>{totalVotesCount}</strong> Total Votes Cast
          </span>
          <span className="text-[#E5A93C]">◆</span>
          <span className="inline-flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-[#E5A93C]" />
            <strong>{totalSquadsCount}</strong> Squad Members Committed
          </span>
          <span className="text-[#E5A93C]">◆</span>
          <span className="inline-flex items-center gap-1">
            <Scale className="w-3.5 h-3.5 text-[#E5A93C]" />
            <strong>12</strong> CAC Trustee Seats in Voting
          </span>
          <span className="text-[#E5A93C]">◆</span>
          <span className="inline-flex items-center gap-1">
            <Wifi className="w-3.5 h-3.5 text-[#E5A93C]" />
            Wi-Fi: <strong>TinCity_Founders</strong> (PW: <strong>BuildInJos2026</strong>)
          </span>
          <span className="text-[#E5A93C]">◆</span>
          <span>Lead Sector: <strong>{topSector}</strong></span>
        </div>
      </div>

      {/* VIEW MODE 1: LIVE BROADCAST STAGE */}
      {stageMode === 'broadcast' && (
        <div className="flex-1 flex flex-col justify-between space-y-6">
          {/* SLIDE NAVIGATION CONTROLS & TIMER BAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Slide Selection Pills */}
            <div className={`flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl border flex-wrap justify-center shadow-inner ${
              isDark ? 'bg-[#09251B]/80 border-white/10' : 'bg-[#F4EFE6] border-[#09251B]/15'
            }`}>
              {SLIDES.map((slide, idx) => {
                const Icon = slide.icon;
                const isActive = currentSlideIndex === idx;
                return (
                  <button
                    key={slide.id}
                    onClick={() => {
                      setCurrentSlideIndex(idx);
                      setCycleProgress(0);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-display text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 select-none ${
                      isActive
                        ? isDark 
                          ? 'bg-[#E5A93C] text-[#09251B] font-black shadow-md scale-105' 
                          : 'bg-[#0D4734] text-[#FAF6EE] font-black shadow-md scale-105'
                        : isDark
                          ? 'text-white/70 hover:text-white hover:bg-white/10'
                          : 'text-[#09251B]/70 hover:text-[#09251B] hover:bg-white/80'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{slide.shortLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Play/Pause & Duration Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAutoCycling(prev => !prev)}
                className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition active:scale-95 ${
                  isAutoCycling
                    ? isDark ? 'bg-emerald-950 text-emerald-300 border-emerald-700/50' : 'bg-emerald-50 text-[#0D4734] border-emerald-300'
                    : isDark ? 'bg-amber-950 text-amber-300 border-amber-700/50' : 'bg-amber-50 text-amber-900 border-amber-300'
                }`}
                title={isAutoCycling ? 'Pause Auto-Cycle' : 'Resume Auto-Cycle'}
              >
                {isAutoCycling ? <Pause className="w-3.5 h-3.5 text-emerald-400" /> : <Play className="w-3.5 h-3.5 text-amber-500" />}
                <span className="font-mono text-xs">{isAutoCycling ? 'Auto-Cycle ON' : 'Paused'}</span>
              </button>

              <select
                value={cycleDuration}
                onChange={(e) => {
                  setCycleDuration(Number(e.target.value));
                  setCycleProgress(0);
                }}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono font-bold cursor-pointer focus:outline-none ${
                  isDark ? 'bg-[#09251B] border-white/15 text-[#FAF6EE]' : 'bg-white border-[#09251B]/20 text-[#09251B]'
                }`}
              >
                <option value={8}>8s / slide</option>
                <option value={12}>12s / slide</option>
                <option value={20}>20s / slide</option>
                <option value={30}>30s / slide</option>
              </select>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setCurrentSlideIndex(prev => (prev - 1 + SLIDES.length) % SLIDES.length);
                    setCycleProgress(0);
                  }}
                  className={`p-1.5 rounded-xl border cursor-pointer ${
                    isDark ? 'bg-[#09251B] hover:bg-[#0D4734] border-white/10 text-white' : 'bg-white hover:bg-slate-100 border-[#09251B]/20 text-[#09251B]'
                  }`}
                  title="Previous Slide"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setCurrentSlideIndex(prev => (prev + 1) % SLIDES.length);
                    setCycleProgress(0);
                  }}
                  className={`p-1.5 rounded-xl border cursor-pointer ${
                    isDark ? 'bg-[#09251B] hover:bg-[#0D4734] border-white/10 text-white' : 'bg-white hover:bg-slate-100 border-[#09251B]/20 text-[#09251B]'
                  }`}
                  title="Next Slide"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* AUTO-CYCLE SMOOTH PROGRESS BAR */}
          <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden relative">
            <div 
              className="h-full bg-gradient-to-r from-[#E5A93C] via-emerald-400 to-[#E5A93C] transition-all duration-100 ease-linear rounded-full"
              style={{ width: `${cycleProgress}%` }}
            />
          </div>

          {/* DYNAMIC STAGE CONTENT CONTAINER */}
          <div className="flex-1 min-h-[420px] flex items-center justify-center">
            {/* SLIDE 1: ROOM CHECK-IN & JOIN QR */}
            {currentSlideIndex === 0 && (
              <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-5xl mx-auto py-2">
                {/* Left: Giant QR Code Container */}
                <div className="lg:col-span-6 flex flex-col items-center">
                  <div className="relative group">
                    {/* Glowing animated frame corner accents */}
                    <div className="absolute -inset-3 bg-gradient-to-r from-[#E5A93C] via-emerald-500 to-[#E5A93C] rounded-3xl opacity-75 blur-md group-hover:opacity-100 transition duration-500" />
                    
                    <div className="relative bg-white p-6 rounded-3xl border-4 border-[#09251B] shadow-2xl flex flex-col items-center">
                      <img
                        src={qrCodeImgUrl}
                        alt="Join Room QR"
                        className="w-64 h-64 sm:w-72 sm:h-72 object-contain rounded-xl"
                        referrerPolicy="no-referrer"
                      />
                      
                      <div className="mt-3 flex items-center gap-2 text-xs font-mono font-black text-[#0D4734] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Live Join Link · Jos Meetup</span>
                      </div>
                    </div>
                  </div>

                  {/* Copy Link / Slot Selector */}
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={copyToClipboard}
                      className={`px-4 py-2 rounded-xl text-xs font-display font-black flex items-center gap-2 border shadow-sm cursor-pointer transition active:scale-95 ${
                        isDark ? 'bg-[#09251B] text-white border-white/20 hover:bg-[#0D4734]' : 'bg-white text-[#09251B] border-[#09251B]/20 hover:bg-slate-50'
                      }`}
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-[#E5A93C]" />}
                      <span>{copied ? 'Copied Room URL' : 'Copy Direct URL'}</span>
                    </button>

                    <a
                      href={currentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl text-xs font-display font-black flex items-center gap-2 bg-[#0D4734] text-[#FAF6EE] hover:bg-[#166E52] transition active:scale-95 shadow-sm"
                    >
                      <ExternalLink className="w-4 h-4 text-[#E5A93C]" />
                      <span>Open Link</span>
                    </a>
                  </div>
                </div>

                {/* Right: Stage Instructions, Wi-Fi & Live Counter */}
                <div className="lg:col-span-6 space-y-4 text-left">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E5A93C]/20 border border-[#E5A93C]/40 text-[#E5A93C] text-xs font-display font-black uppercase tracking-wider mb-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Welcome to Tin City Founders</span>
                    </div>
                    <h1 className="font-display font-black text-3xl sm:text-5xl leading-tight">
                      SCAN TO <span className="text-[#E5A93C] underline decoration-emerald-500 decoration-4">CHECK IN</span>
                    </h1>
                    <p className={`text-sm sm:text-base font-medium mt-2 ${isDark ? 'text-white/80' : 'text-[#09251B]/80'}`}>
                      Point any smartphone camera to open the live console, cast your votes, submit local problems, and endorse Founding Trustees.
                    </p>
                  </div>

                  {/* Wi-Fi Credentials Badge */}
                  <div className={`p-4 rounded-2xl border flex items-center gap-4 ${
                    isDark ? 'bg-[#09251B]/80 border-white/10' : 'bg-white border-[#09251B]/15 shadow-sm'
                  }`}>
                    <div className="w-12 h-12 rounded-xl bg-[#E5A93C] text-[#09251B] flex items-center justify-center shrink-0 shadow-sm font-black">
                      <Wifi className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#E5A93C] uppercase tracking-wider">Venue High-Speed Wi-Fi</div>
                      <div className="font-display font-black text-sm sm:text-base">
                        Network: <span className="font-mono text-emerald-400">TinCity_Founders</span>
                      </div>
                      <div className="text-xs font-mono text-white/70">
                        Password: <strong className="text-white">BuildInJos2026</strong>
                      </div>
                    </div>
                  </div>

                  {/* Checked In Founders Live Roster Teaser */}
                  <div className={`p-4 rounded-2xl border ${
                    isDark ? 'bg-[#09251B]/80 border-white/10' : 'bg-white border-[#09251B]/15 shadow-sm'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-display font-black text-[#E5A93C] uppercase">
                        Active In The Room Right Now
                      </span>
                      <span className="text-xs font-mono font-bold bg-[#0D4734] text-white px-2 py-0.5 rounded-md">
                        {attendees.length} Checked In
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {attendees.slice(0, 6).map((att, i) => (
                        <div 
                          key={att.id || i}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/20 border border-white/10 text-xs font-bold"
                        >
                          <div 
                            className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] text-white font-black"
                            style={{ backgroundColor: att.avatarColor || '#0D4734' }}
                          >
                            {att.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="truncate max-w-[100px]">{att.name.split(' ')[0]}</span>
                        </div>
                      ))}
                      {attendees.length > 6 && (
                        <span className="text-xs font-mono font-bold text-white/70">+{attendees.length - 6} more</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SLIDE 2: LIVE TRENDING PROBLEM STATEMENTS */}
            {currentSlideIndex === 1 && (
              <div className="w-full max-w-5xl mx-auto space-y-4 text-left py-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-display font-black uppercase text-[#E5A93C] tracking-wider">
                      <Flame className="w-4 h-4 text-amber-500" />
                      <span>Live Challenge Leaderboard</span>
                    </div>
                    <h2 className="font-display font-black text-2xl sm:text-4xl">
                      Top Plateau Problems & Active Squads
                    </h2>
                  </div>
                  <div className="text-xs font-mono font-bold bg-[#0D4734] text-white px-3 py-1.5 rounded-xl border border-emerald-400/30">
                    {problems.length} Challenges Submitted
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {sortedProblems.slice(0, 3).map((prob, index) => {
                    const rankColors = [
                      'from-amber-500/30 to-amber-700/20 border-amber-400',
                      'from-slate-400/30 to-slate-600/20 border-slate-300',
                      'from-orange-600/30 to-orange-800/20 border-orange-500'
                    ];
                    const medals = ['🥇 1st Priority', '🥈 2nd Priority', '🥉 3rd Priority'];

                    return (
                      <div 
                        key={prob.id}
                        className={`p-5 rounded-3xl border-2 bg-gradient-to-b ${rankColors[index] || 'from-emerald-900/30 to-emerald-950/20 border-emerald-600/40'} ${
                          isDark ? 'bg-[#09251B]/90' : 'bg-white'
                        } shadow-xl flex flex-col justify-between space-y-4`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-[#E5A93C] text-[#09251B] font-display font-black text-[11px]">
                              {medals[index]}
                            </span>
                            <span className="text-[11px] font-mono text-emerald-400 font-bold bg-black/40 px-2 py-0.5 rounded-md">
                              {prob.category}
                            </span>
                          </div>

                          <h3 className="font-display font-black text-base sm:text-lg line-clamp-3 leading-snug">
                            {prob.title}
                          </h3>

                          <p className={`text-xs mt-2 line-clamp-2 ${isDark ? 'text-white/70' : 'text-[#09251B]/70'}`}>
                            {prob.description}
                          </p>
                        </div>

                        <div className="space-y-3 pt-2 border-t border-white/10">
                          {/* Live Metrics */}
                          <div className="flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                              <Vote className="w-3.5 h-3.5 text-[#E5A93C]" />
                              <span>{prob.upvotes} Founder Votes</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                              <Users className="w-3.5 h-3.5 text-amber-400" />
                              <span>{prob.commitments} in Squad</span>
                            </div>
                          </div>

                          {/* Needed Skills */}
                          <div className="flex flex-wrap gap-1">
                            {prob.skillsNeeded?.slice(0, 3).map((skill, si) => (
                              <span key={si} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-white/90">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SLIDE 3: FOUNDING TRUSTEES BOARDROOM ROSTER (CAMA 2020) */}
            {currentSlideIndex === 2 && (
              <div className="w-full max-w-5xl mx-auto space-y-4 text-left py-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-display font-black uppercase text-[#E5A93C] tracking-wider">
                      <Scale className="w-4 h-4 text-[#E5A93C]" />
                      <span>CAC Part F & CAMA 2020 Legal Roster</span>
                    </div>
                    <h2 className="font-display font-black text-2xl sm:text-4xl">
                      Founding Trustees Boardroom Matrix
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-xl bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold">
                      12 Seats Required
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {/* Tier 1: CORE */}
                  <div className={`p-4 rounded-3xl border ${isDark ? 'bg-[#09251B]/80 border-emerald-500/30' : 'bg-white border-[#09251B]/20'} shadow-lg space-y-3`}>
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div className="font-display font-black text-sm text-[#E5A93C]">CORE TRACK (Seats 1–4)</div>
                      <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded">Execution</span>
                    </div>
                    <div className="space-y-2">
                      {TRUSTEE_SEATS.slice(0, 4).map(seat => {
                        const cand = trusteeCandidates.find(c => c.seatNumber === seat.seatNumber);
                        return (
                          <div key={seat.seatNumber} className="p-2.5 rounded-xl bg-black/20 border border-white/10 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-bold flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-[#E5A93C] text-[#09251B] flex items-center justify-center text-[10px] font-black">
                                  {seat.seatNumber}
                                </span>
                                <span className="truncate max-w-[140px]">{cand ? cand.name : seat.title}</span>
                              </div>
                              <span className="text-[10px] text-white/60 block">{seat.title}</span>
                            </div>
                            <span className="font-mono text-[11px] font-bold text-[#E5A93C]">
                              {cand ? `★ ${((cand.scoreR + cand.scoreN + cand.scoreT) / 3).toFixed(1)}` : 'Open'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tier 2: CREDIBILITY */}
                  <div className={`p-4 rounded-3xl border ${isDark ? 'bg-[#09251B]/80 border-emerald-500/30' : 'bg-white border-[#09251B]/20'} shadow-lg space-y-3`}>
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div className="font-display font-black text-sm text-[#E5A93C]">CREDIBILITY (Seats 5–8)</div>
                      <span className="text-[10px] font-mono bg-blue-950 text-blue-300 px-2 py-0.5 rounded">Elders & Mentors</span>
                    </div>
                    <div className="space-y-2">
                      {TRUSTEE_SEATS.slice(4, 8).map(seat => {
                        const cand = trusteeCandidates.find(c => c.seatNumber === seat.seatNumber);
                        return (
                          <div key={seat.seatNumber} className="p-2.5 rounded-xl bg-black/20 border border-white/10 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-bold flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-blue-400 text-[#09251B] flex items-center justify-center text-[10px] font-black">
                                  {seat.seatNumber}
                                </span>
                                <span className="truncate max-w-[140px]">{cand ? cand.name : seat.title}</span>
                              </div>
                              <span className="text-[10px] text-white/60 block">{seat.title}</span>
                            </div>
                            <span className="font-mono text-[11px] font-bold text-[#E5A93C]">
                              {cand ? `★ ${((cand.scoreR + cand.scoreN + cand.scoreT) / 3).toFixed(1)}` : 'Open'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tier 3: BRIDGES */}
                  <div className={`p-4 rounded-3xl border ${isDark ? 'bg-[#09251B]/80 border-emerald-500/30' : 'bg-white border-[#09251B]/20'} shadow-lg space-y-3`}>
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div className="font-display font-black text-sm text-[#E5A93C]">BRIDGES (Seats 9–12)</div>
                      <span className="text-[10px] font-mono bg-amber-950 text-amber-300 px-2 py-0.5 rounded">Capital & Legal</span>
                    </div>
                    <div className="space-y-2">
                      {TRUSTEE_SEATS.slice(8, 12).map(seat => {
                        const cand = trusteeCandidates.find(c => c.seatNumber === seat.seatNumber);
                        return (
                          <div key={seat.seatNumber} className="p-2.5 rounded-xl bg-black/20 border border-white/10 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-bold flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-amber-400 text-[#09251B] flex items-center justify-center text-[10px] font-black">
                                  {seat.seatNumber}
                                </span>
                                <span className="truncate max-w-[140px]">{cand ? cand.name : seat.title}</span>
                              </div>
                              <span className="text-[10px] text-white/60 block">{seat.title}</span>
                            </div>
                            <span className="font-mono text-[11px] font-bold text-[#E5A93C]">
                              {cand ? `★ ${((cand.scoreR + cand.scoreN + cand.scoreT) / 3).toFixed(1)}` : 'Open'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SLIDE 4: SECTOR PRIORITIES & INNOVATION HEATMAP */}
            {currentSlideIndex === 3 && (
              <div className="w-full max-w-5xl mx-auto space-y-4 text-left py-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-display font-black uppercase text-[#E5A93C] tracking-wider">
                      <BarChart2 className="w-4 h-4 text-emerald-400" />
                      <span>Plateau Innovation Sectors</span>
                    </div>
                    <h2 className="font-display font-black text-2xl sm:text-4xl">
                      Sector Priorities & Collective Momentum
                    </h2>
                  </div>
                  <div className="text-xs font-mono font-bold bg-[#0D4734] text-white px-3 py-1.5 rounded-xl">
                    {totalVotesCount} Cumulative Votes Cast
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                  {sectorCounts.map(([sectorName, data], index) => {
                    const percentage = totalVotesCount > 0 ? Math.round((data.votes / totalVotesCount) * 100) : 0;
                    return (
                      <div 
                        key={sectorName}
                        className={`p-5 rounded-3xl border ${isDark ? 'bg-[#09251B]/80 border-white/10' : 'bg-white border-[#09251B]/15'} shadow-xl space-y-3`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="w-7 h-7 rounded-xl bg-[#E5A93C] text-[#09251B] flex items-center justify-center font-display font-black text-xs">
                            #{index + 1}
                          </span>
                          <span className="font-mono text-xs text-emerald-400 font-bold">
                            {data.count} Problems
                          </span>
                        </div>

                        <h3 className="font-display font-black text-base leading-snug">
                          {sectorName}
                        </h3>

                        <div className="space-y-1.5 pt-2">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-white/70">Upvote Share</span>
                            <span className="font-bold text-[#E5A93C]">{percentage}% ({data.votes} votes)</span>
                          </div>
                          <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-500 to-[#E5A93C] rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SLIDE 5: LIVE FOUNDER SPOTLIGHT */}
            {currentSlideIndex === 4 && (
              <div className="w-full max-w-5xl mx-auto space-y-4 text-left py-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-display font-black uppercase text-[#E5A93C] tracking-wider">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span>Meet The Builders</span>
                    </div>
                    <h2 className="font-display font-black text-2xl sm:text-4xl">
                      Founder Spotlight: Who's in Jos Room
                    </h2>
                  </div>
                  <div className="text-xs font-mono font-bold bg-[#0D4734] text-white px-3 py-1.5 rounded-xl">
                    {attendees.length} Founders Checked In
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                  {attendees.slice(0, 4).map((att) => (
                    <div 
                      key={att.id}
                      className={`p-5 rounded-3xl border ${isDark ? 'bg-[#09251B]/80 border-white/10' : 'bg-white border-[#09251B]/15'} shadow-xl flex flex-col justify-between space-y-3`}
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <div 
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-display font-black text-sm shadow-sm"
                            style={{ backgroundColor: att.avatarColor || '#0D4734' }}
                          >
                            {att.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-display font-black text-sm leading-tight">{att.name}</h3>
                            <span className="text-[11px] font-bold text-[#E5A93C] line-clamp-1">{att.title}</span>
                          </div>
                        </div>

                        <p className={`text-xs line-clamp-3 ${isDark ? 'text-white/80' : 'text-[#09251B]/80'}`}>
                          {att.bio || 'Building innovations in Plateau State.'}
                        </p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-white/10 text-[11px]">
                        {att.giveAsk && (
                          <div className="p-2 rounded-xl bg-black/20 font-mono text-[10px] text-white/80 line-clamp-2">
                            {att.giveAsk}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {att.tags?.slice(0, 2).map((t, ti) => (
                            <span key={ti} className="px-2 py-0.5 rounded-md bg-[#0D4734] text-[#FAF6EE] text-[10px] font-bold">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: CAMERA QR SCANNER */}
      {stageMode === 'scanner' && (
        <div className="w-full max-w-2xl mx-auto space-y-4 py-4 text-center">
          <div className={`p-6 sm:p-8 rounded-3xl border-2 shadow-2xl ${
            isDark ? 'bg-[#09251B] border-emerald-500/40 text-[#FAF6EE]' : 'bg-white border-[#09251B] text-[#09251B]'
          }`}>
            <div className="mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E5A93C] text-[#09251B] text-xs font-display font-black uppercase mb-2">
                <ScanLine className="w-3.5 h-3.5" />
                <span>Host Check-In Camera Viewfinder</span>
              </div>
              <h2 className="font-display font-black text-2xl sm:text-3xl">
                Scan Attendee Badge QR
              </h2>
              <p className={`text-xs sm:text-sm mt-1 max-w-md mx-auto ${isDark ? 'text-white/70' : 'text-[#09251B]/70'}`}>
                Point camera at attendee phone or physical badge to verify check-in and import details.
              </p>
            </div>

            {/* Viewfinder Container */}
            <div className="relative w-full max-w-md mx-auto aspect-square bg-black rounded-2xl overflow-hidden border-3 border-[#09251B] shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraActive && !scannedResult ? 'block' : 'hidden'}`}
              />

              {cameraActive && !scannedResult && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-6">
                  <div className="bg-[#09251B]/80 text-[#FAF6EE] text-[11px] font-mono px-3 py-1 rounded-full border border-white/20 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Searching for badges...</span>
                  </div>

                  <div className="relative w-48 h-48 sm:w-56 sm:h-56 border-2 border-dashed border-[#E5A93C] rounded-2xl flex items-center justify-center">
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-3 border-l-3 border-[#E5A93C] rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-3 border-r-3 border-[#E5A93C] rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-3 border-l-3 border-[#E5A93C] rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-3 border-r-3 border-[#E5A93C] rounded-br-lg" />
                    <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-[#E5A93C] to-transparent shadow-[0_0_8px_#E5A93C] animate-bounce duration-1000" />
                  </div>

                  <div className="text-[11px] text-white/80 font-medium bg-[#09251B]/70 px-3 py-0.5 rounded-lg">
                    Align QR code inside frame
                  </div>
                </div>
              )}

              {scannedResult && (
                <div className="absolute inset-0 bg-[#0D4734]/95 text-[#FAF6EE] p-6 flex flex-col items-center justify-center gap-3 z-10">
                  <div className="w-14 h-14 rounded-2xl bg-[#E5A93C] text-[#09251B] flex items-center justify-center shadow-lg">
                    <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
                  </div>
                  <h3 className="font-display font-black text-lg sm:text-xl text-[#FAF6EE]">
                    Badge Scanned!
                  </h3>
                  <p className="text-xs text-white/90 font-mono bg-black/40 p-2.5 rounded-xl max-w-xs break-all border border-white/10">
                    {scannedResult}
                  </p>
                  {scanSuccessMessage && (
                    <span className="text-xs font-bold text-[#E5A93C]">{scanSuccessMessage}</span>
                  )}
                </div>
              )}

              {(!cameraActive || cameraError) && !scannedResult && (
                <div className="p-6 text-center text-[#FAF6EE] space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center mx-auto">
                    <CameraOff className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-sm text-white">Camera Feed Inactive</h4>
                    <p className="text-xs text-white/70 mt-1 max-w-xs mx-auto">
                      {cameraError || 'Allow camera permissions in browser to scan attendee QR codes.'}
                    </p>
                  </div>
                  <button
                    onClick={() => startCamera(facingMode)}
                    className="bg-[#E5A93C] text-[#09251B] font-display font-black text-xs px-4 py-2 rounded-xl cursor-pointer transition active:scale-95 inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Enable Camera</span>
                  </button>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              {cameraActive && !scannedResult && (
                <>
                  <button
                    onClick={handleToggleFacingMode}
                    className="bg-white/10 hover:bg-white/20 text-white font-display font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer transition flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#E5A93C]" />
                    <span>Switch Camera ({facingMode === 'environment' ? 'Back' : 'Front'})</span>
                  </button>
                  <button
                    onClick={stopCamera}
                    className="bg-red-500/20 text-red-300 font-display font-bold text-xs px-3 py-2 rounded-xl cursor-pointer"
                  >
                    Turn Off
                  </button>
                </>
              )}

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFile}
                className="bg-white/10 hover:bg-white/20 text-white font-display font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer transition flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 text-[#E5A93C]" />
                <span>{isProcessingFile ? 'Analyzing...' : 'Scan Screenshot / File'}</span>
              </button>

              {availableDevices.length > 1 && (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => handleDeviceChange(e.target.value)}
                  className="bg-black/40 text-white text-xs font-bold border border-white/20 rounded-xl px-3 py-2 cursor-pointer"
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

            {/* Scanned Card Action */}
            {scannedResult && (
              <div className="mt-5 p-4 bg-black/40 border border-emerald-500/40 rounded-2xl text-left space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 font-display font-black text-sm">
                    <UserCheck className="w-4 h-4" />
                    <span>Check-In Ready</span>
                  </div>
                  <button
                    onClick={handleResetScanner}
                    className="text-xs font-bold text-white/70 hover:text-white underline cursor-pointer"
                  >
                    Scan Another QR
                  </button>
                </div>

                {parsedFounderData && (
                  <div className="bg-white/10 p-3 rounded-xl border border-white/15 text-xs space-y-1">
                    <div className="font-display font-black text-sm text-white">
                      {parsedFounderData.name || 'Founder Profile'}
                    </div>
                    {parsedFounderData.title && (
                      <div className="text-[#E5A93C] font-bold">{parsedFounderData.title}</div>
                    )}
                    {parsedFounderData.tags && parsedFounderData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {parsedFounderData.tags.map((t, i) => (
                          <span key={i} className="bg-[#0D4734] text-white px-2 py-0.5 rounded-md text-[10px] font-bold">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleQuickCheckInFromQR}
                  className="w-full bg-[#E5A93C] hover:bg-[#D4952B] text-[#09251B] font-display font-black text-sm py-2.5 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
                >
                  <Sparkles className="w-4 h-4 fill-current" />
                  <span>{parsedFounderData?.name ? `Confirm Check-In for ${parsedFounderData.name}` : 'Complete Meetup Check-In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STAGE FOOTER BRANDING */}
      <div className="pt-4 border-t border-[#E5A93C]/20 flex flex-wrap items-center justify-between text-xs font-display font-bold text-white/60 gap-2">
        <div className="flex items-center gap-2">
          <BrandLogo variant="icon-only" size="sm" />
          <span className="text-[#E5A93C]">TIN CITY FOUNDERS</span>
          <span>·</span>
          <span>STAGE BROADCAST CONSOLE</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span>{problems.length} Problem Statements</span>
          <span>·</span>
          <span>{attendees.length} Founders Checked In</span>
          <span>·</span>
          <span>Jos, Plateau State</span>
        </div>
      </div>
    </div>
  );
};
