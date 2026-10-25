# OnePot Project Development Rules

## Tech Stack
- Frontend: React.js (Vite), CSS Variables / Tailwind CSS, Chart.js
- Backend: Node.js, Express.js REST API
- Database: MySQL (or SQLite for local dev)
- Integrations: Nodemailer (SMTP), Paystack API (Test Mode), Mono API (Sandbox)

## Core Business Logic
1. OnePot Wallet: All contributions aggregate into a single family pot balance.
2. Bowls Budgeting: Zero-based allocation into bowls (Rent, Food, School Fees, Emergency, Goals).
3. Role-Based Access Control (RBAC):
   - Admin (Parents): Create/edit bowls, allocate funds, approve/reject expense requests.
   - Member (Children): View balance, contribute, request spending (creates pending requests).
4. Approval Workflow: Expenses created by members default to `pending` until approved by an admin.
5. Privacy: Track contributions, not private salary details. Mask bank account numbers (`****6789`).