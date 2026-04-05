import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { isAuthorizedStaffAccess, normalizeEmail } from "../../../shared/accessControl";
import {
  ArrowRight,
  Loader2,
  QrCode,
  ShieldCheck,
  Stethoscope,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const STAFF_EMAIL_STORAGE_KEY = "triage_staff_admin_email";

export default function AccessPortal() {
  const [, setLocation] = useLocation();
  const { user, loading, isAuthenticated } = useAuth();
  const [adminEmail, setAdminEmail] = useState("");
  const [isOpeningPatientSpace, setIsOpeningPatientSpace] = useState(false);

  const patientEntryQuery = trpc.triage.publicPatientEntry.useQuery(undefined, {
    enabled: false,
    staleTime: 60_000,
  });

  const pendingAdminEmail = useMemo(() => {
    if (typeof window === "undefined") return "";
    return normalizeEmail(window.sessionStorage.getItem(STAFF_EMAIL_STORAGE_KEY) || "");
  }, []);

  useEffect(() => {
    if (!pendingAdminEmail) {
      return;
    }

    setAdminEmail((current) => current || pendingAdminEmail);
  }, [pendingAdminEmail]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    const expectedEmail = normalizeEmail(
      typeof window === "undefined" ? "" : window.sessionStorage.getItem(STAFF_EMAIL_STORAGE_KEY) || "",
    );

    if (!expectedEmail) {
      return;
    }

    const actualEmail = normalizeEmail(user.email || "");
    if (
      isAuthorizedStaffAccess({
        isAuthenticated,
        expectedAdminEmail: expectedEmail,
        userEmail: actualEmail,
        userRole: user.role,
      })
    ) {
      setLocation("/staff");
    }
  }, [isAuthenticated, setLocation, user]);

  async function handlePatientAccess() {
    setIsOpeningPatientSpace(true);
    try {
      const result = await patientEntryQuery.refetch();
      if (result.data?.patientPath) {
        setLocation(result.data.patientPath);
        return;
      }

      toast.error("Impossible d’ouvrir l’espace patient pour le moment.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d’ouvrir l’espace patient.");
    } finally {
      setIsOpeningPatientSpace(false);
    }
  }

  function handleStaffAccess() {
    const normalizedEmail = normalizeEmail(adminEmail);
    if (!normalizedEmail) {
      toast.error("Veuillez saisir l’email administrateur avant de continuer.");
      return;
    }

    window.sessionStorage.setItem(STAFF_EMAIL_STORAGE_KEY, normalizedEmail);

    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }

    const currentEmail = normalizeEmail(user?.email || "");
    if (
      !isAuthorizedStaffAccess({
        isAuthenticated,
        expectedAdminEmail: normalizedEmail,
        userEmail: currentEmail,
        userRole: user?.role,
      })
    ) {
      if (user?.role !== "admin") {
        toast.error("Ce compte est connecté, mais ne dispose pas des droits administrateur.");
        return;
      }

      toast.error("L’email saisi ne correspond pas au compte administrateur connecté.");
      return;
    }

    setLocation("/staff");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_24%),radial-gradient(circle_at_85%_10%,_rgba(59,130,246,0.16),_transparent_26%),linear-gradient(180deg,_#f8fafc_0%,_#eef6ff_100%)] p-6 sm:p-8">
      <div className="container flex min-h-[calc(100vh-3rem)] items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[2rem] border-white/70 bg-white/90 shadow-[0_30px_100px_rgba(15,23,42,0.12)] backdrop-blur">
            <CardHeader className="space-y-5 p-8 sm:p-10">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 hover:bg-emerald-100">
                  Portail d’accès
                </Badge>
                <Badge variant="outline" className="rounded-full border-slate-200 bg-white/80 px-3 py-1 text-slate-600">
                  Personnel & patients séparés
                </Badge>
              </div>
              <div className="space-y-4">
                <CardTitle className="max-w-3xl text-4xl leading-tight text-slate-950 sm:text-5xl">
                  Choisissez d’abord votre espace avant d’accéder à l’application de triage.
                </CardTitle>
                <CardDescription className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                  L’espace patient reste public et immédiat, sans email ni mot de passe. L’espace personnel reste réservé aux comptes administrateurs autorisés, avec vérification de l’email admin avant l’accès sécurisé.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 p-8 pt-0 sm:grid-cols-3 sm:p-10 sm:pt-0">
              <div className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/90 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Personnel</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">Connexion sécurisée avec rôle admin pour l’équipe soignante et la supervision clinique.</p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/90 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Patients</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">Accès direct au formulaire d’admission sans authentification préalable.</p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/90 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Contrôle</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">Séparation claire des parcours pour limiter les erreurs d’orientation à l’entrée.</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="rounded-[2rem] border-slate-200/80 bg-white/92 shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
              <CardHeader className="space-y-4 p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-950 text-white">
                  <UserCog className="h-7 w-7" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-slate-950">Espace personnel admin</CardTitle>
                  <CardDescription className="mt-2 text-base leading-7 text-slate-600">
                    Entrez l’email administrateur autorisé, puis continuez vers la connexion sécurisée du personnel.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 p-8 pt-0">
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email admin</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@hopital.ma"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                    className="h-12 rounded-2xl bg-white"
                  />
                </div>
                <Button className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800" onClick={handleStaffAccess} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Accéder à l’espace personnel
                </Button>
                <p className="text-sm leading-6 text-slate-500">
                  Après authentification, l’accès est autorisé uniquement si le compte connecté possède bien le rôle <strong>admin</strong> et le même email que celui saisi ici.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-emerald-200/70 bg-emerald-50/80 shadow-[0_24px_70px_rgba(16,185,129,0.12)]">
              <CardHeader className="space-y-4 p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-600 text-white">
                  <Users className="h-7 w-7" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-slate-950">Espace patient</CardTitle>
                  <CardDescription className="mt-2 text-base leading-7 text-slate-700">
                    Les patients entrent directement dans le formulaire sans email ni mot de passe, puis sont redirigés vers le parcours public disponible.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 p-8 pt-0">
                <Button className="h-12 w-full rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={handlePatientAccess} disabled={isOpeningPatientSpace || patientEntryQuery.isFetching}>
                  {isOpeningPatientSpace || patientEntryQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                  Entrer dans l’espace patient
                </Button>
                <div className="rounded-[1.5rem] border border-emerald-200/80 bg-white/70 p-4 text-sm leading-6 text-slate-700">
                  L’application réutilise automatiquement un lien patient public actif ou en crée un nouveau si nécessaire.
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="rounded-[1.5rem] border-white/70 bg-white/90">
                <CardContent className="flex items-start gap-3 p-5">
                  <Stethoscope className="mt-1 h-5 w-5 text-slate-900" />
                  <p className="text-sm leading-6 text-slate-600">Le personnel rejoint le tableau clinique complet après validation de l’identité admin.</p>
                </CardContent>
              </Card>
              <Card className="rounded-[1.5rem] border-white/70 bg-white/90">
                <CardContent className="flex items-start gap-3 p-5">
                  <QrCode className="mt-1 h-5 w-5 text-emerald-600" />
                  <p className="text-sm leading-6 text-slate-600">Le patient accède directement au formulaire public sans friction de connexion.</p>
                </CardContent>
              </Card>
              <Card className="rounded-[1.5rem] border-white/70 bg-white/90">
                <CardContent className="flex items-start gap-3 p-5">
                  <ArrowRight className="mt-1 h-5 w-5 text-sky-600" />
                  <p className="text-sm leading-6 text-slate-600">La séparation initiale rend les parcours plus clairs dès l’ouverture de l’application.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
