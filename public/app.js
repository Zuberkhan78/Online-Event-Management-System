let currentSlide = 0;

function goToSlide(index) {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.slide-dot');
  if (!slides.length) return;

  slides[currentSlide].classList.remove('active');
  dots[currentSlide].classList.remove('active');
  currentSlide = (index + slides.length) % slides.length;
  slides[currentSlide].classList.add('active');
  dots[currentSlide].classList.add('active');
}

setInterval(() => goToSlide(currentSlide + 1), 3500);
let currentUser = JSON.parse(localStorage.getItem('user'));
let allApprovedEvents = [];

function switchAuth(view) {
  if (view === 'register') {
    document.getElementById('loginBox').classList.add('hidden');
    document.getElementById('registerBox').classList.remove('hidden');
  } else {
    document.getElementById('registerBox').classList.add('hidden');
    document.getElementById('loginBox').classList.remove('hidden');
  }
}

function showDashboard() {
  document.getElementById('authSection').classList.add('hidden');
  document.getElementById('userSection').classList.add('hidden');
  document.getElementById('organizerSection').classList.add('hidden');
  document.getElementById('adminSection').classList.add('hidden');
  document.getElementById('userNav').classList.add('hidden');

  if (!currentUser) {
    document.getElementById('authSection').classList.remove('hidden');
    switchAuth('login');
    return;
  }

  document.getElementById('userNav').classList.remove('hidden');
  document.getElementById('welcomeText').innerText = `${currentUser.full_name} (${currentUser.role.toUpperCase()})`;

  if (currentUser.role === 'user') {
    document.getElementById('userSection').classList.remove('hidden');
    loadUserDashboard();
  } else if (currentUser.role === 'organizer') {
    document.getElementById('organizerSection').classList.remove('hidden');
    loadOrganizerDashboard();
  } else if (currentUser.role === 'admin') {
    document.getElementById('adminSection').classList.remove('hidden');
    loadAdminDashboard();
  }
}

async function register() {
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: document.getElementById('regName').value,
      email: document.getElementById('regEmail').value,
      password: document.getElementById('regPassword').value,
      role: document.getElementById('regRole').value
    })
  });
  const data = await res.json();
  alert(data.message || data.error);
  if (res.ok) switchAuth('login');
}

async function login() {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: document.getElementById('loginEmail').value,
      password: document.getElementById('loginPassword').value
    })
  });
  const data = await res.json();
  if (res.ok) {
    currentUser = data;
    localStorage.setItem('user', JSON.stringify(data));
    showDashboard();
  } else {
    alert(data.error || 'Login failed');
  }
}

function logout() {
  localStorage.removeItem('user');
  currentUser = null;
  showDashboard();
}

function updateTotalPrice(eventId, unitPrice) {
  const qty = parseInt(document.getElementById(`qty-${eventId}`).value, 10) || 1;
  document.getElementById(`total-${eventId}`).innerText = `Total: Rs. ${(qty * unitPrice).toFixed(2)}`;
}

function renderApprovedEvents(events) {
  document.getElementById('eventsList').innerHTML = events.map(e => {
    const soldOut = e.total_seats <= 0;
    return `
      <div class="card">
        <h3>
          ${e.title}
          <span class="badge">Rs. ${e.ticket_price} / seat</span>
          ${soldOut ? '<span class="badge soldout">SOLD OUT</span>' : ''}
        </h3>
        <p>${e.description || ''}</p>
        <p><strong>Venue:</strong> ${e.venue} | <strong>Date:</strong> ${new Date(e.event_date).toLocaleString()} | <strong>Seats Left:</strong> ${e.total_seats}</p>
        <div class="booking-row">
          <label for="qty-${e.event_id}" style="font-size: 14px; font-weight: bold;">Seats:</label>
          <input type="number" id="qty-${e.event_id}" value="1" min="1" max="${Math.min(10, e.total_seats)}" ${soldOut ? 'disabled' : ''} oninput="updateTotalPrice(${e.event_id}, ${e.ticket_price})" />
          <span id="total-${e.event_id}" class="price-preview">Total: Rs. ${Number(e.ticket_price).toFixed(2)}</span>
          <button class="success" onclick="bookTicket(${e.event_id})" ${soldOut ? 'disabled' : ''}>
            ${soldOut ? 'Sold Out' : 'Book Tickets'}
          </button>
        </div>
      </div>
    `;
  }).join('') || '<p>No matching approved events found.</p>';
}

function filterEvents() {
  const query = document.getElementById('eventSearchInput').value.toLowerCase();
  const filtered = allApprovedEvents.filter(e =>
    e.title.toLowerCase().includes(query) || e.venue.toLowerCase().includes(query)
  );
  renderApprovedEvents(filtered);
}

async function loadUserDashboard() {
  const evRes = await fetch('/api/events');
  allApprovedEvents = await evRes.json();
  renderApprovedEvents(allApprovedEvents);

  const bkRes = await fetch(`/api/bookings/user/${currentUser.user_id}`);
  const bookings = await bkRes.json();
  document.getElementById('myBookingsList').innerHTML = bookings.map(b => `
    <div class="card" id="booking-${b.booking_id}" data-title="${b.title}" data-venue="${b.venue}" data-date="${b.event_date}" data-seats="${b.seats_booked}" data-amount="${b.total_amount}">
      <strong>${b.title}</strong> - ${b.seats_booked} Seat(s) | Total: Rs. ${b.total_amount} |
      Status: <span class="badge">${b.booking_status.toUpperCase()}</span>
      ${b.booking_status === 'confirmed' ? `
        <div style="margin-top: 8px;">
          <button onclick="printTicket(${b.booking_id})" style="width:auto; padding:7px 14px; background:#475569;">Print E-Ticket</button>
          <button class="danger" onclick="cancelBooking(${b.booking_id})">Cancel Ticket</button>
        </div>
      ` : ''}
    </div>
  `).join('') || '<p>No bookings yet.</p>';
}

async function bookTicket(event_id) {
  const seats_booked = parseInt(document.getElementById(`qty-${event_id}`).value, 10) || 1;
  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: currentUser.user_id, event_id, seats_booked })
  });
  const data = await res.json();
  alert(data.message || data.error);
  loadUserDashboard();
}

async function cancelBooking(bookingId) {
  if (!confirm('Cancel this ticket and refund the seats?')) return;
  const res = await fetch(`/api/bookings/cancel/${bookingId}`, { method: 'PUT' });
  const data = await res.json();
  alert(data.message || data.error);
  loadUserDashboard();
}

function printTicket(id) {
  const card = document.getElementById(`booking-${id}`);
  const win = window.open('', '_blank', 'width=550,height=520');
  win.document.write(`
    <html><body style="font-family:Arial;padding:30px;">
      <div style="border:2px dashed #1e293b;padding:25px;border-radius:10px;">
        <h2>EventHub Official E-Ticket</h2><hr/>
        <p><strong>Booking ID:</strong> #EVT-${id}</p>
        <p><strong>Attendee:</strong> ${currentUser.full_name}</p>
        <p><strong>Event:</strong> ${card.dataset.title}</p>
        <p><strong>Venue:</strong> ${card.dataset.venue}</p>
        <p><strong>Date:</strong> ${new Date(card.dataset.date).toLocaleString()}</p>
        <p><strong>Seats:</strong> ${card.dataset.seats} | <strong>Paid:</strong> Rs. ${card.dataset.amount}</p>
        <p style="color:#16a34a;font-weight:bold;">STATUS: CONFIRMED</p><hr/>
        <button onclick="window.print()" style="padding:10px 20px;background:#2563eb;color:#fff;border:none;border-radius:5px;cursor:pointer;">Print / Save PDF</button>
      </div>
    </body></html>
  `);
  win.document.close();
}

async function submitNewEvent() {
  const res = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizer_id: currentUser.user_id,
      title: document.getElementById('evTitle').value,
      description: document.getElementById('evDesc').value,
      event_date: document.getElementById('evDate').value,
      venue: document.getElementById('evVenue').value,
      ticket_price: document.getElementById('evPrice').value,
      total_seats: document.getElementById('evSeats').value
    })
  });
  const data = await res.json();
  alert(data.message || data.error);
  loadOrganizerDashboard();
}

async function loadOrganizerDashboard() {
  const res = await fetch(`/api/events/organizer/${currentUser.user_id}`);
  const events = await res.json();
  document.getElementById('orgEventsList').innerHTML = events.map(e => `
    <div class="card">
      <strong>${e.title}</strong> - <span class="badge">${e.status.toUpperCase()}</span>
      <p style="margin: 8px 0;">${e.venue} | Seats Remaining: <strong>${e.total_seats}</strong></p>
      <p style="margin: 8px 0;">
        Tickets Sold: <strong>${e.tickets_sold}</strong> |
        <span class="badge revenue">Revenue: Rs. ${e.total_revenue}</span>
      </p>
      <div style="display:flex; gap:8px; margin-top:8px;">
        <button onclick="viewAttendees(${e.event_id})" style="width:auto; padding:7px 14px; background:#475569;">View Attendees</button>
        <button class="danger" onclick="deleteEvent(${e.event_id})">Delete Event</button>
      </div>
      <div id="attendees-${e.event_id}" class="hidden" style="margin-top:10px; padding:10px; background:#f8fafc; border:1px dashed #cbd5e1;"></div>
    </div>
  `).join('') || '<p>No events submitted yet.</p>';
}

async function deleteEvent(eventId) {
  if (!confirm('Are you sure you want to delete this event?')) return;
  const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
  const data = await res.json();
  alert(data.message || data.error);
  loadOrganizerDashboard();
}

async function viewAttendees(eventId) {
  const box = document.getElementById(`attendees-${eventId}`);
  if (!box.classList.contains('hidden')) {
    box.classList.add('hidden');
    return;
  }
  const res = await fetch(`/api/events/${eventId}/attendees`);
  const attendees = await res.json();
  box.innerHTML = attendees.length
    ? attendees.map(a => `<div>- <strong>${a.full_name}</strong> (${a.email}) - ${a.seats_booked} seat(s) [${a.booking_status}]</div>`).join('')
    : 'No attendees registered yet.';
  box.classList.remove('hidden');
}

async function loadAdminDashboard() {
  const statsRes = await fetch('/api/admin/stats');
  const stats = await statsRes.json();
  document.getElementById('adminStats').innerHTML = `
    <div class="stat-card"><h3>${stats.total_users}</h3><p>Total Users</p></div>
    <div class="stat-card"><h3>${stats.approved_events}</h3><p>Approved Events</p></div>
    <div class="stat-card"><h3>${stats.total_tickets}</h3><p>Tickets Sold</p></div>
    <div class="stat-card"><h3>Rs. ${stats.total_revenue}</h3><p>Total Revenue</p></div>
  `;

  const res = await fetch('/api/admin/pending');
  const data = await res.json();

  document.getElementById('pendingOrgs').innerHTML = data.organizers.map(o => `
    <div class="card">
      <strong>${o.full_name}</strong> (${o.email})
      <button class="success" onclick="approveOrg(${o.user_id})">Approve Organizer</button>
    </div>
  `).join('') || '<p>No pending organizers.</p>';

  document.getElementById('pendingEvents').innerHTML = data.events.map(e => `
    <div class="card">
      <strong>${e.title}</strong> by ${e.organizer_name} - ${e.venue}
      <div style="margin-top:8px; display:flex; gap:8px;">
        <button class="success" onclick="approveEvent(${e.event_id})">Approve Event</button>
        <button class="danger" onclick="rejectEvent(${e.event_id})">Reject Event</button>
      </div>
    </div>
  `).join('') || '<p>No pending events.</p>';

  const usersRes = await fetch('/api/admin/users');
  const allUsers = await usersRes.json();
  document.getElementById('allUsersTable').innerHTML = `
    <table>
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
      <tbody>
        ${allUsers.map(u => `
          <tr>
            <td>${u.full_name}</td>
            <td>${u.email}</td>
            <td><span class="badge">${u.role.toUpperCase()}</span></td>
            <td>${u.is_approved ? 'Approved' : 'Pending'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function approveOrg(id) {
  await fetch(`/api/admin/approve-organizer/${id}`, { method: 'PUT' });
  loadAdminDashboard();
}

async function approveEvent(id) {
  await fetch(`/api/admin/approve-event/${id}`, { method: 'PUT' });
  loadAdminDashboard();
}

async function rejectEvent(id) {
  await fetch(`/api/admin/reject-event/${id}`, { method: 'PUT' });
  loadAdminDashboard();
}

showDashboard();