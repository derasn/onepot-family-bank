# OnePot Family Bank - Express REST API

> **"One family, one pot = No stories"**  
> A centralized family banking ledger combining a pooled wallet, envelope (bowls) budgeting, role-based approval workflows, and savings goals.

---

## 🏗️ Architecture & Features

1. **Pooled Family Wallet (`/api/family`, `/api/contributions`)**:
   - Single central wallet where family members pool money together.
   - Financial privacy: Tracks contributions, **never** private salaries or income.
   - Bank details are automatically masked (e.g. `****6789`).
   - 5% Auto-savings: 5% of all incoming contributions automatically credit the locked Family Emergency Fund.

2. **Bowls Envelope Budgeting (`/api/bowls`)**:
   - Money is assigned to categorized bowls (Rent, Food & Groceries, School Fees, Utilities, Travel, Healthcare, Emergency).
   - **4 Allocation Modes**:
     - `manual`: Specific amounts to designated bowls.
     - `zero-based`: Every naira in the pot is assigned a job (`Total Pot - Total Allocations = 0`).
     - `50-30-20`: 50% Needs, 30% Wants, 20% Savings.
     - `priority`: Allocates in order of priority until budget targets are met or funds exhaust.
   - Spending limit triggers: In-app & email notification when any bowl reaches 80% of its allocation.

3. **Role-Based Access Control & Approvals (`/api/expenses`)**:
   - **Admins (Parents)**: Can create/edit bowls, allocate funds, directly log expenses, and approve/reject pending spending requests.
   - **Members (Children)**: Can view family balances, contribute to the pot, and request spending from bowls (defaults to `pending`).
   - **Emergency Fund Borrowing**: When a bowl is empty, members can submit an emergency borrow request requiring parent authorization.

4. **Goals Tracking (`/api/goals`)**:
   - Any member can propose a family goal with deadline and target amount.
   - Funded directly from the pot with progress tracking.
   - Dual-admin unlock before final funds disbursement.

5. **Integrations**:
   - **Paystack API (Test / Simulated Mode)**: Contribution collection and transaction verification.
   - **Mono API (Sandbox Mode)**: Open Banking account linking and transaction enrichment.
   - **Nodemailer (SMTP / Mock)**: Automated email notifications for requests, approvals, and budget alerts.

---

## 🛠️ API Endpoints Reference

### 🔐 Authentication (`/api/auth`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register user account | Public |
| `POST` | `/api/auth/login` | Login and obtain JWT token | Public |
| `GET` | `/api/auth/me` | Current user & family membership profile | Authenticated |
| `PUT` | `/api/auth/profile` | Update profile, phone, masked bank account | Authenticated |
| `POST` | `/api/auth/change-password` | Update account password | Authenticated |

### 👨‍👩‍👧‍👦 Family Management (`/api/family`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/family/create` | Create new family pot & seeds default bowls | Authenticated |
| `POST` | `/api/family/join` | Join existing family via `invite_code` | Authenticated |
| `GET` | `/api/family/details` | Summary balances (pot, emergency, spent, saved) | Family Member |
| `GET` | `/api/family/members` | List members with total contributed & spent | Family Member |
| `PUT` | `/api/family/members/:id/role` | Promote/demote member role | Admin (Parent) |
| `DELETE` | `/api/family/members/:id` | Remove member from family pot | Admin (Parent) |
| `POST` | `/api/family/regenerate-invite` | Generate new family invite code | Admin (Parent) |
| `PUT` | `/api/family/settings` | Update family name & auto-save rate | Admin (Parent) |

### 🍲 Bowls & Budgeting (`/api/bowls`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/bowls` | List all bowls with progress & remaining balance | Family Member |
| `GET` | `/api/bowls/unallocated-pot` | Get unallocated pot balance for zero-based rules | Family Member |
| `POST` | `/api/bowls` | Create custom bowl | Admin (Parent) |
| `PUT` | `/api/bowls/:id` | Update bowl target, priority, color, icon | Admin (Parent) |
| `DELETE` | `/api/bowls/:id` | Delete bowl (refunds unspent funds to pot) | Admin (Parent) |
| `POST` | `/api/bowls/allocate` | Allocate funds (`manual`, `zero-based`, `50-30-20`, `priority`) | Admin (Parent) |

### 💳 Contributions (`/api/contributions`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/contributions/initialize` | Initialize Paystack contribution | Family Member |
| `POST` | `/api/contributions/verify` | Verify Paystack tx (credits 95% pot, 5% emergency) | Family Member |
| `POST` | `/api/contributions/manual` | Log direct simulated contribution | Family Member |
| `GET` | `/api/contributions` | Contribution transaction ledger | Family Member |
| `GET` | `/api/contributions/stats` | Pooling breakdown by member ("Dad 200k, Mum 100k") | Family Member |

### 💸 Expenses & Approvals (`/api/expenses`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/expenses` | List expenses (filterable by bowl, user, status) | Family Member |
| `POST` | `/api/expenses` | Log expense (auto-debits for Admin, creates pending request for Member) | Family Member |
| `POST` | `/api/expenses/emergency-borrow` | Request borrow from Emergency Fund | Family Member |
| `PUT` | `/api/expenses/:id/decision` | Approve or reject pending expense request | Admin (Parent) |
| `GET` | `/api/expenses/:id` | View expense with full approval audit trail | Family Member |

### 🎯 Goals (`/api/goals`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/goals` | List all family goals with progress percentage | Family Member |
| `POST` | `/api/goals` | Create a new family goal | Family Member |
| `POST` | `/api/goals/:id/contribute` | Allocate pot funds to goal | Family Member |
| `PUT` | `/api/goals/:id/unlock` | Unlock goal for disbursement | Admin (Parent) |

### 🏦 Open Banking Sandbox (`/api/mono`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/mono/link` | Exchange auth code and store verified masked account | Family Member |
| `GET` | `/api/mono/accounts` | List linked bank accounts | Family Member |

### 📊 Dashboard & Reports (`/api/dashboard`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/dashboard/summary` | Top metric cards, bowls progress, recent tx, chart data | Family Member |
| `GET` | `/api/dashboard/report` | Downloadable/exportable report (`?format=json` or `?format=csv`) | Family Member |

### 🔔 Notifications (`/api/notifications`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/notifications` | User notifications (optional `?unread_only=true`) | Authenticated |
| `GET` | `/api/notifications/unread-count` | Number of unread notifications | Authenticated |
| `PUT` | `/api/notifications/:id/read` | Mark single notification as read | Authenticated |
| `PUT` | `/api/notifications/read-all` | Mark all notifications as read | Authenticated |

---

## 🚀 Running Locally

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment**:
   Edit `backend/.env` with your MySQL server credentials:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=onepot_db
   ```

3. **Initialize Database & Seed Data**:
   ```bash
   npm run db:init
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   # or
   npm start
   ```

5. **Demo Accounts Seeded**:
   - **Dad (Admin)**: `dad@onepot.local` / `password123`
   - **Mum (Admin)**: `mum@onepot.local` / `password123`
   - **Tobi (Member)**: `tobi@onepot.local` / `password123`
   - **Zainab (Member)**: `zainab@onepot.local` / `password123`

