const seedBookings = require("../seed/bookings");

const bookings = new Map(); // bookingId -> booking

seedBookings.forEach((booking) => {
  bookings.set(booking.bookingId, booking);
});

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

function list() {
  return Array.from(bookings.values());
}

module.exports = { create, getById, cancel, list };
