import { expect, type BrowserContext, type Page } from "@playwright/test";

/** Open the machine page in a second tab of the same (authenticated) context. */
export async function openMachine(context: BrowserContext): Promise<Page> {
  const machine = await context.newPage();
  await machine.goto("/machine");
  await expect(machine.getByText("Operator console")).toBeVisible({ timeout: 15_000 });
  return machine;
}

/** Full demo reset (sim + seeded data) through the operator console. */
export async function resetDemo(machine: Page) {
  const reset = machine.waitForResponse((r) => r.url().includes("/api/sim/reset") && r.ok());
  await machine.getByRole("button", { name: "Reset demo" }).click();
  await reset;
}

/** Navigate the courier tab to the locker stop with the seeded parcels. */
export async function gotoLockerStop(courier: Page) {
  await courier.goto("/");
  await courier.getByText("Route Amsterdam-Zuid").click();
  await courier.getByText("Naar pakketautomaat").click();
  await expect(courier.getByRole("heading", { name: "Pakketten" })).toBeVisible();
}

/** Tap a parcel, read the session QR payload, bind it manually on the machine. */
export async function startSessionFor(courier: Page, machine: Page, barcode: string) {
  await courier.getByRole("button", { name: new RegExp(barcode) }).click();
  const qrPayload = await courier.getByTestId("qr-payload").textContent({ timeout: 15_000 });
  // the console remembers manual mode between sessions: toggle only if needed
  const qrInput = machine.getByLabel("Scan QR-code van de koerier");
  const manualToggle = machine.getByText("Handmatig invoeren");
  await expect(qrInput.or(manualToggle).first()).toBeVisible({ timeout: 15_000 });
  if (!(await qrInput.isVisible())) await manualToggle.click();
  await qrInput.fill(qrPayload!);
  await machine.getByRole("button", { name: "Scan QR" }).click();
  await expect(machine.getByText("Gekoppeld ✓")).toBeVisible();
}

/** The machine-side door close for the currently open compartment. */
export async function closeOpenDoor(machine: Page) {
  await machine.getByRole("button", { name: "Sluit", exact: true }).first().click();
}

/** Toggle a failure mode on the operator console. */
export async function toggleFailure(machine: Page, label: string) {
  await machine.getByRole("button", { name: new RegExp(label) }).click();
}
