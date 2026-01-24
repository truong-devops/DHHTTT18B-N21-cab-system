/*
 * Generated from contracts/openapi/review-service.yaml
 * To regenerate: npm run generate:review-service --workspace @libs/types
 */
export interface Review {
  id?: string;
  rideId?: string;
  riderId?: string;
  driverId?: string;
  rating?: number;
  comment?: string | null;
  status?: string;
  statusUpdatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateReviewRequest {
  rideId: string;
  driverId: string;
  rating: number;
  comment?: string;
  status?: string;
}

export interface UpdateReviewRequest {
  rating?: number;
  comment?: string;
  status?: string;
  statusReason?: string;
}

export interface ReviewResponse {
  data?: Review;
}

export interface ReviewListResponse {
  data?: Review[];
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
  "/v1/reviews": {
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
            "application/json": ReviewListResponse;
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
          "application/json": CreateReviewRequest;
        };
      };
      responses: {
        201: {
          content: {
            "application/json": ReviewResponse;
          };
        };
      };
    };
  };
  "/v1/reviews/{id}": {
    get: {
      parameters: {
        path: {
          id: string;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": ReviewResponse;
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
          "application/json": UpdateReviewRequest;
        };
      };
      responses: {
        200: {
          content: {
            "application/json": ReviewResponse;
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
            "application/json": ReviewResponse;
          };
        };
      };
    };
  };
}
