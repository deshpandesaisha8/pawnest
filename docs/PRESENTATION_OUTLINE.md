# Presentation outline (10 to 12 slides, about 6 minutes plus the demo)

Keep each slide to a few words and one picture. Put your spoken explanation in the speaker notes.

| # | Slide | On the slide | Picture |
|---|---|---|---|
| 1 | Title | Pawnest: Shelter and Adoption Hub. Team names, course, date | Logo or a pet portrait |
| 2 | Problem | Four problems: unknown space, forgotten animals, animals not ready, guesswork matching | A simple icon for each |
| 3 | Objectives | Capacity monitor, long-stay alert, readiness status, compatibility matching, audit trail | Four small icons |
| 4 | Why a database | Relationships, transactions, rules enforced by triggers, SQL reports | Excel vs database comparison |
| 5 | Architecture | Browser, Flask, MySQL. Roles: adopter, admin, vet | A three-box diagram |
| 6 | ER diagram | 14 tables and their relationships | Diagram exported from mermaid.live |
| 7 | Normalization | The `cap_dogs/cap_cats` to `shelter_capacity` story. 3NF | Before and after tables |
| 8 | Database objects | 4 triggers, 2 procedures, 1 function, 4 views, 6 indexes, CHECK constraints | A table of names and purposes |
| 9 | Key features | Matching, waitlist, follow-ups, certificate, reports, 7 categories | 3 or 4 screenshots |
| 10 | Security | Hashed passwords, parameterised SQL, server-side codes, role-based DB users, rate limiting | A lock icon and a short list |
| 11 | Live demo | "Let's see it working" | Screenshot of the home page |
| 12 | Learnings and next steps | What worked, the concurrency bug we found and fixed, future work, GitHub link, thank you | QR code to the repo |

## Who presents
Split the slides between members so everyone speaks: the database member takes 4, 6, 7 and 8, the backend member takes 5 and 10, the frontend member takes 9, and the docs member takes 2, 3 and 12. Whoever drives the demo practises it twice.

## Tips
- Make the ER diagram at <https://mermaid.live>: paste the code from `docs/ER_DIAGRAM.md` and export a PNG.
- Use big fonts (at least 24 pt) and no long paragraphs.
- Practise out loud with a timer, and agree who answers which viva questions.
