import { Calendar, Home, User, Settings, Menu, X, LogOut, KeyRound } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { useCoachRestrictions } from "@/hooks/useCoachRestrictions";
import { ChangePasswordDialog } from "./ChangePasswordDialog";

interface MobileNavProps {
  userId?: string;
  onBookingOpen: () => void;
}

export function MobileNav({ userId, onBookingOpen }: MobileNavProps) {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole(userId);
  const { signOut } = useAuth();
  const { isCoach } = useCoachRestrictions(userId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50">
        <div className="grid grid-cols-4 h-16">
          <button
            onClick={() => navigate("/")}
            className="flex flex-col items-center justify-center gap-1 text-xs hover:bg-accent active:bg-accent"
          >
            <Home className="h-5 w-5" />
            <span>Accueil</span>
          </button>
          {!isCoach && (
            <button
              onClick={onBookingOpen}
              className="flex flex-col items-center justify-center gap-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80"
            >
              <Calendar className="h-5 w-5" />
              <span>Réserver</span>
            </button>
          )}
          <button
            onClick={() => navigate("/mes-reservations")}
            className="flex flex-col items-center justify-center gap-1 text-xs hover:bg-accent active:bg-accent"
          >
            <User className="h-5 w-5" />
            <span>{isAdmin ? "Toutes" : "Mes résa"}</span>
          </button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex flex-col items-center justify-center gap-1 text-xs hover:bg-accent active:bg-accent"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span>Menu</span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-background z-40 animate-in fade-in slide-in-from-bottom-5"
          onClick={() => setMenuOpen(false)}
        >
          <div className="container mx-auto px-4 py-8 space-y-4">
            {isAdmin && (
              <Button
                variant="outline"
                className="w-full h-14 text-lg"
                onClick={() => {
                  navigate("/admin");
                  setMenuOpen(false);
                }}
              >
                <Settings className="h-5 w-5 mr-3" />
                Gestion Admin
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full h-14 text-lg"
              onClick={() => {
                setChangePasswordOpen(true);
                setMenuOpen(false);
              }}
            >
              <KeyRound className="h-5 w-5 mr-3" />
              Changer le mot de passe
            </Button>
            <Button
              variant="destructive"
              className="w-full h-14 text-lg"
              onClick={() => {
                signOut();
                setMenuOpen(false);
              }}
            >
              <LogOut className="h-5 w-5 mr-3" />
              Déconnexion
            </Button>
          </div>
        </div>
      )}

      <ChangePasswordDialog 
        open={changePasswordOpen} 
        onOpenChange={setChangePasswordOpen} 
      />
    </>
  );
}
