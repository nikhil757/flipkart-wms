import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import toast from "react-hot-toast";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.endsWith(".csv")) {
      toast.error("Only CSV files are supported");
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/products/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      toast.success(`Uploaded: ${data.summary.inserted} products processed`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bulk CSV Upload</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload product inventory data. Supports millions of rows via streaming ingestion.
        </p>
      </div>

      {/* Format guide */}
      <div className="card p-5 bg-blue-50 border-blue-100">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Required CSV Format</h3>
        <div className="font-mono text-xs text-blue-700 bg-blue-100 rounded-lg p-3">
          WID,EAN,Manufacturing_Date,Expiry_Date<br />
          WH-001,8901030820013,2024-01-15,2026-01-15<br />
          WH-002,8901030820013,2024-02-20,2026-02-20
        </div>
        <p className="text-xs text-blue-600 mt-2">
          WID must be unique per row. One product type (EAN) can have multiple WIDs.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`card border-2 border-dashed p-10 text-center cursor-pointer transition-all
          ${dragOver ? "border-brand-400 bg-brand-50" : "border-gray-200 hover:border-brand-300 hover:bg-gray-50"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileText size={20} className="text-brand-500" />
            <div className="text-left">
              <div className="font-semibold text-gray-900 text-sm">{file.name}</div>
              <div className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }}
              className="ml-2 text-gray-400 hover:text-red-500"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <Upload size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600">Drop your CSV here or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Max 500 MB · CSV format only</p>
          </>
        )}
      </div>

      {file && (
        <button onClick={handleSubmit} disabled={loading} className="btn-primary">
          <Upload size={16} />
          {loading ? "Processing…" : "Upload & Ingest"}
        </button>
      )}

      {/* Results */}
      {result && (
        <div className="card p-6 fade-in">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle size={18} className="text-green-500" />
            <h3 className="font-semibold text-gray-900">Upload Complete</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total Rows Parsed", value: result.summary.totalRows, color: "text-gray-700" },
              { label: "Records Processed", value: result.summary.inserted, color: "text-green-600" },
              { label: "Skipped / Updated", value: result.summary.updated, color: "text-yellow-600" },
              { label: "Parse Errors", value: result.summary.errorCount, color: result.summary.errorCount > 0 ? "text-red-500" : "text-gray-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-50 rounded-xl px-4 py-3">
                <div className={`text-xl font-bold ${color}`}>{value?.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {result.sampleErrors?.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-red-600 mb-2">
                <AlertCircle size={14} />
                Sample Errors (first 10)
              </div>
              <div className="bg-red-50 rounded-lg p-3 space-y-1">
                {result.sampleErrors.map((e, i) => (
                  <div key={i} className="text-xs text-red-700 font-mono">
                    Row {e.row}: {e.issue} — {JSON.stringify(e.data)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
