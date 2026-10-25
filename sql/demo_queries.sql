-- Pawnest demo queries (run in Workbench against the pawnest database). Statements marked EXPECTED ERROR are meant to fail.
USE pawnest;

-- ===== DDL =====
SHOW TABLES;
DESCRIBE pets;
SHOW CREATE TABLE applications;
CREATE TABLE demo_scratch (id INT PRIMARY KEY, note VARCHAR(30));
ALTER TABLE demo_scratch ADD COLUMN created_on DATE;
DROP TABLE demo_scratch;

-- ===== DML (inside a transaction, so nothing is kept) =====
START TRANSACTION;
INSERT INTO donations (amount, note) VALUES (500, 'viva demo');
UPDATE donations SET amount = 1000 WHERE note = 'viva demo';
DELETE FROM donations WHERE note = 'viva demo';
ROLLBACK;

-- ===== Joins =====
-- INNER JOIN across four tables: who applied for which animal, at which shelter
SELECT u.full_name AS adopter, p.name AS animal, p.species, s.name AS shelter, a.status
FROM applications a JOIN users u ON u.user_id = a.user_id JOIN pets p ON p.pet_id = a.pet_id JOIN shelters s ON s.shelter_id = p.shelter_id;
-- LEFT JOIN: shelters with no rabbits
SELECT s.name FROM shelters s LEFT JOIN pets p ON p.shelter_id = s.shelter_id AND p.species = 'Rabbit' WHERE p.pet_id IS NULL;
-- SELF JOIN: same breed housed in two different shelters
SELECT a.name AS animal_1, b.name AS animal_2, a.breed FROM pets a JOIN pets b ON a.breed = b.breed AND a.species = b.species AND a.shelter_id < b.shelter_id LIMIT 10;

-- ===== Aggregates: GROUP BY, HAVING =====
SELECT species, COUNT(*) AS animals, SUM(status = 'Adopted') AS adopted FROM pets GROUP BY species ORDER BY animals DESC;
SELECT breed, COUNT(*) AS n FROM pets GROUP BY breed HAVING COUNT(*) >= 8 ORDER BY n DESC;

-- ===== Subqueries, CTE and window functions =====
-- correlated subquery: animals waiting longer than the average for their species
SELECT name, species, DATEDIFF(CURDATE(), intake_date) AS days FROM pets p
WHERE status = 'Available' AND DATEDIFF(CURDATE(), intake_date) > (SELECT AVG(DATEDIFF(CURDATE(), intake_date)) FROM pets WHERE species = p.species AND status = 'Available')
ORDER BY days DESC LIMIT 10;
-- CTE + RANK(): the three longest-waiting animals of each species
WITH waiting AS (SELECT name, species, DATEDIFF(CURDATE(), intake_date) AS days, RANK() OVER (PARTITION BY species ORDER BY intake_date) AS rnk FROM pets WHERE status = 'Available')
SELECT * FROM waiting WHERE rnk <= 3 ORDER BY species, rnk;

-- ===== Views =====
SELECT * FROM v_capacity ORDER BY current_count / capacity DESC LIMIT 10;
SELECT * FROM v_long_stay ORDER BY days_in_shelter DESC LIMIT 10;
SELECT readiness, COUNT(*) AS animals FROM v_pet_readiness GROUP BY readiness;
SELECT * FROM v_shelter_stats ORDER BY rate DESC;

-- ===== Functions and procedures =====
SELECT name, fn_days_in_shelter(pet_id) AS days_waiting FROM pets WHERE pet_id IN (1, 2, 3);
-- CALL sp_match_pets(<user_id>);          -- ranks animals for an adopter who has saved preferences
-- CALL sp_approve_application(<app_id>);  -- approves one, rejects the rest, marks the animal adopted, schedules follow-ups

-- ===== Triggers =====
-- Capacity trigger. EXPECTED ERROR: adding an animal to a shelter that is full for that species
SET @sh = (SELECT shelter_id FROM v_capacity WHERE current_count >= capacity LIMIT 1);
SET @sp = (SELECT species FROM v_capacity WHERE current_count >= capacity LIMIT 1);
INSERT INTO pets (name, species, breed, size, energy, shelter_id, intake_date) VALUES ('DemoPet', @sp, 'Indie', 'Small', 'Low', @sh, CURDATE());
-- Application check trigger. EXPECTED ERROR: applying for an adopted animal
INSERT INTO applications (pet_id, user_id) VALUES ((SELECT pet_id FROM pets WHERE status = 'Adopted' LIMIT 1), (SELECT MIN(user_id) FROM users));
-- Audit trigger: look at what it recorded after approving or declining an application in the website
SELECT * FROM audit_log ORDER BY log_id DESC LIMIT 10;

-- ===== Transactions =====
START TRANSACTION;
UPDATE pets SET status = 'Adopted' WHERE pet_id = 1;
SELECT pet_id, name, status FROM pets WHERE pet_id = 1;
ROLLBACK;
SELECT pet_id, name, status FROM pets WHERE pet_id = 1;

-- ===== Indexes =====
SHOW INDEX FROM pets;
EXPLAIN SELECT * FROM pets WHERE species = 'Dog' AND status = 'Available';


-- =========================================
-- SQL contribution: Adoption summary
-- Purpose: Count adoption applications by status
-- =========================================

SELECT status, COUNT(*) AS total_applications
FROM applications
GROUP BY status
ORDER BY total_applications DESC;

