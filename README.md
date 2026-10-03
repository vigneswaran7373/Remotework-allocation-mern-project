# WorkSync – Smart Remote Work Allocation & Monitoring System (MERN)

Managers create tasks; the system **automatically assigns each task to the best-fit remote employee** (skills, free capacity, track record) and **monitors productivity** from tasks and daily check-ins, flagging overload, overdue work and silent team members.

**Stack:** MongoDB · Express.js · React (Vite) · Node.js · JWT auth · REST APIs · background automation job

## Roles
| Role | Can do |
|---|---|
| **Manager** | add/deactivate employees, create tasks, auto-allocate, get ranked suggestions, assign manually, see the monitoring dashboard, pause/run automation |
| **Employee** | see only their tasks, start/finish them, submit a daily check-in, edit own skills & weekly capacity |

## How the allocation works (plain JavaScript, `server/services/allocator.js`)
```
score = 0.5 × skillFit + 0.3 × availability + 0.2 × performance
```
- **skillFit** – share of the task's required skills the person has
- **availability** – share of weekly capacity still free after taking the task
- **performance** – on-time completion rate over the last 60 days (0.7 for newcomers)
- **Hard rules** – needs at least one required skill and enough free hours, otherwise ineligible
- Tasks are processed **most urgent first** (priority, then due date) and each assignment updates the person's load, so work is spread out
- Tasks nobody can take stay unassigned **with a reason** ("no matching skills", "not enough free capacity")
- The *Suggest* button shows every candidate ranked, with the reason, so the manager can override

## How monitoring works (`server/services/metrics.js`)
Productivity score (0-100) = 40% on-time rate + 30% check-in consistency (last 7 days) + 30% share of open tasks that are not overdue. Status: ≥75 on track, ≥50 at risk, else needs attention. Signals shown to the manager: overdue tasks, overloaded / near capacity, no check-in for 2+ days, long days (burnout risk), free capacity.

## Automation
A background job (`AUTO_ALLOCATE_MINUTES`, default 5) allocates newly created unassigned tasks on its own. Managers can pause/resume it or run it now from the Monitor page. Tasks are claimed atomically, so two runs can never double-assign.

## Run it
Needs Node 18+ and MongoDB (local or Atlas).
```bash
cd server
cp .env.example .env
npm install
npm run seed          # demo team, tasks and check-ins
npm run dev           # http://localhost:5003

cd ../client          # new terminal
npm install
npm run dev           # http://localhost:5175
```
Logins (password `password123`): **manager@work.com**, employees `asha@work.com`, `ravi@work.com`, `meera@work.com`, `karan@work.com`.
In the demo data Karan has an overdue task and has stopped checking in, so the dashboard flags him; several tasks start unassigned so you can try *Auto-allocate*.

## Tests
```bash
cd server && npm test      # 24 tests (needs MongoDB; uses a separate `worksync_test` database that it wipes)
```
11 unit tests for the allocator and metrics, 13 API tests for auth, roles, validation, allocation, check-ins, monitoring, the scheduler and deactivation.

## REST API
| Method | Route | Access |
|---|---|---|
| POST | /api/auth/register · /login | public |
| GET · PATCH | /api/auth/me | logged in |
| GET · POST | /api/employees | manager |
| PATCH · DELETE | /api/employees/:id | manager |
| GET · POST | /api/tasks | manager (all) · employee (own, GET only) |
| POST | /api/tasks/allocate | manager |
| GET | /api/tasks/:id/suggestions | manager |
| PATCH · DELETE | /api/tasks/:id | manager |
| PATCH | /api/tasks/:id/status | assignee or manager |
| POST · GET | /api/checkins · /api/checkins/mine | employee |
| GET | /api/checkins | manager |
| GET | /api/monitor | manager |
| GET · PATCH · POST | /api/monitor/automation · /automation/run | manager |
