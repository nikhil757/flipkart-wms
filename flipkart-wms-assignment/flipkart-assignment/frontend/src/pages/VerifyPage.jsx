import { useState, useRef, useCallback } from "react";
import { ScanLine, Camera, CheckCircle, XCircle, RotateCcw, Package } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth";

export default function VerifyPage() {
  const { user } = useAuth();
  const [wid, setWid] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [image, setImage] = useState(null);          // { file, preview }
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream] = useState(null);
  const videoRef = useRef();
  const canvasRef = useRef();
  const fileInputRef = useRef();

  // ── Camera helpers ──────────────────────────────────────────────────────────
  const openCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 1280, height: 720 },
      });
      setStream(s);
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = s;
      }, 100);
    } catch {
      toast.error("Camera not available. Use file upload instead.");
    }
  };

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
      const preview = URL.createObjectURL(blob);
      setImage({ file, preview });
      closeCamera();
      toast.success("Photo captured!");
    }, "image/jpeg", 0.85);
  }, []);

  const closeCamera = useCallback(() => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraOpen(false);
  }, [stream]);

  // ── Verification ─────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    const trimmedWid = wid.trim();
    if (!trimmedWid) { toast.error("Enter a WID to verify"); return; }

    setLoading(true);
    setResult(null);

    const form = new FormData();
    form.append("wid", trimmedWid);
    form.append("operator_id", user.username);
    if (image?.file) form.append("image", image.file);

    try {
      const res = await fetch("/api/validation/verify", { method: "POST", body: form });
      const data = await res.json();
      setResult({ ok: res.ok, data });
      if (!res.ok) toast.error("Product not found in database");
    } catch (err) {
      toast.error("Network error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setWid("");
    setResult(null);
    setImage(null);
  };

  const isExpired = (dateStr) => new Date(dateStr) < new Date();
  const daysUntilExpiry = (dateStr) => {
    const days = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="max-w-lg space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Product Verification</h1>
        <p className="text-gray-500 text-sm mt-1">
          Scan or type a WID to validate product details on the warehouse floor.
        </p>
      </div>

      {/* WID Input */}
      <div className="card p-6 space-y-4">
        <div>
          <label className="label">Warehouse ID (WID)</label>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="e.g. WH-001234"
              value={wid}
              onChange={(e) => setWid(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              autoFocus
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Scan barcode or type manually · Press Enter to verify</p>
        </div>

        {/* Image section */}
        <div>
          <label className="label">Product Photo (optional)</label>
          {image ? (
            <div className="relative rounded-xl overflow-hidden">
              <img src={image.preview} alt="Captured" className="w-full h-48 object-cover" />
              <button
                onClick={() => setImage(null)}
                className="absolute top-2 right-2 bg-white/80 backdrop-blur rounded-full p-1.5 shadow hover:bg-white"
              >
                <RotateCcw size={14} className="text-gray-600" />
              </button>
            </div>
          ) : cameraOpen ? (
            <div className="relative rounded-xl overflow-hidden bg-black">
              <video ref={videoRef} autoPlay playsInline className="w-full h-52 object-cover" />
              {/* Scanner overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-brand-400 rounded-lg w-48 h-32 relative">
                  <div className="absolute left-0 right-0 h-0.5 bg-brand-400 opacity-70 scan-line" />
                </div>
              </div>
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
                <button onClick={capturePhoto} className="bg-white text-gray-900 font-semibold text-sm px-5 py-2 rounded-full shadow-lg hover:bg-gray-100">
                  📸 Capture
                </button>
                <button onClick={closeCamera} className="bg-black/50 text-white text-sm px-4 py-2 rounded-full">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={openCamera} className="btn-secondary text-sm flex-1 justify-center">
                <Camera size={14} />
                Use Camera
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="btn-secondary text-sm flex-1 justify-center">
                📁 Upload Photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (f) setImage({ file: f, preview: URL.createObjectURL(f) });
                }}
              />
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <button onClick={handleVerify} disabled={loading || !wid.trim()} className="btn-primary w-full justify-center">
          <ScanLine size={16} />
          {loading ? "Verifying…" : "Verify Product"}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className={`card p-6 fade-in border-2 ${result.ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          {result.ok ? (
            <>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle size={20} className="text-green-600" />
                <h3 className="font-bold text-green-800">Product Found ✓</h3>
                <span className="ml-auto text-xs text-green-600 font-medium">Log ID #{result.data.log_id}</span>
              </div>

              <div className="bg-white rounded-xl p-4 space-y-3">
                {[
                  { label: "WID", value: result.data.product.wid, mono: true },
                  { label: "EAN / Barcode", value: result.data.product.ean, mono: true },
                  {
                    label: "Manufacturing Date",
                    value: result.data.product.manufacturing_date,
                    mono: false,
                  },
                  {
                    label: "Expiry Date",
                    value: result.data.product.expiry_date,
                    mono: false,
                    badge: isExpired(result.data.product.expiry_date)
                      ? { text: "EXPIRED", cls: "bg-red-100 text-red-700" }
                      : daysUntilExpiry(result.data.product.expiry_date) <= 30
                      ? { text: `${daysUntilExpiry(result.data.product.expiry_date)}d left`, cls: "bg-yellow-100 text-yellow-700" }
                      : { text: `${daysUntilExpiry(result.data.product.expiry_date)}d left`, cls: "bg-green-100 text-green-700" },
                  },
                ].map(({ label, value, mono, badge }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide w-40">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold text-gray-900 ${mono ? "font-mono" : ""}`}>{value}</span>
                      {badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                          {badge.text}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {result.data.image_captured && (
                <p className="text-xs text-green-600 mt-3 flex items-center gap-1">
                  📷 Photo captured and logged
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3">
              <XCircle size={20} className="text-red-500 shrink-0" />
              <div>
                <p className="font-bold text-red-800">Product Not Found</p>
                <p className="text-sm text-red-600">WID "{result.data.wid}" does not exist in the database. This event has been logged.</p>
              </div>
            </div>
          )}

          <button onClick={reset} className="mt-4 btn-secondary text-sm w-full justify-center">
            <RotateCcw size={14} />
            Verify Another
          </button>
        </div>
      )}
    </div>
  );
}
