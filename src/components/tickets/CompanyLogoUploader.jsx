import { useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, ImageIcon, Upload } from "lucide-react";

export default function CompanyLogoUploader({ companyId, logoUrl, onUpdated, size = "md" }) {
  const fileRef = useRef(null);

  const handleUpload = async (file) => {
    if (!file) return;
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      await base44.functions.invoke('ticketSystem', {
        operation: 'updateCompany',
        company_id: companyId,
        logo_url: res.file_url,
      });
      if (onUpdated) onUpdated(res.file_url);
    } catch (e) {
      alert("Erro ao enviar logo");
    }
  };

  const sizeClasses = size === "lg" ? "w-16 h-16" : "w-10 h-10";

  return (
    <div className="relative group shrink-0">
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className={`${sizeClasses} rounded-lg object-contain border border-border bg-card`} />
      ) : (
        <div className={`${sizeClasses} rounded-lg border border-dashed border-input flex items-center justify-center bg-muted/30`}>
          <ImageIcon className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      <button
        onClick={() => fileRef.current?.click()}
        className="absolute inset-0 rounded-lg bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        title="Alterar logo"
      >
        <Upload className="w-4 h-4 text-white" />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleUpload(e.target.files?.[0])}
      />
    </div>
  );
}