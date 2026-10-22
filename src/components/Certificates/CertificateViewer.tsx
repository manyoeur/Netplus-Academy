import React, { useState, useRef } from 'react';
import { 
  Award, 
  Download, 
  Printer, 
  CheckCircle2, 
  ShieldCheck, 
  Copy, 
  QrCode, 
  Search, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAcademy } from '../../context/AcademyContext';
import { Certificate } from '../../types';

interface CertificateViewerProps {
  certificate?: Certificate;
  onSelectCourseToEarn?: () => void;
}

export const CertificateViewer: React.FC<CertificateViewerProps> = ({
  certificate: propCert,
  onSelectCourseToEarn
}) => {
  const { currentUser, verifyCertificate } = useAcademy();
  const [selectedCert, setSelectedCert] = useState<Certificate | undefined>(
    propCert || currentUser.certificates[0]
  );
  const [verifyQuery, setVerifyQuery] = useState('');
  const [verifyResult, setVerifyResult] = useState<Certificate | null | 'not_found'>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const certRef = useRef<HTMLDivElement>(null);

  const triggerConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyVerification = (cert: Certificate) => {
    const url = `${window.location.origin}/?verify=${cert.certificateNumber}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleRunVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyQuery.trim()) return;
    const found = verifyCertificate(verifyQuery);
    setVerifyResult(found || 'not_found');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-700 to-indigo-900 text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white font-mono text-xs font-semibold">
              Verifiable Credentials
            </span>
            <span className="text-xs text-amber-100">• Industry Standard</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Automated Certificate Registry & Generator
          </h1>
          <p className="text-xs text-amber-100 mt-1 max-w-2xl">
            Upon 100% module and lab completion, certificates are programmatically generated, digitally signed, and minted with SHA-256 cryptographic hashes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={triggerConfetti}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-medium backdrop-blur-sm transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Celebrate</span>
          </button>
        </div>
      </div>

      {/* Select certificate pills if user has multiple */}
      {currentUser.certificates.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-mono text-xs pr-1">Your Credentials:</span>
          {currentUser.certificates.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCert(c)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                selectedCert?.id === c.id
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              {c.certificateNumber}
            </button>
          ))}
        </div>
      )}

      {/* Certificate Display Area */}
      {selectedCert ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Cryptographically Secured • Serial: <code className="font-mono">{selectedCert.certificateNumber}</code></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopyVerification(selectedCert)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied' : 'Share / Verify URL'}</span>
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / PDF Export</span>
              </button>
            </div>
          </div>

          {/* The High-Fidelity Certificate Canvas / Card */}
          <div
            id="certificate-print-area"
            ref={certRef}
            className="relative p-8 sm:p-14 rounded-3xl bg-gradient-to-br from-amber-50/70 via-white to-amber-50/50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 border-8 border-double border-amber-600/40 dark:border-amber-500/30 shadow-2xl overflow-hidden text-center text-slate-900 dark:text-slate-100"
          >
            {/* Guilloche Corner Accents */}
            <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-amber-500/60" />
            <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-amber-500/60" />
            <div className="absolute bottom-4 left-4 w-24 h-24 border-b-2 border-l-2 border-amber-500/60" />
            <div className="absolute bottom-4 right-4 w-24 h-24 border-b-2 border-r-2 border-amber-500/60" />

            {/* Academy Seal & Crest */}
            <div className="flex flex-col items-center justify-center space-y-2 mb-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 via-amber-600 to-yellow-400 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 ring-4 ring-amber-400/40">
                <Award className="w-9 h-9" />
              </div>
              <h2 className="text-xs uppercase font-mono tracking-widest text-amber-700 dark:text-amber-400 font-bold">
                Netplus Networking Academy of Technology
              </h2>
              <div className="h-0.5 w-32 bg-amber-500/30 mx-auto" />
            </div>

            {/* Certificate Title */}
            <div className="space-y-2 my-6">
              <span className="text-xs uppercase font-serif tracking-widest text-slate-500 dark:text-slate-400">
                This is to certify that
              </span>
              <h1 className="text-3xl sm:text-4xl font-serif font-black tracking-wide text-slate-900 dark:text-white underline decoration-amber-500/40 underline-offset-8">
                {selectedCert.studentName}
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl mx-auto pt-3">
                has successfully fulfilled all curriculum requirements, passed comprehensive laboratory simulations, and demonstrated professional mastery in:
              </p>
              <h3 className="text-xl sm:text-2xl font-bold font-sans text-blue-800 dark:text-cyan-400 pt-1">
                {selectedCert.courseTitle}
              </h3>
              <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                Final Grade: {selectedCert.grade}
              </p>
            </div>

            {/* Skills & Badges */}
            <div className="max-w-2xl mx-auto my-6 p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-left">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 font-bold">
                Demonstrated Engineering Competencies:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedCert.skillsAcquired.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60"
                  >
                    ✓ {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Signatures & Verification metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-200 dark:border-slate-800 items-end">
              
              <div className="text-left space-y-1">
                <p className="text-[10px] font-mono text-slate-400 uppercase">Certificate Serial</p>
                <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{selectedCert.certificateNumber}</p>
                <p className="text-[9px] font-mono text-slate-400 truncate max-w-[200px]" title={selectedCert.verificationHash}>
                  Hash: {selectedCert.verificationHash}
                </p>
              </div>

              {/* Gold Hologram Simulator */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-amber-500 bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <span className="text-[9px] font-mono uppercase tracking-wider text-amber-600 dark:text-amber-400 mt-1 font-bold">
                  Verified Official
                </span>
              </div>

              <div className="text-right space-y-1">
                <div className="font-serif italic text-base text-slate-800 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 pb-1">
                  {selectedCert.instructorName}
                </div>
                <p className="text-[10px] font-mono text-slate-400 uppercase">{selectedCert.instructorTitle}</p>
                <p className="text-[10px] text-slate-500 font-mono">Issued: {selectedCert.issueDate}</p>
              </div>

            </div>
          </div>
        </div>
      ) : (
        /* Empty state: No certificate yet */
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Award className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            No Certificates Earned Yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Complete all modules, labs, and the final quiz of any networking course to automatically receive your verifiable official certificate!
          </p>
          {onSelectCourseToEarn && (
            <button
              onClick={onSelectCourseToEarn}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all"
            >
              Start Course Learning
            </button>
          )}
        </div>
      )}

      {/* Public Verification Registry Search Bar */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-500" />
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Public Certificate Verification Registry
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verify credentials issued to students by searching serial numbers (e.g. <code>NP-CCNA-2026-9921</code>) or SHA-256 hashes.
            </p>
          </div>
        </div>

        <form onSubmit={handleRunVerify} className="flex gap-2">
          <input
            type="text"
            value={verifyQuery}
            onChange={(e) => setVerifyQuery(e.target.value)}
            placeholder="Enter certificate number (e.g. NP-CCNA-2026-9921) or hash..."
            className="flex-1 px-3.5 py-2.5 rounded-xl text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
          >
            Verify
          </button>
        </form>

        {verifyResult && verifyResult !== 'not_found' && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Authentic & Valid Credential</p>
              <p className="mt-1">
                Issued to: <strong>{verifyResult.studentName}</strong> ({verifyResult.studentEmail})
              </p>
              <p>Course: <strong>{verifyResult.courseTitle}</strong></p>
              <p>Issued on: {verifyResult.issueDate} • Grade: {verifyResult.grade}</p>
            </div>
          </div>
        )}

        {verifyResult === 'not_found' && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-200">
            <p className="font-bold">Credential Not Found in Registry</p>
            <p className="mt-1">Please double check the certificate serial number or cryptographic hash.</p>
          </div>
        )}
      </div>
    </div>
  );
};
