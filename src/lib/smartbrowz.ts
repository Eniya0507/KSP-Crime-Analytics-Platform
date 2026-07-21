/**
 * Catalyst SmartBrowz — Headless Browser PDF Generation
 *
 * Sends HTML content to Catalyst SmartBrowz to generate a professional PDF
 * using a real headless browser (full CSS, fonts, layout fidelity).
 *
 * Falls back to the existing browser print dialog when SmartBrowz is
 * unavailable, unconfigured, or returns an error.
 *
 * API Reference:
 *   POST /baas/v1/project/{projectId}/smartbrowz/screenshot
 *   Body: { url?, html_content?, output_format: "pdf", ... }
 *
 * The existing openPrint() fallback in reports.ts is always preserved.
 */

import { getCatalystConfig } from './catalyst';
import { uploadPdfToStratus } from './stratus';

// ── Internal helpers ─────────────────────────────────────────────────────────

function getSmartBrowzBase(): string {
  const { projectId } = getCatalystConfig();
  return `https://api.catalyst.zoho.com/baas/v1/project/${projectId}/smartbrowz`;
}

function authHeaders(): Record<string, string> {
  const { token } = getCatalystConfig();
  return {
    'Content-Type': 'application/json',
    Authorization: `Zoho-oauthtoken ${token}`,
    Environment: 'Development',
  };
}

function isSmartBrowzConfigured(): boolean {
  const { projectId, token } = getCatalystConfig();
  return !!projectId && !!token;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface SmartBrowzResult {
  success: boolean;
  /** Cloud URL of the stored PDF (via Stratus), if available */
  pdfUrl?: string;
  /** Error message if generation failed */
  error?: string;
}

/**
 * Generate a professional PDF from HTML via Catalyst SmartBrowz.
 *
 * @param html       Full HTML document string (including <style> blocks)
 * @param filename   Desired filename (without extension) for the PDF download
 * @returns `true` if SmartBrowz succeeded and triggered the download,
 *          `false` if SmartBrowz was unavailable — caller should fall back to openPrint()
 */
export async function generatePdfViaSmartBrowz(
  html: string,
  filename: string,
): Promise<SmartBrowzResult> {
  if (!isSmartBrowzConfigured()) {
    console.info('[KSP SmartBrowz] Not configured — caller should use local print fallback.');
    return { success: false, error: 'SmartBrowz not configured' };
  }

  try {
    const res = await fetch(`${getSmartBrowzBase()}/screenshot`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        html_content: html,
        output_format: 'pdf',
        page_size: 'A4',
        orientation: 'portrait',
        print_background: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`SmartBrowz ${res.status}: ${text}`);
    }

    // SmartBrowz returns the PDF as a binary stream
    const pdfBlob = await res.blob();

    // Trigger browser download
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Upload to Stratus in the background (non-blocking)
    let pdfUrl: string | undefined;
    uploadPdfToStratus(pdfBlob, filename)
      .then((u) => { pdfUrl = u || undefined; })
      .catch(() => { /* silent */ });

    // Revoke after small delay
    setTimeout(() => URL.revokeObjectURL(url), 10_000);

    console.info(`[KSP SmartBrowz] PDF generated successfully for "${filename}"`);
    return { success: true, pdfUrl };
  } catch (err: any) {
    console.warn('[KSP SmartBrowz] PDF generation failed:', err.message ?? err);
    return { success: false, error: err.message ?? String(err) };
  }
}

/**
 * Convenience wrapper used by report buttons.
 * Tries SmartBrowz first; if it fails, calls the provided fallback function.
 *
 * @param html         Full HTML string for the report
 * @param filename     Display name for the PDF file
 * @param fallback     The existing openPrint / local export function to call on failure
 * @returns SmartBrowzResult (success=true means SmartBrowz handled it)
 */
export async function exportWithSmartBrowz(
  html: string,
  filename: string,
  fallback: () => void,
): Promise<SmartBrowzResult> {
  const result = await generatePdfViaSmartBrowz(html, filename);
  if (!result.success) {
    fallback();
  }
  return result;
}
