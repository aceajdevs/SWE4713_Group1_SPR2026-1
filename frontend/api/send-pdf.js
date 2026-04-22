import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

function ensureEnvLoaded() {
  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"];
  const hasAll = required.every((key) => Boolean(process.env[key]));
  if (hasAll) return;

  const candidatePaths = [
    path.resolve(process.cwd(), "..", "..", ".env.local"),
    path.resolve(process.cwd(), ".env.local"),
  ];

  for (const envPath of candidatePaths) {
    try {
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath, override: false });
        break;
      }
    } catch {
      // ignore
    }
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10_000_000) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function badRequest(res, message) {
  res.statusCode = 400;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: false, error: message }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end("Method Not Allowed");
  }

  ensureEnvLoaded();

  let payload;
  try {
    payload = await readJson(req);
  } catch (err) {
    const message = String(err?.message || "Invalid request");
    if (message.toLowerCase().includes("payload too large")) {
      res.statusCode = 413;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ ok: false, error: "Attachment payload too large for this endpoint." }));
    }
    return badRequest(res, "Invalid JSON body.");
  }

  const {
    to,
    subject,
    text,
    filename,
    attachmentBase64,
    attachmentDataUri,
    attachmentContentType,
    pdfBase64,
    pdfDataUri,
  } = payload || {};

  if (!to || typeof to !== "string") return badRequest(res, "`to` is required");

  const effectiveSubject = typeof subject === "string" && subject.trim() ? subject.trim() : "Document";
  const effectiveText = typeof text === "string" ? text : "";
  const effectiveFilename = typeof filename === "string" && filename.trim() ? filename.trim() : "document";

  const legacyPdfBase64 =
    typeof pdfBase64 === "string"
      ? pdfBase64
      : typeof pdfDataUri === "string"
        ? pdfDataUri.replace(/^data:application\/pdf;base64,/, "")
        : "";

  const rawAttachmentBase64 =
    typeof attachmentBase64 === "string"
      ? attachmentBase64
      : typeof attachmentDataUri === "string"
        ? String(attachmentDataUri).replace(/^data:[^;]+;base64,/, "")
        : legacyPdfBase64;

  const effectiveContentType =
    typeof attachmentContentType === "string" && attachmentContentType.trim()
      ? attachmentContentType.trim()
      : legacyPdfBase64
        ? "application/pdf"
        : "application/octet-stream";

  if (!rawAttachmentBase64) {
    return badRequest(res, "Attachment is required (`attachmentBase64` or `attachmentDataUri`).");
  }

  let attachmentBuffer;
  try {
    attachmentBuffer = Buffer.from(rawAttachmentBase64, "base64");
  } catch {
    return badRequest(res, "Invalid base64 attachment");
  }

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE,
    MAIL_FROM
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        ok: false,
        error:
          "Missing server configuration. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM in Vercel env."
      })
    );
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE).toLowerCase() === "true", // true for 465, false for 587
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });

  try {
    const info = await transporter.sendMail({
      from: MAIL_FROM,
      to,
      subject: effectiveSubject,
      text: effectiveText,
      attachments: [
        {
          filename: effectiveFilename,
          content: attachmentBuffer,
          contentType: effectiveContentType,
        }
      ]
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: true, messageId: info.messageId }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: err?.message || "Failed to send email" }));
  }
}

