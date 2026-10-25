# Demo script (about 12 minutes)

## Before the demo (do this the day before)
- Run the site once. Register an **admin**, **adopter A** and **adopter B** with made-up details, and write the passwords down.
- In Workbench keep three tabs ready: (1) the Navigator open on `pawnest`, (2) `sql/demo_queries.sql`, (3) a tab with `SELECT user_id, username, role, LEFT(password_hash, 30) AS hash FROM users;` and `SELECT * FROM audit_log ORDER BY log_id DESC;`.
- In VS Code keep `README.md`, `01_schema.sql` and `api_core.py` open. Press **Ctrl + =** a few times to make the text big.
- Use browser zoom 110 percent, and a second private window for adopter B.
- Pick two ready animals: `SELECT name FROM v_pet_readiness WHERE readiness = 'Ready' AND status = 'Available' LIMIT 5;`
- Take screenshots of each step and save them in `docs/screenshots/`, as a backup if something fails.
- Start MySQL, then run `flask run` and test once, including the sign-in.

## Script
| Time | Show | Say |
|---|---|---|
| 0:00 | README on GitHub | The problem in three sentences, and the four features |
| 1:00 | Workbench Navigator, ER diagram from the README | 14 tables, how they connect (1 to many, many to many), 3NF and the `shelter_capacity` story |
| 2:30 | VS Code terminal, then the website home page | Browser, Flask and MySQL. "Workbench is only a viewer for the same database" |
| 3:00 | Register adopter A | Server-side validation and email. Then Workbench tab 3: the password is a hash |
| 4:00 | Adopter A: preferences, matches, animal tabs, one animal's page | `sp_match_pets` ranks inside MySQL. Seven categories. Medical history and cost estimate |
| 5:00 | Adopter A applies (4-step wizard); adopter B applies for the same animal | Validation, then the `trg_app_check` rule |
| 6:30 | Admin: dashboard, applications, advance one stage, then **approve** A | Show B rejected automatically. Say: one transaction, locks, rollback |
| 8:00 | Workbench tab 3 | The audit log (trigger), follow-ups created, the animal is Adopted. Download the certificate |
| 9:00 | Admin: add an animal to a shelter that is full | The capacity trigger refuses it |
| 9:45 | Reports page | GROUP BY, HAVING, RANK window function, charts |
| 10:30 | `demo_queries.sql`: a join, a view, `EXPLAIN` | Show one query from each type |
| 11:15 | Optional: the adopter database user | Try `UPDATE pets ...` as the adopter user and show the denied error |
| 11:45 | Back to README | Limitations and improvements, then ask for questions |

## If something goes wrong
- Site will not start: show the screenshots, then run queries in Workbench instead.
- A page shows an error: say what you expect to see, show the Flask terminal and Workbench, and carry on.
- Never improvise on the database: use the prepared queries.
