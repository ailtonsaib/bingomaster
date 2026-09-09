import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Search } from "lucide-react";
import RequisitionsTable, { RequisitionDetailModal } from "./ErpWarehouseRequisitionTable";

export default function ErpWarehouseRequisitionPanel({ user }) {
  const [reqs, setReqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [reqDetail, setReqDetail] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setReqs(await base44.entities.ErpWarehouseRequisition.filter({ user_email: user.email }, "-created_date", 500));
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [user.email]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar requisição/insumo..." className="w-full h-9 rounded-md border border-input bg-transparent pl-9 pr-3 text-sm" />
      </div>
      <RequisitionsTable reqs={reqs} loading={loading} search={search} onOpen={setReqDetail} />
      {reqDetail && <RequisitionDetailModal req={reqDetail} onClose={() => setReqDetail(null)} onSaved={load} />}
    </div>
  );
}