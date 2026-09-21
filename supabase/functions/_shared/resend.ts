export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  apiKey?: string;
}

export async function sendEmailViaResend({
  to,
  subject,
  html,
  from,
  apiKey,
}: SendEmailOptions) {
  const resendApiKey = apiKey || Deno.env.get("RESEND_API_KEY");
  const sender = from || Deno.env.get("FROM_EMAIL") || "ParkZone <team@eswipe.app>";

  if (!resendApiKey) {
    console.warn("[ParkZone Resend Dev] RESEND_API_KEY is not configured.");
    return {
      success: true,
      devMode: true,
      message: "Email simulated (no API key configured)",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sender,
      to: [to],
      subject,
      html,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[Resend Error]", data);
    throw new Error(data.message || JSON.stringify(data));
  }

  return {
    success: true,
    id: data.id,
  };
}
