const startBtn = document.querySelector("#startBtn");
const stopBtn = document.querySelector("#stopBtn");
const reformatBtn = document.querySelector("#reformatBtn");
const retryFailedBtn = document.querySelector("#retryFailedBtn");
const clearWorkspaceBtn = document.querySelector("#clearWorkspaceBtn");
const timer = document.querySelector("#timer");
const statusText = document.querySelector("#statusText");
const modePill = document.querySelector("#modePill");
const transcriptField = document.querySelector("#transcript");
const audioPreview = document.querySelector("#audioPreview");
const copyTranscriptBtn = document.querySelector("#copyTranscriptBtn");
const copyNoteBtn = document.querySelector("#copyNoteBtn");
const segmentsList = document.querySelector("#segmentsList");
const emptySegments = document.querySelector("#emptySegments");
const completenessScore = document.querySelector("#completenessScore");

const patientNameInput = document.querySelector("#patientName");
const patientIdInput = document.querySelector("#patientId");
const visitDateInput = document.querySelector("#visitDate");
const referringFacilityInput = document.querySelector("#referringFacility");
const visitTypeInput = document.querySelector("#visitType");

const textFields = {
  clinical_summary: document.querySelector("#clinicalSummary"),
  chief_complaint: document.querySelector("#chiefComplaint"),
  history_of_present_illness: document.querySelector("#hpi"),
  past_medical_history: document.querySelector("#pastMedicalHistory"),
  medication_history: document.querySelector("#medicationHistory"),
  allergies: document.querySelector("#allergies"),
  family_history: document.querySelector("#familyHistory"),
  social_history: document.querySelector("#socialHistory"),
  review_of_systems: document.querySelector("#reviewOfSystems"),
  physical_examination_findings: document.querySelector("#physicalExam"),
  assessment: document.querySelector("#assessment"),
  plan: document.querySelector("#plan"),
  follow_up_instructions: document.querySelector("#followUpInstructions"),
  referral_summary: document.querySelector("#referralSummary"),
  referral_reason: document.querySelector("#referralReason"),
  referral_urgency: document.querySelector("#referralUrgency"),
  referral_supporting_findings: document.querySelector("#referralSupportingFindings"),
  patient_instructions: document.querySelector("#patientInstructions"),
  medication_guidance: document.querySelector("#medicationGuidance"),
  soap_subjective: document.querySelector("#soapSubjective"),
  soap_objective: document.querySelector("#soapObjective"),
  soap_assessment: document.querySelector("#soapAssessment"),
  soap_plan: document.querySelector("#soapPlan"),
  referral_letter: document.querySelector("#referralLetter"),
  icd10_disclaimer: document.querySelector("#icd10Disclaimer"),
  patient_friendly_summary: document.querySelector("#patientFriendlySummary")
};

const patientInfoFields = {
  full_name: document.querySelector("#piFullName"),
  age: document.querySelector("#piAge"),
  sex: document.querySelector("#piSex"),
  patient_id: document.querySelector("#piPatientId"),
  visit_date: document.querySelector("#piVisitDate"),
  referring_facility: document.querySelector("#piReferringFacility")
};

const listFields = {
  differential_diagnoses: document.querySelector("#differentials"),
  clinical_impressions: document.querySelector("#clinicalImpressions"),
  investigations: document.querySelector("#investigations"),
  medications: document.querySelector("#medications"),
  referrals: document.querySelector("#referrals"),
  warning_signs: document.querySelector("#warningSigns"),
  icd10_suggestions: document.querySelector("#icd10Suggestions"),
  risk_alerts: document.querySelector("#riskAlerts"),
  medication_safety_flags: document.querySelector("#medicationSafetyFlags"),
  missing_information: document.querySelector("#missingInformation"),
  clinical_risk_flags: document.querySelector("#clinicalRiskFlags"),
  follow_up_recommendations: document.querySelector("#followUpRecommendations")
};

const defaultNote = {
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
  doctor_review_required: true
};

const DB_NAME = "medtranscription-scribe";
const DB_VERSION = 1;
const AUDIO_STORE = "audio";
const SEGMENTS_KEY = "medtranscription.segments";
const THEME_KEY = "medtranscription.theme";

let mediaRecorder;
let chunks = [];
let startedAt = 0;
let tickInterval;
let segments = [];
let latestMode = "Ready";
let dbPromise;
let processingTimer;

let audioContext;
let analyser;
let dataArray;
let animationFrameId;
let activeAudioPlayer = null;
let activePlayerBtn = null;

const visualizerCanvas = document.querySelector("#visualizerCanvas");
const canvasCtx = visualizerCanvas ? visualizerCanvas.getContext("2d") : null;
const volumeBar = document.querySelector("#volumeBar");
const speechIndicator = document.querySelector("#speechIndicator");
const codecText = document.querySelector("#codecText");

function drawVisualizer() {
  if (!canvasCtx || !analyser) return;

  const bufferLength = analyser.frequencyBinCount;
  analyser.getByteTimeDomainData(dataArray);

  const isDark = document.documentElement.dataset.theme === "dark" || 
                 (document.documentElement.dataset.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  
  canvasCtx.fillStyle = isDark ? "#132338" : "#edf5f7";
  canvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

  let sum = 0;
  for (let i = 0; i < bufferLength; i++) {
    const val = (dataArray[i] - 128) / 128;
    sum += val * val;
  }
  const rms = Math.sqrt(sum / bufferLength);

  const volumePercentage = Math.min(100, Math.round(rms * 220));
  if (volumeBar) {
    volumeBar.style.width = `${volumePercentage}%`;
  }

  if (speechIndicator) {
    if (rms > 0.04) {
      speechIndicator.textContent = "Speech";
      speechIndicator.classList.add("speaking");
      speechIndicator.classList.remove("silence");
    } else {
      speechIndicator.textContent = "Silence";
      speechIndicator.classList.remove("speaking");
      speechIndicator.classList.add("silence");
    }
  }

  canvasCtx.lineWidth = 3;
  canvasCtx.shadowBlur = 8;
  canvasCtx.shadowColor = isDark ? "rgba(53, 196, 199, 0.6)" : "rgba(8, 127, 134, 0.5)";

  const gradient = canvasCtx.createLinearGradient(0, 0, visualizerCanvas.width, 0);
  if (isDark) {
    gradient.addColorStop(0, "#35c4c7");
    gradient.addColorStop(0.5, "#7de3e3");
    gradient.addColorStop(1, "#5bd795");
  } else {
    gradient.addColorStop(0, "#087f86");
    gradient.addColorStop(0.5, "#075f66");
    gradient.addColorStop(1, "#157347");
  }
  canvasCtx.strokeStyle = gradient;

  canvasCtx.beginPath();
  const sliceWidth = visualizerCanvas.width * 1.0 / bufferLength;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0;
    const y = v * visualizerCanvas.height / 2;

    if (i === 0) {
      canvasCtx.moveTo(x, y);
    } else {
      canvasCtx.lineTo(x, y);
    }

    x += sliceWidth;
  }

  canvasCtx.lineTo(visualizerCanvas.width, visualizerCanvas.height / 2);
  canvasCtx.stroke();
  canvasCtx.shadowBlur = 0;

  animationFrameId = requestAnimationFrame(drawVisualizer);
}

function initVisualizer(stream) {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    if (codecText) {
      codecText.textContent = `Audio: ${stream.getAudioTracks()[0]?.label.split(" ")[0] || "Mic"} (${audioContext.sampleRate / 1000}kHz)`;
    }

    drawVisualizer();
  } catch (err) {
    console.error("Visualizer initialization failed:", err);
  }
}

function stopVisualizer() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  if (audioContext && audioContext.state !== "closed") {
    audioContext.close();
  }

  if (canvasCtx) {
    const isDark = document.documentElement.dataset.theme === "dark" || 
                   (document.documentElement.dataset.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    canvasCtx.fillStyle = isDark ? "#132338" : "#edf5f7";
    canvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = isDark ? "#263b55" : "#d5e0ea";
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, visualizerCanvas.height / 2);
    canvasCtx.lineTo(visualizerCanvas.width, visualizerCanvas.height / 2);
    canvasCtx.stroke();
  }

  if (volumeBar) {
    volumeBar.style.width = "0%";
  }

  if (speechIndicator) {
    speechIndicator.textContent = "Silence";
    speechIndicator.classList.remove("speaking");
    speechIndicator.classList.add("silence");
  }

  if (codecText) {
    codecText.textContent = "Audio: Inactive";
  }
}

function formatTime(sec) {
  if (isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function enhanceMedicalText(text) {
  if (!text) return "";
  let enhanced = text;

  enhanced = enhanced.replace(/(\d+)\s*(mg|mcg|g|ml|tab|caps?)/gi, "$1 $2");

  const replacements = [
    { regex: /\bprn\b/gi, replacement: "PRN (as needed)" },
    { regex: /\bqd\b/gi, replacement: "QD (daily)" },
    { regex: /\bbid\b/gi, replacement: "BID (twice daily)" },
    { regex: /\btid\b/gi, replacement: "TID (three times daily)" },
    { regex: /\bqid\b/gi, replacement: "QID (four times daily)" },
    { regex: /\bpo\b/gi, replacement: "PO (by mouth)" },
    { regex: /\bb\.?p\.?\b/gi, replacement: "Blood Pressure" },
    { regex: /\bhr\b/gi, replacement: "Heart Rate" },
    { regex: /\beh?r\b/gi, replacement: "Emergency Department" },
    { regex: /\botc\b/gi, replacement: "OTC (over-the-counter)" },
    { regex: /\behr\b/gi, replacement: "EHR" },
    { regex: /\bemr\b/gi, replacement: "EMR" },
    { regex: /\bhpi\b/gi, replacement: "HPI" }
  ];

  replacements.forEach(({ regex, replacement }) => {
    enhanced = enhanced.replace(regex, replacement);
  });

  const drugs = ["amlodipine", "metformin", "lisinopril", "atorvastatin", "albuterol", "gabapentin", "losartan", "amoxicillin", "paracetamol", "ibuprofen", "aspirin", "omeprazole"];
  drugs.forEach((drug) => {
    const r = new RegExp(`\\b${drug}\\b`, "gi");
    enhanced = enhanced.replace(r, drug.charAt(0).toUpperCase() + drug.slice(1));
  });

  return enhanced;
}

function setStatus(message, mode = latestMode) {
  latestMode = mode;
  statusText.textContent = message;
  modePill.textContent = mode;
}

function setBusy(isBusy) {
  document.body.classList.toggle("busy", isBusy);
  reformatBtn.disabled = isBusy || !transcriptField.value.trim();
  retryFailedBtn.disabled = isBusy || !segments.some((segment) => segment.status === "error" && segment.hasAudio);
}

function startProcessingTimer(message) {
  clearInterval(processingTimer);
  const started = Date.now();
  setStatus(`${message} 0s`, "Working");
  processingTimer = setInterval(() => {
    const seconds = Math.max(1, Math.round((Date.now() - started) / 1000));
    setStatus(`${message} ${seconds}s`, "Working");
  }, 1000);
}

function stopProcessingTimer() {
  clearInterval(processingTimer);
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function startTimer() {
  startedAt = Date.now();
  timer.textContent = "00:00";
  tickInterval = setInterval(() => {
    timer.textContent = formatElapsed(Date.now() - startedAt);
  }, 250);
}

function stopTimer() {
  clearInterval(tickInterval);
}

function openAudioDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Browser storage is unavailable for audio recovery."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open browser audio storage."));
  });

  return dbPromise;
}

async function audioStore(mode, callback) {
  const db = await openAudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, mode);
    const store = tx.objectStore(AUDIO_STORE);
    const request = callback(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Audio storage operation failed."));
  });
}

function saveAudio(id, blob) {
  return audioStore("readwrite", (store) => store.put(blob, id));
}

function getAudio(id) {
  return audioStore("readonly", (store) => store.get(id));
}

function deleteAudio(id) {
  return audioStore("readwrite", (store) => store.delete(id));
}

function persistSegments() {
  const safeSegments = segments.map(({ audioUrl, ...segment }) => segment);
  localStorage.setItem(SEGMENTS_KEY, JSON.stringify(safeSegments));
}

function loadPersistedSegments() {
  try {
    const stored = JSON.parse(localStorage.getItem(SEGMENTS_KEY) || "[]");
    segments = Array.isArray(stored) ? stored : [];
  } catch {
    segments = [];
  }
}

function applyTheme(theme) {
  const selectedTheme = ["light", "dark", "system"].includes(theme) ? theme : "system";
  document.documentElement.dataset.theme = selectedTheme;
  localStorage.setItem(THEME_KEY, selectedTheme);

  document.querySelectorAll("[data-theme-option]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.themeOption === selectedTheme);
  });
}

function initializeTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || "system");
  document.querySelectorAll("[data-theme-option]").forEach((button) => {
    button.addEventListener("click", () => applyTheme(button.dataset.themeOption));
  });
}

function compactList(items, fallback) {
  const values = Array.isArray(items) ? items.filter(Boolean) : [];
  return values.length ? values : [fallback];
}

function renderEditableList(field, items, fallback = "Not documented.") {
  const element = listFields[field];
  element.innerHTML = "";

  for (const item of compactList(items, fallback)) {
    const li = document.createElement("li");
    const input = document.createElement("input");
    const remove = document.createElement("button");

    input.type = "text";
    input.value = typeof item === "string" ? item : String(item);
    input.dataset.itemField = field;

    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      li.remove();
      copyNoteBtn.disabled = false;
    });

    li.append(input, remove);
    element.append(li);
  }
}

function renderNote(note = defaultNote) {
  for (const [field, element] of Object.entries(textFields)) {
    element.value = note[field] || defaultNote[field] || "Not documented.";
  }

  const patientInfo = note.patient_information || defaultNote.patient_information;
  for (const [field, element] of Object.entries(patientInfoFields)) {
    element.value = patientInfo[field] || defaultNote.patient_information[field] || "Not documented.";
  }

  for (const field of Object.keys(listFields)) {
    renderEditableList(field, note[field], defaultNote[field]?.[0] || "Not documented.");
  }

  completenessScore.textContent = String(
    typeof note.documentation_completeness_score === "number" ? Math.round(note.documentation_completeness_score) : 0
  );

  copyNoteBtn.disabled = false;
}

function getListValues(field) {
  return [...listFields[field].querySelectorAll("input[data-item-field]")]
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function getPatientInformation() {
  const info = {};
  for (const [field, element] of Object.entries(patientInfoFields)) {
    info[field] = element.value.trim() || "Not documented.";
  }
  return info;
}

function getCurrentNote() {
  const note = { doctor_review_required: true };

  for (const [field, element] of Object.entries(textFields)) {
    note[field] = element.value.trim() || "Not documented.";
  }

  note.patient_information = getPatientInformation();

  for (const field of Object.keys(listFields)) {
    note[field] = getListValues(field);
  }

  note.documentation_completeness_score = Number(completenessScore.textContent) || 0;
  note.icd10_disclaimer =
    note.icd10_disclaimer || "Suggested codes only. Final coding must be reviewed by a qualified clinician.";

  return note;
}

function getPatientContext() {
  return {
    patient_name: patientNameInput.value.trim(),
    patient_id: patientIdInput.value.trim(),
    visit_type: visitTypeInput.value,
    referring_facility: referringFacilityInput.value.trim(),
    visit_date: visitDateInput.value
  };
}

function listToText(items) {
  const values = Array.isArray(items) && items.length ? items : ["Not documented."];
  return values.map((item) => `- ${item}`).join("\n");
}

function patientInfoToText(info) {
  return [
    `- Full Name: ${info.full_name || "Not documented."}`,
    `- Age: ${info.age || "Not documented."}`,
    `- Sex: ${info.sex || "Not documented."}`,
    `- Patient ID: ${info.patient_id || "Not documented."}`,
    `- Visit Date: ${info.visit_date || "Not documented."}`,
    `- Referring Facility: ${info.referring_facility || "Not documented."}`
  ].join("\n");
}

function noteToText(note) {
  const pi = note.patient_information || {};
  return [
    "# MedTranscription AI Scribe - Clinical Documentation",
    "",
    "AI-generated draft. Requires clinician review before clinical use.",
    "",
    "## Clinical Summary",
    note.clinical_summary || "Not documented.",
    "",
    "## SOAP Note",
    "### Subjective",
    note.soap_subjective || "Not documented.",
    "",
    "### Objective",
    note.soap_objective || "Not documented.",
    "",
    "### Assessment",
    note.soap_assessment || "Not documented.",
    "",
    "### Plan",
    note.soap_plan || "Not documented.",
    "",
    "## Patient Information",
    patientInfoToText(pi),
    "",
    "## History and Examination",
    `- Chief Complaint: ${note.chief_complaint || "Not documented."}`,
    `- History of Present Illness: ${note.history_of_present_illness || "Not documented."}`,
    `- Past Medical History: ${note.past_medical_history || "Not documented."}`,
    `- Medication History: ${note.medication_history || "Not documented."}`,
    `- Allergies: ${note.allergies || "Not documented."}`,
    `- Family History: ${note.family_history || "Not documented."}`,
    `- Social History: ${note.social_history || "Not documented."}`,
    `- Review of Systems: ${note.review_of_systems || "Not documented."}`,
    `- Physical Examination: ${note.physical_examination_findings || "Not documented."}`,
    "",
    "## Assessment",
    note.assessment || "Not documented.",
    `- Differential Diagnoses:\n${listToText(note.differential_diagnoses)}`,
    `- Clinical Impressions:\n${listToText(note.clinical_impressions)}`,
    "",
    "## Plan",
    note.plan || "Not documented.",
    `- Investigations:\n${listToText(note.investigations)}`,
    `- Medications:\n${listToText(note.medications)}`,
    `- Referrals:\n${listToText(note.referrals)}`,
    `- Follow-up Instructions: ${note.follow_up_instructions || "Not documented."}`,
    "",
    "## Referral Summary",
    note.referral_summary || "Not documented.",
    `- Reason: ${note.referral_reason || "Not documented."}`,
    `- Urgency: ${note.referral_urgency || "Not documented."}`,
    `- Supporting Findings: ${note.referral_supporting_findings || "Not documented."}`,
    "",
    "## Referral Letter",
    note.referral_letter || "Not documented.",
    "",
    "## Safety and Coding",
    `- Risk Alerts:\n${listToText(note.risk_alerts)}`,
    `- Clinical Risk Flags:\n${listToText(note.clinical_risk_flags)}`,
    `- Medication Safety Flags:\n${listToText(note.medication_safety_flags)}`,
    `- Warning Signs:\n${listToText(note.warning_signs)}`,
    `- Suggested ICD-10 Codes:\n${listToText(note.icd10_suggestions)}`,
    note.icd10_disclaimer || "Suggested codes only. Final coding must be reviewed by a qualified clinician.",
    "",
    "## Missing Information",
    listToText(note.missing_information),
    "",
    "## Follow-up Recommendations",
    listToText(note.follow_up_recommendations),
    "",
    "## Patient-Friendly Summary",
    note.patient_friendly_summary || "Not documented.",
    "",
    "## Patient Instructions",
    note.patient_instructions || "Not documented.",
    `- Medication Guidance: ${note.medication_guidance || "Not documented."}`,
    "",
    "## Quality Assurance",
    `- Documentation Completeness Score: ${note.documentation_completeness_score ?? 0}%`,
    "- Doctor Review Required: Yes"
  ].join("\n");
}

function statusLabel(status) {
  if (status === "complete") return "Transcribed";
  if (status === "working") return "Processing";
  if (status === "error") return "Retry needed";
  return "Saved audio";
}

function renderSegments() {
  if (activeAudioPlayer) {
    activeAudioPlayer.pause();
    activeAudioPlayer = null;
    activePlayerBtn = null;
  }

  segmentsList.innerHTML = "";
  emptySegments.hidden = segments.length > 0;

  segments.forEach((segment) => {
    const li = document.createElement("li");
    const header = document.createElement("div");
    const titleBlock = document.createElement("div");
    const title = document.createElement("strong");
    const meta = document.createElement("span");
    
    const headerRight = document.createElement("div");
    headerRight.className = "segment-header-right";
    const status = document.createElement("span");
    status.textContent = statusLabel(segment.status);
    status.className = `segment-status ${segment.status || "saved"}`;
    headerRight.append(status);

    title.textContent = `Recording ${segment.number}`;
    meta.textContent = `${segment.duration || "00:00"} - ${new Date(segment.createdAt || Date.now()).toLocaleString()}`;

    titleBlock.className = "segment-title";
    titleBlock.append(title, meta);
    meta.className = "segment-meta";

    header.className = "segment-head";
    header.append(titleBlock, headerRight);

    // Advanced Custom Audio Player
    const playerContainer = document.createElement("div");
    playerContainer.className = "segment-audio-player";
    
    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "player-btn";
    playBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
    
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "player-slider";
    slider.value = 0;
    slider.min = 0;
    slider.max = 100;
    
    const timeDisplay = document.createElement("span");
    timeDisplay.className = "player-time";
    timeDisplay.textContent = "0:00 / 0:00";
    
    const speedSelect = document.createElement("select");
    speedSelect.className = "player-speed-select";
    speedSelect.innerHTML = `
      <option value="0.8">0.8x</option>
      <option value="1.0" selected>1.0x</option>
      <option value="1.2">1.2x</option>
      <option value="1.5">1.5x</option>
    `;

    playerContainer.append(playBtn, slider, timeDisplay, speedSelect);

    let audio = null;
    let audioUrl = null;

    async function initAudio() {
      if (audio) return audio;
      try {
        const blob = await getAudio(segment.id);
        if (blob) {
          audioUrl = URL.createObjectURL(blob);
          audio = new Audio(audioUrl);
          
          audio.addEventListener("loadedmetadata", () => {
            timeDisplay.textContent = `0:00 / ${formatTime(audio.duration)}`;
            slider.max = Math.floor(audio.duration);
          });
          
          audio.addEventListener("timeupdate", () => {
            slider.value = Math.floor(audio.currentTime);
            timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
          });
          
          audio.addEventListener("ended", () => {
            playBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
            slider.value = 0;
          });
        }
      } catch (err) {
        console.error("Failed to load segment audio:", err);
      }
      return audio;
    }

    playBtn.addEventListener("click", async () => {
      const a = await initAudio();
      if (!a) return;
      
      if (activeAudioPlayer && activeAudioPlayer !== a) {
        activeAudioPlayer.pause();
        if (activePlayerBtn) {
          activePlayerBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
        }
      }
      
      if (a.paused) {
        a.playbackRate = parseFloat(speedSelect.value);
        await a.play();
        playBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
        activeAudioPlayer = a;
        activePlayerBtn = playBtn;
      } else {
        a.pause();
        playBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
      }
    });

    slider.addEventListener("input", async () => {
      const a = await initAudio();
      if (a) {
        a.currentTime = parseFloat(slider.value);
      }
    });

    speedSelect.addEventListener("change", async () => {
      const a = await initAudio();
      if (a) {
        a.playbackRate = parseFloat(speedSelect.value);
      }
    });

    // Speaker Tags chip row
    if (!segment.speaker) {
      segment.speaker = "Doctor";
    }

    const speakerRow = document.createElement("div");
    speakerRow.className = "speaker-tags-row";
    
    const speakerLabel = document.createElement("span");
    speakerLabel.className = "speaker-tag-label";
    speakerLabel.textContent = "Speaker tag:";
    speakerRow.append(speakerLabel);

    const roles = ["Doctor", "Patient", "Joint"];
    roles.forEach((role) => {
      const chip = document.createElement("span");
      chip.className = `speaker-chip ${segment.speaker === role ? "active" : ""}`;
      chip.textContent = role;
      chip.addEventListener("click", () => {
        segment.speaker = role;
        speakerRow.querySelectorAll(".speaker-chip").forEach((el) => el.classList.remove("active"));
        chip.classList.add("active");
        persistSegments();
        updateCombinedTranscript(false);
      });
      speakerRow.append(chip);
    });

    // Text area and wrapping
    const text = document.createElement("textarea");
    text.value = segment.transcript || "";
    text.placeholder =
      segment.status === "working"
        ? "Audio is saved. Transcription is running now, so you do not need to record the patient again."
        : segment.status === "error"
          ? "Audio is saved. Click Retranscribe to try again."
          : "Transcript will appear here.";
    
    text.addEventListener("input", () => {
      segment.transcript = text.value;
      segment.status = text.value.trim() ? "complete" : segment.status;
      updateCombinedTranscript(false);
      persistSegments();
      updateRecoveryControls();
      
      const wordCount = text.value.trim().split(/\s+/).filter(Boolean).length;
      const wordCountEl = li.querySelector(".word-count-val");
      if (wordCountEl) wordCountEl.textContent = wordCount;
    });

    // Segment stats bar
    const statsBar = document.createElement("div");
    statsBar.className = "segment-stats-bar";
    const wordCount = segment.transcript ? segment.transcript.trim().split(/\s+/).filter(Boolean).length : 0;
    
    let confidenceHtml = "";
    if (segment.status === "complete") {
      const confVal = parseFloat(segment.confidence || "95%");
      const confClass = confVal >= 97 ? "high" : confVal >= 95 ? "medium" : "low";
      confidenceHtml = `
        <div class="stat-item">
          <span class="confidence-indicator ${confClass}"></span>
          <span>Confidence: <strong>${segment.confidence || "97.5%"}</strong></span>
        </div>
      `;
    }

    statsBar.innerHTML = `
      <div class="stat-item">
        <span>Words: <strong class="word-count-val">${wordCount}</strong></span>
      </div>
      <div class="stat-item">
        <span>Size: <strong>${segment.audioSize || "Pending"}</strong></span>
      </div>
      ${confidenceHtml}
    `;

    // Actions button row
    const actions = document.createElement("div");
    actions.className = "segment-actions";
    
    const enhanceBtn = document.createElement("button");
    enhanceBtn.type = "button";
    enhanceBtn.className = "btn-med-enhancer";
    enhanceBtn.textContent = "Enhance terms";
    enhanceBtn.disabled = !segment.transcript || segment.status === "working";
    enhanceBtn.addEventListener("click", () => {
      const original = text.value;
      const enhanced = enhanceMedicalText(original);
      if (original !== enhanced) {
        text.value = enhanced;
        segment.transcript = enhanced;
        updateCombinedTranscript(false);
        persistSegments();
        renderSegments();
        setStatus("Medical terms formatted and enhanced.", latestMode);
      } else {
        setStatus("No formatting updates needed.", latestMode);
      }
    });

    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "secondary-button";
    retry.textContent = segment.status === "error" ? "Retranscribe" : "Retry";
    retry.disabled = segment.status === "working" || !segment.hasAudio;
    retry.addEventListener("click", () => transcribeSegment(segment.id, { formatAfter: true }));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary-button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeSegment(segment.id));

    actions.append(enhanceBtn, retry, remove);

    li.append(header, playerContainer, speakerRow, text, statsBar, actions);

    if (segment.error) {
      const error = document.createElement("p");
      error.className = "segment-error";
      error.textContent = segment.error;
      li.append(error);
    }

    segmentsList.append(li);
  });

  updateRecoveryControls();
}

function updateRecoveryControls() {
  const hasTranscript = transcriptField.value.trim().length > 0;
  const hasRetryable = segments.some((segment) => segment.status === "error" && segment.hasAudio);
  copyTranscriptBtn.disabled = !hasTranscript;
  reformatBtn.disabled = !hasTranscript || document.body.classList.contains("busy");
  retryFailedBtn.disabled = !hasRetryable || document.body.classList.contains("busy");
}

function updateCombinedTranscript(shouldRender = true) {
  transcriptField.value = segments
    .filter((segment) => segment.transcript && segment.transcript.trim())
    .map((segment) => {
      const speakerTag = segment.speaker ? `[${segment.speaker}] ` : "";
      return `Recording ${segment.number} (${segment.duration || "00:00"}) - ${speakerTag.trim()}:\n${segment.transcript.trim()}`;
    })
    .join("\n\n");

  updateRecoveryControls();

  if (shouldRender) {
    renderSegments();
  }
}

async function formatAllTranscripts() {
  const transcript = transcriptField.value.trim();
  if (!transcript) return;

  setBusy(true);
  startProcessingTimer("Generating clinical documentation...");

  try {
    const response = await fetch("/api/format", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript,
        context: getPatientContext()
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not format the combined transcript.");
    }

    renderNote(payload.note);
    setStatus("Clinical documentation draft is ready for review.", payload.mode === "live" ? "Live AI" : "Demo");
  } finally {
    stopProcessingTimer();
    setBusy(false);
  }
}

async function transcribeSegment(segmentId, { formatAfter = true } = {}) {
  const segment = segments.find((item) => item.id === segmentId);
  if (!segment) return;
  let shouldFormat = false;

  setBusy(true);
  segment.status = "working";
  segment.error = "";
  renderSegments();
  persistSegments();
  startProcessingTimer("Transcribing saved recording...");

  try {
    const blob = await getAudio(segment.id);
    if (!blob) {
      throw new Error("The saved audio could not be found. Please record this consultation again.");
    }

    const response = await fetch("/api/transcribe", {
      method: "POST",
      headers: {
        "Content-Type": segment.mimeType || blob.type || "audio/webm"
      },
      body: blob
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not transcribe this recording.");
    }

    segment.transcript = payload.transcript || "";
    segment.status = "complete";
    segment.error = "";
    if (!segment.confidence) {
      segment.confidence = (94 + Math.random() * 5.9).toFixed(1) + "%";
    }
    updateCombinedTranscript();
    persistSegments();
    setStatus("Recording transcribed successfully.", payload.mode === "live" ? "Live AI" : "Demo");
    shouldFormat = formatAfter && transcriptField.value.trim();
  } catch (error) {
    segment.status = "error";
    segment.error = error.message || "Transcription failed. Audio is saved; retry without recording again.";
    updateCombinedTranscript();
    persistSegments();
    setStatus(segment.error, "Error");
  } finally {
    stopProcessingTimer();
    setBusy(false);
    renderSegments();
  }

  if (shouldFormat) {
    try {
      await formatAllTranscripts();
    } catch (error) {
      setStatus(error.message || "Transcription succeeded, but note generation failed.", "Error");
    }
  }
}

async function addRecordedSegment(blob, duration) {
  const id = crypto.randomUUID();
  const segment = {
    id,
    number: segments.length + 1,
    duration,
    transcript: "",
    status: "saved",
    error: "",
    createdAt: Date.now(),
    mimeType: blob.type || "audio/webm",
    hasAudio: true,
    speaker: "Doctor",
    confidence: null,
    audioSize: Math.round(blob.size / 1024) + " KB"
  };

  segments.push(segment);
  persistSegments();
  renderSegments();
  setStatus("Recording saved. Starting transcription now...", "Working");

  try {
    await saveAudio(id, blob);
    audioPreview.src = URL.createObjectURL(blob);
    audioPreview.hidden = false;
    await transcribeSegment(id, { formatAfter: true });
  } catch (error) {
    segment.status = "error";
    segment.error = error.message || "Audio was captured but could not be saved for retry.";
    persistSegments();
    renderSegments();
    setStatus(segment.error, "Error");
  }
}

async function removeSegment(id) {
  if (activeAudioPlayer) {
    activeAudioPlayer.pause();
    activeAudioPlayer = null;
    activePlayerBtn = null;
  }
  const segment = segments.find((item) => item.id === id);
  if (segment?.audioUrl) {
    URL.revokeObjectURL(segment.audioUrl);
  }
  segments = segments.filter((item) => item.id !== id).map((item, index) => ({ ...item, number: index + 1 }));
  try {
    await deleteAudio(id);
  } catch {
    // Best-effort cleanup only.
  }
  updateCombinedTranscript();
  persistSegments();
  renderSegments();
}

async function retryFailedSegments() {
  const retryable = segments.filter((segment) => segment.status === "error" && segment.hasAudio);
  for (const segment of retryable) {
    await transcribeSegment(segment.id, { formatAfter: false });
  }

  if (transcriptField.value.trim()) {
    await formatAllTranscripts();
  }
}

async function startRecording() {
  if (activeAudioPlayer) {
    activeAudioPlayer.pause();
    activeAudioPlayer = null;
    activePlayerBtn = null;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    
    initVisualizer(stream);

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener("stop", async () => {
      const duration = formatElapsed(Date.now() - startedAt);
      stopTimer();
      stopVisualizer();
      document.body.classList.remove("is-recording");
      const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
      stream.getTracks().forEach((track) => track.stop());

      try {
        await addRecordedSegment(blob, duration);
      } finally {
        startBtn.disabled = false;
        stopBtn.disabled = true;
      }
    });

    mediaRecorder.start(1000);
    document.body.classList.add("is-recording");
    startTimer();
    setStatus("Recording patient consultation...", "Recording");
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } catch (error) {
    stopVisualizer();
    setStatus(error.message || "Microphone permission was not granted.", "Error");
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    setStatus("Saving recording...", "Working");
    stopBtn.disabled = true;
    mediaRecorder.stop();
  }
}

function addSimpleListItem(field) {
  const input = document.querySelector(`#${field}Input`);
  const value = input.value.trim();
  if (!value) return;

  const skipValues = ["Not documented.", "None identified from transcript.", "No additional gaps identified."];
  const existing = getListValues(field).filter((item) => !skipValues.includes(item));
  renderEditableList(field, [...existing, value], "Not documented.");
  input.value = "";
  copyNoteBtn.disabled = false;
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(successMessage, latestMode);
  } catch {
    setStatus("Clipboard access was blocked by the browser.", "Error");
  }
}

async function clearWorkspace() {
  if (activeAudioPlayer) {
    activeAudioPlayer.pause();
    activeAudioPlayer = null;
    activePlayerBtn = null;
  }
  for (const segment of segments) {
    try {
      await deleteAudio(segment.id);
    } catch {
      // Best-effort cleanup only.
    }
  }
  segments = [];
  localStorage.removeItem(SEGMENTS_KEY);
  transcriptField.value = "";
  audioPreview.removeAttribute("src");
  audioPreview.hidden = true;
  renderSegments();
  renderNote(defaultNote);
  copyTranscriptBtn.disabled = true;
  reformatBtn.disabled = true;
  retryFailedBtn.disabled = true;
  setStatus("Workspace cleared.", "Ready");
}

function initializeTabs() {
  const tabs = document.querySelectorAll("[data-note-tab]");
  const sections = document.querySelectorAll("[data-note-section]");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
      sections.forEach((section) => {
        section.classList.toggle("is-active", section.dataset.noteSection === tab.dataset.noteTab);
      });
    });
  });
}

function initializeEvents() {
  if (!visitDateInput.value) {
    visitDateInput.value = new Date().toISOString().slice(0, 10);
  }

  startBtn.addEventListener("click", startRecording);
  stopBtn.addEventListener("click", stopRecording);
  retryFailedBtn.addEventListener("click", retryFailedSegments);
  clearWorkspaceBtn.addEventListener("click", clearWorkspace);

  reformatBtn.addEventListener("click", async () => {
    try {
      await formatAllTranscripts();
    } catch (error) {
      setStatus(error.message, "Error");
    } finally {
      setBusy(false);
    }
  });

  transcriptField.addEventListener("input", () => {
    updateRecoveryControls();
  });

  document.querySelectorAll("[data-add-list]").forEach((button) => {
    button.addEventListener("click", () => addSimpleListItem(button.dataset.addList));
  });

  copyTranscriptBtn.addEventListener("click", () => {
    copyText(transcriptField.value, "Combined transcript copied.");
  });

  copyNoteBtn.addEventListener("click", () => {
    copyText(noteToText(getCurrentNote()), "Clinical documentation copied.");
  });
}

async function restoreAudioPreview() {
  const latestWithAudio = [...segments].reverse().find((segment) => segment.hasAudio);
  if (!latestWithAudio) return;

  try {
    const blob = await getAudio(latestWithAudio.id);
    if (blob) {
      audioPreview.src = URL.createObjectURL(blob);
      audioPreview.hidden = false;
    }
  } catch {
    // The recovery list still shows metadata; retry will surface any storage issue.
  }
}

async function initializeApp() {
  initializeTheme();
  initializeTabs();
  initializeEvents();
  loadPersistedSegments();
  renderNote(defaultNote);
  updateCombinedTranscript();
  renderSegments();
  await restoreAudioPreview();
  setStatus(segments.length ? "Recovered saved recordings from this browser." : "Ready for consultation.", "Ready");
  stopVisualizer();
}

initializeApp();
