import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { FileSpreadsheet, Download, Upload, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface BulkImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ImportResult {
  login: string;
  pin: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export const BulkImportModal = ({ open, onOpenChange, onSuccess }: BulkImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    success: ImportResult[];
    errors: any[];
    summary: { total: number; succeeded: number; failed: number };
  } | null>(null);
  const [showPins, setShowPins] = useState<Set<number>>(new Set());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("Le fichier ne doit pas dépasser 5MB");
      return;
    }

    setFile(selectedFile);
    parseExcelFile(selectedFile);
  };

  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const parsedMembers = jsonData.map((row: any) => ({
          firstName: row["Prénom"] || row["prenom"] || "",
          lastName: row["Nom"] || row["nom"] || "",
          email: row["Email"] || row["email"] || "",
          role: row["Rôle"] || row["role"] || "player",
        }));

        setMembers(parsedMembers);
        toast.success(`${parsedMembers.length} membres détectés`);
      } catch (error) {
        toast.error("Erreur lors de la lecture du fichier");
        console.error(error);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const downloadExampleFile = () => {
    const exampleData = [
      { Prénom: "Jean", Nom: "Dupont", Email: "jean.dupont@email.com", Rôle: "player" },
      { Prénom: "Marie", Nom: "Martin", Email: "", Rôle: "coach" },
      { Prénom: "Pierre", Nom: "Durant", Email: "pierre@email.com", Rôle: "player" },
    ];

    const ws = XLSX.utils.json_to_sheet(exampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Membres");
    XLSX.writeFile(wb, "exemple_import_membres.xlsx");
    toast.success("Fichier exemple téléchargé");
  };

  const handleImport = async () => {
    if (members.length === 0) {
      toast.error("Aucun membre à importer");
      return;
    }

    setImporting(true);
    setProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-import-members`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ members }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de l'import");
      }

      setResults(result);
      setProgress(100);

      // Télécharger automatiquement le fichier credentials
      if (result.success.length > 0) {
        downloadCredentials(result.success);
      }

      toast.success(`Import terminé: ${result.summary.succeeded} membres créés`);
      
      if (result.summary.failed > 0) {
        toast.error(`${result.summary.failed} erreurs`);
      }

      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  };

  const downloadCredentials = (credentials: ImportResult[]) => {
    const data = credentials.map(c => ({
      Login: c.login,
      "Code PIN": c.pin,
      Prénom: c.firstName,
      Nom: c.lastName,
      Email: c.email,
      Rôle: c.role,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Identifiants");
    
    const now = new Date();
    const filename = `credentials_tennis_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.xlsx`;
    
    XLSX.writeFile(wb, filename);
  };

  const downloadErrors = () => {
    if (!results || results.errors.length === 0) return;

    const data = results.errors.map(e => ({
      Ligne: e.index,
      Prénom: e.firstName,
      Nom: e.lastName,
      Erreur: e.error,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Erreurs");
    XLSX.writeFile(wb, "erreurs_import.xlsx");
    toast.success("Fichier d'erreurs téléchargé");
  };

  const togglePinVisibility = (index: number) => {
    const newShowPins = new Set(showPins);
    if (newShowPins.has(index)) {
      newShowPins.delete(index);
    } else {
      newShowPins.add(index);
    }
    setShowPins(newShowPins);
  };

  const resetModal = () => {
    setFile(null);
    setMembers([]);
    setResults(null);
    setProgress(0);
    setShowPins(new Set());
  };

  const handleClose = () => {
    resetModal();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import en masse de membres (Excel)</DialogTitle>
        </DialogHeader>

        {!results ? (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Importez jusqu'à 1000 membres via un fichier Excel (.xlsx)
                </p>
                <Button variant="outline" size="sm" onClick={downloadExampleFile}>
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger exemple
                </Button>
              </div>

              <div className="border rounded-lg p-4 space-y-2 bg-muted/50">
                <p className="font-medium text-sm">Format du fichier Excel :</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li><strong>Prénom</strong> (obligatoire)</li>
                  <li><strong>Nom</strong> (obligatoire)</li>
                  <li><strong>Email</strong> (optionnel - un email fictif sera généré si absent)</li>
                  <li><strong>Rôle</strong> (optionnel - par défaut: player)</li>
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-upload">Fichier Excel (.xlsx)</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
              />
            </div>

            {members.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {members.length} membres détectés
                  </p>
                </div>

                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prénom</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rôle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.slice(0, 10).map((member, index) => (
                        <TableRow key={index}>
                          <TableCell>{member.firstName}</TableCell>
                          <TableCell>{member.lastName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {member.email || "(auto)"}
                          </TableCell>
                          <TableCell>{member.role}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {members.length > 10 && (
                    <p className="text-xs text-center text-muted-foreground py-2">
                      ... et {members.length - 10} autres membres
                    </p>
                  )}
                </div>

                {importing && (
                  <div className="space-y-2">
                    <Progress value={progress} />
                    <p className="text-sm text-center text-muted-foreground">
                      Import en cours...
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleImport}
                  disabled={importing}
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {importing ? "Import en cours..." : `Importer ${members.length} membres`}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Résumé de l'import</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{results.summary.total}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Réussis</p>
                  <p className="text-2xl font-bold text-green-600">{results.summary.succeeded}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Erreurs</p>
                  <p className="text-2xl font-bold text-red-600">{results.summary.failed}</p>
                </div>
              </div>
            </div>

            {results.success.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Identifiants générés</h3>
                  <Button variant="outline" size="sm" onClick={() => downloadCredentials(results.success)}>
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger Excel
                  </Button>
                </div>

                <div className="border rounded-lg max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Login</TableHead>
                        <TableHead>Code PIN</TableHead>
                        <TableHead>Prénom</TableHead>
                        <TableHead>Nom</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.success.map((member, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono">{member.login}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono">
                                {showPins.has(index) ? member.pin : "••••"}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePinVisibility(index)}
                              >
                                {showPins.has(index) ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>{member.firstName}</TableCell>
                          <TableCell>{member.lastName}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {results.errors.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-red-600">Erreurs ({results.errors.length})</h3>
                  <Button variant="outline" size="sm" onClick={downloadErrors}>
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger erreurs
                  </Button>
                </div>

                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ligne</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>Erreur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.errors.map((error, index) => (
                        <TableRow key={index}>
                          <TableCell>{error.index}</TableCell>
                          <TableCell>{error.firstName} {error.lastName}</TableCell>
                          <TableCell className="text-red-600 text-sm">{error.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
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
