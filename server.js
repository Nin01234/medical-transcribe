import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");

async function loadLocalEnv() {
  try {
    const envText = await readFile(join(__dirname, ".env"), "utf8");
    for (const line of envText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();
      const value = rawValue.replace(/^["']|["']$/g, "");

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env is optional; demo mode works without it.
  }
}

await loadLocalEnv();

const port = Number(process.env.PORT || 3000);

const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req, maxBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Audio upload is larger than 25 MB."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  const body = await readRequestBody(req, 2 * 1024 * 1024);
  if (!body.length) return {};
  return JSON.parse(body.toString("utf8"));
}

function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function parseGeminiText(responseJson) {
  const textParts = [];
  for (const candidate of responseJson.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (typeof part.text === "string") {
        textParts.push(part.text);
      }
    }
  }
  return textParts.join("\n").trim();
}

function parseJsonText(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

async function callGemini(parts, generationConfig) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
  const body = {
    contents: [{ role: "user", parts }]
  };

  if (generationConfig) {
    body.generation_config = generationConfig;
  }

  let response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY
    },
    body: JSON.stringify(body)
  });

  let payload = await response.json();

  if (!response.ok && generationConfig) {
    const fallbackBody = {
      contents: body.contents,
      generationConfig: {
        responseMimeType: generationConfig.response_format?.text?.mime_type,
        responseSchema: generationConfig.response_schema,
        temperature: generationConfig.temperature
      }
    };

    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify(fallbackBody)
    });
    payload = await response.json();
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || "Gemini request failed.");
  }

  const text = parseGeminiText(payload);
  if (!text) {
    throw new Error("Gemini returned no text.");
  }

  return text;
}

const SCRIBE_SYSTEM_PROMPT = `You are MedTranscription AI Scribe, an advanced clinical documentation assistant designed for healthcare professionals.

PRIMARY ROLE
- Listen to or analyze clinician-patient conversations.
- Generate accurate, structured clinical documentation.
- Reduce administrative burden while maintaining clinical accuracy.
- Never invent facts not mentioned in the conversation.
- Clearly distinguish between confirmed information and assumptions.
- If information is missing, mark it as "Not documented" rather than guessing.

OUTPUT REQUIREMENTS — populate every section from the transcript only:
1. Patient Information (full name, age, sex, patient ID, visit date, referring facility)
2. Chief Complaint
3. History of Present Illness (symptoms, duration, severity, associated symptoms, aggravating/relieving factors)
4. Past Medical History (chronic diseases, surgeries, hospitalizations)
5. Medication History (current medications and dosages if available)
6. Allergies (drug, food, environmental)
7. Family History
8. Social History (smoking, alcohol, occupation, exercise)
9. Review of Systems
10. Physical Examination Findings
11. Assessment (differential diagnoses and clinical impressions)
12. Plan (investigations, medications, referrals, follow-up instructions)
13. Referral Summary (reason, urgency, supporting findings)
14. Patient Instructions (plain language, medication guidance, warning signs)

ADVANCED FEATURES
A. SOAP Note: Subjective, Objective, Assessment, Plan
B. Referral Letter: referring clinician, receiving clinician, findings, investigations, requested actions
C. ICD-10 Suggestions — include disclaimer: "Suggested codes only. Final coding must be reviewed by a qualified clinician."
D. Risk Detection — flag chest pain, stroke symptoms, suicidal ideation, severe bleeding, respiratory distress, sepsis indicators, critical vital signs when present
E. Medication Safety — flag duplicates, interactions, allergy conflicts when detectable
F. Missing Information — list important undocumented items
G. Quality Assurance — documentation completeness score (0-100), missing information list, clinical risk flags

FORMATTING: Professional medical language, bullet points where appropriate, concise but complete. Never fabricate. Mark uncertain information clearly.

COMPLIANCE: Protect patient privacy. Inform clinicians that AI output requires review before clinical use.`;

const NOTE_SCHEMA = {
  type: "object",
  required: ["note"],
  properties: {
    note: {
      type: "object",
      required: [
        "clinical_summary",
        "patient_information",
        "chief_complaint",
        "history_of_present_illness",
        "past_medical_history",
        "medication_history",
        "allergies",
        "family_history",
        "social_history",
        "review_of_systems",
        "physical_examination_findings",
        "assessment",
        "differential_diagnoses",
        "clinical_impressions",
        "plan",
        "investigations",
        "medications",
        "referrals",
        "follow_up_instructions",
        "referral_summary",
        "referral_reason",
        "referral_urgency",
        "referral_supporting_findings",
        "patient_instructions",
        "medication_guidance",
        "warning_signs",
        "soap_subjective",
        "soap_objective",
        "soap_assessment",
        "soap_plan",
        "referral_letter",
        "icd10_suggestions",
        "icd10_disclaimer",
        "risk_alerts",
        "medication_safety_flags",
        "missing_information",
        "documentation_completeness_score",
        "clinical_risk_flags",
        "follow_up_recommendations",
        "patient_friendly_summary",
        "doctor_review_required"
      ],
      properties: {
        clinical_summary: { type: "string" },
        patient_information: {
          type: "object",
          properties: {
            full_name: { type: "string" },
            age: { type: "string" },
            sex: { type: "string" },
            patient_id: { type: "string" },
            visit_date: { type: "string" },
            referring_facility: { type: "string" }
          }
        },
        chief_complaint: { type: "string" },
        history_of_present_illness: { type: "string" },
        past_medical_history: { type: "string" },
        medication_history: { type: "string" },
        allergies: { type: "string" },
        family_history: { type: "string" },
        social_history: { type: "string" },
        review_of_systems: { type: "string" },
        physical_examination_findings: { type: "string" },
        assessment: { type: "string" },
        differential_diagnoses: { type: "array", items: { type: "string" } },
        clinical_impressions: { type: "array", items: { type: "string" } },
        plan: { type: "string" },
        investigations: { type: "array", items: { type: "string" } },
        medications: { type: "array", items: { type: "string" } },
        referrals: { type: "array", items: { type: "string" } },
        follow_up_instructions: { type: "string" },
        referral_summary: { type: "string" },
        referral_reason: { type: "string" },
        referral_urgency: { type: "string" },
        referral_supporting_findings: { type: "string" },
        patient_instructions: { type: "string" },
        medication_guidance: { type: "string" },
        warning_signs: { type: "array", items: { type: "string" } },
        soap_subjective: { type: "string" },
        soap_objective: { type: "string" },
        soap_assessment: { type: "string" },
        soap_plan: { type: "string" },
        referral_letter: { type: "string" },
        icd10_suggestions: { type: "array", items: { type: "string" } },
        icd10_disclaimer: { type: "string" },
        risk_alerts: { type: "array", items: { type: "string" } },
        medication_safety_flags: { type: "array", items: { type: "string" } },
        missing_information: { type: "array", items: { type: "string" } },
        documentation_completeness_score: { type: "number" },
        clinical_risk_flags: { type: "array", items: { type: "string" } },
        follow_up_recommendations: { type: "array", items: { type: "string" } },
        patient_friendly_summary: { type: "string" },
        doctor_review_required: { type: "boolean" }
      }
    }
  }
};

function emptyNote(overrides = {}) {
  return {
    clinical_summary: "Not documented.",
    patient_information: {
      full_name: "Not documented.",
      age: "Not documented.",
      sex: "Not documented.",
      patient_id: "Not documented.",
      visit_date: "Not documented.",
      referring_facility: "Not documented."
    },
    chief_complaint: "Not documented.",
    history_of_present_illness: "Not documented.",
    past_medical_history: "Not documented.",
    medication_history: "Not documented.",
    allergies: "Not documented.",
    family_history: "Not documented.",
    social_history: "Not documented.",
    review_of_systems: "Not documented.",
    physical_examination_findings: "Not documented.",
    assessment: "Not documented.",
    differential_diagnoses: ["Not documented."],
    clinical_impressions: ["Not documented."],
    plan: "Not documented.",
    investigations: ["Not documented."],
    medications: ["Not documented."],
    referrals: ["Not documented."],
    follow_up_instructions: "Not documented.",
    referral_summary: "Not documented.",
    referral_reason: "Not documented.",
    referral_urgency: "Not documented.",
    referral_supporting_findings: "Not documented.",
    patient_instructions: "Not documented.",
    medication_guidance: "Not documented.",
    warning_signs: ["Not documented."],
    soap_subjective: "Not documented.",
    soap_objective: "Not documented.",
    soap_assessment: "Not documented.",
    soap_plan: "Not documented.",
    referral_letter: "Not documented.",
    icd10_suggestions: ["Not documented."],
    icd10_disclaimer: "Suggested codes only. Final coding must be reviewed by a qualified clinician.",
    risk_alerts: ["None identified from transcript."],
    medication_safety_flags: ["None identified from transcript."],
    missing_information: ["No additional gaps identified."],
    documentation_completeness_score: 0,
    clinical_risk_flags: ["None identified from transcript."],
    follow_up_recommendations: ["Not documented."],
    patient_friendly_summary: "Not documented.",
    doctor_review_required: true,
    ...overrides
  };
}

function mergePatientContext(note, context = {}) {
  const patientInfo = { ...note.patient_information };
  if (context.patient_name) patientInfo.full_name = context.patient_name;
  if (context.patient_id) patientInfo.patient_id = context.patient_id;
  if (context.referring_facility) patientInfo.referring_facility = context.referring_facility;
  if (context.visit_date) patientInfo.visit_date = context.visit_date;
  if (context.visit_type) {
    patientInfo.referring_facility = patientInfo.referring_facility || context.visit_type;
  }
  return { ...note, patient_information: patientInfo };
}

function demoClinicalNote(transcript, context = {}) {
  const cleaned = transcript.trim() || "No transcript was provided.";
  const note = emptyNote({
    clinical_summary: cleaned,
    history_of_present_illness: cleaned,
    patient_friendly_summary: cleaned,
    missing_information: ["Demo mode: set GEMINI_API_KEY for live transcription and AI formatting."],
    documentation_completeness_score: 35
  });
  return {
    status: "demo",
    transcript: cleaned,
    note: mergePatientContext(note, context)
  };
}

async function transcribeAudio(audioBuffer, contentType) {
  if (!hasGeminiKey()) {
    return {
      status: "demo",
      transcript:
        "Demo transcript: The patient reports fever, headache, chills, and body weakness for three days. No vomiting or chest pain. Patient has a history of hypertension and takes amlodipine 5 mg daily."
    };
  }

  const transcript = await callGemini([
    {
      text:
        "Transcribe this clinical consultation audio into clear, speaker-neutral text. If the patient or clinician speaks in a local Ghanaian language like Twi (Akan), transcribe and translate it directly into clear English. Capture medically relevant details accurately. Do not summarize."
    },
    {
      inlineData: {
        mimeType: contentType || "audio/webm",
        data: audioBuffer.toString("base64")
      }
    }
  ]);

  return {
    status: "live",
    transcript
  };
}

function buildFormatPrompt(transcript, context = {}) {
  const contextLines = [];
  if (context.patient_name) contextLines.push(`Known patient name: ${context.patient_name}`);
  if (context.patient_id) contextLines.push(`Known patient ID: ${context.patient_id}`);
  if (context.visit_type) contextLines.push(`Visit type: ${context.visit_type}`);
  if (context.referring_facility) contextLines.push(`Referring facility: ${context.referring_facility}`);
  if (context.visit_date) contextLines.push(`Visit date: ${context.visit_date}`);

  const contextBlock = contextLines.length
    ? `\n\nClinician-provided context (use when not contradicted by transcript):\n${contextLines.join("\n")}`
    : "";

  return `Analyze this clinician-patient conversation transcript and return structured clinical documentation as JSON.${contextBlock}\n\nTranscript:\n\n${transcript}`;
}

async function formatClinicalNote(transcript, context = {}) {
  if (!hasGeminiKey()) {
    return demoClinicalNote(transcript, context);
  }

  const text = await callGemini(
    [{ text: `${SCRIBE_SYSTEM_PROMPT}\n\n${buildFormatPrompt(transcript, context)}` }],
    {
      temperature: 0.1,
      response_format: {
        type: "json_schema",
        text: { mime_type: "application/json" }
      },
      response_schema: NOTE_SCHEMA
    }
  );

  const parsed = parseJsonText(text);
  return {
    status: "live",
    transcript,
    note: mergePatientContext(parsed.note || emptyNote(), context)
  };
}

async function handleAnalyze(req, res) {
  try {
    const audioBuffer = await readRequestBody(req);
    if (!audioBuffer.length) {
      sendJson(res, 400, { error: "No audio was received." });
      return;
    }

    const transcription = await transcribeAudio(audioBuffer, req.headers["content-type"]);
    const formatted = await formatClinicalNote(transcription.transcript);

    sendJson(res, 200, {
      provider: hasGeminiKey() ? "gemini" : "demo",
      mode: hasGeminiKey() ? "live" : "demo",
      transcription_model: hasGeminiKey() ? geminiModel : null,
      note_model: hasGeminiKey() ? geminiModel : null,
      transcript: transcription.transcript,
      note: formatted.note
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unexpected server error." });
  }
}

async function handleTranscribe(req, res) {
  try {
    const audioBuffer = await readRequestBody(req);
    if (!audioBuffer.length) {
      sendJson(res, 400, { error: "No audio was received." });
      return;
    }

    const transcription = await transcribeAudio(audioBuffer, req.headers["content-type"]);
    sendJson(res, 200, {
      provider: hasGeminiKey() ? "gemini" : "demo",
      mode: hasGeminiKey() ? "live" : "demo",
      transcription_model: hasGeminiKey() ? geminiModel : null,
      transcript: transcription.transcript
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unexpected server error." });
  }
}

async function handleFormat(req, res) {
  try {
    const body = await readJsonBody(req);
    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";

    if (!transcript) {
      sendJson(res, 400, { error: "No transcript was received." });
      return;
    }

    const formatted = await formatClinicalNote(transcript, body.context || {});
    sendJson(res, 200, {
      provider: hasGeminiKey() ? "gemini" : "demo",
      mode: hasGeminiKey() ? "live" : "demo",
      note_model: hasGeminiKey() ? geminiModel : null,
      transcript,
      note: formatted.note
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unexpected server error." });
  }
}

async function serveStatic(req, res) {
  const requestedPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  const safePath = normalize(requestedPath === "/" ? "/index.html" : requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = createServer((req, res) => {
  if (req.method === "POST" && req.url?.startsWith("/api/analyze")) {
    handleAnalyze(req, res);
    return;
  }

  if (req.method === "POST" && req.url?.startsWith("/api/transcribe")) {
    handleTranscribe(req, res);
    return;
  }

  if (req.method === "POST" && req.url?.startsWith("/api/format")) {
    handleFormat(req, res);
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed." });
});

server.on("error", (error) => {
  console.error(`Server failed to start: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, () => {
  console.log(`MedTranscription AI Scribe running at http://localhost:${port}`);
});
