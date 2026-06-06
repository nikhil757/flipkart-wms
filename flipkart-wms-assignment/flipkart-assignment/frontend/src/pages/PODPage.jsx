import { useState, useRef, useCallback } from "react";
import { Truck, Camera, CheckCircle, RotateCcw, QrCode } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth";

export default function PODPage() {
  const { user } = useAuth();
  const [awb, setAwb] = useState("");
  const [media, setMedia] = useState(null);      // { file, preview, type }
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isVideo, setIsVideo] = useState(false);
  const [stream, setStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");

  const videoRef = useRef();
  const canvasRef = useRef();
  const fileInputRef = useRef();
  const chunksRef = useRef([]);

  // ── Camera ─────────────────────────────────────────────────────────────────
  const openCamera = async (forVideo = false) => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 1280, height: 720 },
        audio: forVideo,
      });
      setStream(s);
      setIsVideo(forVideo);
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = s;
      }, 100);
    } catch {
      toast.error("Camera not available. Try file upload.");
    }
  };

  const capturePhoto = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], `pod_${Date.now()}.jpg`, { type: "image/jpeg" });
      setMedia({ file, preview: URL.createObjectURL(blob), type: "photo" });
      closeCamera();
      toast.success("📸 Photo captured!");
    }, "image/jpeg", 0.85);
  }, []);

  const startRecording = useCallback(() => {
    if (!stream) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const file = new File([blob], `pod_${Date.now()}.webm`, { type: "video/webm" });
      setMedia({ file, preview: URL.createObjectURL(blob), type: "video" });
      closeCamera();
      toast.success("🎥 Video recorded!");
    };
    mr.start();
    setMediaRecorder(mr);
    setRecording(true);
  }, [stream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorder) mediaRecorder.stop();
    setRecording(false);
  }, [mediaRecorder]);

  const closeCamera = useCallback(() => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraOpen(false);
    setRecording(false);
  }, [stream]);

  // ── Submit POD ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!awb.trim()) { toast.error("AWB number is required"); return; }
    if (!media) { toast.error("Please capture a photo or video as proof"); return; }

    setLoading(true);
    const form = new FormData();
    form.append("awb_number", awb.trim());
    form.append("driver_id", user.username);
    form.append("media", media.file);
    form.append("notes", notes);

    try {
      const res = await fetch("/api/pod/deliver", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      toast.success("✅ POD submitted successfully!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setAwb("");
    setMedia(null);
    setResult(null);
    setNotes("");
  };

  return (
    <div className="max-w-lg space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Proof of Delivery</h1>
        <p className="text-gray-500 text-sm mt-1">
          Scan AWB number and capture delivery evidence.
        </p>
      </div>

      {result ? (
        // ── Success State ────────────────────────────────────────────────────
        <div className="card p-8 text-center fade-in border-2 border-green-200 bg-green-50">
          <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={28} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-green-800 mb-1">Delivery Confirmed!</h2>
          <p className="text-sm text-green-700 mb-4">POD successfully logged to cloud storage.</p>

          <div className="bg-white rounded-xl p-4 text-left space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">AWB Number</span>
              <span className="font-mono font-semibold">{result.awb_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Delivery ID</span>
              <span className="font-mono font-semibold">#{result.delivery_id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Media Type</span>
              <span className="font-semibold capitalize">{result.media_type}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Timestamp</span>
              <span className="font-semibold">{new Date(result.delivered_at).toLocaleString()}</span>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400 font-mono truncate">{result.cloud_url}</p>
            </div>
          </div>

          <button onClick={reset} className="btn-primary w-full justify-center">
            <RotateCcw size={14} />
            Log Another Delivery
          </button>
        </div>
      ) : (
        // ── Input Form ───────────────────────────────────────────────────────
        <div className="space-y-4">
          {/* AWB Input */}
          <div className="card p-5 space-y-4">
            <div>
              <label className="label flex items-center gap-1.5">
                <QrCode size={12} />
                AWB Number
              </label>
              <input
                className="input text-lg font-mono"
                placeholder="Scan barcode or type AWB…"
                value={awb}
                onChange={(e) => setAwb(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">Use a barcode scanner or type the Air Waybill number</p>
            </div>

            <div>
              <label className="label">Delivery Notes (optional)</label>
              <textarea
                className="input resize-none h-16 text-sm"
                placeholder="e.g. Left at door, received by security…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Media Capture */}
          <div className="card p-5">
            <label className="label mb-3">Delivery Evidence *</label>

            {media ? (
              <div className="space-y-3">
                {media.type === "photo" ? (
                  <img src={media.preview} alt="POD" className="w-full h-52 object-cover rounded-xl" />
                ) : (
                  <video src={media.preview} controls className="w-full h-52 rounded-xl bg-black" />
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 capitalize">
                    {media.type === "photo" ? "📸" : "🎥"} {media.type} captured · {(media.file.size / 1024).toFixed(0)} KB
                  </span>
                  <button onClick={() => setMedia(null)} className="text-xs text-gray-500 hover:text-red-500 font-medium">
                    Retake
                  </button>
                </div>
              </div>
            ) : cameraOpen ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-black">
                  <video ref={videoRef} autoPlay playsInline muted={!isVideo} className="w-full h-52 object-cover" />
                  {recording && (
                    <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      REC
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {!isVideo ? (
                    <button onClick={capturePhoto} className="btn-primary flex-1 justify-center">
                      📸 Capture Photo
                    </button>
                  ) : recording ? (
                    <button onClick={stopRecording} className="bg-red-500 text-white font-semibold px-5 py-2.5 rounded-xl flex-1 flex items-center justify-center gap-2">
                      ⏹ Stop Recording
                    </button>
                  ) : (
                    <button onClick={startRecording} className="bg-red-500 text-white font-semibold px-5 py-2.5 rounded-xl flex-1 flex items-center justify-center gap-2">
                      ⏺ Start Recording
                    </button>
                  )}
                  <button onClick={closeCamera} className="btn-secondary">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => openCamera(false)} className="btn-secondary justify-center py-3 text-sm">
                  <Camera size={15} />
                  Photo
                </button>
                <button onClick={() => openCamera(true)} className="btn-secondary justify-center py-3 text-sm">
                  🎥 Video
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary justify-center py-3 text-sm col-span-2"
                >
                  📁 Upload from device
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files[0];
                if (f) {
                  setMedia({
                    file: f,
                    preview: URL.createObjectURL(f),
                    type: f.type.startsWith("video/") ? "video" : "photo",
                  });
                }
              }}
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !awb.trim() || !media}
            className="btn-primary w-full justify-center py-3"
          >
            <Truck size={16} />
            {loading ? "Uploading…" : "Submit Proof of Delivery"}
          </button>
        </div>
      )}
    </div>
  );
}
