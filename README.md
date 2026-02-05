<details> <summary><b>Show diagram (Mermaid)</b></summary>
flowchart TB
  subgraph Clients
    C1[Customer App]
    C2[Driver App]
    C3[Admin Dashboard]
  end

  C1 -->|HTTPS / WebSocket| G[API Gateway]
  C2 -->|HTTPS / WebSocket| G
  C3 -->|HTTPS| G

  subgraph Services
    A[auth-service]
    U[user-service]
    D[driver-service]
    B[booking-service]
    R[ride-service]
    P[pricing-service]
    Pay[payment-service]
    N[notification-service]
    Rev[review-service]
  end

  G --> A
  G --> U
  G --> D
  G --> B
  G --> R
  G --> P
  G --> Pay
  G --> N
  G --> Rev

  subgraph DataLayer
    PG[(PostgreSQL)]
    MG[(MongoDB)]
    RD[(Redis + Geo)]
  end

  A --> RD
  U --> PG
  D --> PG
  B --> PG
  R --> RD
  P --> RD
  Pay --> PG
  N --> MG
  Rev --> PG

  subgraph EventBus
    K[Kafka / RabbitMQ]
  end

  B --> K
  R --> K
  Pay --> K
  K --> N
  K --> P
  K --> R

</details>
