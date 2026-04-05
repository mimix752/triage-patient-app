import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  isAuthorizedLocalAdminCredentials,
  LOCAL_ADMIN_EMAIL_STORAGE_KEY,
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
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { preferPublicUrl } from "../../../shared/publicOrigin";

export default function AccessPortal() {
  const [, setLocation] = useLocation();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isOpeningPatientSpace, setIsOpeningPatientSpace] = useState(false);
  const adminEmailRef = useRef<HTMLInputElement | null>(null);

  const patientEntryQuery = trpc.triage.publicPatientEntry.useQuery(undefined, {
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

  const patientPath = patientEntryQuery.data?.patientPath || "";
  const patientUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return patientEntryQuery.data?.patientUrl || "";
    }

    return preferPublicUrl({
      candidateUrl: patientEntryQuery.data?.patientUrl,
      fallbackPath: patientPath,
      currentOrigin: window.location.origin,
      referrer: document.referrer,
      ancestorOrigins: window.location.ancestorOrigins,
    });
  }, [patientEntryQuery.data?.patientUrl, patientPath]);

  async function handlePatientAccess() {
    setIsOpeningPatientSpace(true);
    try {
      const result = patientEntryQuery.data?.patientPath ? { data: patientEntryQuery.data } : await patientEntryQuery.refetch();
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

  function handleStaffShortcut() {
    adminEmailRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    adminEmailRef.current?.focus();
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_24%),radial-gradient(circle_at_85%_10%,_rgba(59,130,246,0.16),_transparent_26%),linear-gradient(180deg,_#f8fafc_0%,_#eef6ff_100%)] p-6 sm:p-8">
      <div className="container flex min-h-[calc(100vh-3rem)] items-center">
        <div className="grid w-full items-start gap-4 lg:grid-cols-[0.94fr_1.06fr] xl:gap-5">
          <Card className="min-w-0 rounded-[2rem] border-white/70 bg-white/90 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur">
            <CardHeader className="space-y-3 p-6 sm:p-7">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 hover:bg-emerald-100">
                  Accès clinique
                </Badge>
              </div>
              <div className="space-y-3">
                <CardTitle className="max-w-xl text-3xl leading-tight tracking-[-0.03em] text-slate-950 sm:text-[2.45rem]">
                  Accès clinique.
                </CardTitle>
                <CardDescription className="max-w-md text-[15px] leading-7 text-slate-600">
                  Choisissez simplement l’entrée patient ou l’accès personnel.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 p-6 pt-0 sm:p-7 sm:pt-0">
              <div className="rounded-[1.35rem] border border-emerald-100 bg-emerald-50/70 px-4 py-3.5">
                <p className="text-sm leading-6 text-emerald-900">Le QR code et le lien patient sont centralisés ici pour l’accueil.</p>
              </div>
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Ouverture rapide</p>
                <div className="grid gap-3">
                  <Button className="h-auto w-full justify-start whitespace-normal rounded-[1.5rem] bg-emerald-600 px-5 py-3.5 text-left text-white shadow-[0_14px_30px_rgba(5,150,105,0.18)] transition-all hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-[0_20px_38px_rgba(5,150,105,0.22)]" onClick={handlePatientAccess} disabled={isOpeningPatientSpace || patientEntryQuery.isFetching}>
                    <div className="flex w-full min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold">Entrée patient</p>
                        <p className="mt-1 text-sm leading-6 text-emerald-50/95">Formulaire d’arrivée immédiat, sans identifiants, avec photo, scan et symptômes.</p>
                      </div>
                      {isOpeningPatientSpace || patientEntryQuery.isFetching ? <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" /> : <QrCode className="mt-0.5 h-5 w-5 shrink-0" />}
                    </div>
                  </Button>
                  <Button variant="outline" className="h-auto w-full justify-start whitespace-normal rounded-[1.5rem] border-slate-200 bg-white px-5 py-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md" onClick={handleStaffShortcut}>
                    <div className="flex w-full min-w-0 items-start justify-between gap-3 text-left">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-slate-950">Accès personnel</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">Ouverture directe du formulaire sécurisé pour l’admission et le suivi du service.</p>
                      </div>
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-900" />
                    </div>
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-[210px_minmax(0,1fr)] lg:items-stretch">
                <div className="rounded-[1.4rem] border border-emerald-200/80 bg-white/88 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">QR code</p>
                  <div className="mt-3 flex flex-col items-center gap-3 rounded-[1.2rem] bg-white p-3 shadow-sm">
                    {patientUrl ? (
                      <div className="rounded-[1rem] bg-white p-2 ring-1 ring-emerald-100">
                        <QRCode value={patientUrl} size={132} bgColor="#FFFFFF" fgColor="#0f172a" />
                      </div>
                    ) : (
                      <div className="flex h-[148px] w-[148px] items-center justify-center rounded-[1rem] border border-dashed border-emerald-200 bg-emerald-50 px-3 text-center text-sm text-emerald-700">
                        {patientEntryQuery.isLoading || patientEntryQuery.isFetching ? "Préparation du QR code…" : "QR code indisponible pour le moment."}
                      </div>
                    )}
                    <p className="text-center text-xs leading-5 text-slate-600">À scanner à l’accueil.</p>
                  </div>
                </div>
                <div className="rounded-[1.4rem] border border-emerald-200/80 bg-white/88 p-4 text-sm leading-6 text-slate-700">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Lien patient</p>
                  {patientUrl ? (
                    <>
                      {/* Doublon retiré vers la destination commune `patientUrl` : le lien cliquable a été supprimé ici pour conserver un seul accès visible via le bouton "Entrée patient" plus haut dans la page. */}
                      <p className="mt-3 break-all rounded-[1rem] border border-emerald-100 bg-emerald-50 px-4 py-3 font-medium text-emerald-800">
                        {patientUrl}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-slate-500">Le lien direct du formulaire patient est en cours de préparation.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid min-w-0 gap-4">
            <Card className="rounded-[2rem] border-emerald-200/70 bg-emerald-50/80 shadow-[0_24px_70px_rgba(16,185,129,0.12)]">
              <CardHeader className="space-y-3 p-6 sm:p-7">
                <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-emerald-600 text-white">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-[1.85rem] text-slate-950">Espace patient</CardTitle>
                  <CardDescription className="mt-1 text-[15px] leading-6 text-slate-700">
                    Les patients accèdent directement au formulaire d’arrivée, sans email ni mot de passe.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-6 pt-0 sm:p-7 sm:pt-0">
                {/* Doublon retiré vers la destination commune `patientPath` / `patientUrl` : le CTA secondaire de cette carte a été supprimé pour ne conserver qu’une seule entrée patient visible, située plus haut dans le bloc principal. */}
                <div className="rounded-[1.25rem] border border-emerald-200 bg-white/85 p-4 text-sm leading-6 text-slate-700">
                  Le patient peut entrer directement dans son formulaire d’arrivée.
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-slate-200/80 bg-white/92 shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
              <CardHeader className="space-y-3 p-6 sm:p-7">
                <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-950 text-white">
                  <UserCog className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-slate-950">Espace personnel</CardTitle>
                  <CardDescription className="mt-1 text-[15px] leading-6 text-slate-600">
                    Connectez-vous avec les accès du service pour ouvrir l’espace personnel.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-6 pt-0 sm:p-7 sm:pt-0">
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email professionnel</Label>
                  <Input
                    id="admin-email"
                    ref={adminEmailRef}
                    type="email"
                    placeholder="service@clinique.ma"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                    className="h-11 rounded-2xl bg-white"
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
                    className="h-11 rounded-2xl bg-white"
                  />
                </div>
                <Button className="h-11 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800" onClick={handleStaffAccess}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Accéder à l’espace personnel
                </Button>
                <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3 text-sm leading-6 text-slate-600">
                    <LockKeyhole className="mt-0.5 h-4.5 w-4.5 shrink-0 text-slate-500" />
                    <div>
                      <p className="font-medium text-slate-900">Accès réservé</p>
                      <p className="mt-1">Les identifiants de service sont communiqués en interne au personnel autorisé.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="rounded-[1.35rem] border-white/70 bg-white/90">
                <CardContent className="flex items-start gap-3 p-4">
                  <Stethoscope className="mt-1 h-5 w-5 text-slate-900" />
                  <p className="text-sm leading-6 text-slate-600">Le personnel accède à l’admission, à la salle d’attente et au suivi du service.</p>
                </CardContent>
              </Card>
              <Card className="rounded-[1.35rem] border-white/70 bg-white/90">
                <CardContent className="flex items-start gap-3 p-4">
                  <QrCode className="mt-1 h-5 w-5 text-emerald-600" />
                  <p className="text-sm leading-6 text-slate-600">Le patient complète son arrivée avant d’être pris en charge à l’accueil.</p>
                </CardContent>
              </Card>
              <Card className="rounded-[1.35rem] border-white/70 bg-white/90">
                <CardContent className="flex items-start gap-3 p-4">
                  <LockKeyhole className="mt-1 h-5 w-5 text-sky-600" />
                  <p className="text-sm leading-6 text-slate-600">Le portail distingue clairement l’accès patient et l’accès personnel.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
