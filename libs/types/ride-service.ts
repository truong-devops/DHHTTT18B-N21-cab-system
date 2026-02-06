/*
 * Generated from contracts/openapi/ride-service.yaml
 * To regenerate: npm run generate:ride-service --workspace @libs/types
 */
export interface Ride {
  id?: string;
  externalRideId?: string;
  bookingId?: string | null;
  riderId?: string | null;
  driverId?: string | null;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  status?: string;
  statusUpdatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateRideRequest {
  bookingId?: string;
  driverId?: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat?: number;
  dropoffLng?: number;
  status?: string;
}

export interface UpdateRideRequest {
  driverId?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  status?: string;
  statusReason?: string;
}

export interface RideResponse {
  data?: Ride;
}

export interface RideListResponse {
  data?: Ride[];
  nextCursor?: string | null;
}

export interface ErrorResponse {
  error?: {
    code?: string;
    message?: string;
    details?: Array<Record<string, unknown>>;
  };
  traceId?: string | null;
}

export interface paths {
  "/v1/rides": {
    get: {
      parameters: {
        query?: {
          status?: string;
          riderId?: string;
          limit?: number;
          cursor?: string;
          sort?: "-createdAt" | "createdAt";
        };
      };
      responses: {
        200: {
          content: {
            "application/json": RideListResponse;
          };
        };
      };
    };
    post: {
      parameters: {
        header?: {
          "Idempotency-Key": string;
        };
      };
      requestBody: {
        content: {
          "application/json": CreateRideRequest;
        };
      };
      responses: {
        201: {
          content: {
            "application/json": RideResponse;
          };
        };
      };
    };
  };
  "/v1/rides/{id}": {
    get: {
      parameters: {
        path: {
          id: string;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": RideResponse;
          };
        };
      };
    };
    patch: {
      parameters: {
        path: {
          id: string;
        };
      };
      requestBody: {
        content: {
          "application/json": UpdateRideRequest;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": RideResponse;
          };
        };
      };
    };
    delete: {
      parameters: {
        path: {
          id: string;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": RideResponse;
          };
        };
      };
    };
  };
}
