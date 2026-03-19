import { supabase } from "@/integrations/supabase/client";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];

const ALLOWED_EXTENSIONS = [
  ".pdf", ".jpg", ".jpeg", ".png", ".webp",
  ".doc", ".docx", ".xls", ".xlsx", ".csv",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateFile(file: File): string | null {
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  const validType = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext);
  if (!validType) {
    return `Tipo de arquivo não permitido: ${file.name}. Aceitos: PDF, imagens, Word e Excel.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    return `Arquivo "${file.name}" tem ${sizeMb} MB. Limite: 10 MB.`;
  }
  return null;
}

export function getAcceptString(): string {
  return ALLOWED_EXTENSIONS.join(",");
}

export async function uploadFileToBucket(
  bucket: string,
  path: string,
  file: File,
): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export function buildStoragePath(
  caseId: string,
  fileName: string,
  subfolder?: string,
): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ts = Date.now();
  const base = subfolder ? `${caseId}/${subfolder}` : caseId;
  return `${base}/${ts}_${safe}`;
}

export const MAX_FILE_SIZE_LABEL = "10 MB";
export const ALLOWED_EXTENSIONS_LABEL = "PDF, JPG, PNG, WEBP, DOC, DOCX, XLS, XLSX, CSV";
