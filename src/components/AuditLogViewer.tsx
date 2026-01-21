import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Eye, RefreshCw, Download } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AuditLog {
  id: string;
  performed_at: string;
  performed_by: string | null;
  performer_name: string;
  action_type: "CREATE" | "UPDATE" | "DELETE";
  entity_type: "RESERVATION" | "MEMBER" | "ROLE" | "BLOCKED_SLOT" | "PASSWORD" | "BULK_IMPORT";
  entity_id: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  description: string | null;
}

const PAGE_SIZE = 20;

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const ENTITY_LABELS: Record<string, string> = {
  RESERVATION: "Réservation",
  MEMBER: "Membre",
  ROLE: "Rôle",
  BLOCKED_SLOT: "Blocage",
  PASSWORD: "Mot de passe",
  BULK_IMPORT: "Import",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
};

export const AuditLogViewer = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Filtres
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("performed_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (actionFilter !== "all") {
        query = query.eq("action_type", actionFilter);
      }
      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter);
      }
      if (searchQuery) {
        query = query.or(`performer_name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }
      if (dateFrom) {
        query = query.gte("performed_at", dateFrom);
      }
      if (dateTo) {
        query = query.lte("performed_at", `${dateTo}T23:59:59`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setLogs((data as AuditLog[]) || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Erreur chargement logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, entityFilter, dateFrom, dateTo]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(0);
      fetchLogs();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const handleExportCSV = () => {
    const headers = ["Date", "Utilisateur", "Action", "Type", "Description"];
    const rows = logs.map((log) => [
      format(new Date(log.performed_at), "dd/MM/yyyy HH:mm", { locale: fr }),
      log.performer_name,
      ACTION_LABELS[log.action_type],
      ENTITY_LABELS[log.entity_type],
      log.description || "",
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_logs_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.click();
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Historique des actions</CardTitle>
            <CardDescription>
              {totalCount} action{totalCount > 1 ? "s" : ""} enregistrée{totalCount > 1 ? "s" : ""}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Rafraîchir
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={logs.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exporter CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtres */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Input
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Type d'action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les actions</SelectItem>
              <SelectItem value="CREATE">Création</SelectItem>
              <SelectItem value="UPDATE">Modification</SelectItem>
              <SelectItem value="DELETE">Suppression</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Type d'entité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les entités</SelectItem>
              <SelectItem value="RESERVATION">Réservation</SelectItem>
              <SelectItem value="MEMBER">Membre</SelectItem>
              <SelectItem value="ROLE">Rôle</SelectItem>
              <SelectItem value="BLOCKED_SLOT">Blocage</SelectItem>
              <SelectItem value="PASSWORD">Mot de passe</SelectItem>
              <SelectItem value="BULK_IMPORT">Import</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="Du" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="Au" />
        </div>

        {/* Tableau */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Aucune action enregistrée</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date/Heure</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.performed_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                    </TableCell>
                    <TableCell>{log.performer_name}</TableCell>
                    <TableCell>
                      <Badge className={ACTION_COLORS[log.action_type]}>{ACTION_LABELS[log.action_type]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ENTITY_LABELS[log.entity_type]}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{log.description}</TableCell>
                    <TableCell>
                      {(log.old_values || log.new_values) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedLog(log);
                            setDetailsOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {page + 1} sur {totalPages || 1}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Modal détails */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Détails de l'action</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Date</p>
                    <p>{format(new Date(selectedLog.performed_at), "dd/MM/yyyy HH:mm:ss", { locale: fr })}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Utilisateur</p>
                    <p>{selectedLog.performer_name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Action</p>
                    <Badge className={ACTION_COLORS[selectedLog.action_type]}>{ACTION_LABELS[selectedLog.action_type]}</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Type</p>
                    <Badge variant="outline">{ENTITY_LABELS[selectedLog.entity_type]}</Badge>
                  </div>
                </div>

                {selectedLog.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Description</p>
                    <p>{selectedLog.description}</p>
                  </div>
                )}

                {selectedLog.old_values && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Anciennes valeurs</p>
                    <pre className="bg-muted p-3 rounded-md text-sm overflow-auto max-h-40">
                      {JSON.stringify(selectedLog.old_values, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.new_values && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Nouvelles valeurs</p>
                    <pre className="bg-muted p-3 rounded-md text-sm overflow-auto max-h-40">
                      {JSON.stringify(selectedLog.new_values, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
