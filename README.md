# EventHub — Online Event Management System

A full-stack web application built with **Node.js**, **Express**, **MySQL**, and **Vanilla JavaScript** that manages event creation, admin approvals, ticket bookings, cancellations, and e-ticket generation across three user roles.

## Key Features
- **Role-Based Authentication:** Encrypted registration and login (`bcryptjs` + `JWT`) for **Users**, **Event Organizers**, and **Admins**.
- **Admin Dashboard:** Approve new Event Organizer accounts and review/approve submitted events before they go live.
- **Organizer Dashboard:** Submit new events with venue, date, pricing, and seat limits, and view registered attendees for each event.
- **User Dashboard:** Browse approved events, book tickets with real-time seat updates, cancel bookings with automatic seat refunds, and generate printable E-Tickets.

## Tech Stack
- **Frontend:** HTML5, CSS3, JavaScript (Fetch API)
- **Backend:** Node.js, Express.js
- **Database:** MySQL 8.0 (`mysql2`)

## Setup Instructions
1. Clone the repository:
   ```bash
   git clone https://github.com
   cd Online-Event-Management-System
   
2.Install dependencies:
bash
npm install

3.Create a .env file in the root folder:
env
PORT=5000
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=event_management
JWT_SECRET=your_secret_key

4. Create the event_management database and tables (users, events, bookings) in MySQL, then start the server:
bash
node server.js

6. Open http://localhost:5000 in your browser.
