import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestPayload {
  email: string;
  type?: "recovery" | "signup" | "welcome" | "notification";
  subject?: string;
  customMessage?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
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

    const body = (await req.json()) as RequestPayload;
    const { email, type = "recovery", subject: customSubject, customMessage } = body;

    if (!email || !email.trim()) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromEmail = Deno.env.get("FROM_EMAIL") || "ParkZone <onboarding@resend.dev>";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    let emailSubject = customSubject || "ParkZone Notification";
    let emailHtml = "";
    let emailOtp = "";

    if (type === "recovery" || type === "signup") {
      // Generate OTP via Supabase Auth Admin
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: type === "signup" ? "signup" : "recovery",
        email: normalizedEmail,
      });

      if (linkError) {
        console.error("Error generating OTP:", linkError.message);
        return new Response(
          JSON.stringify({ error: linkError.message || "Failed to generate verification code" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      emailOtp = linkData?.properties?.email_otp || "";
      emailSubject =
        type === "recovery"
          ? "Your ParkZone Password Reset Code"
          : "Welcome to ParkZone - Verification Code";

      emailHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${emailSubject}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
            .card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 36px 28px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
            .brand { display: inline-flex; align-items: center; font-size: 24px; font-weight: 800; color: #0f172a; margin-bottom: 24px; }
            .brand span { color: #2563eb; }
            .title { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
            .desc { font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
            .code-container { background: #f1f5f9; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; border: 1px dashed #cbd5e1; }
            .code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: 'Courier New', monospace; }
            .subtext { font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 16px; }
            .footer { margin-top: 36px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="brand">🅿️ Park<span>Zone</span></div>
            <div class="title">${type === "recovery" ? "Reset Your Password" : "Confirm Your Email"}</div>
            <p class="desc">
              ${
                type === "recovery"
                  ? "We received a request to reset the password for your ParkZone account. Please enter the 6-digit verification code below:"
                  : "Thank you for joining ParkZone! Use the code below to complete your registration:"
              }
            </p>
            <div class="code-container">
              <div class="code">${emailOtp}</div>
            </div>
            <p class="subtext">This code will expire in 10 minutes. If you did not request this, you can safely ignore this email.</p>
            <div class="footer">
              © ${new Date().getFullYear()} ParkZone Technologies. All rights reserved.
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      // General or Welcome Email
      emailSubject = customSubject || "Welcome to ParkZone";
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; padding: 24px; color: #1e293b;">
          <h2>🅿️ ParkZone</h2>
          <p>${customMessage || "Welcome to ParkZone, your smart parking assistant."}</p>
        </body>
        </html>
      `;
    }

    let providerMessageId = null;

    // Send email using Resend API
    if (resendApiKey) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [normalizedEmail],
          subject: emailSubject,
          html: emailHtml,
        }),
      });

      const resendData = await resendRes.json();

      if (!resendRes.ok) {
        console.error("Resend API error:", resendData);
        // Log failure in database if email_logs table exists
        try {
          await supabaseAdmin.from("email_logs").insert({
            recipient: normalizedEmail,
            subject: emailSubject,
            email_type: type,
            provider: "resend",
            status: "failed",
            error_message: JSON.stringify(resendData),
          });
        } catch (_) {}

        return new Response(
          JSON.stringify({ error: "Failed to send email via Resend", details: resendData }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      providerMessageId = resendData?.id;
      console.log(`[ParkZone] Email sent via Resend successfully to ${normalizedEmail}. ID: ${providerMessageId}`);
    } else {
      console.warn(
        `[ParkZone DEV] RESEND_API_KEY is not set. OTP for ${normalizedEmail} is: ${emailOtp}`
      );
    }

    // Log success in email_logs table
    try {
      await supabaseAdmin.from("email_logs").insert({
        recipient: normalizedEmail,
        subject: emailSubject,
        email_type: type,
        provider: "resend",
        provider_id: providerMessageId,
        status: "sent",
      });
    } catch (logErr) {
      // Ignore if table doesn't exist yet
      console.warn("Could not write to email_logs table:", logErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Verification code sent to your email successfully.",
        providerId: providerMessageId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("send-otp-email exception:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
