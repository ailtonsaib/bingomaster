import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Upload, Loader2, Trash2, CheckCircle2, XCircle, Calendar, Building2, FileKey2, AlertTriangle } from "lucide-react";

const MODELOS = ["NFe", "NFSe", "NFCe"];

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function formatCnpj(v) {
  const d = String(v || "").replace(/\D/g, "").padStart(14, "0");
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export default function CertificateManager({ userEmail }) {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ alias: "", password: "", modelos: ["NFe"], file: null, fileName: "" });
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("manageCertificate", { operation: "list", email: userEmail });
      setCerts(res?.data?.certificates || []);
    } catch (e) {
      setError(e.response?.data?.error || e.data?.error || "Erro ao carregar certificados");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [userEmail]);

  const toggleModelo = (m) => {
    setForm((f) => ({
      ...f,
      modelos: f.modelos.includes(m) ? f.modelos.filter((x) => x !== m) : [...f.modelos, m],
    }));
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setForm((s) => ({ ...s, file: f, fileName: f.name }));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.file || !form.password || !form.alias) {
      setError("Preencha nome, senha e selecione o arquivo .pfx/.p12");
      return;
    }
    if (form.modelos.length === 0) {
      setError("Selecione ao menos um modelo (NF-e, NFS-e ou NFC-e)");
      return;
    }
    setUploading(true);
    try {
      // 1. Envia o PFX para o storage privado
      const upRes = await base44.integrations.Core.UploadPrivateFile({ file: form.file });
      if (!upRes?.file_uri) throw new Error("Falha no upload do arquivo.");
      // 2. Registra e parseia o certificado no backend
      const res = await base44.functions.invoke("manageCertificate", {
        operation: "upload",
        email: userEmail,
        file_uri: upRes.file_uri,
        file_name: form.fileName,
        password: form.password,
        alias: form.alias,
        modelos: form.modelos,
      });
      if (!res?.data?.success) throw new Error(res?.data?.error || "Erro ao importar certificado");
      setSuccess(`Certificado "${form.alias}" importado com sucesso!`);
      setForm({ alias: "", password: "", modelos: ["NFe"], file: null, fileName: "" });
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.data?.error || err.message || "Erro no upload");
    }
    setUploading(false);
  };

  const handleActivate = async (id) => {
    try {
      await base44.functions.invoke("manageCertificate", { operation: "activate", email: userEmail, certificate_id: id });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.data?.error || "Erro ao ativar");
    }
  };

  const handleDeactivate = async (id) => {
    try {
      await base44.functions.invoke("manageCertificate", { operation: "deactivate", email: userEmail, certificate_id: id });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.data?.error || "Erro ao desativar");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Excluir este certificado? Esta ação não pode ser desfeita.")) return;
    try {
      await base44.functions.invoke("manageCertificate", { operation: "delete", email: userEmail, certificate_id: id });
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.data?.error || "Erro ao excluir");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-blue-600" /> Certificados Digitais A1
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Importe o certificado A1 (.pfx/.p12) para emissão de NF-e, NFC-e e NFS-e. O arquivo é armazenado em storage privado e protegido por senha.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-start gap-2 text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> <span>{success}</span>
        </div>
      )}

      {/* Formulário de importação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileKey2 className="w-4 h-4" /> Importar novo certificado</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome (alias)</Label>
              <Input value={form.alias} onChange={(e) => setForm((f) => ({ ...f, alias: e.target.value }))} placeholder="Ex: Certificado Principal 2026" />
            </div>
            <div>
              <Label>Senha do certificado</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Senha do .pfx" />
            </div>
            <div className="md:col-span-2">
              <Label>Arquivo do certificado (.pfx / .p12)</Label>
              <Input type="file" accept=".pfx,.p12,application/x-pkcs12" onChange={handleFile} ref={fileRef} />
              {form.fileName && <span className="text-xs text-gray-500 mt-1 block">Selecionado: {form.fileName}</span>}
            </div>
            <div className="md:col-span-2">
              <Label>Modelos autorizados</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {MODELOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleModelo(m)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      form.modelos.includes(m)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={uploading} className="gap-2">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Importando..." : "Importar certificado"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Lista de certificados */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Certificados cadastrados</h3>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : certs.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
            Nenhum certificado importado ainda.
          </div>
        ) : (
          <div className="grid gap-3">
            {certs.map((c) => {
              const expired = c.status === "expired";
              return (
                <Card key={c.id} className={c.is_active ? "border-emerald-300 bg-emerald-50/40" : ""}>
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800">{c.alias}</span>
                          {c.is_active && (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3 h-3" /> Ativo
                            </span>
                          )}
                          {expired ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                              <XCircle className="w-3 h-3" /> Vencido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                              <CheckCircle2 className="w-3 h-3" /> Válido
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          {c.cnpj && (
                            <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {formatCnpj(c.cnpj)}</span>
                          )}
                          <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(c.valid_from)} — {formatDate(c.valid_to)}</span>
                        </div>
                        <div className="mt-1.5 flex gap-1 flex-wrap">
                          {(c.modelos || []).map((m) => (
                            <span key={m} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">{m}</span>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-1 truncate">{c.subject_dn}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {c.is_active ? (
                          <Button size="sm" variant="outline" onClick={() => handleDeactivate(c.id)} className="gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Desativar
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled={expired} onClick={() => handleActivate(c.id)} className="gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Ativar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)} className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" /> Excluir
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}