# Normalization notes

The design target is **third normal form (3NF)**. Each point below is something that changed during the project, so it can be explained as a design story.

## 1NF: atomic values, no repeating groups
- **Fixed during the project.** The first version of `shelters` had `cap_dogs` and `cap_cats` columns, which is a repeating group (one column per species). Adding rabbits would have meant altering the table again. It became `shelter_capacity(shelter_id, species, capacity)`, one row per shelter and species. Script 07 introduced it and script 08 dropped the old columns.
- **Deliberate exception.** `applications.details` is a JSON document holding the adopter's form answers (phone, city, home type, references). It is always read together, never searched or joined column by column, and belongs to that one application, so a JSON column is simpler than eight extra columns. The trade-off is that those answers cannot be indexed.

## 2NF: no partial dependencies
- Tables with composite keys: `favorites (user_id, pet_id)`, `waitlist (user_id, pet_id)` and `shelter_capacity (shelter_id, species)`. In each, every non-key column depends on the **whole** key. For example, `capacity` depends on both the shelter and the species, and `joined_at` on both the adopter and the animal.
- All other tables use a single-column key, so partial dependencies cannot occur.

## 3NF: no transitive dependencies
- Shelter details (name, address, coordinates) live only in `shelters`. `pets` holds just `shelter_id`.
- Adopter details live only in `users`. `applications`, `visits`, `waitlist` and `favorites` hold just `user_id`.
- The animal's name is never copied into `applications` or `followups`; it is found with a join.
- `v_capacity`, `v_shelter_stats` and the other views calculate counts instead of storing them, so nothing can drift out of date.

## Known trade-off
`pets.breed` is a free-text column. A separate `breeds` table would need `(breed, species)` as its key because "Indie" exists for both dogs and cats, and staff add new breeds freely. It was kept as an attribute for simplicity.

## Keys and constraints in use
| Kind | Where |
|---|---|
| Primary keys | every table; composite on `favorites`, `waitlist`, `shelter_capacity` |
| Foreign keys | 16, with `ON DELETE CASCADE` for dependent rows (preferences, favorites, waitlist, follow-ups) and `SET NULL` for audit and medical author |
| UNIQUE | `users.username`, `shelters.name`, `visits (pet_id, visit_date, slot)` which prevents double booking, `followups (application_id, days_after)` |
| CHECK | rating 1 to 5, donation amount > 0, capacity >= 0, match score 0 to 100, stage 0 to 4 |
| ENUM / NOT NULL / DEFAULT | species, status, role, size, energy, and required columns throughout |
