import { useState } from "react";
import { KeyRound } from "lucide-react";
import ErpSimpleCrud from "./ErpSimpleCrud";
import ErpCompanyCertModal from "./ErpCompanyCertModal";
import { ERP_CRUD_CONFIGS } from "@/lib/erpCrudConfigs";

// Cadastro de Empresas com ação por linha para anexar o certificado digital A1
export default function ErpCompanyManager({ user }) {
  const [certCompany, setCertCompany] = useState(null);
  return (
    <>
      <ErpSimpleCrud
        key="empresas"
        user={user}
        {...ERP_CRUD_CONFIGS.empresas}
        rowAction={{ icon: KeyRound, title: "Anexar Certificado A1", onClick: (company) => setCertCompany(company) }}
      />
      {certCompany && <ErpCompanyCertModal user={user} company={certCompany} onClose={() => setCertCompany(null)} />}
    </>
  );
}