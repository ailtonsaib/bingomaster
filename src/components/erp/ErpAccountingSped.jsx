import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, FileDown, FileText } from "lucide-react";

const fmt = (n) => String(n || "");
const onlyNum = (s) => String(s || "").replace(/\D/g, "");
const pad = (n, len) => String(n || "").padStart(len, "0");

export default function ErpAccountingSped({ user }) {
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [preview, setPreview] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [j, a, c] = await Promise.all([
        base44.entities.ErpJournalEntry.filter({ user_email: user.email, status: "definitivo" }, "date", 2000),
        base44.entities.ErpChartAccount.filter({ user_email: user.email }, "code", 500),
        base44.entities.ErpCompany.filter({ user_email: user.email }, "razao_social", 5),
      ]);
      setEntries(j); setAccounts(a); setCompany(c[0] || null);
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  const inYear = useMemo(() => entries.filter(e => new Date(e.date).getFullYear() === Number(year)).sort((a, b) => new Date(a.date) - new Date(b.date)), [entries, year]);

  const ddmmyyyy = (iso) => { const d = new Date(iso); return pad(d.getDate(), 2) + pad(d.getMonth() + 1, 2) + d.getFullYear(); };

  const generate = () => {
    setGenerating(true);
    try {
      const L = [];
      const cnpj = onlyNum(company?.cnpj);
      const nome = (company?.razao_social || "EMPRESA").toUpperCase().replace(/\|/g, " ");
      // 0000 — abertura
      L.push(["0000", "LECD", "2026-08-13", cnpj, nome, "4", "0", "1", "1", "A", "1", "1", "", "", "", "", "", "1", "", "", "", "1", "", ""].join("|"));
      // 0027
      L.push(["0027", "2026-08-13", "2026-08-13"].join("|"));
      // I010 — abertura bloco I
      L.push(["I010", "0"].join("|"));
      // I012 — plano de contas
      accounts.forEach(a => L.push(["I012", a.code, a.code, (a.name || "").toUpperCase().replace(/\|/g, " "), "0", ""].join("|")));
      // I200/I250 — lançamentos
      inYear.forEach(e => {
        const vl = (e.total_debit || 0).toFixed(2);
        L.push(["I200", e.number, ddmmyyyy(e.date), vl, "D", ""].join("|"));
        (e.lines || []).forEach(l => {
          const v = (Number(l.debit) || Number(l.credit) || 0).toFixed(2);
          const ind = l.debit > 0 ? "D" : "C";
          L.push(["I250", e.number, ddmmyyyy(e.date), v, ind, l.account_code || "", (e.cost_center_name || "").replace(/\|/g, " "), (l.complement || e.history || "").toUpperCase().replace(/\|/g, " "), ""].join("|"));
        });
      });
      // J900 — encerramento
      L.push(["J900", "TERMINO DO ARQUIVO DIGITAL"].join("|"));
      // J930
      L.push(["J930", "Contador", pad(inYear.length, 8)].join("|"));
      // 9999
      L.push(["9999", String(L.length + 1)].join("|"));
      setPreview(L.join("\n"));
    } catch (e) { alert(e.message); }
    setGenerating(false);
  };

  const download = () => {
    const blob = new Blob([preview], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ECD_${onlyNum(company?.cnpj) || "empresa"}_${year}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500">Ano-base:</span>
        <input type="number" value={year} onChange={e => setYear(e.target.value)} className="h-8 w-24 rounded-md border border-input px-2 text-sm" />
        <Button size="sm" onClick={generate} disabled={generating} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">{generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Gerar SPED ECD</Button>
        {preview && <Button size="sm" variant="outline" onClick={download} className="gap-1.5"><FileDown className="w-4 h-4" /> Baixar .txt</Button>}
        <span className="text-xs text-gray-400 ml-2">{inYear.length} lançamentos definitivos no período</span>
      </div>
      {!company && <p className="text-xs text-amber-600">Cadastre sua empresa (matriz) no módulo Gerencial para preencher o CNPJ/nome no arquivo.</p>}
      <p className="text-xs text-gray-500">Gera o arquivo da Escrituração Contábil Digital (ECD) com os blocos 0000, 0027, I010, I012 (plano de contas), I200/I250 (lançamentos) e J900/J930 (encerramento). É uma base para conferência — valide no PVA antes da transmissão.</p>
      {preview && (
        <div className="bg-gray-900 text-gray-100 rounded-xl p-4 max-h-[60vh] overflow-auto font-mono text-xs whitespace-pre">
          {preview.split("\n").slice(0, 200).join("\n")}{preview.split("\n").length > 200 ? "\n..." : ""}
        </div>
      )}
    </div>
  );
}