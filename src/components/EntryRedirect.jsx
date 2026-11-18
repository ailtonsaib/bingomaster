import { Navigate } from "react-router-dom";
import { entryRoute } from "@/lib/appEntry";

/** Endereço principal sem menu: vai direto para o aplicativo do usuário */
export default function EntryRedirect() {
  return <Navigate to={entryRoute()} replace />;
}