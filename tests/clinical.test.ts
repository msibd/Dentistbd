import { beforeAll, describe, expect, it } from "vitest";
import { GET as listExaminations, POST as createExamination } from "@/app/api/examinations/route";
import { GET as getExamination, PATCH as patchExamination } from "@/app/api/examinations/[id]/route";
import { GET as getChart, PUT as putChart } from "@/app/api/patients/[id]/dental-chart/route";
import { GET as followUps } from "@/app/api/follow-ups/route";
import { POST as createPrescription, GET as listPrescriptions } from "@/app/api/prescriptions/route";
import { GET as listTreatments, POST as createTreatment } from "@/app/api/treatments/route";
import { GET as getTreatment, PATCH as patchTreatment } from "@/app/api/treatments/[id]/route";
import { POST as addSession } from "@/app/api/treatments/[id]/sessions/route";
import { prisma } from "@/lib/prisma";
import { call, createSession, type TestUser } from "./helpers";

let admin: TestUser;
let receptionist: TestUser;
let patientId = "";
let otherPatientId = "";

const exam = (overrides: Record<string, unknown> = {}) => ({
  patientId,
  chiefComplaint: "Pain in lower right molar",
  findings: "Deep occlusal caries on 46",
  diagnosis: "Irreversible pulpitis, tooth 46",
  ...overrides,
});
const dateKey = (daysAhead: number) => new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
  patientId = (await prisma.patient.create({ data: { patientCode: "PID-CLIN-1", name: "Clinical Patient", phone: "01800000001" } })).id;
  otherPatientId = (await prisma.patient.create({ data: { patientCode: "PID-CLIN-2", name: "Other Patient", phone: "01800000002" } })).id;
});

describe("examination records", () => {
  it("records an examination against the signed-in doctor", async () => {
    const { status, json } = await call(createExamination, "/api/examinations", { method: "POST", body: exam({ followUpDate: dateKey(7), notes: "Advised RCT" }), cookie: admin.cookie });
    expect(status).toBe(201);
    expect(json.examination.diagnosis).toMatch(/pulpitis/);
    expect(json.examination.examinedBy.id).toBe(admin.id);
    expect(json.examination.followUpDate.slice(0, 10)).toBe(dateKey(7));
    const audit = await prisma.auditEvent.findFirst({ where: { entity: "ExaminationRecord", entityId: json.examination.id } });
    expect(audit?.action).toBe("CREATE");
  });

  it("links an examination to that patient's appointment only", async () => {
    const appointment = await prisma.appointment.create({
      data: { patientId, patientName: "Clinical Patient", patientPhone: "01800000001", service: "Check-up", dateTime: new Date(), status: "COMPLETED" },
    });
    const ok = await call(createExamination, "/api/examinations", { method: "POST", body: exam({ appointmentId: appointment.id }), cookie: admin.cookie });
    expect(ok.status).toBe(201);
    expect(ok.json.examination.appointmentId).toBe(appointment.id);

    const wrongPatient = await call(createExamination, "/api/examinations", { method: "POST", body: exam({ patientId: otherPatientId, appointmentId: appointment.id }), cookie: admin.cookie });
    expect(wrongPatient.status).toBe(400);
    expect((await call(createExamination, "/api/examinations", { method: "POST", body: exam({ appointmentId: "missing" }), cookie: admin.cookie })).status).toBe(404);
  });

  it("rejects invalid examinations", async () => {
    const cases: Record<string, unknown> = {
      "unknown patient": exam({ patientId: "missing" }),
      "no complaint": exam({ chiefComplaint: "" }),
      "no diagnosis": exam({ diagnosis: " " }),
      "bad follow-up date": exam({ followUpDate: "next week" }),
      "bad timestamp": exam({ examinedAt: "yesterday" }),
      "oversized notes": exam({ notes: "x".repeat(4001) }),
    };
    for (const [name, body] of Object.entries(cases)) {
      const { status } = await call(createExamination, "/api/examinations", { method: "POST", body, cookie: admin.cookie });
      expect(status, name).toBe(name === "unknown patient" ? 404 : 400);
    }
  });

  it("lists a patient's examinations newest first, with paging", async () => {
    for (let n = 0; n < 3; n += 1) {
      await call(createExamination, "/api/examinations", { method: "POST", cookie: admin.cookie, body: exam({ diagnosis: `Visit ${n}`, examinedAt: new Date(Date.now() - n * 86_400_000).toISOString() }) });
    }
    const list = await call(listExaminations, `/api/examinations?patientId=${patientId}`, { cookie: admin.cookie });
    expect(list.status).toBe(200);
    const dates = list.json.examinations.map((item: { examinedAt: string }) => new Date(item.examinedAt).getTime());
    expect(dates).toEqual([...dates].sort((a: number, b: number) => b - a));
    expect((await call(listExaminations, "/api/examinations", { cookie: admin.cookie })).status).toBe(400);
    const none = await call(listExaminations, `/api/examinations?patientId=${otherPatientId}`, { cookie: admin.cookie });
    expect(none.json.examinations).toEqual([]);
  });

  it("updates an examination but never moves it to another patient", async () => {
    const created = (await call(createExamination, "/api/examinations", { method: "POST", body: exam(), cookie: admin.cookie })).json.examination;
    const edited = await call(patchExamination, `/api/examinations/${created.id}`, {
      method: "PATCH", cookie: admin.cookie, params: { id: created.id },
      body: { chiefComplaint: "Updated complaint", diagnosis: "Updated diagnosis", patientId: otherPatientId },
    });
    expect(edited.status).toBe(200);
    expect(edited.json.examination.diagnosis).toBe("Updated diagnosis");
    expect(edited.json.examination.patientId).toBe(patientId);
    expect((await call(getExamination, `/api/examinations/${created.id}`, { cookie: admin.cookie, params: { id: created.id } })).status).toBe(200);
    expect((await call(getExamination, "/api/examinations/missing", { cookie: admin.cookie, params: { id: "missing" } })).status).toBe(404);
  });

  it("keeps clinical records private from the receptionist", async () => {
    const created = (await call(createExamination, "/api/examinations", { method: "POST", body: exam(), cookie: admin.cookie })).json.examination;
    for (const result of await Promise.all([
      call(listExaminations, `/api/examinations?patientId=${patientId}`, { cookie: receptionist.cookie }),
      call(getExamination, `/api/examinations/${created.id}`, { cookie: receptionist.cookie, params: { id: created.id } }),
      call(createExamination, "/api/examinations", { method: "POST", body: exam(), cookie: receptionist.cookie }),
      call(getChart, `/api/patients/${patientId}/dental-chart`, { cookie: receptionist.cookie, params: { id: patientId } }),
    ])) expect(result.status).toBe(403);
  });
});

describe("dental chart", () => {
  it("records tooth conditions and updates them in place", async () => {
    const first = await call(putChart, `/api/patients/${patientId}/dental-chart`, {
      method: "PUT", cookie: admin.cookie, params: { id: patientId },
      body: { entries: [{ toothNumber: "46", condition: "CARIES", notes: "Deep" }, { toothNumber: "16", condition: "FILLED" }] },
    });
    expect(first.status).toBe(200);
    expect(first.json.chart).toHaveLength(2);

    const second = await call(putChart, `/api/patients/${patientId}/dental-chart`, {
      method: "PUT", cookie: admin.cookie, params: { id: patientId },
      body: { entries: [{ toothNumber: "46", condition: "ROOT_CANAL" }, { toothNumber: "75", condition: "EXTRACTED" }] },
    });
    expect(second.json.chart.map((entry: { toothNumber: string }) => entry.toothNumber)).toEqual(["16", "46", "75"]);
    const tooth46 = second.json.chart.find((entry: { toothNumber: string }) => entry.toothNumber === "46");
    expect(tooth46.condition).toBe("ROOT_CANAL");
    expect(tooth46.notes).toBeNull();
    expect(await prisma.dentalChartEntry.count({ where: { patientId, toothNumber: "46" } })).toBe(1);
    expect((await call(getChart, `/api/patients/${patientId}/dental-chart`, { cookie: admin.cookie, params: { id: patientId } })).json.chart).toHaveLength(3);
  });

  it("rejects tooth numbers outside FDI notation, unknown conditions and duplicates", async () => {
    const put = (entries: unknown) => call(putChart, `/api/patients/${patientId}/dental-chart`, { method: "PUT", cookie: admin.cookie, params: { id: patientId }, body: { entries } });
    for (const tooth of ["19", "00", "9", "49", "56", "ab", "116"]) {
      expect((await put([{ toothNumber: tooth, condition: "CARIES" }])).status, tooth).toBe(400);
    }
    expect((await put([{ toothNumber: "11", condition: "BROKEN_HEART" }])).status).toBe(400);
    expect((await put([{ toothNumber: "11", condition: "CARIES" }, { toothNumber: "11", condition: "FILLED" }])).status).toBe(400);
    expect((await put([])).status).toBe(400);
  });

  it("returns 404 for a missing patient and enforces the database rule too", async () => {
    expect((await call(getChart, "/api/patients/none/dental-chart", { cookie: admin.cookie, params: { id: "none" } })).status).toBe(404);
    expect((await call(putChart, "/api/patients/none/dental-chart", { method: "PUT", cookie: admin.cookie, params: { id: "none" }, body: { entries: [{ toothNumber: "11", condition: "CARIES" }] } })).status).toBe(404);
    await expect(prisma.dentalChartEntry.create({ data: { patientId, toothNumber: "99", condition: "CARIES" } })).rejects.toThrow();
  });
});

describe("treatment plans", () => {
  const plan = (overrides: Record<string, unknown> = {}) => ({ patientId, diagnosis: "Caries 46", procedureName: "Root canal treatment", toothNumbers: ["46"], estimatedCost: 9500, ...overrides });

  it("creates a plan, records sessions, and completes it", async () => {
    const created = await call(createTreatment, "/api/treatments", { method: "POST", body: plan(), cookie: admin.cookie });
    expect(created.status).toBe(201);
    expect(created.json.plan.status).toBe("PLANNED");
    const id = created.json.plan.id as string;

    const sessionResult = await call(addSession, `/api/treatments/${id}/sessions`, { method: "POST", body: { notes: "Access opened, canals located" }, cookie: admin.cookie, params: { id } });
    expect(sessionResult.status).toBe(201);

    const done = await call(patchTreatment, `/api/treatments/${id}`, { method: "PATCH", body: { status: "COMPLETED" }, cookie: admin.cookie, params: { id } });
    expect(done.status).toBe(200);
    expect((await prisma.treatmentPlan.findUniqueOrThrow({ where: { id } })).completedAt).not.toBeNull();
    const detail = await call(getTreatment, `/api/treatments/${id}`, { cookie: receptionist.cookie, params: { id } });
    expect(detail.status).toBe(200);
  });

  it("freezes completed plans: no edits, status changes or new sessions", async () => {
    const id = (await call(createTreatment, "/api/treatments", { method: "POST", body: plan(), cookie: admin.cookie })).json.plan.id as string;
    await call(patchTreatment, `/api/treatments/${id}`, { method: "PATCH", body: { status: "COMPLETED" }, cookie: admin.cookie, params: { id } });
    expect((await call(patchTreatment, `/api/treatments/${id}`, { method: "PATCH", body: { status: "IN_PROGRESS" }, cookie: admin.cookie, params: { id } })).status).toBe(409);
    expect((await call(patchTreatment, `/api/treatments/${id}`, { method: "PATCH", body: plan({ estimatedCost: 1 }), cookie: admin.cookie, params: { id } })).status).toBe(409);
    expect((await call(addSession, `/api/treatments/${id}/sessions`, { method: "POST", body: { notes: "late" }, cookie: admin.cookie, params: { id } })).status).toBe(409);
  });

  it("validates input and permissions", async () => {
    const bad: Record<string, unknown> = {
      "negative cost": plan({ estimatedCost: -1 }),
      "bad tooth": plan({ toothNumbers: ["99"] }),
      "duplicate teeth": plan({ toothNumbers: ["46", "46"] }),
      "no procedure": plan({ procedureName: "" }),
      "no patient": plan({ patientId: "" }),
    };
    for (const [name, body] of Object.entries(bad)) {
      expect((await call(createTreatment, "/api/treatments", { method: "POST", body, cookie: admin.cookie })).status, name).toBe(400);
    }
    expect((await call(createTreatment, "/api/treatments", { method: "POST", body: plan(), cookie: receptionist.cookie })).status).toBe(403);
    expect((await call(listTreatments, "/api/treatments", { cookie: receptionist.cookie })).status).toBe(200);
  });
});

describe("prescriptions and follow-up reminders", () => {
  it("issues a prescription with medications and a follow-up date", async () => {
    const { status, json } = await call(createPrescription, "/api/prescriptions", {
      method: "POST", cookie: admin.cookie,
      body: {
        patientId, diagnosis: "Post-extraction care", instructions: "Soft diet for 2 days", followUpDate: dateKey(5),
        medications: [{ name: "Amoxicillin 500mg", dosage: "1 capsule", frequency: "3 times daily", duration: "5 days", instructions: null }],
      },
    });
    expect(status).toBe(201);
    expect(json.prescription.prescribedById ?? admin.id).toBe(admin.id);
    expect((await call(listPrescriptions, `/api/prescriptions?search=Post-extraction`, { cookie: admin.cookie })).json.prescriptions.length).toBeGreaterThan(0);
  });

  it("rejects a prescription without medications or with a bad patient", async () => {
    const base = { patientId, diagnosis: "Test", followUpDate: null, instructions: null };
    expect((await call(createPrescription, "/api/prescriptions", { method: "POST", cookie: admin.cookie, body: { ...base, medications: [] } })).status).toBe(400);
    expect((await call(createPrescription, "/api/prescriptions", { method: "POST", cookie: admin.cookie, body: { ...base, patientId: "missing", medications: [{ name: "A", dosage: "1", frequency: "1", duration: "1", instructions: null }] } })).status).toBeGreaterThanOrEqual(400);
  });

  it("lists upcoming follow-ups for the front desk without exposing clinical text", async () => {
    const { status, json } = await call(followUps, "/api/follow-ups?days=30", { cookie: receptionist.cookie });
    expect(status).toBe(200);
    expect(json.followUps.length).toBeGreaterThan(0);
    const dates = json.followUps.map((item: { followUpDate: string }) => item.followUpDate);
    expect(dates).toEqual([...dates].sort());
    const text = JSON.stringify(json);
    expect(text).not.toMatch(/pulpitis|Post-extraction|Amoxicillin/);
    expect(json.followUps[0].patient.phone).toBeTruthy();
    expect((await call(followUps, "/api/follow-ups?days=0", { cookie: admin.cookie })).status).toBe(400);
    expect((await call(followUps, "/api/follow-ups?days=500", { cookie: admin.cookie })).status).toBe(400);
  });

  it("skips disabled patients and past follow-up dates", async () => {
    const quiet = await prisma.patient.create({ data: { patientCode: "PID-CLIN-3", name: "Disabled", phone: "01800000009", isActive: false } });
    await prisma.examinationRecord.create({ data: { patientId: quiet.id, chiefComplaint: "x", diagnosis: "y", followUpDate: new Date(`${dateKey(3)}T00:00:00Z`) } });
    await prisma.examinationRecord.create({ data: { patientId: otherPatientId, chiefComplaint: "x", diagnosis: "y", followUpDate: new Date(`${dateKey(-3)}T00:00:00Z`) } });
    const { json } = await call(followUps, "/api/follow-ups?days=30", { cookie: admin.cookie });
    const ids = json.followUps.map((item: { patient: { id: string } }) => item.patient.id);
    expect(ids).not.toContain(quiet.id);
    expect(ids).not.toContain(otherPatientId);
  });
});
