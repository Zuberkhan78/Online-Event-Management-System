const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 1. Health Check
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    res.json({ status: 'Connected to MySQL event_management!', dbCheck: rows[0].result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Register User, Organizer, or Admin
app.post('/api/register', async (req, res) => {
  const { full_name, email, password, role } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const isApproved = role === 'organizer' ? false : true;
    await db.query(
      'INSERT INTO users (full_name, email, password_hash, role, is_approved) VALUES (?, ?, ?, ?, ?)',
      [full_name, email, hash, role || 'user', isApproved]
    );
    res.status(201).json({
      message: role === 'organizer'
        ? 'Organizer registered! Wait for Admin approval before logging in.'
        : 'Registration successful! You can now log in.'
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });
    if (!user.is_approved) return res.status(403).json({ error: 'Organizer account pending Admin approval' });

    const token = jwt.sign({ user_id: user.user_id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, role: user.role, full_name: user.full_name, user_id: user.user_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. User: View Approved Events
app.get('/api/events', async (req, res) => {
  const [events] = await db.query(
    `SELECT e.*, u.full_name AS organizer_name 
     FROM events e JOIN users u ON e.organizer_id = u.user_id 
     WHERE e.status = 'approved' ORDER BY e.event_date ASC`
  );
  res.json(events);
});

// 5. User: Book Tickets, View My Bookings & Cancel Booking
app.post('/api/bookings', async (req, res) => {
  const { user_id, event_id, seats_booked } = req.body;
  const qty = parseInt(seats_booked, 10) || 1;
  if (qty < 1) return res.status(400).json({ error: 'Select at least 1 seat' });

  try {
    const [events] = await db.query('SELECT ticket_price, total_seats FROM events WHERE event_id = ?', [event_id]);
    if (events.length === 0) return res.status(404).json({ error: 'Event not found' });
    if (events[0].total_seats < qty) return res.status(400).json({ error: 'Not enough seats available' });

    const total_amount = events[0].ticket_price * qty;
    await db.query(
      'INSERT INTO bookings (user_id, event_id, seats_booked, total_amount) VALUES (?, ?, ?, ?)',
      [user_id, event_id, qty, total_amount]
    );
    await db.query('UPDATE events SET total_seats = total_seats - ? WHERE event_id = ?', [qty, event_id]);
    res.status(201).json({ message: `Successfully booked ${qty} ticket(s)!` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/bookings/user/:userId', async (req, res) => {
  const [rows] = await db.query(
    `SELECT b.*, e.title, e.event_date, e.venue 
     FROM bookings b JOIN events e ON b.event_id = e.event_id 
     WHERE b.user_id = ? ORDER BY b.booked_at DESC`,
    [req.params.userId]
  );
  res.json(rows);
});

app.put('/api/bookings/cancel/:bookingId', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM bookings WHERE booking_id = ?', [req.params.bookingId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    if (rows[0].booking_status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    await db.query("UPDATE bookings SET booking_status = 'cancelled' WHERE booking_id = ?", [req.params.bookingId]);
    await db.query('UPDATE events SET total_seats = total_seats + ? WHERE event_id = ?', [rows[0].seats_booked, rows[0].event_id]);
    res.json({ message: 'Booking cancelled and seats refunded!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Organizer: Create Event, View My Events (With Sales & Revenue) & View Attendees
app.post('/api/events', async (req, res) => {
  const { organizer_id, title, description, event_date, venue, ticket_price, total_seats } = req.body;
  try {
    const formattedDate = event_date ? event_date.replace('T', ' ') + ':00' : null;
    await db.query(
      'INSERT INTO events (organizer_id, title, description, event_date, venue, ticket_price, total_seats) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [organizer_id, title, description, formattedDate, venue, ticket_price, total_seats]
    );
    res.status(201).json({ message: 'Event submitted for Admin approval!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/events/organizer/:orgId', async (req, res) => {
  const [rows] = await db.query(
    `SELECT e.*,
       COALESCE(SUM(CASE WHEN b.booking_status = 'confirmed' THEN b.seats_booked ELSE 0 END), 0) AS tickets_sold,
       COALESCE(SUM(CASE WHEN b.booking_status = 'confirmed' THEN b.total_amount ELSE 0 END), 0) AS total_revenue
     FROM events e
     LEFT JOIN bookings b ON e.event_id = b.event_id
     WHERE e.organizer_id = ?
     GROUP BY e.event_id
     ORDER BY e.created_at DESC`,
    [req.params.orgId]
  );
  res.json(rows);
});

app.get('/api/events/:eventId/attendees', async (req, res) => {
  const [rows] = await db.query(
    `SELECT b.booking_id, b.seats_booked, b.total_amount, b.booking_status, u.full_name, u.email
     FROM bookings b JOIN users u ON b.user_id = u.user_id
     WHERE b.event_id = ? ORDER BY b.booked_at DESC`,
    [req.params.eventId]
  );
  res.json(rows);
});

// 7. Admin: Platform Analytics + Pending Organizers & Events
app.get('/api/admin/stats', async (req, res) => {
  try {
    const [[userCount]] = await db.query('SELECT COUNT(*) AS total_users FROM users');
    const [[eventCount]] = await db.query("SELECT COUNT(*) AS approved_events FROM events WHERE status = 'approved'");
    const [[bookingStats]] = await db.query(
      `SELECT COALESCE(SUM(seats_booked), 0) AS total_tickets,
              COALESCE(SUM(total_amount), 0) AS total_revenue
       FROM bookings WHERE booking_status = 'confirmed'`
    );
    res.json({
      total_users: userCount.total_users,
      approved_events: eventCount.approved_events,
      total_tickets: bookingStats.total_tickets,
      total_revenue: bookingStats.total_revenue
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/pending', async (req, res) => {
  const [organizers] = await db.query("SELECT user_id, full_name, email FROM users WHERE role = 'organizer' AND is_approved = FALSE");
  const [events] = await db.query(
    `SELECT e.*, u.full_name AS organizer_name 
     FROM events e JOIN users u ON e.organizer_id = u.user_id WHERE e.status = 'pending'`
  );
  res.json({ organizers, events });
});

app.put('/api/admin/approve-organizer/:id', async (req, res) => {
  await db.query('UPDATE users SET is_approved = TRUE WHERE user_id = ?', [req.params.id]);
  res.json({ message: 'Organizer approved!' });
});

app.put('/api/admin/approve-event/:id', async (req, res) => {
  await db.query("UPDATE events SET status = 'approved' WHERE event_id = ?", [req.params.id]);
  res.json({ message: 'Event approved!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));