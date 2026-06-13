import type {
  DimensionsDto,
  ParcelDto,
  ParcelDtoDirectionEnum,
  ParcelDtoStatusEnum,
  StopDto,
  StopDtoDeliveryLocationTypeEnum,
  TripDto,
} from "./generated";

// springdoc doesn't emit `required` for Kotlin non-null props, so every generated field is optional; these Required<> casts model the real non-null DTOs (size stays nullable).
export type ParcelView = Required<Omit<ParcelDto, "size" | "dimensions">> & {
  size?: ParcelDto["size"];
  dimensions: Required<DimensionsDto>;
};
export type StopView = Required<Omit<StopDto, "parcels">> & { parcels: ParcelView[] };
export type TripView = Required<Omit<TripDto, "stops">> & { stops: StopView[] };

export type DeliveryLocationType = StopDtoDeliveryLocationTypeEnum;
export type ParcelDirection = ParcelDtoDirectionEnum;
export type ParcelStatus = ParcelDtoStatusEnum;
