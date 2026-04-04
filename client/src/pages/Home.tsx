import DashboardLayout from "@/components/DashboardLayout";
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
  Mic,
  MicOff,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Upload,
  UserPlus,
  Waves,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

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

const statCards = [
  {
    key: "totalPatients",
    label: "Patients suivis",
    icon: UserPlus,
    accent: "from-slate-950 to-slate-700",
    suffix: "",
  },
  {
    key: "waitingPatients",
    label: "En attente",
    icon: Clock3,
    accent: "from-blue-600 to-cyan-500",
    suffix: "",
  },
  {
    key: "urgentPatients",
    label: "Cas prioritaires",
    icon: AlertTriangle,
    accent: "from-rose-600 to-orange-500",
    suffix: "",
  },
  {
    key: "avgWaitingMinutes",
    label: "Attente moyenne",
    icon: Waves,
    accent: "from-emerald-600 to-teal-500",
    suffix: " min",
  },
] as const;

const signalOptions: Array<{ key: keyof AssessmentState; label: string; helper: string }> = [
  { key: "canWalk", label: "Le patient peut marcher", helper: "Mobilité autonome à l’arrivée" },
  { key: "hasBleeding", label: "Saignement actif", helper: "Présence de saignement en cours" },
  { key: "hasSevereBleeding", label: "Hémorragie sévère", helper: "Saignement majeur ou non contrôlé" },
  {
    key: "hasBreathingDifficulty",
    label: "Difficulté respiratoire",
    helper: "Dyspnée, polypnée ou détresse respiratoire",
  },
  { key: "hasChestPain", label: "Douleur thoracique", helper: "Oppression ou douleur aiguë thoracique" },
  {
    key: "hasNeurologicalDeficit",
    label: "Déficit neurologique",
    helper: "Trouble moteur, parole ou asymétrie faciale",
  },
  {
    key: "hasLossOfConsciousness",
    label: "Perte de connaissance",
    helper: "Malaise avec altération de conscience",
  },
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

function parseNullableNumber(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(value: string | number | Date) {
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

export default function Home() {
  const [location, setLocation] = useLocation();
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const utils = trpc.useUtils();
  const bootstrapQuery = trpc.triage.bootstrap.useQuery(undefined, {
    staleTime: 10_000,
  });

  const createCaseMutation = trpc.triage.createCase.useMutation({
    onSuccess: async result => {
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
      await utils.triage.bootstrap.invalidate();
      await utils.triage.dashboard.invalidate();
      setLocation("/tableau-de-bord");
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const dashboard = bootstrapQuery.data;

  const activeView = useMemo(() => {
    if (location === "/nouveau-dossier") return "new";
    if (location === "/tableau-de-bord") return "board";
    if (location === "/protocoles") return "protocols";
    return "overview";
  }, [location]);

  const topPriorityCase = dashboard?.cases?.[0] ?? null;

  async function handleIdentityFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setIdentityImageDataUrl(dataUrl);
      setIdentityFileName(file.name);
      toast.success("Document d’identité prêt pour l’analyse.");
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
      recorder.ondataavailable = event => {
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
        streamRef.current?.getTracks().forEach(track => track.stop());
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
    toast.success("Enregistrement arrêté. Le fichier est prêt pour transcription.");
  }

  function updateAssessment<K extends keyof AssessmentState>(key: K, value: AssessmentState[K]) {
    setAssessment(current => ({ ...current, [key]: value }));
  }

  function updateIdentity<K extends keyof IdentityState>(key: K, value: IdentityState[K]) {
    setIdentity(current => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    if (!assessment.chiefComplaint || !assessment.symptomSummary) {
      toast.error("Veuillez compléter le motif de consultation et le résumé clinique.");
      return;
    }

    if (intakeMethod === "ocr" && !identityImageDataUrl) {
      toast.error("Veuillez ajouter une carte d’identité à analyser.");
      return;
    }

    if (intakeMethod === "vocal" && !voiceAudioDataUrl) {
      toast.error("Veuillez enregistrer ou téléverser un audio.");
      return;
    }

    if (
      intakeMethod === "manuel" &&
      (!identity.firstName || !identity.lastName || !identity.dateOfBirth)
    ) {
      toast.error("Veuillez renseigner les informations d’identité requises.");
      return;
    }

    await createCaseMutation.mutateAsync({
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

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 lg:gap-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_26%),radial-gradient(circle_at_85%_12%,_rgba(59,130,246,0.14),_transparent_24%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(241,245,249,0.94))] p-5 shadow-[0_30px_90px_rgba(15,23,42,0.08)] sm:p-7 xl:p-8">
          <div className="absolute inset-x-6 top-5 flex justify-end sm:inset-x-auto sm:right-5">
            <div className="rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur">
              Utilisation tablette & smartphone
            </div>
          </div>

          <div className="grid gap-6 pt-8 lg:grid-cols-[minmax(0,1.22fr)_minmax(280px,340px)] lg:items-start lg:gap-6 lg:pt-0 xl:grid-cols-[minmax(0,1.18fr)_minmax(300px,360px)]">
            <div className="min-w-0 max-w-4xl xl:max-w-[56rem]">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-slate-950 px-3 py-1 text-white hover:bg-slate-950">
                  Triage clinique assisté
                </Badge>
                <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                  Parcours mobile-first
                </Badge>
              </div>

              <h1 className="mt-5 max-w-2xl text-pretty text-[2.45rem] font-semibold leading-[1.02] tracking-[-0.04em] text-slate-950 sm:text-[3rem] lg:max-w-[34rem] lg:text-[3.25rem] xl:max-w-[38rem] xl:text-[3.55rem]">
                Triage médical d’urgence pour une admission rapide, lisible et sûre.
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base sm:leading-8 xl:max-w-[42rem]">
                Le personnel soignant peut ouvrir un dossier par scan de pièce d’identité, saisie manuelle ou saisie vocale, compléter l’évaluation clinique guidée et obtenir une proposition de priorité avant validation médicale.
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[1.5rem] border border-white/70 bg-white/75 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Admission</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">OCR, manuel ou vocal</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/70 bg-white/75 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Orientation</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">Priorisation par gravité</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/70 bg-white/75 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Supervision</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">Suivi temps réel des patients</p>
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button
                  className="h-12 rounded-2xl bg-slate-950 px-6 text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800"
                  onClick={() => setLocation("/nouveau-dossier")}
                >
                  Créer un nouveau dossier
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-2xl border-white/80 bg-white/80 px-6 shadow-sm hover:bg-white"
                  onClick={() => setLocation("/tableau-de-bord")}
                >
                  Ouvrir le tableau de bord
                </Button>
              </div>
            </div>

            <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-2">
              {statCards.map(card => {
                const value = dashboard?.summary?.[card.key] ?? 0;
                return (
                  <Card
                    key={card.key}
                    className="rounded-[1.7rem] border-white/70 bg-white/80 shadow-[0_24px_60px_rgba(15,23,42,0.07)] backdrop-blur"
                  >
                    <CardContent className="flex h-full flex-col p-5 sm:p-6">
                      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-white shadow-lg`}>
                        <card.icon className="h-5 w-5" />
                      </div>
                      <p className="mt-4 text-sm text-slate-500">{card.label}</p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
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

        {!dashboard && bootstrapQuery.isLoading ? (
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
                    <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 hover:bg-emerald-100">
                      Admission patient
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-600">
                      Multi-saisie
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
                      Parcours guidé
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
                    <div>
                      <CardTitle className="text-2xl tracking-tight text-slate-950 sm:text-[2rem]">
                        Créer un dossier patient et lancer l’évaluation initiale
                      </CardTitle>
                      <CardDescription className="mt-3 max-w-3xl text-sm leading-7 text-slate-500 sm:text-[15px]">
                        Sélectionnez un mode de collecte, vérifiez les informations d’identité, documentez les symptômes et les constantes vitales, puis déclenchez la priorisation assistée.
                      </CardDescription>
                    </div>
                    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Étapes</p>
                      <div className="mt-3 space-y-3 text-sm text-slate-700">
                        <div className="flex gap-3"><span className="font-semibold text-slate-400">01</span><span>Identifier le patient</span></div>
                        <div className="flex gap-3"><span className="font-semibold text-slate-400">02</span><span>Renseigner les signaux de gravité</span></div>
                        <div className="flex gap-3"><span className="font-semibold text-slate-400">03</span><span>Valider la proposition de triage</span></div>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-8 p-5 sm:p-7">
                  <Tabs value={intakeMethod} onValueChange={value => setIntakeMethod(value as IntakeMethod)}>
                    <TabsList className="grid h-auto w-full grid-cols-3 rounded-[1.4rem] bg-slate-100 p-1.5">
                      <TabsTrigger value="ocr" className="rounded-[1rem] py-3 text-xs sm:text-sm">Scan identité</TabsTrigger>
                      <TabsTrigger value="manuel" className="rounded-[1rem] py-3 text-xs sm:text-sm">Saisie manuelle</TabsTrigger>
                      <TabsTrigger value="vocal" className="rounded-[1rem] py-3 text-xs sm:text-sm">Saisie vocale</TabsTrigger>
                    </TabsList>

                    <TabsContent value="ocr" className="mt-5">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_270px]">
                        <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-slate-50/80 p-5">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                              <FileBadge className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-slate-900">Analyse OCR d’un document officiel</h3>
                              <p className="mt-1 text-sm leading-6 text-slate-500">
                                Téléversez une carte d’identité ou un justificatif officiel. Les champs sont proposés automatiquement, puis restent modifiables.
                              </p>
                            </div>
                          </div>
                          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
                            <Input id="identity-upload" type="file" accept="image/*" onChange={handleIdentityFile} className="rounded-2xl bg-white" />
                            <Button
                              variant="outline"
                              className="rounded-2xl bg-white"
                              onClick={() => toast.info("Le document sera analysé lors de la création du dossier.")}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Préparer l’analyse
                            </Button>
                          </div>
                          {identityFileName ? (
                            <p className="mt-3 text-sm text-slate-500">Document sélectionné : {identityFileName}</p>
                          ) : null}
                        </div>
                        <Alert className="rounded-[1.6rem] border-emerald-200 bg-emerald-50/80">
                          <ShieldCheck className="h-4 w-4" />
                          <AlertTitle>Contrôle avant validation</AlertTitle>
                          <AlertDescription>
                            Les informations extraites sont relues par l’agent d’accueil et stockées avec masquage des identifiants sensibles.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </TabsContent>

                    <TabsContent value="manuel" className="mt-5">
                      <Alert className="rounded-[1.6rem] border-blue-200 bg-blue-50/80">
                        <UserPlus className="h-4 w-4" />
                        <AlertTitle>Saisie manuelle encadrée</AlertTitle>
                        <AlertDescription>
                          Utilisez cette modalité lorsque le patient ne présente pas de document exploitable ou que l’accueil nécessite une saisie directe rapide.
                        </AlertDescription>
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
                              <h3 className="text-base font-semibold text-slate-900">Transcription vocale automatique</h3>
                              <p className="mt-1 text-sm leading-6 text-slate-500">
                                Enregistrez la voix du patient ou importez un fichier audio ; les informations dictées sont transcrites puis vérifiées avant enregistrement.
                              </p>
                            </div>
                          </div>
                          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                            <Input type="file" accept="audio/*" onChange={handleAudioFile} className="rounded-2xl bg-white" />
                            <Button
                              type="button"
                              onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                              className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
                            >
                              {isRecording ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                              {isRecording ? "Arrêter" : "Enregistrer"}
                            </Button>
                          </div>
                          {voiceFileName ? <p className="mt-3 text-sm text-slate-500">Audio prêt : {voiceFileName}</p> : null}
                        </div>
                        <Alert className="rounded-[1.6rem] border-amber-200 bg-white">
                          <BrainCircuit className="h-4 w-4" />
                          <AlertTitle>Langues terrain</AlertTitle>
                          <AlertDescription>
                            La saisie vocale peut être préparée pour le français, l’arabe, la darija ou l’anglais selon le contexte d’accueil.
                          </AlertDescription>
                        </Alert>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Prénom</Label>
                      <Input value={identity.firstName} onChange={event => updateIdentity("firstName", event.target.value)} className="rounded-2xl bg-white" placeholder="Prénom" />
                    </div>
                    <div className="space-y-2">
                      <Label>Nom</Label>
                      <Input value={identity.lastName} onChange={event => updateIdentity("lastName", event.target.value)} className="rounded-2xl bg-white" placeholder="Nom" />
                    </div>
                    <div className="space-y-2">
                      <Label>Date de naissance</Label>
                      <Input value={identity.dateOfBirth} onChange={event => updateIdentity("dateOfBirth", event.target.value)} className="rounded-2xl bg-white" placeholder="YYYY-MM-DD" />
                    </div>
                    <div className="space-y-2">
                      <Label>Numéro de sécurité sociale</Label>
                      <Input value={identity.socialSecurityNumber} onChange={event => updateIdentity("socialSecurityNumber", event.target.value)} className="rounded-2xl bg-white" placeholder="Numéro" />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_420px]">
                    <div className="space-y-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <Label>Motif de consultation</Label>
                          <Input
                            value={assessment.chiefComplaint}
                            onChange={event => updateAssessment("chiefComplaint", event.target.value)}
                            className="rounded-2xl bg-white"
                            placeholder="Ex. douleur thoracique, chute, fièvre, détresse respiratoire"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Résumé clinique</Label>
                          <Textarea
                            value={assessment.symptomSummary}
                            onChange={event => updateAssessment("symptomSummary", event.target.value)}
                            className="min-h-[140px] rounded-2xl bg-white"
                            placeholder="Décrire les symptômes, leur apparition, leur évolution et les signes associés."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Niveau de douleur</Label>
                          <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 px-4 py-4">
                            <input
                              type="range"
                              min={0}
                              max={10}
                              value={assessment.painLevel}
                              onChange={event => updateAssessment("painLevel", Number(event.target.value))}
                              className="w-full accent-slate-950"
                            />
                            <p className="mt-3 text-sm text-slate-500">Score actuel : <span className="font-semibold text-slate-900">{assessment.painLevel}/10</span></p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Langue prioritaire</Label>
                          <Select value={preferredLanguage} onValueChange={setPreferredLanguage}>
                            <SelectTrigger className="rounded-2xl bg-white">
                              <SelectValue placeholder="Choisir" />
                            </SelectTrigger>
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
                          <Input value={mobileNumber} onChange={event => setMobileNumber(event.target.value)} className="rounded-2xl bg-white" placeholder="Optionnel" />
                        </div>
                        <div className="space-y-2">
                          <Label>Notes d’accueil</Label>
                          <Input value={notes} onChange={event => setNotes(event.target.value)} className="rounded-2xl bg-white" placeholder="Observations initiales" />
                        </div>
                      </div>

                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <HeartPulse className="h-4 w-4 text-rose-600" />
                          <p className="text-sm font-semibold text-slate-900">Signaux cliniques de gravité</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {signalOptions.map(option => {
                            const checked = Boolean(assessment[option.key]);
                            return (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => updateAssessment(option.key, (!checked) as never)}
                                className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${checked ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-900/10" : "border-slate-200 bg-slate-50/80 text-slate-800 hover:bg-slate-100"}`}
                              >
                                <p className="text-sm font-medium">{option.label}</p>
                                <p className={`mt-2 text-xs leading-5 ${checked ? "text-slate-200" : "text-slate-500"}`}>{option.helper}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Card className="rounded-[1.6rem] border-slate-200/80 bg-slate-50/80 shadow-none">
                        <CardHeader>
                          <CardTitle className="text-lg">Constantes vitales</CardTitle>
                          <CardDescription>À renseigner si elles sont disponibles dès l’accueil.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                          <div className="space-y-2">
                            <Label>Saturation O₂ (%)</Label>
                            <Input value={assessment.oxygenSaturation} onChange={event => updateAssessment("oxygenSaturation", event.target.value)} className="rounded-2xl bg-white" placeholder="Ex. 98" />
                          </div>
                          <div className="space-y-2">
                            <Label>Fréquence cardiaque</Label>
                            <Input value={assessment.heartRate} onChange={event => updateAssessment("heartRate", event.target.value)} className="rounded-2xl bg-white" placeholder="Ex. 85" />
                          </div>
                          <div className="space-y-2">
                            <Label>Fréquence respiratoire</Label>
                            <Input value={assessment.respiratoryRate} onChange={event => updateAssessment("respiratoryRate", event.target.value)} className="rounded-2xl bg-white" placeholder="Ex. 20" />
                          </div>
                          <div className="space-y-2">
                            <Label>Pression systolique</Label>
                            <Input value={assessment.systolicBloodPressure} onChange={event => updateAssessment("systolicBloodPressure", event.target.value)} className="rounded-2xl bg-white" placeholder="Ex. 120" />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-[1.6rem] border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.92),rgba(255,255,255,0.96))] shadow-none">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-lg text-emerald-900">
                            <BrainCircuit className="h-5 w-5" />
                            Garde-fous du prototype
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm leading-6 text-emerald-950/80">
                          <p>Les identifiants sensibles sont masqués côté persistance applicative.</p>
                          <p>La priorité proposée constitue une aide à l’orientation, jamais une décision clinique autonome.</p>
                          <p>Les cas urgents et critiques peuvent déclencher une notification interne au personnel concerné.</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Canal sélectionné : {intakeLabels[intakeMethod]}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Le dossier sera créé puis orienté selon une logique de triage simplifiée, à confirmer par validation médicale.
                      </p>
                    </div>
                    <Button
                      onClick={handleSubmit}
                      disabled={createCaseMutation.isPending}
                      className="h-12 rounded-2xl bg-slate-950 px-6 text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800"
                    >
                      {createCaseMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Lancer le triage automatique
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {(activeView === "overview" || activeView === "board") && (
              <Card className="rounded-[1.9rem] border-white/70 bg-white/85 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <CardHeader className="p-5 sm:p-7">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <CardTitle className="text-2xl tracking-tight text-slate-950">Patients en attente</CardTitle>
                      <CardDescription className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
                        Vue opérationnelle priorisée des patients, des délais cibles et du statut actuel de prise en charge.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="w-fit rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                      Tri par priorité et attente
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-0 pb-2">
                  <div className="overflow-x-auto px-4 pb-4 sm:px-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Patient</TableHead>
                          <TableHead>Priorité</TableHead>
                          <TableHead>Motif</TableHead>
                          <TableHead>Canal</TableHead>
                          <TableHead>Attente</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboard?.cases?.map(row => (
                          <TableRow key={row.triageCaseId}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-slate-900">{row.patientFirstName} {row.patientLastName}</p>
                                <p className="text-xs text-slate-500">Entrée {formatDate(row.createdAt)}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`rounded-full border ${priorityClasses[row.priority as Priority]}`}>
                                {priorityLabels[row.priority as Priority]}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[260px] text-sm leading-6 text-slate-600">{row.chiefComplaint}</TableCell>
                            <TableCell>{intakeLabels[row.intakeMethod as IntakeMethod]}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-slate-900">{row.waitingTimeMinutes} min</p>
                                <p className="text-xs text-slate-500">cible {row.targetWaitMinutes} min</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-slate-700">
                                {row.status.replaceAll("_", " ")}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-5">
            <Card className="rounded-[1.8rem] border-white/70 bg-white/85 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl tracking-tight text-slate-950">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  Priorité la plus élevée
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topPriorityCase ? (
                  <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-5">
                    <Badge variant="outline" className={`rounded-full border ${priorityClasses[topPriorityCase.priority as Priority]}`}>
                      {priorityLabels[topPriorityCase.priority as Priority]}
                    </Badge>
                    <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">
                      {topPriorityCase.patientFirstName} {topPriorityCase.patientLastName}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{topPriorityCase.chiefComplaint}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Attente</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{topPriorityCase.waitingTimeMinutes} min</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Action</p>
                        <p className="mt-2 text-sm font-medium leading-6 text-slate-900">{topPriorityCase.recommendedAction}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Aucun patient enregistré pour le moment.</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[1.8rem] border-white/70 bg-white/85 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-xl tracking-tight text-slate-950">Notifications personnel</CardTitle>
                <CardDescription>Alertes récentes concernant les dossiers urgents ou critiques.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard?.notifications?.map(notification => (
                  <div key={notification.id} className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Badge
                        variant="outline"
                        className={`rounded-full border ${notification.severity === "critical" ? "border-rose-200 bg-rose-100 text-rose-700" : notification.severity === "urgent" ? "border-amber-200 bg-amber-100 text-amber-700" : "border-slate-200 bg-slate-100 text-slate-700"}`}
                      >
                        {notification.severity}
                      </Badge>
                      <span className="text-xs text-slate-400">{formatDate(notification.createdAt)}</span>
                    </div>
                    <p className="mt-3 font-medium text-slate-900">{notification.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{notification.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {(activeView === "overview" || activeView === "protocols") && (
              <Card className="rounded-[1.8rem] border-white/70 bg-white/85 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl tracking-tight text-slate-950">
                    <Stethoscope className="h-5 w-5 text-blue-600" />
                    Cadre protocolaire
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-[1.5rem] border border-blue-200/70 bg-blue-50/75 p-4">
                    <p className="text-sm leading-6 text-blue-950/80">{dashboard?.protocolSummary?.description}</p>
                  </div>

                  <div className="space-y-3">
                    {(dashboard?.guidedQuestions ?? []).slice(0, 6).map(question => (
                      <div key={question.id} className="rounded-[1.25rem] border border-slate-200 bg-slate-50/80 p-4">
                        <p className="font-medium text-slate-900">{question.label}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{question.helper}</p>
                      </div>
                    ))}
                  </div>

                  <Alert className="rounded-[1.4rem] border-amber-200 bg-amber-50/80">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Validation médicale obligatoire</AlertTitle>
                    <AlertDescription>
                      Le score généré par l’application aide à orienter le patient, mais la décision finale de triage doit toujours être confirmée par un professionnel habilité.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
