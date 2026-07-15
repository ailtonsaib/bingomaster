import { useEffect } from "react";

export default function DanfePrint({ order, company, onClose }) {
  useEffect(() => {
    window.print();
  }, []);

  const fmtMoney = (v) => "R$ " + (Number(v) || 0).toFixed(2);
  const fmtDate = (dt) => {
    if (!dt) return "—";
    try { return new Date(dt).toLocaleDateString("pt-BR"); } catch { return dt; }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto print-area" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b no-print">
          <h2 className="font-bold">Pré-visualização DANFE</h2>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Fechar</button>
        </div>

        <div className="p-6 print-page">
          {/* Header with logo */}
          <div className="flex items-start justify-between border-2 border-black p-4">
            <div className="flex items-center gap-3">
              {company?.logo_url && (
                <img src={company.logo_url} alt="Logo" className="max-h-20 max-w-[140px] object-contain" />
              )}
              <div>
                <p className="font-bold text-sm">{company?.razao_social || "—"}</p>
                <p className="text-xs">CNPJ: {company?.cnpj || "—"}</p>
                <p className="text-xs">IE: {company?.ie || "—"}{company?.im ? ` · IM: ${company.im}` : ""}</p>
                <p className="text-xs">{company?.address || ""}, {company?.number || ""} - {company?.district || ""}</p>
                <p className="text-xs">{company?.city || ""} - {company?.uf || ""} · CEP: {company?.cep || ""}</p>
                <p className="text-xs">Fone: {company?.phone || "—"}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold border border-black px-4 py-1">DANFE</p>
              <p className="text-xs mt-1">Documento Auxiliar da NF-e</p>
              <p className="text-xs">Nº {order.nfe_number || "—"}</p>
              <p className="text-xs">Série {order.nfe_series || "—"}</p>
            </div>
          </div>

          {/* Chave de acesso */}
          {order.nfe_key && (
            <div className="border-2 border-black border-t-0 p-3">
              <p className="text-xs font-medium">Chave de Acesso</p>
              <p className="text-sm font-mono break-all">{order.nfe_key}</p>
            </div>
          )}

          {/* Recipient */}
          <div className="border-2 border-black border-t-0 p-4">
            <p className="text-xs font-bold mb-1">DESTINATÁRIO</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="col-span-2"><b>Nome/Razão:</b> {order.customer_name || "—"}</div>
              <div><b>CNPJ/CPF:</b> {order.customer_cpf_cnpj || "—"}</div>
              <div><b>Endereço:</b> {order.customer_address || "—"}</div>
              <div><b>Nº:</b> {order.customer_number || "—"}</div>
              <div><b>Bairro:</b> {order.customer_district || "—"}</div>
              <div><b>CEP:</b> {order.customer_cep || "—"}</div>
              <div><b>Município:</b> {order.customer_city || "—"}</div>
              <div><b>UF:</b> {order.customer_uf || "—"}</div>
              <div><b>IE:</b> {order.customer_ie || "—"}</div>
            </div>
          </div>

          {/* Items */}
          <table className="w-full border-2 border-black border-t-0 text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left border border-black">Item</th>
                <th className="p-2 text-left border border-black">Descrição</th>
                <th className="p-2 text-center border border-black">NCM</th>
                <th className="p-2 text-center border border-black">CFOP</th>
                <th className="p-2 text-center border border-black">Un.</th>
                <th className="p-2 text-right border border-black">Qtd</th>
                <th className="p-2 text-right border border-black">V. Unit</th>
                <th className="p-2 text-right border border-black">V. Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item, i) => (
                <tr key={i}>
                  <td className="p-2 border border-black">{i + 1}</td>
                  <td className="p-2 border border-black">{item.product_name}</td>
                  <td className="p-2 text-center border border-black">{item.ncm || "—"}</td>
                  <td className="p-2 text-center border border-black">{item.cfop || "—"}</td>
                  <td className="p-2 text-center border border-black">{item.unit || "UN"}</td>
                  <td className="p-2 text-right border border-black">{item.quantity}</td>
                  <td className="p-2 text-right border border-black">{(item.unit_price || 0).toFixed(2)}</td>
                  <td className="p-2 text-right border border-black">{(item.total || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border-2 border-black border-t-0 p-4 grid grid-cols-2 gap-4 text-xs">
            <div>
              <p><b>Natureza da Operação:</b> {order.nature_operation || "—"}</p>
              <p><b>Forma de Pagamento:</b> {order.payment_method === "0" ? "À Vista" : "A Prazo"}</p>
              <p><b>Data de Emissão:</b> {order.nfe_issue_date ? fmtDate(order.nfe_issue_date) : fmtDate(order.order_date)}</p>
            </div>
            <div className="text-right space-y-1">
              <p><b>Valor dos Produtos:</b> {fmtMoney(order.total_products)}</p>
              <p><b>Valor do ICMS:</b> {fmtMoney(order.total_icms)}</p>
              <p><b>Valor do IPI:</b> {fmtMoney(order.total_ipi)}</p>
              <p><b>Valor do PIS:</b> {fmtMoney(order.total_pis)}</p>
              <p><b>Valor do COFINS:</b> {fmtMoney(order.total_cofins)}</p>
              <p className="text-sm font-bold border-t border-black pt-1"><b>Valor Total da NF-e:</b> {fmtMoney(order.total_nota)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}