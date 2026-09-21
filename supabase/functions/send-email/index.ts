import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { sendEmailViaResend } from "../_shared/resend.ts";

interface EmailRequest {
  to: string;
  template: "welcome" | "recovery" | "receipt" | "notification";
  subject?: string;
  data?: {
    name?: string;
    otp?: string;
    locationName?: string;
    amount?: number;
    currency?: string;
    spaceNumber?: string;
    ticketNumber?: string;
    message?: string;
  };
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

    const { to, template, subject: customSubject, data = {} } = (await req.json()) as EmailRequest;

    if (!to || !to.trim()) {
      return new Response(JSON.stringify({ error: "'to' email address is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = to.trim().toLowerCase();
    let emailSubject = customSubject || "";
    let emailHtml = "";

    if (template === "receipt") {
      emailSubject = customSubject || `ParkZone Parking Receipt #${data.ticketNumber || "Receipt"}`;
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b; }
            .card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; }
            .title { font-size: 20px; font-weight: bold; color: #0f172a; margin-bottom: 16px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
            .total { font-weight: bold; font-size: 16px; border-top: 2px solid #e2e8f0; margin-top: 12px; padding-top: 12px; }
            .footer { margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="card">
            <div style="font-size: 24px; font-weight: bold; margin-bottom: 16px;">🅿️ ParkZone Receipt</div>
            <div class="title">Payment Confirmed</div>
            <div class="row"><span>Location:</span><span>${data.locationName || "Parking Zone"}</span></div>
            <div class="row"><span>Space:</span><span>${data.spaceNumber || "Assigned"}</span></div>
            <div class="row"><span>Ticket #:</span><span>${data.ticketNumber || "N/A"}</span></div>
            <div class="row total"><span>Total Paid:</span><span>${data.amount || 0} ${data.currency || "RWF"}</span></div>
            <div class="footer">Thank you for parking with ParkZone • team@eswipe.app</div>
          </div>
        </body>
        </html>
      `;
    } else {
      emailSubject = customSubject || "ParkZone Notification";
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; padding: 24px; color: #1e293b;">
          <h2>🅿️ ParkZone</h2>
          <p>${data.message || "Notification from ParkZone."}</p>
          <p style="font-size: 12px; color: #94a3b8;">Sent from team@eswipe.app</p>
        </body>
        </html>
      `;
    }

    const result = await sendEmailViaResend({
      to: normalizedEmail,
      subject: emailSubject,
      html: emailHtml,
      from: "ParkZone <team@eswipe.app>",
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email dispatched successfully.",
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
