# Viva notes

How to use these: read each answer, then say it **in your own words**. If you do not know something, say what you do know and offer to check it in the code. Everyone should be able to open the files for their own part and explain them.

**Numbers to remember:** 14 tables, 4 views, 4 triggers, 2 stored procedures, 1 stored function, 16 foreign keys, 5 CHECK constraints, 9 shelters, 7 animal categories, 214 animals, 3 user roles (adopter, admin, vet).

---

## A. About the project
**1. What problem does it solve?**
Shelters often track animals on paper or WhatsApp. Nobody knows which shelter has space, animals that wait for months are forgotten, adopters apply for animals that are not ready, and matching is guesswork. Pawnest keeps everything in one database and makes the database enforce the rules.

**2. Why a database and not Excel?**
Excel cannot stop a shelter going over capacity or two people booking the same slot, it cannot safely handle two people changing the same record, and it does not link adopters, animals and applications properly. A database enforces these rules itself.

**3. Why MySQL (relational) and not NoSQL?**
Our data is structured and full of relationships (shelter, animal, application, adopter) and needs transactions, triggers and joins. NoSQL suits flexible, unstructured data. We use one JSON column for the application form answers, which is the only flexible part.

**4. What are your four main features and where are they in the database?**
Capacity monitor (`shelter_capacity`, `v_capacity`, trigger `trg_pets_capacity`). Long-stay alert (`v_long_stay`, an index on status and intake date). Readiness status (`v_pet_readiness`, trigger `trg_app_check`). Compatibility matching (stored procedure `sp_match_pets`).

**5. Who uses it?**
Adopters browse, set preferences, apply, book visits and join waitlists. Admins (shelter staff) manage animals and approve applications. Vets add medical records. Admin and vet sign-up need a secret code checked on the server.

## B. Design
**6. Explain your ER diagram.**
A shelter has many animals (1 to many). An adopter has many applications and an animal receives many applications (1 to many each). Adopters and animals are also linked many to many through favorites and the waitlist, using tables whose key is the pair (user_id, pet_id). An application has many follow-ups. Medical records belong to an animal. (Diagram: docs/ER_DIAGRAM.md.)

**7. Give examples of primary key, foreign key and composite key.**
Primary key: `pets.pet_id`. Foreign key: `pets.shelter_id` points to `shelters.shelter_id`. Composite key: `favorites (user_id, pet_id)` and `shelter_capacity (shelter_id, species)`.

**8. Which normal form is your design in?**
Third normal form. Shelter details live only in `shelters`, adopter details only in `users`, and tables hold just the ids. Nothing derived is stored, because counts come from views.

**9. Tell me one thing you changed for normalization.**
The first version of `shelters` had `cap_dogs` and `cap_cats` columns, a repeating group. Adding rabbits would have meant new columns. We moved it to `shelter_capacity(shelter_id, species, capacity)`, one row per shelter and species, and dropped the old columns.

**10. Why is there a JSON column?**
`applications.details` stores the adopter's form answers. They are always read together, never searched or joined, and belong to that one application. The trade-off is that they cannot be indexed.

**11. Is there any redundancy left?**
`pets.breed` is free text. A breeds table would need (breed, species) as its key because "Indie" exists for dogs and cats, and staff add new breeds freely, so we kept it simple.

**12. What does ON DELETE CASCADE mean in your project?**
If an adopter account is deleted, their preferences, favorites and waitlist rows are deleted automatically. For the audit log we use SET NULL, so the history stays even if the person is removed.

**13. Which constraints did you use?**
Primary keys, foreign keys, UNIQUE (username, shelter name, one visit slot per animal and date), CHECK (rating 1 to 5, donation above 0, capacity at least 0, match score 0 to 100, stage 0 to 4), NOT NULL, ENUM and defaults.

## C. SQL objects
**14. What is a trigger? Which ones do you have?**
A trigger runs automatically when a row is inserted, updated or deleted. Ours: `trg_pets_capacity` (blocks adding an animal when the shelter is full for that species, or does not take it), `trg_app_check` (refuses an application for an animal that is not available), `trg_app_audit` (logs every application status change), `trg_pet_available` (notifies the first person on the waitlist).

**15. Trigger vs procedure vs function?**
A trigger fires by itself on an event. A procedure runs when you CALL it and can change data. A function returns one value and is used inside a SELECT. Ours: `sp_approve_application`, `sp_match_pets` and `fn_days_in_shelter`.

**16. What does `sp_approve_application` do and why a transaction?**
It approves one application, rejects the other open ones for the same animal, marks the animal adopted and schedules follow-ups at 7, 30 and 90 days. These steps must all happen or none, so they run in one transaction with a rollback on any error.

**17. How does `sp_match_pets` score animals?**
Out of 100: size matches 25, energy matches 25, an apartment adopter is not given a large animal 20, a first-time adopter is not given a high-energy animal 15, and the adopter has a yard or the animal is not high-energy 15. It only considers available, ready animals that fit the adopter's species, kids and other-pets answers.

**18. What is a view and why use them?**
A view is a saved query that behaves like a table. We use `v_capacity`, `v_long_stay`, `v_pet_readiness` and `v_shelter_stats`. They always show current numbers, so we never store counts that could become wrong.

**19. What is an index? Which did you add and what is the downside?**
An index makes searches faster, like a book index. We added six, for example on (species, status) and (status, intake_date). The downside is that writes are slightly slower and indexes use space. `EXPLAIN SELECT ...` in `demo_queries.sql` shows an index being used.

**20. Which joins did you use?**
INNER JOIN (applications with users, animals and shelters), LEFT JOIN (shelters with no rabbits), and a self join (same breed in two shelters). All are in `sql/demo_queries.sql`.

**21. GROUP BY vs HAVING?**
GROUP BY groups rows, and HAVING filters the groups after counting, while WHERE filters rows before. Example: breeds with at least 8 animals, `GROUP BY breed HAVING COUNT(*) >= 8`.

**22. What is the window function in your project?**
`RANK() OVER (PARTITION BY species ORDER BY intake_date)` in a CTE gives the three longest-waiting animals of each species on the Reports page.

## D. Transactions and concurrency
**23. Explain ACID with your project.**
Atomicity: approval either fully happens or is rolled back. Consistency: constraints and triggers keep data valid (capacity, ratings). Isolation: row locks stop two admins corrupting the same application. Durability: InnoDB writes committed data safely to disk.

**24. What if two admins approve at the same moment?**
The procedure locks the application row with `SELECT ... FOR UPDATE`, so the second admin waits. After the first commits, the second finds the application is no longer open, and the procedure raises "This application is already closed". We found a gap here during testing (an already-rejected application could still be approved) and fixed it in `sql/10_approval_guard.sql`.

**25. What does ROLLBACK do?**
It undoes everything since START TRANSACTION. The demo file shows setting an animal to Adopted and rolling it back.

## E. Security
**26. How are passwords stored?**
As salted hashes (scrypt, through Werkzeug), never as plain text. A hash cannot be turned back into the password.

**27. How do you prevent SQL injection?**
Every query uses parameters (`%s`), so user input is never glued into the SQL text. The few column names built into a query come from fixed lists in the code.

**28. How is the admin code protected?**
It lives in `.env` on the server and is checked on the server, never in the web page. Five wrong tries lock the form for 30 seconds, and registration and login are rate limited.

**29. How is access controlled?**
The server checks the user's role on every route. There are also optional separate MySQL users (`09_roles_optional.sql`): the adopter user is refused if it tries to update animals or approve applications, because the database itself denies it.

**30. Other protections?**
Only JSON requests are accepted for changes (blocks cross-site form posts), secure response headers, photos are checked and re-saved with Pillow, and secrets stay out of Git through `.gitignore`.

## F. App and tools
**31. Architecture?**
Browser sends requests to Flask (`/api/...` returning JSON), and Flask runs SQL on MySQL. MySQL Workbench is only a window into the same database.

**32. Why Flask with raw SQL and no ORM?**
It is small and simple, and the SQL stays visible, which is the point of a DBMS project.

**33. Which tools did you use?**
MySQL 8 and Workbench, Python and Flask, VS Code, Git and GitHub, HTML, CSS, JavaScript and Chart.js.

## G. Standard questions
- **DDL, DML, DCL, TCL:** CREATE/ALTER/DROP, INSERT/UPDATE/DELETE/SELECT, GRANT/REVOKE (our roles script), COMMIT/ROLLBACK.
- **DELETE vs TRUNCATE vs DROP:** DELETE removes chosen rows and can be rolled back, TRUNCATE empties the whole table fast, DROP removes the table itself.
- **Primary key vs unique key:** a table has one primary key and it cannot be NULL; it can have several unique keys.
- **INNER vs LEFT JOIN:** INNER keeps only matching rows, LEFT keeps every row from the left table.

## H. Curveballs
- **"Show the animals waiting longest."** `SELECT * FROM v_long_stay ORDER BY days_in_shelter DESC;`
- **"Show a trigger working."** Add an animal to a full shelter (refused), or approve an application and show `SELECT * FROM audit_log ORDER BY log_id DESC;`
- **"Limitations?"** Demo donations take no payment, matching is rule-based (not machine learning), email and WhatsApp alerts are optional, and it has not been load-tested.
- **"Improvements?"** Cloud database, a real payment gateway, automated tests, scheduled backups.
- **"What if MySQL stops?"** The site shows an error. InnoDB recovers committed data when it restarts, and we can restore from a Workbench Data Export backup.

## I. Know your own part
| Member | Be ready to open and explain |
|---|---|
| Database | `sql/01` to `10`, the ER diagram, normalization, triggers and procedures |
| Backend | `app.py`, `api_core.py`, `api_extras.py`, `db.py`, login and security |
| Frontend | `static/index.html`, `css/style.css`, `js/app.js`, how pages call `/api/...` |
| Docs and testing | README, demo queries, the test plan, screenshots |
