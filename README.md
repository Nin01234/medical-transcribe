# Clinical Voice EMR Assistant

This MVP records doctor-patient conversation segments in the browser, sends each audio segment to a local Node backend, transcribes it, and formats all visit transcripts into one EMR-ready clinical note for doctor review.

## Run it

```bash
npm start
```

Open `http://localhost:3000`.

The app works in demo mode without an API key. To use live transcription and AI note formatting:

```bash
cp .env.example .env
```

Put your Google AI Studio key in `.env`:

```bash
GEMINI_API_KEY="your-google-ai-studio-key-here"
GEMINI_MODEL="gemini-2.5-flash"
```

Then restart the server:

```bash
npm start
```

Optional model settings:

```bash
GEMINI_MODEL="gemini-2.5-flash"
```

## What it produces

- A list of consultation recording segments
- An editable combined transcript
- Chief complaint
- History of present illness
- Past medical history
- Medications
- Allergies
- Assessment
- Plan
- Lab requests
- Prescriptions
- Safety flags

The generated output is always a draft. A clinician can edit text fields directly and add or remove medications, plan items, lab requests, prescriptions, and safety flags before copying or saving the final EMR entry.

## Privacy notes for production

- Ask for patient consent before recording.
- Avoid storing raw audio unless clinically and legally required.
- Encrypt any stored audio, transcripts, and notes.
- Add role-based access control and audit logs.
- Add a clear doctor approval step before saving into the real EMR.

cd "/c/Users/Nino/Desktop/Medical Transcribe/Medical Transcribe/Medical Transcribe"
npm install
npm start