import { expect, test, type Page } from "@playwright/test";
import {
  closeOpenDoor,
  gotoLockerStop,
  openMachine,
  resetDemo,
  startSessionFor,
  toggleFailure,
} from "./helpers";

/**
 * The demo scenarios end to end across both screens, against the real local
 * stack (backend + locker-sim + Postgres + Keycloak + Redpanda). Serial: the
 * machine is shared state; every test starts from a demo reset.
 */
test.describe.configure({ mode: "serial" });

let machine: Page;

test.beforeEach(async ({ context, page }) => {
  machine = await openMachine(context);
  await resetDemo(machine);
  await gotoLockerStop(page);
});

test.afterEach(async () => {
  await machine?.close();
});

test("hand-in happy path across courier and machine", async ({ page }) => {
  await startSessionFor(page, machine, "DHL-IN-001");

  // the right door opens by itself for the chosen parcel
  await expect(page.getByText("Plaats pakket en sluit de deur")).toBeVisible({ timeout: 15_000 });
  await expect(machine.getByText(/open$/).first()).toBeVisible();

  await closeOpenDoor(machine);
  await page.getByRole("button", { name: "Bevestig plaatsing" }).click();
  await expect(page.getByText("Pakket ingeleverd ✓")).toBeVisible();

  // next-parcel mode names what to grab next
  await expect(page.getByRole("button", { name: /Volgende (inleveren|ophalen): DHL-/ })).toBeVisible();
  await page.getByRole("button", { name: "Sessie afronden" }).click();
  await expect(page.getByText("Sessie afgerond")).toBeVisible();
});

test("vak te klein escalates to a bigger door", async ({ page }) => {
  await toggleFailure(machine, "Vak te klein");
  await startSessionFor(page, machine, "DHL-IN-002");

  // sabotage: an undersized door opens; the courier reports it
  await expect(page.getByText("Plaats pakket en sluit de deur")).toBeVisible({ timeout: 15_000 });
  await toggleFailure(machine, "Vak te klein"); // disarm so the retry is honest
  await page.getByRole("button", { name: "Vak te klein", exact: true }).click();

  // doors are physical: the too-small door stays open and blocks the retry
  await expect(page.getByText(/Er staat nog een deur open/)).toBeVisible({ timeout: 15_000 });
  await closeOpenDoor(machine);

  // …and once it is closed the wizard re-attempts by itself: a bigger door opens
  await expect(page.getByText("Plaats pakket en sluit de deur")).toBeVisible({ timeout: 15_000 });

  await closeOpenDoor(machine);
  await page.getByRole("button", { name: "Bevestig plaatsing" }).click();
  await expect(page.getByText("Pakket ingeleverd ✓")).toBeVisible();
});

test("hand-out: the compartment holding the parcel opens", async ({ page }) => {
  await startSessionFor(page, machine, "DHL-OUT-001");

  await expect(page.getByText("Neem het pakket uit het vak")).toBeVisible({ timeout: 15_000 });
  await closeOpenDoor(machine);
  await page.getByRole("button", { name: "Bevestig ophalen" }).click();
  await expect(page.getByText("Pakket opgehaald ✓")).toBeVisible();
});

test("hand-out report-missing falls back to standard handling", async ({ page }) => {
  await toggleFailure(machine, "Pakket ontbreekt");
  await startSessionFor(page, machine, "DHL-OUT-001");

  await expect(page.getByText("Neem het pakket uit het vak")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Pakket ontbreekt" }).click();

  // back to the picker; the parcel is registered NOT_DELIVERED server-side
  await expect(page.getByText("Kies een pakket")).toBeVisible({ timeout: 15_000 });
  await toggleFailure(machine, "Pakket ontbreekt");
});

test("a dangling open door blocks the next session until closed", async ({ page }) => {
  await startSessionFor(page, machine, "DHL-IN-001");
  await expect(page.getByText("Plaats pakket en sluit de deur")).toBeVisible({ timeout: 15_000 });

  // courier walks away with the door open: leaves the wizard, the session
  // stays ACTIVE server-side (the reaper would clean it up after 5 min)
  await machine.getByRole("button", { name: "Laat open" }).click();
  await gotoLockerStop(page);

  // the machine nags about the open door
  await expect(machine.getByText(/Sluit eerst vak/)).toBeVisible({ timeout: 5_000 });

  // a new courier session is blocked with a clear message
  await startSessionFor(page, machine, "DHL-IN-002");
  await expect(page.getByText(/Er staat nog een deur open/)).toBeVisible({ timeout: 15_000 });

  // someone closes the abandoned door; the wizard continues by itself
  await closeOpenDoor(machine);
  await expect(page.getByText("Plaats pakket en sluit de deur")).toBeVisible({ timeout: 15_000 });
  await closeOpenDoor(machine);
  await page.getByRole("button", { name: "Bevestig plaatsing" }).click();
  await expect(page.getByText("Pakket ingeleverd ✓")).toBeVisible();
});

test("deur klemt: escape hatches appear and reopen recovers", async ({ page }) => {
  await startSessionFor(page, machine, "DHL-IN-001");
  await expect(page.getByText("Plaats pakket en sluit de deur")).toBeVisible({ timeout: 15_000 });

  await toggleFailure(machine, "Deur klemt");
  await closeOpenDoor(machine); // refuses: DOOR_STUCK, door stays open

  // after ~8 status polls the courier app offers the escape hatches
  await expect(page.getByText("Deur niet gesloten?")).toBeVisible({ timeout: 25_000 });
  await toggleFailure(machine, "Deur klemt");

  await page.getByRole("button", { name: "Open vak opnieuw" }).click();
  await expect(page.getByText("Plaats pakket en sluit de deur")).toBeVisible({ timeout: 15_000 });
  await closeOpenDoor(machine);
  await page.getByRole("button", { name: "Bevestig plaatsing" }).click();
  await expect(page.getByText("Pakket ingeleverd ✓")).toBeVisible();
});

test("announced parcel reserves a visible compartment; reset clears it", async ({ page }) => {
  await machine.getByLabel("Barcode").fill("DHL-IN-E2E");
  await machine.getByRole("button", { name: "Aanmelden" }).click();
  await expect(machine.getByText(/Aangemeld via Kafka/)).toBeVisible();

  // the Kafka consumer reserves a door; the machine shows it within a few polls
  await expect(machine.getByText("DHL-IN-E2E", { exact: true })).toBeVisible({ timeout: 20_000 });

  // and the courier app picks the parcel up on the next trips refresh
  await expect(page.getByRole("button", { name: /DHL-IN-E2E/ })).toBeVisible({ timeout: 15_000 });

  await resetDemo(machine);
  await expect(machine.getByText("DHL-IN-E2E", { exact: true })).not.toBeVisible({ timeout: 10_000 });
});
