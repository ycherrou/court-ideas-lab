import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";

const passwordSchema = z.object({
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

const ChangePassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Vous devez être connecté");
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);

      // Vérifier si l'utilisateur doit changer son mot de passe
      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", session.user.id)
        .single();

      if (profile && !profile.must_change_password) {
        navigate("/");
      }
    };

    checkAuth();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = passwordSchema.parse({ password, confirmPassword });
      setLoading(true);

      // Mettre à jour le mot de passe
      const { error: passwordError } = await supabase.auth.updateUser({
        password: validated.password,
      });

      if (passwordError) throw passwordError;

      // Mettre à jour must_change_password
      if (userId) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ must_change_password: false })
          .eq("id", userId);

        if (profileError) {
          console.error("Erreur mise à jour profil:", profileError);
        }
      }

      toast.success("Mot de passe modifié avec succès");
      navigate("/");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Erreur lors du changement de mot de passe");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Changement de mot de passe requis</CardTitle>
          <CardDescription>
            Veuillez créer un nouveau mot de passe sécurisé pour votre compte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 caractères"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Retapez votre mot de passe"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Modification..." : "Changer le mot de passe"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePassword;
