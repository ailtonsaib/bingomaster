import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, ArrowRight, ArrowLeft, UserCheck, Trash2, Clock, Paperclip, Loader2, Send, Download, Lock, Building2, FileUp } from "lucide-react";
import { base44 } from "@/api/base44Client";

const STATUS_LABELS = {
  aberto: "Aberto", em_analise: "Em Análise", iniciado: "Iniciado", em_teste: "Em Teste", concluido: "Concluído",
};
const STATUS_FLOW = ["aberto", "em_analise", "iniciado", "em_teste", "concluido"];

export default function TicketDetailModal({ ticket, users, currentUser, onMove, onTransfer, onDelete, onClose }) {
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  const isRequester = currentUser?.role === "requester";
  const isAgent = currentUser?.role === "agent";
  const canManage = !isRequester && !isAgent;
  const currentIdx = STATUS_FLOW.indexOf(ticket.status);
  const canForward = currentIdx < STATUS_FLOW.length - 1;
  const canBackward = currentIdx > 0;
  const isConcluido = ticket.status === "concluido";

  const fmtDate = (d) => d ? new Date(d).toLocaleString("pt-BR") : "—";
  const stageTimestamps = [
    { label: "Aberto", date: ticket.aberto_at },
    { label: "Em Análise", date: ticket.em_analise_at },
    { label: "Iniciado", date: ticket.iniciado_at },
    { label: "Em Teste", date: ticket.em_teste_at },
    { label: "Concluído", date: ticket.concluido_at },
  ];

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const res = await base44.functions.invoke('ticketSystem', { operation: 'getComments', ticket_id: ticket.id });
      const sorted = (res.data.comments || []).sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      setComments(sorted);
    } catch (e) { console.error("Erro ao carregar comentários:", e); }
    setLoadingComments(false);
  }, [ticket.id]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const res = await base44.integrations.Core.UploadFile({ file });
        uploaded.push({ file_url: res.file_url, file_name: file.name });
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (e) { alert("Erro ao enviar arquivo"); }
    setUploading(false);
  };

  const removeAttachment = (idx) => setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const handlePostComment = async () => {
    if (!newComment.trim() && attachments.length === 0) return;
    setPosting(true);
    try {
      await base44.functions.invoke('ticketSystem', {
        operation: 'addComment',
        ticket_id: ticket.id,
        ticket_title: ticket.title,
        company_id: ticket.company_id,
        author_id: currentUser.id,
        author_name: currentUser.name,
        author_role: currentUser.role,
        content: newComment,
        attachments,
      });
      setNewComment("");
      setAttachments([]);
      await loadComments();
    } catch (e) { alert("Erro ao enviar comentário"); }
    setPosting(false);
  };

  const handleForward = () => onMove(ticket.id, STATUS_FLOW[currentIdx + 1], "forward");
  const handleBackward = () => onMove(ticket.id, STATUS_FLOW[currentIdx - 1], "backward");
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-bold font-mono text-primary">#{ticket.id?.slice(-6)}</span>
                <Badge variant="secondary">{STATUS_LABELS[ticket.status]}</Badge>
              </div>
              <h2 className="text-lg font-bold leading-tight">{ticket.title}</h2>
              <div className="flex items-center gap-1.5 mt-2 text-sm">
                <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{ticket.company_name || "—"}</span>
                <span className="text-xs text-muted-foreground">· Criado por {ticket.created_by_name}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0"><X className="w-4 h-4" /></Button>
          </div>

          {ticket.description && (
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {ticket.type_name && <Badge variant="outline">{ticket.type_name}</Badge>}
            {ticket.module_name && <Badge variant="outline" className="border-primary/30">{ticket.module_name}</Badge>}
            {ticket.submodule_name && <Badge variant="secondary">{ticket.submodule_name}</Badge>}
            {ticket.priority_name && <Badge variant="outline" className="border-primary/30">{ticket.priority_name}</Badge>}
          </div>

          {/* Responsável inline */}
          {canManage && onTransfer ? (
            <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-2.5">
              <UserCheck className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground shrink-0 font-medium">Responsável:</span>
              <select
                className="flex-1 h-8 rounded-md border border-input bg-card px-2 text-sm font-medium"
                value=""
                onChange={(e) => { if (e.target.value) { const u = users.find((u) => u.id === e.target.value); if (u) onTransfer(ticket.id, u.id, u.name); } }}
              >
                <option value="">{ticket.assigned_to_name || "Atribuir responsável..."}</option>
                {users.filter((u) => u.id !== ticket.assigned_to_id).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <UserCheck className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Responsável:</span>
              <span className="font-medium">{ticket.assigned_to_name || "Não atribuído"}</span>
            </div>
          )}

          {/* Stage timestamps */}
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Clock className="w-4 h-4" /> Linha do Tempo</h3>
            <div className="space-y-1">
              {stageTimestamps.map((s, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs ${s.date ? "" : "opacity-40"}`}>
                  <div className={`w-2 h-2 rounded-full ${s.date ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  <span className="w-24 font-medium">{s.label}</span>
                  <span className="text-muted-foreground">{s.date ? fmtDate(s.date) : "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Comments / Interactions */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-2">Comentários & Anexos ({comments.length})</h3>
            {loadingComments ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum comentário ainda</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {comments.map((c) => (
                  <div key={c.id} className="bg-muted/20 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{c.author_name}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(c.created_date)}</span>
                    </div>
                    {c.content && <p className="text-sm whitespace-pre-wrap mb-2">{c.content}</p>}
                    {c.attachments && c.attachments.length > 0 && (
                      <div className="space-y-1">
                        {c.attachments.map((a, i) => (
                          <a key={i} href={a.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
                            <Paperclip className="w-3 h-3" />
                            <span className="truncate">{a.file_name}</span>
                            <Download className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add comment (disabled if concluido) */}
          {!isConcluido && (
            <div className="border-t pt-4 space-y-2">
              <textarea
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[60px]"
                placeholder="Adicione um comentário..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <label className="flex items-center justify-center gap-2 cursor-pointer text-sm px-4 py-3 rounded-lg border-2 border-dashed border-input hover:border-primary/40 hover:bg-primary/5 transition-colors w-full">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <FileUp className="w-5 h-5 text-muted-foreground" />}
                <span className="font-medium">{uploading ? "Enviando..." : "Anexar documentos"}</span>
                <span className="text-xs text-muted-foreground">— clique para selecionar</span>
                <input type="file" multiple className="hidden" onChange={(e) => handleFiles(Array.from(e.target.files))} />
              </label>
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded px-3 py-1.5 text-xs">
                      <Paperclip className="w-3 h-3 text-primary shrink-0" />
                      <span className="truncate flex-1">{a.file_name}</span>
                      <button onClick={() => removeAttachment(i)} className="text-destructive hover:text-destructive/80 shrink-0"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button size="sm" className="gap-1" onClick={handlePostComment} disabled={posting || uploading || (!newComment.trim() && attachments.length === 0)}>
                  {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar Comentário
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          {canManage && (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {onMove && (
                <>
                  <Button size="sm" variant="default" onClick={handleForward} disabled={!canForward} className="gap-1">
                    <ArrowRight className="w-4 h-4" /> Avançar
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleBackward} disabled={!canBackward} className="gap-1">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                  </Button>
                </>
              )}
              {onDelete && (
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir chamado?")) onDelete(ticket.id); }} className="gap-1 text-destructive ml-auto">
                  <Trash2 className="w-4 h-4" /> Excluir
                </Button>
              )}
            </div>
          )}

          {isRequester && (
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                Como cliente, você pode acompanhar o status e adicionar comentários, mas não pode movimentar, transferir ou excluir chamados.
              </p>
            </div>
          )}

          {isAgent && (
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                Como atendente, você pode visualizar todos os chamados e adicionar comentários, mas não pode alterar status, transferir responsável ou excluir chamados.
              </p>
            </div>
          )}

          {/* History */}
          {ticket.history && ticket.history.length > 0 && (
            <div>
              <button onClick={() => setHistoryExpanded(!historyExpanded)} className="text-sm font-semibold mb-2">
                Histórico de Movimentações ({ticket.history.length})
              </button>
              {historyExpanded && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {ticket.history.map((h, i) => (
                    <div key={i} className="text-xs border-l-2 pl-2 py-1" style={{ borderColor: h.direction === 'forward' ? '#10b981' : h.direction === 'backward' ? '#f59e0b' : '#3b82f6' }}>
                      <span className="font-medium">{h.moved_by_name}</span> ·{" "}
                      {h.direction === 'transfer' ? (h.note || 'Transferiu') : (
                        `${STATUS_LABELS[h.from_status] || 'Início'} → ${STATUS_LABELS[h.to_status]}`
                      )}
                      <span className="text-muted-foreground"> · {fmtDate(h.moved_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}