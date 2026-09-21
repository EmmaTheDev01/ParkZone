import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmailViaResend } from "../_shared/resend.ts";

interface WelcomePayload {
  email: string;
  name?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, name } = (await req.json()) as WelcomePayload;

    if (!email || !email.trim()) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const greetingName = name ? ` ${name}` : "";
    const subject = "Welcome to ParkZone - Your Smart Parking Assistant 🅿️";

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 40px 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
          .brand { font-size: 26px; font-weight: 800; color: #0f172a; margin-bottom: 24px; }
          .brand span { color: #2563eb; }
          .hero-badge { display: inline-block; background-color: #eff6ff; color: #1d4ed8; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
          .title { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
          .desc { font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
          .features { background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; }
          .feature-item { display: flex; align-items: flex-start; margin-bottom: 14px; font-size: 14px; color: #334155; }
          .feature-item:last-child { margin-bottom: 0; }
          .feature-icon { margin-right: 12px; font-size: 18px; }
          .footer { margin-top: 36px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="brand">🅿️ Park<span>Zone</span></div>
          <div class="hero-badge">Account Ready</div>
          <div class="title">Welcome aboard${greetingName}! 🎉</div>
          <p class="desc">
            We're thrilled to have you! With ParkZone, finding, reserving, and paying for parking spots has never been easier.
          </p>
          <div class="features">
            <div class="feature-item">
              <span class="feature-icon">🔍</span>
              <span><strong>Instant Spot Discovery:</strong> View live availability, hourly rates, and directions in Kigali.</span>
            </div>
            <div class="feature-item" style="margin-top: 12px;">
              <span class="feature-icon">📱</span>
              <span><strong>QR Code Check-In:</strong> Scan to park seamlessly with zero hassle.</span>
            </div>
            <div class="feature-item" style="margin-top: 12px;">
              <span class="feature-icon">💳</span>
              <span><strong>Flexible Payments:</strong> Pay securely using MTN Mobile Money, card, or cash.</span>
            </div>
          </div>
          <p class="desc" style="font-size: 14px;">
            Open the ParkZone app anytime to reserve your first spot. If you need any assistance, feel free to reply directly to this email.
          </p>
          <div class="footer">
            © ${new Date().getFullYear()} ParkZone Technologies • sent from team@eswipe.app
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmailViaResend({
      to: normalizedEmail,
      subject,
      html: emailHtml,
      from: "ParkZone <team@eswipe.app>",
    });

    // Optional: Log to Supabase email_logs table
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      if (supabaseUrl && supabaseServiceRoleKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
        await supabase.from("email_logs").insert({
          recipient: normalizedEmail,
          subject,
          email_type: "welcome",
          provider: "resend",
          provider_id: result.id || null,
          status: "sent",
        });
      }
    } catch (_) {}

    return new Response(
      JSON.stringify({
        success: true,
        message: "Welcome email sent successfully.",
        providerId: result.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
