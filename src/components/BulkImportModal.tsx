import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Download, Upload, FileText, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface BulkImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ImportResult {
  login: string;
  pin: string;
  fullName: string;
  email: string;
  role: string;
}

interface SkippedMember {
  fullName: string;
  email: string;
  reason: string;
}

const BATCH_SIZE = 400;

export const BulkImportModal = ({ open, onOpenChange, onSuccess }: BulkImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedMembers, setParsedMembers] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [results, setResults] = useState<{ success: ImportResult[], skipped: SkippedMember[], errors: any[] } | null>(null);
  const [showPins, setShowPins] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseExcelFile(selectedFile);
    }
  };

  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        const members = jsonData.map((row: any) => ({
          fullName: row["Nom complet"] || row["nom complet"] || row["Nom"] || row["nom"] || row["NOM"] || "",
          email: row["Email"] || row["email"] || row["EMAIL"] || "",
          role: row["Rôle"] || row["Role"] || row["role"] || row["ROLE"] || "player"
        }));

        setParsedMembers(members);
        const batches = Math.ceil(members.length / BATCH_SIZE);
        toast.success(`${members.length} membres détectés (${batches} lot${batches > 1 ? 's' : ''})`);
      } catch (error) {
        toast.error("Erreur lors de la lecture du fichier");
        console.error(error);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadExampleFile = () => {
    const exampleData = [
      { "Nom complet": "Jean Dupont", "Email": "jean.dupont@example.com", "Rôle": "player" },
      { "Nom complet": "Marie Martin", "Email": "", "Rôle": "coach" },
      { "Nom complet": "Pierre Durand", "Email": "pierre@example.com", "Rôle": "admin" }
    ];

    const ws = XLSX.utils.json_to_sheet(exampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Membres");
    XLSX.writeFile(wb, "exemple_import_membres.xlsx");
  };

  const handleImport = async () => {
    if (parsedMembers.length === 0) {
      toast.error("Aucun membre à importer");
      return;
    }

    setImporting(true);
    setProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expirée");
        setImporting(false);
        return;
      }

      // Split members into batches
      const batches: any[][] = [];
      for (let i = 0; i < parsedMembers.length; i += BATCH_SIZE) {
        batches.push(parsedMembers.slice(i, i + BATCH_SIZE));
      }

      setTotalBatches(batches.length);
      
      // Accumulate results from all batches
      const allSuccess: ImportResult[] = [];
      const allSkipped: SkippedMember[] = [];
      const allErrors: any[] = [];

      for (let i = 0; i < batches.length; i++) {
        setCurrentBatch(i + 1);
        setProgress(Math.round((i / batches.length) * 100));

        try {
          const { data, error } = await supabase.functions.invoke("bulk-import-members", {
            body: { members: batches[i] },
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          });

          if (error) {
            // If batch fails completely, add all members as errors
            batches[i].forEach(member => {
              allErrors.push({
                ...member,
                error: error.message || "Erreur lors de l'import du lot"
              });
            });
          } else {
            // Accumulate successful imports, skipped and errors
            if (data.success) {
              allSuccess.push(...data.success);
            }
            if (data.skipped) {
              allSkipped.push(...data.skipped);
            }
            if (data.errors) {
              allErrors.push(...data.errors);
            }
          }
        } catch (batchError: any) {
          // Handle network or other errors for this batch
          batches[i].forEach(member => {
            allErrors.push({
              ...member,
              error: batchError.message || "Erreur réseau"
            });
          });
        }

        // Small delay between batches to avoid overwhelming the server
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setProgress(100);
      setResults({ success: allSuccess, skipped: allSkipped, errors: allErrors });
      
      const messages: string[] = [];
      if (allSuccess.length > 0) messages.push(`${allSuccess.length} créé(s)`);
      if (allSkipped.length > 0) messages.push(`${allSkipped.length} ignoré(s)`);
      if (allErrors.length > 0) messages.push(`${allErrors.length} erreur(s)`);
      toast.success(`Import terminé: ${messages.join(', ')}`);
      
      if (allSuccess.length > 0) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Erreur lors de l'import");
    } finally {
      setImporting(false);
      setCurrentBatch(0);
      setTotalBatches(0);
    }
  };

  const downloadCredentials = () => {
    if (!results || results.success.length === 0) return;

    const credentials = results.success.map(r => ({
      "Nom complet": r.fullName,
      "Email": r.email,
      "Login": r.login,
      "PIN": r.pin,
      "Rôle": r.role
    }));

    const ws = XLSX.utils.json_to_sheet(credentials);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Identifiants");
    XLSX.writeFile(wb, "identifiants_membres.xlsx");
    toast.success("Fichier téléchargé");
  };

  const downloadErrors = () => {
    if (!results || results.errors.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(results.errors);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Erreurs");
    XLSX.writeFile(wb, "erreurs_import.xlsx");
    toast.success("Fichier téléchargé");
  };

  const downloadSkipped = () => {
    if (!results || results.skipped.length === 0) return;

    const skippedData = results.skipped.map(s => ({
      "Nom complet": s.fullName,
      "Email": s.email,
      "Raison": s.reason
    }));

    const ws = XLSX.utils.json_to_sheet(skippedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ignorés");
    XLSX.writeFile(wb, "membres_ignores.xlsx");
    toast.success("Fichier téléchargé");
  };

  const togglePinVisibility = () => {
    setShowPins(!showPins);
  };

  const resetModal = () => {
    setFile(null);
    setParsedMembers([]);
    setResults(null);
    setProgress(0);
    setCurrentBatch(0);
    setTotalBatches(0);
    setShowPins(false);
  };

  const handleClose = () => {
    resetModal();
    onOpenChange(false);
  };

  const getBatchInfo = () => {
    const batches = Math.ceil(parsedMembers.length / BATCH_SIZE);
    if (batches <= 1) return null;
    
    const batchSizes = [];
    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, parsedMembers.length);
      batchSizes.push(end - start);
    }
    
    return `${batches} lots (${batchSizes.join(' + ')} membres)`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import groupé de membres</DialogTitle>
        </DialogHeader>

        {!results ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={downloadExampleFile}
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                Télécharger un exemple
              </Button>
              <label className="flex-1">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {file ? file.name : "Choisir un fichier"}
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
              <p className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Format du fichier Excel attendu :
              </p>
              <ul className="list-disc list-inside space-y-1 ml-6">
                <li>Colonne <strong>"Nom complet"</strong> : Le nom complet du membre (obligatoire)</li>
                <li>Colonne <strong>"Email"</strong> : Adresse email (optionnel)</li>
                <li>Colonne <strong>"Rôle"</strong> : player, coach, super_coach ou admin (optionnel, par défaut: player)</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Un login et un PIN seront générés automatiquement pour chaque membre.
              </p>
            </div>

            {parsedMembers.length > 0 && (
              <>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom complet</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rôle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedMembers.slice(0, 10).map((member, index) => (
                        <TableRow key={index}>
                          <TableCell>{member.fullName}</TableCell>
                          <TableCell>{member.email || "Auto-généré"}</TableCell>
                          <TableCell>{member.role}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {parsedMembers.length > 10 && (
                    <div className="p-2 text-center text-sm text-muted-foreground border-t">
                      ... et {parsedMembers.length - 10} autres membres
                    </div>
                  )}
                </div>

                {getBatchInfo() && (
                  <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    Import automatique en {getBatchInfo()}
                  </div>
                )}

                {importing && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Import lot {currentBatch}/{totalBatches} en cours...</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex-1"
                  >
                    {importing 
                      ? `Import en cours... (lot ${currentBatch}/${totalBatches})`
                      : `Importer ${parsedMembers.length} membres`
                    }
                  </Button>
                  <Button variant="outline" onClick={resetModal} disabled={importing}>
                    Annuler
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="p-4 border rounded-lg">
                <p className="text-2xl font-bold text-green-600">{results.success.length}</p>
                <p className="text-sm text-muted-foreground">Créés</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-2xl font-bold text-amber-500">{results.skipped.length}</p>
                <p className="text-sm text-muted-foreground">Ignorés</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-2xl font-bold text-destructive">{results.errors.length}</p>
                <p className="text-sm text-muted-foreground">Erreurs</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-2xl font-bold">{parsedMembers.length}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>

            {results.success.length > 0 && (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Membres créés avec succès</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={togglePinVisibility}
                  >
                    {showPins ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom complet</TableHead>
                        <TableHead>Login</TableHead>
                        <TableHead>PIN</TableHead>
                        <TableHead>Rôle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.success.map((result, index) => (
                        <TableRow key={index}>
                          <TableCell>{result.fullName}</TableCell>
                          <TableCell className="font-mono">{result.login}</TableCell>
                          <TableCell className="font-mono">
                            {showPins ? result.pin : "****"}
                          </TableCell>
                          <TableCell>{result.role}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button onClick={downloadCredentials} className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger les identifiants
                </Button>
              </>
            )}

            {results.skipped.length > 0 && (
              <>
                <h3 className="font-semibold text-amber-600">Membres ignorés (déjà présents)</h3>
                <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom complet</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Raison</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.skipped.map((skipped, index) => (
                        <TableRow key={index}>
                          <TableCell>{skipped.fullName}</TableCell>
                          <TableCell>{skipped.email}</TableCell>
                          <TableCell className="text-sm text-amber-600">{skipped.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button variant="outline" onClick={downloadSkipped} className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger les ignorés
                </Button>
              </>
            )}

            {results.errors.length > 0 && (
              <>
                <h3 className="font-semibold text-destructive">Erreurs</h3>
                <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom complet</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Erreur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.errors.map((error, index) => (
                        <TableRow key={index}>
                          <TableCell>{error.fullName}</TableCell>
                          <TableCell>{error.email}</TableCell>
                          <TableCell className="text-sm text-destructive">{error.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button variant="outline" onClick={downloadErrors} className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger les erreurs
                </Button>
              </>
            )}

            <Button onClick={handleClose} className="w-full">
              Fermer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
