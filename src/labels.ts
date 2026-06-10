import type { DeliveryLocationType, ParcelDirection, ParcelStatus } from "./api/types";

export const locationTypeLabel: Record<DeliveryLocationType, string> = {
  DOOR: "Voordeur",
  SERVICE_POINT: "Servicepunt",
  LOCKER: "Pakketautomaat",
};

export const directionLabel: Record<ParcelDirection, string> = {
  HAND_IN: "Inleveren",
  HAND_OUT: "Ophalen",
};

export const statusLabel: Record<ParcelStatus, string> = {
  EXPECTED: "Verwacht",
  HANDED_IN: "Ingeleverd",
  HANDED_OUT: "Opgehaald",
  NOT_DELIVERED: "Niet bezorgd",
};

export const statusBadgeClass: Record<ParcelStatus, string> = {
  EXPECTED: "bg-neutral-200 text-neutral-700",
  HANDED_IN: "bg-green-100 text-green-800",
  HANDED_OUT: "bg-green-100 text-green-800",
  NOT_DELIVERED: "bg-red-100 text-dhl-red",
};

export function formatTripDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
