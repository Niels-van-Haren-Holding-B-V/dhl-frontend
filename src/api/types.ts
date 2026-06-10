import type {
  DimensionsDto,
  ParcelDto,
  ParcelDtoDirectionEnum,
  ParcelDtoStatusEnum,
  StopDto,
  StopDtoDeliveryLocationTypeEnum,
  TripDto,
} from "./generated";

// springdoc doesn't emit `required` for Kotlin non-null properties (yet), so
// every generated field is optional. The backend DTOs are non-null Kotlin data
// classes; model that reality once here (and cast once in the trips query)
// instead of optional-chaining through every component. `size` stays nullable —
// it really is optional in the backend.
export type ParcelView = Required<Omit<ParcelDto, "size" | "dimensions">> & {
  size?: ParcelDto["size"];
  dimensions: Required<DimensionsDto>;
};
export type StopView = Required<Omit<StopDto, "parcels">> & { parcels: ParcelView[] };
export type TripView = Required<Omit<TripDto, "stops">> & { stops: StopView[] };

export type DeliveryLocationType = StopDtoDeliveryLocationTypeEnum;
export type ParcelDirection = ParcelDtoDirectionEnum;
export type ParcelStatus = ParcelDtoStatusEnum;
