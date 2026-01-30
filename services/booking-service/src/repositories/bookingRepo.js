const bookings = new Map(); // bookingId -> booking

function create(booking) {
  bookings.set(booking.bookingId, booking);
  return booking;
}

function getById(bookingId) {
  return bookings.get(bookingId);
}

function cancel(bookingId) {
  const booking = bookings.get(bookingId);
  if (!booking) return null;

  if (booking.status === "CANCELED") return booking; // idempotent

  booking.status = "CANCELED";
  booking.canceledAt = new Date().toISOString();
  bookings.set(bookingId, booking);
  return booking;
}
module.exports = { create, getById, cancel  };
