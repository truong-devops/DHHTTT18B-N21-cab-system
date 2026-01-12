# Kafka Topics

| Topic | Producer | Consumer |
|------|----------|----------|
| ride.created | booking-service | (TBD: ride/notification/pricing/eta) |
| ride.assigned | (TBD) | notification-service |
| driver.location.updated | ride-service | (TBD: eta/monitoring) |
| payment.completed | payment-service | (TBD: ride/notification) |
| payment.failed | payment-service | notification-service |
