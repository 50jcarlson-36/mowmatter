import { createClient } from "npm:@supabase/supabase-js@2.102.0";
import { normalizeBrand, portalURL, invoiceHTML } from "./model.mjs";
const origins = new Set([
  "https://office.mowmatter.com",
  "https://mowmatter-office.onrender.com",
  "https://mowmatter-office.steelfurymx.chatgpt.site",
]);
const uuid = (v: unknown) =>
  typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "",
    headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
      "Access-Control-Allow-Origin": origins.has(origin)
        ? origin
        : "https://office.mowmatter.com",
      "Access-Control-Allow-Headers": "authorization,apikey,content-type",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
    };
  const out = (v: unknown, status = 200) =>
    new Response(JSON.stringify(v), { status, headers });
  if (!origins.has(origin)) return out({ error: "Origin not allowed" }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return out({ error: "POST required" }, 405);
  try {
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const checked = async (q: any) => {
      const r = await q;
      if (r.error) throw Error(r.error.message);
      return r.data;
    };
    const {
      data: { user },
      error,
    } = await db.auth.getUser(
      (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""),
    );
    if (error || !user || !user.email_confirmed_at)
      return out({ error: "Sign in with a verified email" }, 401);
    const multipart = req.headers
      .get("content-type")
      ?.includes("multipart/form-data");
    let form: FormData | undefined, b: any;
    if (multipart) {
      if (Number(req.headers.get("content-length") || 0) > 2200000)
        return out({ error: "Logo must be under 2 MB" }, 413);
      form = await req.formData();
      b = { action: "logo", company_id: form.get("company_id") };
    } else {
      const raw = await req.text();
      if (raw.length > 10000) return out({ error: "Request too large" }, 413);
      b = JSON.parse(raw);
    }
    if (!uuid(b.company_id))
      return out({ error: "Business link is invalid" }, 400);
    const company = await checked(
      db
        .from("mow_crew_companies")
        .select("id,name,branding")
        .eq("id", b.company_id)
        .single(),
    );
    const member = await checked(
      db
        .from("mow_crew_members")
        .select("role")
        .eq("company_id", company.id)
        .eq("user_id", user.id)
        .maybeSingle(),
    );
    const owner = member?.role === "owner";
    if (["portal", "portal_update"].includes(b.action)) {
      if (!uuid(b.customer_id))
        return out({ error: "Customer link is invalid" }, 400);
      const customer = await checked(
        db
          .from("mow_customers")
          .select("id,name,address,city,email,phone")
          .eq("company_id", company.id)
          .eq("id", b.customer_id)
          .maybeSingle(),
      );
      if (
        !customer ||
        !customer.email ||
        customer.email.toLowerCase() !== user.email?.toLowerCase()
      )
        return out(
          {
            error: "Use the verified email your lawn care company has on file.",
          },
          403,
        );
      if (b.action === "portal_update") {
        if (typeof b.phone !== "string" || b.phone.length > 30)
          throw Error("Enter a valid phone number");
        await checked(
          db
            .from("mow_customers")
            .update({
              phone: b.phone.trim(),
              updated_at: new Date().toISOString(),
            })
            .eq("company_id", company.id)
            .eq("id", customer.id),
        );
        return out({ ok: true });
      }
      const jobs = await checked(
        db
          .from("mow_crew_jobs")
          .select(
            "id,service_date,scheduled_time,status,services,address,cancelled_at",
          )
          .eq("company_id", company.id)
          .eq("customer_id", customer.id)
          .order("service_date", { ascending: false })
          .limit(100),
      );
      const invoices = await checked(
        db
          .from("mow_customer_invoices")
          .select("*")
          .eq("company_id", company.id)
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(100),
      );
      return out({
        company,
        customer,
        jobs,
        invoices: invoices.map((i: any) => ({
          ...i,
          html: invoiceHTML(i, portalURL(company.id, customer.id)),
        })),
      });
    }
    if (!owner) return out({ error: "Owner access required" }, 403);
    if (b.action === "get") {
      const invoices = await checked(
        db
          .from("mow_customer_invoices")
          .select("*")
          .eq("company_id", company.id)
          .order("created_at", { ascending: false })
          .limit(100),
      );
      return out({
        company,
        invoices: invoices.map((i: any) => ({
          ...i,
          html: invoiceHTML(i, portalURL(company.id, i.customer_id)),
        })),
      });
    }
    if (b.action === "save") {
      if (
        typeof b.name !== "string" ||
        b.name.trim().length < 2 ||
        b.name.length > 120
      )
        throw Error("Enter your business name");
      const branding = {
        ...normalizeBrand(b.branding || {}),
        logo_url: company.branding?.logo_url || "",
      };
      await checked(
        db
          .from("mow_crew_companies")
          .update({ name: b.name.trim(), branding })
          .eq("id", company.id),
      );
      return out({ ok: true });
    }
    if (b.action === "logo") {
      const file = form?.get("file");
      if (
        !(file instanceof File) ||
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size < 1 ||
        file.size > 2097152
      )
        throw Error("Use a PNG, JPG or WebP under 2 MB");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const type =
        bytes[0] === 137 &&
        bytes[1] === 80 &&
        bytes[2] === 78 &&
        bytes[3] === 71
          ? "image/png"
          : bytes[0] === 255 && bytes[1] === 216
            ? "image/jpeg"
            : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
                String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
              ? "image/webp"
              : null;
      if (type !== file.type) throw Error("Invalid logo file");
      const path = company.id + "/" + crypto.randomUUID();
      await checked(
        db.storage
          .from("mow-business-logos")
          .upload(path, bytes, { contentType: type }),
      );
      const { data } = db.storage.from("mow-business-logos").getPublicUrl(path);
      await checked(
        db
          .from("mow_crew_companies")
          .update({
            branding: { ...company.branding, logo_url: data.publicUrl },
          })
          .eq("id", company.id),
      );
      return out({ ok: true, logo_url: data.publicUrl });
    }
    if (b.action === "remove_logo") {
      const branding = { ...company.branding, logo_url: "" };
      await checked(
        db.from("mow_crew_companies").update({ branding }).eq("id", company.id),
      );
      return out({ ok: true });
    }
    if(b.action==='settlement'){
      if(!uuid(b.invoice_id)||!['open','paid_external','void'].includes(b.status)||typeof b.note!=='string'||b.note.trim().length<3||b.note.length>500)throw Error('Review the invoice state and add a note');
      const changed=await checked(db.from('mow_customer_invoices').update({settlement_status:b.status,settlement_note:b.note.trim(),settlement_by:user.id,settlement_at:new Date().toISOString()}).eq('company_id',company.id).eq('id',b.invoice_id).select('id').maybeSingle());
      if(!changed)throw Error('Invoice unavailable');return out({ok:true});
    }
    if (b.action === "send_invoice") {
      if (!uuid(b.invoice_id)) throw Error("Select an invoice");
      const key = Deno.env.get("RESEND_API_KEY");
      if (!key)
        return out(
          {
            error:
              "Invoice email provider is not configured. Share the customer account link instead.",
          },
          503,
        );
      const invoice = await checked(
        db
          .from("mow_customer_invoices")
          .select("*")
          .eq("company_id", company.id)
          .eq("id", b.invoice_id)
          .single(),
      );
      if(invoice.settlement_status&&invoice.settlement_status!=='open')throw Error('This invoice is settled or void');
      const invoiceJob=await checked(db.from('mow_crew_jobs').select('plan_id,cancelled_at').eq('company_id',company.id).eq('id',invoice.job_id).single());
      if(invoiceJob.cancelled_at)throw Error('Visit was canceled');
      if(invoiceJob.plan_id){const recurring=await checked(db.from('mow_homeowner_subscriptions').select('plan_id').eq('company_id',company.id).eq('plan_id',invoiceJob.plan_id).maybeSingle());if(recurring)throw Error('This visit is billed through recurring payments');}
      const paid=await checked(db.from('mow_payment_checkouts').select('status').eq('company_id',company.id).eq('job_id',invoice.job_id).maybeSingle());if(paid?.status==='paid')throw Error('This visit is already paid');
      if (invoice.email_status === "sent")
        return out({ ok: true, status: "sent" });
      if (
        invoice.email_attempt_at &&
        Date.now() - Date.parse(invoice.email_attempt_at) > 23 * 3600000
      )
        throw Error(
          "Email retry window expired. Share the customer account link instead.",
        );
      const customer = await checked(
        db
          .from("mow_customers")
          .select("email,notification_consent")
          .eq("company_id", company.id)
          .eq("id", invoice.customer_id)
          .single(),
      );
      if (
        !customer.notification_consent ||
        !/^\S+@\S+\.\S+$/.test(customer.email)
      )
        throw Error(
          "Add a customer email and notification consent before sending.",
        );
      const claim = await checked(
        db
          .from("mow_customer_invoices")
          .update({
            email_status: "sending",
            email_attempt_at:
              invoice.email_attempt_at || new Date().toISOString(),
          })
          .eq("company_id", company.id)
          .eq("id", invoice.id)
          .in("email_status", ["draft", "failed"])
          .select("id")
          .maybeSingle(),
      );
      if (!claim)
        return out({ error: "Invoice email is already being processed." }, 409);
      let status = "failed";
      try {
        const link = portalURL(company.id, invoice.customer_id),
          response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + key,
              "Content-Type": "application/json",
              "Idempotency-Key": "mowmatter-invoice-" + invoice.id,
            },
            body: JSON.stringify({
              from: "MowMatter <noreply@mowmatter.com>",
              to: [customer.email],
              ...(invoice.snapshot.branding?.email
                ? { reply_to: invoice.snapshot.branding.email }
                : {}),
              subject: `Invoice MM-${invoice.number} — ${invoice.snapshot.business}`,
              html: invoiceHTML(invoice, link),
              text: `Invoice MM-${invoice.number}: $${(invoice.amount_cents / 100).toFixed(2)}. Manage your account: ${link}`,
            }),
            signal: AbortSignal.timeout(10000),
          });
        if (response.ok && (await response.json()).id) status = "sent";
      } catch {}
      await checked(
        db
          .from("mow_customer_invoices")
          .update({ email_status: status })
          .eq("id", invoice.id)
          .eq("company_id", company.id),
      );
      return out(
        {
          ok: status === "sent",
          status,
          ...(status === "failed"
            ? {
                error:
                  "Email was not accepted. You can retry or share the account link.",
              }
            : {}),
        },
        status === "sent" ? 200 : 502,
      );
    }
    if (b.action === "generate") {
      if (!uuid(b.job_id)) throw Error("Select a completed visit");
      const job = await checked(
        db
          .from("mow_crew_jobs")
          .select("*")
          .eq("id", b.job_id)
          .eq("company_id", company.id)
          .single(),
      );
      if (
        job.status !== "completed" ||
        job.cancelled_at ||
        !job.customer_id ||
        job.price_cents <= 0
      )
        throw Error(
          "Invoice requires a completed visit with a customer and a price",
        );
      const customer = await checked(
        db
          .from("mow_customers")
          .select("name")
          .eq("id", job.customer_id)
          .eq("company_id", company.id)
          .single(),
      );
      await checked(
        db.from("mow_customer_invoices").upsert(
          {
            company_id: company.id,
            customer_id: job.customer_id,
            job_id: job.id,
            amount_cents: job.price_cents,
            snapshot: {
              business: company.name,
              branding: company.branding,
              customer: customer.name,
              address: job.address,
              service_date: job.service_date,
              services: job.services,
            },
          },
          { onConflict: "job_id", ignoreDuplicates: true },
        ),
      );
      return out({ ok: true });
    }
    return out({ error: "Unknown action" }, 400);
  } catch (e) {
    return out(
      { error: e instanceof Error ? e.message : "Unable to save" },
      400,
    );
  }
});
