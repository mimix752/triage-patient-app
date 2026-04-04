import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  AudioLines,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileBadge,
  HeartPulse,
  Loader2,
  LucideIcon,
  Mic,
  MicOff,
  QrCode,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Upload,
  UserCog,
  UserPlus,
  Users,
  Waves,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

type IntakeMethod = "ocr" | "manuel" | "vocal";
type Priority = "urgence_vitale" | "urgence" | "semi_urgence" | "non_urgent";

type IdentityState = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  socialSecurityNumber: string;
};

type AssessmentState = {
  chiefComplaint: string;
  symptomSummary: string;
  painLevel: number;
  canWalk: boolean;
  hasBleeding: boolean;
  hasSevereBleeding: boolean;
  hasBreathingDifficulty: boolean;
  hasChestPain: boolean;
  hasNeurologicalDeficit: boolean;
  hasLossOfConsciousness: boolean;
  hasHighFever: boolean;
  hasTrauma: boolean;
  isPregnant: boolean;
  oxygenSaturation: string;
  heartRate: string;
  respiratoryRate: string;
  systolicBloodPressure: string;
};

type StaffingState = {
  doctorsOnDuty: string;
  nursesOnDuty: string;
  availableDoctors: string;
  availableNurses: string;
  waitingPatients: string;
  activeCriticalPatients: string;
  notes: string;
};

type DashboardSummary = {
  totalPatients: number;
  waitingPatients: number;
  urgentPatients: number;
  p1Patients: number;
  avgWaitingMinutes: number;
  manualOverrides: number;
  staffing: {
    doctorsOnDuty: number;
    nursesOnDuty: number;
    availableDoctors: number;
    availableNurses: number;
    waitingPatients: number;
    activeCriticalPatients: number;
    occupancyPressureScore: number;
    updatedAt: string | number | Date;
  } | null;
};

type DashboardCase = {
  triageCaseId: number;
  patientId: number;
  patientFirstName: string;
  patientLastName: string;
  intakeMethod: IntakeMethod;
  intakeSource: "staff_full" | "patient_qr";
  preferredLanguage: string;
  chiefComplaint: string;
  priority: Priority;
  aiRecommendedPriority: Priority | null;
  entryMode: "standard_ai" | "manual_p1" | "manual_staff";
  manualPriorityOverride: boolean;
  status: "en_attente" | "en_cours" | "oriente" | "termine";
  queueRank: number;
  queuePressureScore: number;
  targetWaitMinutes: number;
  waitingTimeMinutes: number;
  recommendedAction: string;
  protocolReference: string;
  createdAt: string | number | Date;
  updatedAt: string | number | Date;
};

type DashboardNotification = {
  id: number;
  severity: "info" | "urgent" | "critical";
  title: string;
  content: string;
  delivered: boolean;
  createdAt: string | number | Date;
};

type FormLink = {
  id: number;
  label: string;
  token: string;
  expiresAt: string | number | Date | null;
  createdAt?: string | number | Date;
};

type ActivePatient = {
  triageCaseId: number;
  patientDisplayName: string;
  priority: Priority;
  status: "en_attente" | "en_cours" | "oriente" | "termine";
  queueRank: number;
  waitingTimeMinutes: number;
  chiefComplaint: string;
  intakeSource: "staff_full" | "patient_qr";
  entryMode: "standard_ai" | "manual_p1" | "manual_staff";
  createdAt: string | number | Date;
};

type ProtocolSummary = {
  title: string;
  description: string;
  levels: Array<{
    code: string;
    label: string;
    description: string;
    targetMinutes: number;
  }>;
};

type StaffBootstrapPayload = {
  mode: "staff";
  summary: DashboardSummary;
  staffing: DashboardSummary["staffing"];
  cases: DashboardCase[];
  notifications: DashboardNotification[];
  formLinks: FormLink[];
  activePatients: ActivePatient[];
  guidedQuestions: string[];
  protocolSummary: ProtocolSummary;
};

type PatientBootstrapPayload = {
  mode: "patient";
  link: {
    id: number;
    label: string;
    token: string;
    expiresAt: string | number | Date | null;
  };
  guidedQuestions: string[];
  protocolSummary: ProtocolSummary;
};

type StatCard = {
  key: keyof Pick<DashboardSummary, "totalPatients" | "waitingPatients" | "urgentPatients" | "avgWaitingMinutes">;
  label: string;
  icon: LucideIcon;
  accent: string;
  suffix: string;
};

const priorityClasses: Record<Priority, string> = {
  urgence_vitale: "border-rose-200 bg-rose-100 text-rose-700",
  urgence: "border-amber-200 bg-amber-100 text-amber-700",
  semi_urgence: "border-blue-200 bg-blue-100 text-blue-700",
  non_urgent: "border-emerald-200 bg-emerald-100 text-emerald-700",
};

const priorityLabels: Record<Priority, string> = {
  urgence_vitale: "Urgence vitale",
  urgence: "Urgence",
  semi_urgence: "Semi-urgence",
  non_urgent: "Non urgent",
};

const intakeLabels: Record<IntakeMethod, string> = {
  ocr: "Scan identité",
  manuel: "Saisie manuelle",
  vocal: "Saisie vocale",
};

const statCards: StatCard[] = [
  { key: "totalPatients", label: "Patients suivis", icon: UserPlus, accent: "from-slate-950 to-slate-700", suffix: "" },
  { key: "waitingPatients", label: "En attente", icon: Clock3, accent: "from-blue-600 to-cyan-500", suffix: "" },
  { key: "urgentPatients", label: "Cas prioritaires", icon: AlertTriangle, accent: "from-rose-600 to-orange-500", suffix: "" },
  { key: "avgWaitingMinutes", label: "Attente moyenne", icon: Waves, accent: "from-emerald-600 to-teal-500", suffix: " min" },
];

const signalOptions: Array<{ key: keyof Pick<AssessmentState, "canWalk" | "hasBleeding" | "hasSevereBleeding" | "hasBreathingDifficulty" | "hasChestPain" | "hasNeurologicalDeficit" | "hasLossOfConsciousness" | "hasHighFever" | "hasTrauma" | "isPregnant">; label: string; helper: string }> = [
  { key: "canWalk", label: "Le patient peut marcher", helper: "Mobilité autonome à l’arrivée" },
  { key: "hasBleeding", label: "Saignement actif", helper: "Présence de saignement en cours" },
  { key: "hasSevereBleeding", label: "Hémorragie sévère", helper: "Saignement majeur ou non contrôlé" },
  { key: "hasBreathingDifficulty", label: "Difficulté respiratoire", helper: "Dyspnée ou détresse respiratoire" },
  { key: "hasChestPain", label: "Douleur thoracique", helper: "Oppression ou douleur aiguë thoracique" },
  { key: "hasNeurologicalDeficit", label: "Déficit neurologique", helper: "Trouble moteur, parole ou asymétrie faciale" },
  { key: "hasLossOfConsciousness", label: "Perte de connaissance", helper: "Malaise avec altération de conscience" },
  { key: "hasHighFever", label: "Fièvre élevée", helper: "Température ou syndrome infectieux marqué" },
  { key: "hasTrauma", label: "Traumatisme récent", helper: "Chute, choc ou mécanisme traumatique" },
  { key: "isPregnant", label: "Grossesse connue", helper: "Contexte obstétrical identifié" },
];

const initialIdentityState: IdentityState = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  socialSecurityNumber: "",
};

const initialAssessmentState: AssessmentState = {
  chiefComplaint: "",
  symptomSummary: "",
  painLevel: 4,
  canWalk: true,
  hasBleeding: false,
  hasSevereBleeding: false,
  hasBreathingDifficulty: false,
  hasChestPain: false,
  hasNeurologicalDeficit: false,
  hasLossOfConsciousness: false,
  hasHighFever: false,
  hasTrauma: false,
  isPregnant: false,
  oxygenSaturation: "",
  heartRate: "",
  respiratoryRate: "",
  systolicBloodPressure: "",
};

const initialStaffingState: StaffingState = {
  doctorsOnDuty: "4",
  nursesOnDuty: "8",
  availableDoctors: "2",
  availableNurses: "5",
  waitingPatients: "9",
  activeCriticalPatients: "1",
  notes: "Charge modérée à élevée en début de soirée.",
};

function parseNullableNumber(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRequiredNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDate(value: string | number | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Impossible de lire le fichier."));
    reader.readAsDataURL(file);
  });
}

function buildStaffingPayload(staffing: StaffingState) {
  return {
    doctorsOnDuty: parseRequiredNumber(staffing.doctorsOnDuty, 1),
    nursesOnDuty: parseRequiredNumber(staffing.nursesOnDuty, 1),
    availableDoctors: parseRequiredNumber(staffing.availableDoctors, 1),
    availableNurses: parseRequiredNumber(staffing.availableNurses, 1),
    waitingPatients: parseRequiredNumber(staffing.waitingPatients, 0),
    activeCriticalPatients: parseRequiredNumber(staffing.activeCriticalPatients, 0),
    notes: staffing.notes,
  };
}

function StaffPage() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [intakeMethod, setIntakeMethod] = useState<IntakeMethod>("ocr");
  const [preferredLanguage, setPreferredLanguage] = useState("fr");
  const [identity, setIdentity] = useState<IdentityState>(initialIdentityState);
  const [assessment, setAssessment] = useState<AssessmentState>(initialAssessmentState);
  const [mobileNumber, setMobileNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [identityFileName, setIdentityFileName] = useState("");
  const [identityImageDataUrl, setIdentityImageDataUrl] = useState("");
  const [voiceAudioDataUrl, setVoiceAudioDataUrl] = useState("");
  const [voiceFileName, setVoiceFileName] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [staffing, setStaffing] = useState<StaffingState>(initialStaffingState);
  const [qrLabel, setQrLabel] = useState("QR Hall principal");
  const [generatedQrLink, setGeneratedQrLink] = useState("");
  const [manualP1Reason, setManualP1Reason] = useState("Suspicion de détresse vitale ou décision clinique immédiate.");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const utils = trpc.useUtils();
  const bootstrapQuery = trpc.triage.staffBootstrap.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 10_000,
  });

  const updateStaffingMutation = trpc.triage.updateStaffing.useMutation({
    onSuccess: async () => {
      toast.success("Ressources opérationnelles mises à jour.");
      await utils.triage.staffBootstrap.invalidate();
      await utils.triage.dashboard.invalidate();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue."),
  });

  const createFormLinkMutation = trpc.triage.createFormLink.useMutation({
    onSuccess: async (result) => {
      setGeneratedQrLink(result.patientUrl);
      toast.success("Lien patient généré pour le QR code.");
      await utils.triage.staffBootstrap.invalidate();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue."),
  });

  const createStaffCaseMutation = trpc.triage.createStaffCase.useMutation({
    onSuccess: async (result) => {
      toast.success(`Dossier créé · ${result.assessment.label}`);
      setIdentity(initialIdentityState);
      setAssessment(initialAssessmentState);
      setPreferredLanguage("fr");
      setMobileNumber("");
      setNotes("");
      setIdentityFileName("");
      setIdentityImageDataUrl("");
      setVoiceAudioDataUrl("");
      setVoiceFileName("");
      await utils.triage.staffBootstrap.invalidate();
      setLocation("/staff/tableau-de-bord");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue."),
  });

  const createManualP1Mutation = trpc.triage.createManualP1Case.useMutation({
    onSuccess: async () => {
      toast.success("Patient critique ajouté en P1 sans attente d’analyse IA.");
      await utils.triage.staffBootstrap.invalidate();
      setLocation("/staff/tableau-de-bord");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue."),
  });

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const [matchStaffNew] = useRoute("/staff/nouveau-dossier");
  const [matchStaffBoard] = useRoute("/staff/tableau-de-bord");
  const [matchStaffProtocols] = useRoute("/staff/protocoles");

  const activeView = useMemo(() => {
    if (matchStaffNew) return "new";
    if (matchStaffBoard) return "board";
    if (matchStaffProtocols) return "protocols";
    return "overview";
  }, [matchStaffBoard, matchStaffNew, matchStaffProtocols]);

  const dashboard = bootstrapQuery.data as StaffBootstrapPayload | undefined;
  const topPriorityCase = dashboard?.cases?.[0] ?? null;

  async function handleIdentityFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setIdentityImageDataUrl(dataUrl);
      setIdentityFileName(file.name);
      toast.success("Document d’identité prêt pour l’analyse OCR." );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lecture du fichier impossible.");
    }
  }

  async function handleAudioFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setVoiceAudioDataUrl(dataUrl);
      setVoiceFileName(file.name);
      toast.success("Fichier audio prêt pour la transcription.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lecture du fichier audio impossible.");
    }
  }

  async function startVoiceRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], `triage-voice-${Date.now()}.webm`, { type: blob.type });
        const dataUrl = await readFileAsDataUrl(file);
        setVoiceAudioDataUrl(dataUrl);
        setVoiceFileName(file.name);
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      toast.success("Enregistrement vocal démarré.");
    } catch {
      toast.error("Impossible d’accéder au microphone sur cet appareil.");
    }
  }

  function stopVoiceRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    toast.success("Enregistrement arrêté. Le fichier est prêt.");
  }

  function updateIdentity<K extends keyof IdentityState>(key: K, value: IdentityState[K]) {
    setIdentity((current) => ({ ...current, [key]: value }));
  }

  function updateAssessment<K extends keyof AssessmentState>(key: K, value: AssessmentState[K]) {
    setAssessment((current) => ({ ...current, [key]: value }));
  }

  function updateStaffing<K extends keyof StaffingState>(key: K, value: StaffingState[K]) {
    setStaffing((current) => ({ ...current, [key]: value }));
  }

  async function submitStaffCase() {
    if (!assessment.chiefComplaint || !assessment.symptomSummary) {
      toast.error("Veuillez compléter le motif de consultation et le résumé clinique.");
      return;
    }

    if (intakeMethod === "ocr" && !identityImageDataUrl) {
      toast.error("Veuillez ajouter une pièce d’identité à analyser.");
      return;
    }

    if (intakeMethod === "vocal" && !voiceAudioDataUrl) {
      toast.error("Veuillez enregistrer ou téléverser un audio.");
      return;
    }

    if (intakeMethod === "manuel" && (!identity.firstName || !identity.lastName || !identity.dateOfBirth)) {
      toast.error("Veuillez renseigner les informations d’identité requises.");
      return;
    }

    await createStaffCaseMutation.mutateAsync({
      intakeMethod,
      identity,
      identityImageDataUrl: identityImageDataUrl || undefined,
      voiceAudioDataUrl: voiceAudioDataUrl || undefined,
      preferredLanguage,
      mobileNumber,
      notes,
      staffing: buildStaffingPayload(staffing),
      skipAiAnalysis: false,
      manualPriority: null,
      manualReason: "",
      assessment: {
        ...assessment,
        oxygenSaturation: parseNullableNumber(assessment.oxygenSaturation),
        heartRate: parseNullableNumber(assessment.heartRate),
        respiratoryRate: parseNullableNumber(assessment.respiratoryRate),
        systolicBloodPressure: parseNullableNumber(assessment.systolicBloodPressure),
      },
    });
  }

  async function submitManualP1() {
    await createManualP1Mutation.mutateAsync({
      intakeMethod,
      identity,
      identityImageDataUrl: identityImageDataUrl || undefined,
      voiceAudioDataUrl: voiceAudioDataUrl || undefined,
      preferredLanguage,
      mobileNumber,
      notes,
      staffing: buildStaffingPayload(staffing),
      manualReason: manualP1Reason,
      chiefComplaint: assessment.chiefComplaint || "Admission critique immédiate",
      symptomSummary:
        assessment.symptomSummary ||
        "Prise en charge manuelle P1 décidée par le personnel soignant avant collecte clinique complète.",
    });
  }

  async function saveStaffingSnapshot() {
    await updateStaffingMutation.mutateAsync(buildStaffingPayload(staffing));
  }

  async function generatePatientLink() {
    await createFormLinkMutation.mutateAsync({
      label: qrLabel,
      origin: window.location.origin,
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-lg">
          <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
          Chargement de l’espace personnel…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] p-6">
        <div className="mx-auto flex min-h-[80vh] max-w-5xl items-center justify-center">
          <Card className="w-full max-w-3xl rounded-[2rem] border-white/70 bg-white/90 shadow-[0_30px_100px_rgba(15,23,42,0.12)]">
            <CardHeader className="space-y-4 p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 text-white">
                <UserCog className="h-8 w-8" />
              </div>
              <Badge className="mx-auto rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 hover:bg-emerald-100">
                Accès personnel soignant
              </Badge>
              <CardTitle className="text-3xl text-slate-950">Espace clinique sécurisé</CardTitle>
              <CardDescription className="mx-auto max-w-2xl text-base leading-7 text-slate-600">
                Cette page donne un accès complet aux équipes soignantes : triage assisté par IA, ajout manuel P1, pilotage des ressources humaines, génération du QR code patient et supervision du flux d’attente.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 p-8 pt-0">
              <Button className="h-12 rounded-2xl bg-slate-950 px-6 text-white hover:bg-slate-800" onClick={() => {
                window.location.href = getLoginUrl();
              }}>
                Se connecter comme personnel
              </Button>
              <p className="text-sm text-slate-500">Le formulaire patient public reste séparé et accessible uniquement via lien ou QR code.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 lg:gap-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_26%),radial-gradient(circle_at_85%_12%,_rgba(59,130,246,0.14),_transparent_24%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(241,245,249,0.94))] p-5 shadow-[0_30px_90px_rgba(15,23,42,0.08)] sm:p-7 xl:p-8">
          <div className="absolute inset-x-6 top-5 flex justify-end sm:inset-x-auto sm:right-5">
            <div className="rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur">
              Accès complet personnel · tablette & smartphone
            </div>
          </div>

          <div className="grid gap-4 pt-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(272px,328px)] lg:items-start lg:gap-5 lg:pt-0 xl:grid-cols-[minmax(0,1.04fr)_minmax(292px,344px)] xl:gap-6">
            <div className="min-w-0 max-w-[42rem]">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-slate-950 px-3 py-1 text-white hover:bg-slate-950">Version 2 · IA + capacitaire</Badge>
                <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">2 parcours séparés</Badge>
              </div>
              <h1 className="mt-4 max-w-[18ch] text-balance text-[1.8rem] font-semibold leading-[1.03] tracking-[-0.04em] text-slate-950 sm:text-[2.1rem] lg:text-[2.35rem] xl:text-[2.55rem]">
                Triage urgentiste avec accès personnel et formulaire patient par QR code.
              </h1>
              <p className="mt-3 max-w-[38rem] text-sm leading-7 text-slate-600 sm:text-[15px] sm:leading-7">
                L’analyse croise signaux cliniques, identité, transcription vocale et pression opérationnelle en fonction de la file active et des soignants disponibles.
              </p>
              <div className="mt-4 grid gap-2.5 md:grid-cols-3 lg:max-w-[39rem]">
                <div className="rounded-[1.35rem] border border-white/70 bg-white/75 p-3.5 shadow-[0_14px_34px_rgba(15,23,42,0.045)] lg:min-h-[9.5rem]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Personnel</p>
                  <p className="mt-1.5 text-sm font-medium leading-6 text-slate-900">Accès complet et sécurisé à toute l’application</p>
                </div>
                <div className="rounded-[1.35rem] border border-white/70 bg-white/75 p-3.5 shadow-[0_14px_34px_rgba(15,23,42,0.045)] lg:min-h-[9.5rem]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Patient</p>
                  <p className="mt-1.5 text-sm font-medium leading-6 text-slate-900">Formulaire public uniquement via QR code</p>
                </div>
                <div className="rounded-[1.35rem] border border-white/70 bg-white/75 p-3.5 shadow-[0_14px_34px_rgba(15,23,42,0.045)] lg:min-h-[9.5rem]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">P1 manuel</p>
                  <p className="mt-1.5 text-sm font-medium leading-6 text-slate-900">Admission critique sans attendre l’IA ni les symptômes complets</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:max-w-[39rem] xl:grid-cols-3">
                <Button className="h-12 justify-center rounded-2xl bg-slate-950 px-6 text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800" onClick={() => setLocation("/staff/nouveau-dossier")}>
                  Créer un dossier personnel
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline" className="h-12 justify-center rounded-2xl border-white/80 bg-white/80 px-6 shadow-sm hover:bg-white" onClick={() => setLocation("/staff/tableau-de-bord")}>
                  Ouvrir le tableau de bord
                </Button>
                <Button variant="outline" className="h-12 justify-center rounded-2xl border-white/80 bg-white/80 px-6 shadow-sm hover:bg-white xl:col-span-1 sm:col-span-2" onClick={logout}>
                  Déconnexion
                </Button>
              </div>
            </div>

            <div className="grid auto-rows-[minmax(0,1fr)] gap-2.5 sm:grid-cols-2 lg:max-w-[20.75rem] lg:justify-self-end lg:pt-1 xl:max-w-[22rem]">
              {statCards.map((card) => {
                const value = dashboard?.summary?.[card.key] ?? 0;
                return (
                    <Card key={card.key} className="rounded-[1.35rem] border-white/70 bg-white/82 shadow-[0_16px_36px_rgba(15,23,42,0.055)] backdrop-blur">
                    <CardContent className="flex h-full min-h-[10.6rem] flex-col p-4 sm:p-5">
                      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-[1rem] bg-gradient-to-br ${card.accent} text-white shadow-lg`}>
                        <card.icon className="h-4.5 w-4.5" />
                      </div>
                      <p className="mt-2.5 text-sm text-slate-500">{card.label}</p>
                      <p className="mt-1 text-[1.8rem] font-semibold tracking-tight text-slate-950 sm:text-[1.75rem]">
                        {value}
                        {card.suffix}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {bootstrapQuery.isLoading ? (
          <Card className="rounded-[1.8rem] border-white/60 bg-white/80 p-8 shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3 text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              Chargement du tableau de bord clinique…
            </div>
          </Card>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_390px]">
          <div className="space-y-5">
            {(activeView === "overview" || activeView === "new") && (
              <Card className="overflow-hidden rounded-[1.9rem] border-white/70 bg-white/85 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <CardHeader className="border-b border-slate-100/80 p-5 sm:p-7">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 hover:bg-emerald-100">Admission personnel</Badge>
                    <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-600">IA avancée + règles</Badge>
                    <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">Override P1 immédiat</Badge>
                  </div>
                  <CardTitle className="mt-4 text-2xl text-slate-950">Créer un dossier de triage</CardTitle>
                  <CardDescription className="text-base leading-7 text-slate-600">
                    Le personnel soignant choisit le mode de saisie, renseigne les constantes et peut forcer une priorité P1 sans attendre que le patient fournisse l’ensemble des données.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-5 sm:p-7">
                  <Tabs value={intakeMethod} onValueChange={(value) => setIntakeMethod(value as IntakeMethod)}>
                    <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-slate-100 p-1">
                      <TabsTrigger value="ocr" className="rounded-2xl py-3">OCR</TabsTrigger>
                      <TabsTrigger value="manuel" className="rounded-2xl py-3">Manuel</TabsTrigger>
                      <TabsTrigger value="vocal" className="rounded-2xl py-3">Vocal</TabsTrigger>
                    </TabsList>

                    <TabsContent value="ocr" className="mt-5">
                      <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-slate-50/80 p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                            <FileBadge className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-slate-900">Scan de carte d’identité</h3>
                            <p className="mt-1 text-sm leading-6 text-slate-500">Téléversez la pièce du patient pour extraction structurée côté serveur, avec correction manuelle possible.</p>
                          </div>
                        </div>
                        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
                          <Input type="file" accept="image/*" onChange={handleIdentityFile} className="rounded-2xl bg-white" />
                          <Button type="button" variant="outline" className="rounded-2xl bg-white" onClick={() => toast.info("Le document sera analysé lors de l’enregistrement du dossier.") }>
                            <Upload className="mr-2 h-4 w-4" />
                            Préparer l’analyse
                          </Button>
                        </div>
                        {identityFileName ? <p className="mt-3 text-sm text-slate-500">Document sélectionné : {identityFileName}</p> : null}
                      </div>
                    </TabsContent>

                    <TabsContent value="manuel" className="mt-5">
                      <Alert className="rounded-[1.6rem] border-blue-200 bg-blue-50/80">
                        <UserPlus className="h-4 w-4" />
                        <AlertTitle>Saisie manuelle immédiate</AlertTitle>
                        <AlertDescription>Mode recommandé lorsque le personnel saisit rapidement l’identité et les signes cliniques dès l’accueil.</AlertDescription>
                      </Alert>
                    </TabsContent>

                    <TabsContent value="vocal" className="mt-5">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_270px]">
                        <div className="rounded-[1.6rem] border border-amber-200 bg-amber-50/70 p-5">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                              <AudioLines className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-slate-900">Transcription vocale</h3>
                              <p className="mt-1 text-sm leading-6 text-slate-500">Capture de la voix du patient ou d’un agent d’accueil pour extraire l’identité et le contexte clinique.</p>
                            </div>
                          </div>
                          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                            <Input type="file" accept="audio/*" onChange={handleAudioFile} className="rounded-2xl bg-white" />
                            <Button type="button" onClick={isRecording ? stopVoiceRecording : startVoiceRecording} className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
                              {isRecording ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                              {isRecording ? "Arrêter" : "Enregistrer"}
                            </Button>
                          </div>
                          {voiceFileName ? <p className="mt-3 text-sm text-slate-500">Audio prêt : {voiceFileName}</p> : null}
                        </div>
                        <Alert className="rounded-[1.6rem] border-amber-200 bg-white">
                          <BrainCircuit className="h-4 w-4" />
                          <AlertTitle>Langues terrain</AlertTitle>
                          <AlertDescription>Préparation compatible avec le français, l’arabe, la darija et l’anglais selon le contexte d’accueil.</AlertDescription>
                        </Alert>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Prénom</Label>
                      <Input value={identity.firstName} onChange={(event) => updateIdentity("firstName", event.target.value)} className="rounded-2xl bg-white" placeholder="Prénom" />
                    </div>
                    <div className="space-y-2">
                      <Label>Nom</Label>
                      <Input value={identity.lastName} onChange={(event) => updateIdentity("lastName", event.target.value)} className="rounded-2xl bg-white" placeholder="Nom" />
                    </div>
                    <div className="space-y-2">
                      <Label>Date de naissance</Label>
                      <Input value={identity.dateOfBirth} onChange={(event) => updateIdentity("dateOfBirth", event.target.value)} className="rounded-2xl bg-white" placeholder="YYYY-MM-DD" />
                    </div>
                    <div className="space-y-2">
                      <Label>Numéro d’identité / sécu</Label>
                      <Input value={identity.socialSecurityNumber} onChange={(event) => updateIdentity("socialSecurityNumber", event.target.value)} className="rounded-2xl bg-white" placeholder="Numéro" />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_420px]">
                    <div className="space-y-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <Label>Motif de consultation</Label>
                          <Input value={assessment.chiefComplaint} onChange={(event) => updateAssessment("chiefComplaint", event.target.value)} className="rounded-2xl bg-white" placeholder="Ex. douleur thoracique, chute, fièvre, détresse respiratoire" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Résumé clinique</Label>
                          <Textarea value={assessment.symptomSummary} onChange={(event) => updateAssessment("symptomSummary", event.target.value)} className="min-h-[140px] rounded-2xl bg-white" placeholder="Décrire les symptômes, leur apparition, leur évolution et les signes associés." />
                        </div>
                        <div className="space-y-2">
                          <Label>Niveau de douleur</Label>
                          <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 px-4 py-4">
                            <input type="range" min={0} max={10} value={assessment.painLevel} onChange={(event) => updateAssessment("painLevel", Number(event.target.value))} className="w-full accent-slate-950" />
                            <p className="mt-3 text-sm text-slate-500">Score actuel : <span className="font-semibold text-slate-900">{assessment.painLevel}/10</span></p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Langue prioritaire</Label>
                          <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
                            <SelectTrigger className="rounded-2xl bg-white"><SelectValue placeholder="Choisir" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fr">Français</SelectItem>
                              <SelectItem value="ar">Arabe</SelectItem>
                              <SelectItem value="darija">Darija</SelectItem>
                              <SelectItem value="en">English</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Téléphone mobile</Label>
                          <Input value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} className="rounded-2xl bg-white" placeholder="Optionnel" />
                        </div>
                        <div className="space-y-2">
                          <Label>Notes d’accueil</Label>
                          <Input value={notes} onChange={(event) => setNotes(event.target.value)} className="rounded-2xl bg-white" placeholder="Observations initiales" />
                        </div>
                        <div className="space-y-2">
                          <Label>SpO₂</Label>
                          <Input value={assessment.oxygenSaturation} onChange={(event) => updateAssessment("oxygenSaturation", event.target.value)} className="rounded-2xl bg-white" placeholder="Ex. 96" />
                        </div>
                        <div className="space-y-2">
                          <Label>Fréquence cardiaque</Label>
                          <Input value={assessment.heartRate} onChange={(event) => updateAssessment("heartRate", event.target.value)} className="rounded-2xl bg-white" placeholder="Ex. 110" />
                        </div>
                        <div className="space-y-2">
                          <Label>Fréquence respiratoire</Label>
                          <Input value={assessment.respiratoryRate} onChange={(event) => updateAssessment("respiratoryRate", event.target.value)} className="rounded-2xl bg-white" placeholder="Ex. 24" />
                        </div>
                        <div className="space-y-2">
                          <Label>TAS</Label>
                          <Input value={assessment.systolicBloodPressure} onChange={(event) => updateAssessment("systolicBloodPressure", event.target.value)} className="rounded-2xl bg-white" placeholder="Ex. 100" />
                        </div>
                      </div>

                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <HeartPulse className="h-4 w-4 text-rose-600" />
                          <p className="text-sm font-semibold text-slate-900">Signaux cliniques de gravité</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {signalOptions.map((option) => {
                            const checked = Boolean(assessment[option.key]);
                            return (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => updateAssessment(option.key, !checked as AssessmentState[typeof option.key])}
                                className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${checked ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"}`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="font-medium">{option.label}</p>
                                  {checked ? <CheckCircle2 className="h-4 w-4" /> : null}
                                </div>
                                <p className={`mt-2 text-sm leading-6 ${checked ? "text-white/80" : "text-slate-500"}`}>{option.helper}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <Card className="rounded-[1.6rem] border-slate-200 bg-slate-50/70 shadow-none">
                        <CardHeader>
                          <CardTitle className="text-lg text-slate-950">Capacité opérationnelle</CardTitle>
                          <CardDescription>L’IA pondère la priorisation selon les ressources réellement disponibles.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2"><Label>Médecins en poste</Label><Input value={staffing.doctorsOnDuty} onChange={(event) => updateStaffing("doctorsOnDuty", event.target.value)} className="rounded-2xl bg-white" /></div>
                          <div className="space-y-2"><Label>Infirmiers en poste</Label><Input value={staffing.nursesOnDuty} onChange={(event) => updateStaffing("nursesOnDuty", event.target.value)} className="rounded-2xl bg-white" /></div>
                          <div className="space-y-2"><Label>Médecins disponibles</Label><Input value={staffing.availableDoctors} onChange={(event) => updateStaffing("availableDoctors", event.target.value)} className="rounded-2xl bg-white" /></div>
                          <div className="space-y-2"><Label>Infirmiers disponibles</Label><Input value={staffing.availableNurses} onChange={(event) => updateStaffing("availableNurses", event.target.value)} className="rounded-2xl bg-white" /></div>
                          <div className="space-y-2"><Label>Patients en attente</Label><Input value={staffing.waitingPatients} onChange={(event) => updateStaffing("waitingPatients", event.target.value)} className="rounded-2xl bg-white" /></div>
                          <div className="space-y-2"><Label>Patients critiques actifs</Label><Input value={staffing.activeCriticalPatients} onChange={(event) => updateStaffing("activeCriticalPatients", event.target.value)} className="rounded-2xl bg-white" /></div>
                          <div className="space-y-2 sm:col-span-2"><Label>Notes service</Label><Textarea value={staffing.notes} onChange={(event) => updateStaffing("notes", event.target.value)} className="min-h-[90px] rounded-2xl bg-white" /></div>
                          <Button type="button" variant="outline" className="sm:col-span-2 rounded-2xl bg-white" onClick={saveStaffingSnapshot} disabled={updateStaffingMutation.isPending}>
                            {updateStaffingMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}Enregistrer l’état du service
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="rounded-[1.6rem] border-rose-200 bg-rose-50/60 shadow-none">
                        <CardHeader>
                          <CardTitle className="text-lg text-rose-800">Ajout manuel P1</CardTitle>
                          <CardDescription>Décision soignante immédiate sans attendre l’étude IA, même si le patient n’a pas encore tout donné.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2"><Label>Motif de l’override</Label><Textarea value={manualP1Reason} onChange={(event) => setManualP1Reason(event.target.value)} className="min-h-[110px] rounded-2xl bg-white" /></div>
                          <Button type="button" className="w-full rounded-2xl bg-rose-600 text-white hover:bg-rose-500" onClick={submitManualP1} disabled={createManualP1Mutation.isPending}>
                            {createManualP1Mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}Créer directement un patient P1
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Alert className="rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 sm:max-w-2xl">
                      <ShieldCheck className="h-4 w-4" />
                      <AlertTitle>Validation humaine obligatoire</AlertTitle>
                      <AlertDescription>La priorité proposée par l’IA reste un support d’aide. La décision finale appartient toujours au personnel médical.</AlertDescription>
                    </Alert>
                    <Button className="h-12 rounded-2xl bg-slate-950 px-6 text-white hover:bg-slate-800" onClick={submitStaffCase} disabled={createStaffCaseMutation.isPending}>
                      {createStaffCaseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Stethoscope className="mr-2 h-4 w-4" />}Enregistrer avec analyse IA
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {(activeView === "overview" || activeView === "board") && (
              <Card className="rounded-[1.9rem] border-white/70 bg-white/85 shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
                <CardHeader className="p-5 sm:p-7">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge className="rounded-full bg-slate-950 px-3 py-1 text-white hover:bg-slate-950">File active</Badge>
                    <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">Tri par priorité et attente</Badge>
                  </div>
                  <CardTitle className="mt-4 text-2xl text-slate-950">Tableau de bord des patients</CardTitle>
                  <CardDescription className="text-base leading-7 text-slate-600">Vue temps réel des patients en attente, des admissions P1 et des dossiers issus du QR code public.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto px-5 pb-5 sm:px-7 sm:pb-7">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Patient</TableHead>
                          <TableHead>Priorité</TableHead>
                          <TableHead>Entrée</TableHead>
                          <TableHead>Rang</TableHead>
                          <TableHead>Attente</TableHead>
                          <TableHead>Motif</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(dashboard?.cases ?? []).map((row: DashboardCase) => (
                          <TableRow key={row.triageCaseId}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-slate-900">{row.patientFirstName} {row.patientLastName}</p>
                                <p className="text-xs text-slate-500">{row.intakeSource === "patient_qr" ? "QR patient" : intakeLabels[row.intakeMethod]}</p>
                              </div>
                            </TableCell>
                            <TableCell><Badge className={`rounded-full border ${priorityClasses[row.priority]}`}>{priorityLabels[row.priority]}</Badge></TableCell>
                            <TableCell>{row.entryMode === "manual_p1" ? "P1 manuel" : row.entryMode === "manual_staff" ? "Override manuel" : "IA assistée"}</TableCell>
                            <TableCell>#{row.queueRank}</TableCell>
                            <TableCell>{row.waitingTimeMinutes} min</TableCell>
                            <TableCell className="max-w-[280px] truncate">{row.chiefComplaint}</TableCell>
                            <TableCell><Badge variant="outline" className="rounded-full">{row.status.replaceAll("_", " ")}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {(activeView === "overview" || activeView === "protocols") && dashboard?.protocolSummary ? (
              <Card className="rounded-[1.9rem] border-white/70 bg-white/85 shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
                <CardHeader className="p-5 sm:p-7">
                  <CardTitle className="text-2xl text-slate-950">Cadre clinique du prototype</CardTitle>
                  <CardDescription className="text-base leading-7 text-slate-600">{dashboard.protocolSummary.description}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 p-5 pt-0 sm:grid-cols-2 sm:p-7 sm:pt-0 xl:grid-cols-4">
                  {dashboard.protocolSummary.levels.map((level) => (
                    <div key={level.code} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{level.code}</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">{level.label}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-500">{level.description}</p>
                      <p className="mt-4 text-sm font-medium text-slate-700">Cible : {level.targetMinutes} min</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-5">
            <Card className="rounded-[1.9rem] border-white/70 bg-white/85 shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl text-slate-950">QR code patient</CardTitle>
                    <CardDescription>Créer un lien public limité au formulaire patient uniquement.</CardDescription>
                  </div>
                  <QrCode className="h-5 w-5 text-slate-500" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Libellé du point d’entrée</Label>
                  <Input value={qrLabel} onChange={(event) => setQrLabel(event.target.value)} className="rounded-2xl bg-white" />
                </div>
                <Button className="w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800" onClick={generatePatientLink} disabled={createFormLinkMutation.isPending}>
                  {createFormLinkMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}Générer le lien patient
                </Button>
                {generatedQrLink ? (
                  <Alert className="rounded-[1.5rem] border-emerald-200 bg-emerald-50/80">
                    <Sparkles className="h-4 w-4" />
                    <AlertTitle>Lien prêt pour QR code</AlertTitle>
                    <AlertDescription>
                      <span className="break-all">{generatedQrLink}</span>
                    </AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-[1.9rem] border-white/70 bg-white/85 shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
              <CardHeader>
                <CardTitle className="text-xl text-slate-950">Cas prioritaire en tête</CardTitle>
                <CardDescription>Lecture rapide du dossier le plus urgent actuellement affiché.</CardDescription>
              </CardHeader>
              <CardContent>
                {topPriorityCase ? (
                  <div className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-5">
                    <Badge className={`rounded-full border ${priorityClasses[topPriorityCase.priority]}`}>{priorityLabels[topPriorityCase.priority]}</Badge>
                    <div>
                      <p className="text-lg font-semibold text-slate-950">{topPriorityCase.patientFirstName} {topPriorityCase.patientLastName}</p>
                      <p className="text-sm text-slate-500">{topPriorityCase.chiefComplaint}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Action</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">{topPriorityCase.recommendedAction}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Référence</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">{topPriorityCase.protocolReference}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Aucun cas chargé pour le moment.</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[1.9rem] border-white/70 bg-white/85 shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
              <CardHeader>
                <CardTitle className="text-xl text-slate-950">Notifications</CardTitle>
                <CardDescription>Alertes générées pour les cas urgents et critiques.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(dashboard?.notifications ?? []).map((notification: DashboardNotification) => (
                  <div key={notification.id} className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Badge className={`rounded-full border ${notification.severity === "critical" ? priorityClasses.urgence_vitale : notification.severity === "urgent" ? priorityClasses.urgence : "border-slate-200 bg-slate-100 text-slate-700"}`}>{notification.severity}</Badge>
                      <span className="text-xs text-slate-400">{formatDate(notification.createdAt)}</span>
                    </div>
                    <p className="mt-3 font-medium text-slate-900">{notification.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{notification.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="rounded-[1.9rem] border-white/70 bg-white/85 shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
          <CardHeader>
            <CardTitle className="text-xl text-slate-950">Patients actifs pour le staff</CardTitle>
            <CardDescription>Vue condensée des admissions en cours pour usage terrain.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(dashboard?.activePatients ?? []).map((row: ActivePatient) => (
              <div key={row.triageCaseId} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{row.patientDisplayName}</p>
                    <p className="text-xs text-slate-500">{row.chiefComplaint}</p>
                  </div>
                  <Badge className={`rounded-full border ${priorityClasses[row.priority]}`}>{priorityLabels[row.priority]}</Badge>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                  <span>Rang #{row.queueRank}</span>
                  <span>{row.waitingTimeMinutes} min</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function PatientPage({ token }: { token: string }) {
  const [intakeMethod, setIntakeMethod] = useState<IntakeMethod>("manuel");
  const [preferredLanguage, setPreferredLanguage] = useState("fr");
  const [identity, setIdentity] = useState<IdentityState>(initialIdentityState);
  const [assessment, setAssessment] = useState<AssessmentState>(initialAssessmentState);
  const [mobileNumber, setMobileNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [identityFileName, setIdentityFileName] = useState("");
  const [identityImageDataUrl, setIdentityImageDataUrl] = useState("");
  const [voiceAudioDataUrl, setVoiceAudioDataUrl] = useState("");
  const [voiceFileName, setVoiceFileName] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const bootstrapQuery = trpc.triage.patientFormBootstrap.useQuery({ token }, { staleTime: 10_000 });
  const submitMutation = trpc.triage.submitPatientCase.useMutation({
    onSuccess: () => {
      toast.success("Votre demande a été transmise à l’équipe soignante.");
      setIdentity(initialIdentityState);
      setAssessment(initialAssessmentState);
      setMobileNumber("");
      setNotes("");
      setIdentityFileName("");
      setIdentityImageDataUrl("");
      setVoiceAudioDataUrl("");
      setVoiceFileName("");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue."),
  });

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function handleIdentityFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setIdentityImageDataUrl(dataUrl);
      setIdentityFileName(file.name);
      toast.success("Document prêt pour vérification à l’accueil.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lecture du fichier impossible.");
    }
  }

  async function handleAudioFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setVoiceAudioDataUrl(dataUrl);
      setVoiceFileName(file.name);
      toast.success("Audio prêt pour transcription.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lecture du fichier audio impossible.");
    }
  }

  async function startVoiceRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], `patient-voice-${Date.now()}.webm`, { type: blob.type });
        const dataUrl = await readFileAsDataUrl(file);
        setVoiceAudioDataUrl(dataUrl);
        setVoiceFileName(file.name);
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast.error("Impossible d’accéder au microphone.");
    }
  }

  function stopVoiceRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  function updateIdentity<K extends keyof IdentityState>(key: K, value: IdentityState[K]) {
    setIdentity((current) => ({ ...current, [key]: value }));
  }

  function updateAssessment<K extends keyof AssessmentState>(key: K, value: AssessmentState[K]) {
    setAssessment((current) => ({ ...current, [key]: value }));
  }

  async function submitPatientForm() {
    if (!assessment.chiefComplaint || !assessment.symptomSummary) {
      toast.error("Veuillez compléter le motif et le résumé des symptômes.");
      return;
    }

    if (intakeMethod === "ocr" && !identityImageDataUrl) {
      toast.error("Veuillez ajouter votre pièce d’identité.");
      return;
    }

    if (intakeMethod === "vocal" && !voiceAudioDataUrl) {
      toast.error("Veuillez enregistrer ou importer un audio.");
      return;
    }

    if (intakeMethod === "manuel" && (!identity.firstName || !identity.lastName || !identity.dateOfBirth)) {
      toast.error("Veuillez renseigner votre identité minimale.");
      return;
    }

    await submitMutation.mutateAsync({
      token,
      intakeMethod,
      identity,
      identityImageDataUrl: identityImageDataUrl || undefined,
      voiceAudioDataUrl: voiceAudioDataUrl || undefined,
      preferredLanguage,
      mobileNumber,
      notes,
      assessment: {
        ...assessment,
        oxygenSaturation: parseNullableNumber(assessment.oxygenSaturation),
        heartRate: parseNullableNumber(assessment.heartRate),
        respiratoryRate: parseNullableNumber(assessment.respiratoryRate),
        systolicBloodPressure: parseNullableNumber(assessment.systolicBloodPressure),
      },
    });
  }

  const bootstrap = bootstrapQuery.data as PatientBootstrapPayload | undefined;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full bg-slate-950 px-3 py-1 text-white hover:bg-slate-950">Parcours patient</Badge>
            <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">Accès via QR code</Badge>
          </div>
          <h1 className="mt-5 max-w-3xl text-[2.1rem] font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-[2.8rem]">
            Pré-enregistrez votre dossier avant l’évaluation par l’équipe soignante.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
            Cette page sert uniquement à collecter vos informations d’identité et votre motif de consultation. La priorité finale est confirmée ensuite par le personnel médical.
          </p>
          {bootstrap?.link ? (
            <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
              Point d’entrée : <span className="font-semibold text-slate-900">{bootstrap.link.label}</span>
            </div>
          ) : null}
        </section>

        {bootstrapQuery.isLoading ? (
          <Card className="rounded-[1.8rem] border-white/60 bg-white/90 p-8 shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
            <div className="flex items-center gap-3 text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />Chargement du formulaire patient…</div>
          </Card>
        ) : null}

        <Card className="rounded-[1.9rem] border-white/70 bg-white/90 shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-950">Formulaire patient</CardTitle>
            <CardDescription className="text-base leading-7 text-slate-600">Choisissez votre mode de saisie puis décrivez votre problème de santé le plus précisément possible.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={intakeMethod} onValueChange={(value) => setIntakeMethod(value as IntakeMethod)}>
              <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-slate-100 p-1">
                <TabsTrigger value="manuel" className="rounded-2xl py-3">Manuel</TabsTrigger>
                <TabsTrigger value="ocr" className="rounded-2xl py-3">Scan</TabsTrigger>
                <TabsTrigger value="vocal" className="rounded-2xl py-3">Voix</TabsTrigger>
              </TabsList>

              <TabsContent value="ocr" className="mt-5">
                <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-slate-50/80 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><FileBadge className="h-5 w-5" /></div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">Ajouter une pièce d’identité</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">Le document servira à pré-remplir vos informations avant vérification humaine à l’accueil.</p>
                    </div>
                  </div>
                  <div className="mt-5"><Input type="file" accept="image/*" onChange={handleIdentityFile} className="rounded-2xl bg-white" /></div>
                  {identityFileName ? <p className="mt-3 text-sm text-slate-500">Document sélectionné : {identityFileName}</p> : null}
                </div>
              </TabsContent>

              <TabsContent value="vocal" className="mt-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <Input type="file" accept="audio/*" onChange={handleAudioFile} className="rounded-2xl bg-white" />
                  <Button type="button" onClick={isRecording ? stopVoiceRecording : startVoiceRecording} className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800">
                    {isRecording ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                    {isRecording ? "Arrêter" : "Enregistrer"}
                  </Button>
                </div>
                {voiceFileName ? <p className="mt-3 text-sm text-slate-500">Audio prêt : {voiceFileName}</p> : null}
              </TabsContent>
            </Tabs>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2"><Label>Prénom</Label><Input value={identity.firstName} onChange={(event) => updateIdentity("firstName", event.target.value)} className="rounded-2xl bg-white" /></div>
              <div className="space-y-2"><Label>Nom</Label><Input value={identity.lastName} onChange={(event) => updateIdentity("lastName", event.target.value)} className="rounded-2xl bg-white" /></div>
              <div className="space-y-2"><Label>Date de naissance</Label><Input value={identity.dateOfBirth} onChange={(event) => updateIdentity("dateOfBirth", event.target.value)} className="rounded-2xl bg-white" placeholder="YYYY-MM-DD" /></div>
              <div className="space-y-2"><Label>Numéro d’identité / sécu</Label><Input value={identity.socialSecurityNumber} onChange={(event) => updateIdentity("socialSecurityNumber", event.target.value)} className="rounded-2xl bg-white" /></div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2"><Label>Motif de consultation</Label><Input value={assessment.chiefComplaint} onChange={(event) => updateAssessment("chiefComplaint", event.target.value)} className="rounded-2xl bg-white" placeholder="Ex. douleur thoracique, chute, fièvre" /></div>
              <div className="space-y-2 md:col-span-2"><Label>Résumé des symptômes</Label><Textarea value={assessment.symptomSummary} onChange={(event) => updateAssessment("symptomSummary", event.target.value)} className="min-h-[140px] rounded-2xl bg-white" placeholder="Décrivez ce que vous ressentez, depuis quand et ce qui vous inquiète." /></div>
              <div className="space-y-2"><Label>Niveau de douleur</Label><Input type="number" min={0} max={10} value={assessment.painLevel} onChange={(event) => updateAssessment("painLevel", Number(event.target.value || 0))} className="rounded-2xl bg-white" /></div>
              <div className="space-y-2"><Label>Langue</Label><Select value={preferredLanguage} onValueChange={setPreferredLanguage}><SelectTrigger className="rounded-2xl bg-white"><SelectValue placeholder="Choisir" /></SelectTrigger><SelectContent><SelectItem value="fr">Français</SelectItem><SelectItem value="ar">Arabe</SelectItem><SelectItem value="darija">Darija</SelectItem><SelectItem value="en">English</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Téléphone</Label><Input value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} className="rounded-2xl bg-white" /></div>
              <div className="space-y-2"><Label>Notes complémentaires</Label><Input value={notes} onChange={(event) => setNotes(event.target.value)} className="rounded-2xl bg-white" /></div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-slate-900">Questions guidées</p>
              <div className="grid gap-3 md:grid-cols-2">
                {(bootstrap?.guidedQuestions ?? []).map((question: string) => (
                  <div key={question} className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4 text-sm leading-6 text-slate-600">{question}</div>
                ))}
              </div>
            </div>

            <Alert className="rounded-[1.5rem] border-blue-200 bg-blue-50/80">
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Information importante</AlertTitle>
              <AlertDescription>En cas de détresse vitale immédiate, adressez-vous directement au personnel présent sans attendre la fin du formulaire.</AlertDescription>
            </Alert>

            <Button className="h-12 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800" onClick={submitPatientForm} disabled={submitMutation.isPending || bootstrapQuery.isLoading}>
              {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChevronRight className="mr-2 h-4 w-4" />}Envoyer le formulaire au service
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Home() {
  const [matchPatient, patientParams] = useRoute<{ token: string }>("/patient/:token");

  if (matchPatient && patientParams?.token) {
    return <PatientPage token={patientParams.token} />;
  }

  return <StaffPage />;
}
