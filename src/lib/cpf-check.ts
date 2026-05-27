// Utilities to verify that an uploaded file actually belongs to the given client CPF.
// Strategy: check digits in filename first; fallback to reading PDF text content.

export function digitsOnly(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Returns true if the client's CPF digits appear contiguously inside the filename digits. */
export function filenameMatchesCpf(fileName: string, clientCpf: string | null | undefined): boolean {
  const cpf = digitsOnly(clientCpf);
  if (cpf.length !== 11) return false;
  const fileDigits = digitsOnly(fileName);
  if (!fileDigits) return false;
  return fileDigits.includes(cpf);
}

/** Loads pdfjs lazily and tries to find the CPF (masked or raw) in the PDF text. */
export async function pdfContainsCpf(file: File, clientCpf: string | null | undefined): Promise<boolean> {
  const cpf = digitsOnly(clientCpf);
  if (cpf.length !== 11) return false;
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") return false;

  try {
    const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
    // Worker setup — use bundler-friendly worker URL
    try {
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    } catch {
      // Fallback: disable worker (slower but works)
      pdfjs.GlobalWorkerOptions.workerSrc = "";
    }

    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: buffer, disableWorker: false });
    const pdf = await loadingTask.promise;
    const maxPages = Math.min(pdf.numPages, 10); // limit for performance
    let fullText = "";
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += " " + content.items.map((it: any) => it.str || "").join(" ");
      // early exit
      const digits = digitsOnly(fullText);
      if (digits.includes(cpf)) return true;
    }
    return digitsOnly(fullText).includes(cpf);
  } catch (e) {
    console.warn("[cpf-check] PDF parse failed:", e);
    return false;
  }
}

/** Format raw 11-digit CPF as 000.000.000-00 */
export function formatCpfMask(cpf: string | null | undefined): string {
  const d = digitsOnly(cpf);
  if (d.length !== 11) return cpf ?? "";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
