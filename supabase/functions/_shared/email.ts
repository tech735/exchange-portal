// @ts-nocheck
// Shared HTML email helpers for notify-team and escalate-tickets, so both
// functions render the same clean, table-based layout instead of a wall of
// plain text.

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// A label/value table for a single record (e.g. one ticket's details).
export function keyValueTable(rows: Array<[string, string]>): string {
  const body = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;color:#334155;white-space:nowrap;">${escapeHtml(label)}</td>
          <td style="padding:10px 14px;border:1px solid #e2e8f0;color:#0f172a;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join('');
  return `<table style="border-collapse:collapse;width:100%;font-size:14px;">${body}</table>`;
}

// A plain text paragraph used for a greeting or an instruction line — no
// colored box, just normal body copy.
export function paragraph(text: string): string {
  return `<p style="margin:0 0 12px;color:#1f2937;font-size:14px;line-height:1.5;">${escapeHtml(text)}</p>`;
}

// A multi-row table for a list of records (e.g. several overdue tickets).
export function listTable(headers: string[], rows: string[][]): string {
  const head = headers
    .map((h) => `<th style="padding:10px 14px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left;color:#334155;">${escapeHtml(h)}</th>`)
    .join('');
  const body = rows
    .map(
      (row) => `<tr>${row.map((cell) => `<td style="padding:10px 14px;border:1px solid #e2e8f0;color:#0f172a;">${escapeHtml(cell)}</td>`).join('')}</tr>`
    )
    .join('');
  return `<table style="border-collapse:collapse;width:100%;font-size:14px;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

// Plain, non-decorative wrapper: subject-line heading, then body copy/table.
export function wrapEmail(heading: string, _subheading: string, bodyHtml: string): string {
  return `
  <div style="font-family:Arial,sans-serif;padding:16px;color:#1f2937;">
    <p style="margin:0 0 16px;font-size:15px;font-weight:600;">${escapeHtml(heading)}</p>
    ${bodyHtml}
    <p style="margin:20px 0 0;color:#6b7280;font-size:12px;">
      Automated notification from the Exchange Portal.
    </p>
  </div>`;
}

export async function sendResendEmail(opts: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
}): Promise<Response> {
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });
}
