/**
 * Catalyst Stratus — File Storage Integration
 *
 * Uploads evidence files and generated reports to Catalyst Stratus.
 * Falls back gracefully to in-browser Blob URLs when Stratus is unavailable.
 *
 * Optional env vars (set in .env or Catalyst console):
 *   VITE_STRATUS_FOLDER_ID  — the Stratus folder ID for report storage
 *
 * If these vars are absent or Stratus returns any error, all functions
 * return sensible fallback values so callers are unaffected.
 */

import { getCatalystConfig } from './catalyst';

export interface StratusUploadResult {
  /** Permanent or temporary URL to access / download the file */
  url: string;
  /** Stratus file ID (empty string if local fallback was used) */
  fileId: string;
  /** Whether the file actually lives in Catalyst Stratus */
  isCloud: boolean;
}

// ── Internal helpers ────────────────────────────────────────────────────────

function getStratusBase(): string {
  const { projectId } = getCatalystConfig();
  return `https://api.catalyst.zoho.com/baas/v1/project/${projectId}/folder`;
}

function getFolderId(): string {
  return (import.meta.env.VITE_STRATUS_FOLDER_ID as string) || '';
}

function authHeaders(): Record<string, string> {
  const { token } = getCatalystConfig();
  return {
    Authorization: `Zoho-oauthtoken ${token}`,
    Environment: 'Development',
  };
}

function isStratusConfigured(): boolean {
  const { projectId, token } = getCatalystConfig();
  return !!projectId && !!token && !!getFolderId();
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Upload a File/Blob to Catalyst Stratus.
 * Returns a local Blob URL as fallback when Stratus is unavailable.
 */
export async function uploadToStratus(
  file: File | Blob,
  filename: string,
): Promise<StratusUploadResult> {
  // Local fallback — always usable offline
  const localUrl = URL.createObjectURL(file);
  const localFallback: StratusUploadResult = { url: localUrl, fileId: '', isCloud: false };

  if (!isStratusConfigured()) {
    console.info('[KSP Stratus] Not configured — using local Blob URL.');
    return localFallback;
  }

  try {
    const folderId = getFolderId();
    const formData = new FormData();
    formData.append('file', file, filename);

    const res = await fetch(`${getStratusBase()}/${folderId}/file/upload`, {
      method: 'POST',
      headers: authHeaders(), // Content-Type is set automatically by fetch for FormData
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Stratus upload failed ${res.status}: ${text}`);
    }

    const json = await res.json();
    const data = json.data ?? json;
    const fileId: string = String(data?.file_id ?? data?.id ?? data?.fileId ?? '');
    const url: string = data?.download_url ?? data?.url ?? localUrl;

    console.info(`[KSP Stratus] Uploaded "${filename}" → fileId=${fileId}`);
    return { url, fileId, isCloud: true };
  } catch (err: any) {
    console.warn('[KSP Stratus] Upload failed, using local fallback:', err.message ?? err);
    return localFallback;
  }
}

/**
 * Get a secure download URL for an existing Stratus file.
 * Returns empty string if Stratus is unavailable.
 */
export async function getStratusDownloadUrl(fileId: string): Promise<string> {
  if (!isStratusConfigured() || !fileId) return '';

  try {
    const folderId = getFolderId();
    const res = await fetch(
      `${getStratusBase()}/${folderId}/file/${fileId}/download`,
      { headers: authHeaders() },
    );
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    return (json.data?.download_url ?? json.download_url ?? '') as string;
  } catch (err: any) {
    console.warn('[KSP Stratus] getDownloadUrl failed:', err.message ?? err);
    return '';
  }
}

/**
 * Upload an HTML report string to Stratus as an HTML file.
 * This is a fire-and-forget helper — it never throws.
 * Returns the cloud URL (or empty string on failure).
 */
export async function uploadReportToStratus(
  htmlContent: string,
  reportName: string,
): Promise<string> {
  try {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const filename = `${reportName.replace(/\s+/g, '_')}_${Date.now()}.html`;
    const result = await uploadToStratus(blob, filename);
    return result.isCloud ? result.url : '';
  } catch {
    return '';
  }
}

/**
 * Upload a PDF Blob to Stratus.
 * Returns the cloud URL (or empty string on failure).
 */
export async function uploadPdfToStratus(pdfBlob: Blob, reportName: string): Promise<string> {
  try {
    const filename = `${reportName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    const result = await uploadToStratus(pdfBlob, filename);
    return result.isCloud ? result.url : '';
  } catch {
    return '';
  }
}
