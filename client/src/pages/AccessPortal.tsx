import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  isAuthorizedLocalAdminCredentials,
  LOCAL_ADMIN_EMAIL_STORAGE_KEY,
  LOCAL_ADMIN_EMAILS,
  LOCAL_ADMIN_PASSWORD_STORAGE_KEY,
  normalizeEmail,
} from "../../../shared/accessControl";
import {
  Loader2,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Stethoscope,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function AccessPortal() {
  const [, setLocation] = useLocation();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isOpeningPatientSpace, setIsOpeningPatientSpace] = useState(false);

  const patientEntryQuery = trpc.triage.publicPatientEntry.useQuery(undefined, {
    enabled: false,
    staleTime: 60_000,
  });

  const pendingAdminEmail = useMemo(() => {
    if (typeof window === "undefined") return "";
    return normalizeEmail(window.sessionStorage.getItem(LOCAL_ADMIN_EMAIL_STORAGE_KEY) || "");
  }, []);

  useEffect(() => {
    if (!pendingAdminEmail) {
      return;
    }

    setAdminEmail((current) => current || pendingAdminEmail);
  }, [pendingAdminEmail]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedEmail = normalizeEmail(window.sessionStorage.getItem(LOCAL_ADMIN_EMAIL_STORAGE_KEY) || "");
    const savedPassword = window.sessionStorage.getItem(LOCAL_ADMIN_PASSWORD_STORAGE_KEY) || "";

    if (savedEmail) {
      setAdminEmail((current) => current || savedEmail);
    }

    if (savedPassword) {
      setAdminPassword((current) => current || savedPassword);
    }
  }, []);

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
    const password = adminPassword.trim();

    if (!normalizedEmail) {
      toast.error("Veuillez saisir un email administrateur.");
      return;
    }

    if (!password) {
      toast.error("Veuillez saisir le mot de passe administrateur.");
      return;
    }

    if (!isAuthorizedLocalAdminCredentials({
      email: normalizedEmail,
      password,
    })) {
      toast.error("Email administrateur ou mot de passe incorrect.");
      return;
    }

    window.sessionStorage.setItem(LOCAL_ADMIN_EMAIL_STORAGE_KEY, normalizedEmail);
    window.sessionStorage.setItem(LOCAL_ADMIN_PASSWORD_STORAGE_KEY, password);
    toast.success("Accès administrateur autorisé.");
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
                  L’espace patient reste public et immédiat, sans email ni mot de passe. L’espace personnel utilise une authentification locale simple avec email autorisé et mot de passe partagé pour accéder rapidement à l’interface admin.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 p-8 pt-0 sm:grid-cols-3 sm:p-10 sm:pt-0">
              <div className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/90 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Personnel</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">Connexion locale avec email autorisé et mot de passe partagé pour l’équipe soignante.</p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/90 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Patients</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">Accès direct au formulaire d’admission sans authentification préalable.</p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/90 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Contrôle</p>
                <p className="mt-3 text-sm leading-6 text-slate-700">Les emails autorisés sont préconfigurés et redirigent vers l’espace admin après validation.</p>
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
                    Saisissez un email autorisé et le mot de passe partagé pour ouvrir immédiatement l’espace admin.
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
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Mot de passe</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="1234"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    className="h-12 rounded-2xl bg-white"
                  />
                </div>
                <Button className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800" onClick={handleStaffAccess}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Accéder à l’espace personnel
                </Button>
                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  <p className="font-medium text-slate-900">Emails admin autorisés</p>
                  <p className="mt-2">{LOCAL_ADMIN_EMAILS.join(" · ")}</p>
                </div>
                <p className="text-sm leading-6 text-slate-500">
                  Le mot de passe partagé configuré pour cet accès local est vérifié côté application et transmis au backend pour ouvrir l’espace admin.
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
                  <p className="text-sm leading-6 text-slate-600">Le personnel rejoint le tableau clinique complet après validation des identifiants locaux.</p>
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
                  <LockKeyhole className="mt-1 h-5 w-5 text-sky-600" />
                  <p className="text-sm leading-6 text-slate-600">Le portail contrôle l’accès admin avec un mot de passe partagé et des emails autorisés.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
