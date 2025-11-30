import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";

const usernameLoginSchema = z.object({
  username: z.string().min(2, "Login invalide"),
  password: z.string().min(4, "PIN invalide"),
});

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkUser();
  }, [navigate]);

  const handleUsernameLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    try {
      usernameLoginSchema.parse({ username, password });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/login-with-username`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur de connexion");
      }

      // Définir la session
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });

      if (sessionError) throw sessionError;

      toast.success("Connexion réussie !");
      
      // Redirection conditionnelle
      if (result.mustChangePassword) {
        navigate("/change-password");
      } else {
        navigate("/");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Réservation de Courts de Tennis</CardTitle>
          <CardDescription className="text-center">
            Connectez-vous avec votre login
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUsernameLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Login</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="jdupont"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin">Code PIN</Label>
              <Input
                id="pin"
                name="password"
                type="password"
                placeholder="1234"
                maxLength={4}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
