import crypto from "node:crypto";

export type IdentityDraft = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  socialSecurityNumber: string;
};

export type DecodedDataUrl = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
};

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
};

export function normalizeFreeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeDate(value: string | null | undefined): string {
  const cleaned = normalizeFreeText(value);
  if (!cleaned) return "";

  const isoMatch = cleaned.match(/^\d{4}-\d{2}-\d{2}$/);
  if (isoMatch) {
    return cleaned;
  }

  const slashMatch = cleaned.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const safeYear = year.length === 2 ? `19${year}` : year;
    return `${safeYear.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return cleaned;
}

export function normalizeSocialSecurityNumber(value: string | null | undefined): string {
  return normalizeFreeText(value).replace(/[^0-9A-Za-z]/g, "");
}

export function maskSocialSecurityNumber(value: string | null | undefined): string {
  const normalized = normalizeSocialSecurityNumber(value);
  if (!normalized) return "";
  if (normalized.length <= 4) return normalized;
  return `${"•".repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
}

export function hashSensitiveValue(value: string | null | undefined): string {
  const normalized = normalizeFreeText(value);
  if (!normalized) return "";
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function extractIdentityFromTranscript(transcript: string): IdentityDraft {
  const normalized = normalizeFreeText(transcript);

  const fullNameMatch = normalized.match(/(?:je m[' ]appelle|nom(?: complet)?|patient(?:e)?|madame|monsieur)\s+([A-Za-zÀ-ÿ' -]{2,})/i);
  const dateMatch = normalized.match(/(?:n[ée]e? le|date de naissance|n[ée] en date du)\s+([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i);
  const ssnMatch = normalized.match(/(?:num[ée]ro de s[ée]curit[ée] sociale|num[ée]ro national|num[ée]ro d[' ]identit[ée])\s*[:\-]?\s*([0-9A-Za-z\s.-]{6,})/i);

  const fullName = normalizeFreeText(fullNameMatch?.[1] ?? "");
  const parts = fullName.split(" ").filter(Boolean);
  const lastName = parts.length > 1 ? parts.at(-1) ?? "" : "";
  const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : fullName;

  return {
    firstName,
    lastName,
    dateOfBirth: normalizeDate(dateMatch?.[1] ?? ""),
    socialSecurityNumber: normalizeSocialSecurityNumber(ssnMatch?.[1] ?? ""),
  };
}

export function mergeIdentityDrafts(...drafts: Array<Partial<IdentityDraft> | null | undefined>): IdentityDraft {
  const merged = drafts.reduce<IdentityDraft>(
    (acc, current) => ({
      firstName: normalizeFreeText(current?.firstName) || acc.firstName,
      lastName: normalizeFreeText(current?.lastName) || acc.lastName,
      dateOfBirth: normalizeDate(current?.dateOfBirth) || acc.dateOfBirth,
      socialSecurityNumber:
        normalizeSocialSecurityNumber(current?.socialSecurityNumber) || acc.socialSecurityNumber,
    }),
    {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      socialSecurityNumber: "",
    },
  );

  return merged;
}

export function decodeDataUrl(dataUrl: string): DecodedDataUrl {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    throw new Error("Format de fichier invalide.");
  }

  const rawMimeType = match[1];
  const mimeType = rawMimeType.split(";")[0].trim().toLowerCase();
  const base64 = match[2];
  const extension = MIME_EXTENSION_MAP[mimeType] ?? mimeType.split("/")[1] ?? "bin";

  return {
    buffer: Buffer.from(base64, "base64"),
    mimeType,
    extension,
  };
}
