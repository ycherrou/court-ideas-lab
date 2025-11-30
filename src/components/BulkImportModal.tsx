import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export const BulkImportModal = ({ open, onOpenChange, onSuccess }: BulkImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedMembers, setParsedMembers] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: ImportResult[], errors: any[] } | null>(null);
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
        toast.success(`${members.length} membres détectés`);
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
        return;
      }

      const { data, error } = await supabase.functions.invoke("bulk-import-members", {
        body: { members: parsedMembers },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      setResults(data);
      toast.success(`Import terminé: ${data.success.length} réussis, ${data.errors.length} erreurs`);
      
      if (data.success.length > 0) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Erreur lors de l'import");
    } finally {
      setImporting(false);
      setProgress(0);
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

  const togglePinVisibility = () => {
    setShowPins(!showPins);
  };

  const resetModal = () => {
    setFile(null);
    setParsedMembers([]);
    setResults(null);
    setProgress(0);
    setShowPins(false);
  };

  const handleClose = () => {
    resetModal();
    onOpenChange(false);
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

                <div className="flex gap-2">
                  <Button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex-1"
                  >
                    {importing ? `Import en cours... ${progress}%` : `Importer ${parsedMembers.length} membres`}
                  </Button>
                  <Button variant="outline" onClick={resetModal}>
                    Annuler
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 border rounded-lg">
                <p className="text-2xl font-bold">{results.success.length}</p>
                <p className="text-sm text-muted-foreground">Réussis</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-2xl font-bold">{results.errors.length}</p>
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
