-- Least-privilege database users (optional). Run as root, then set the DB_ADMIN_* / DB_ADOPTER_* lines in .env.
-- Change both passwords before running.
CREATE USER IF NOT EXISTS 'pawnest_admin'@'localhost' IDENTIFIED BY 'ChangeAdminPass1!';
CREATE USER IF NOT EXISTS 'pawnest_adopter'@'localhost' IDENTIFIED BY 'ChangeAdopterPass1!';

-- Admin: full data access, but no CREATE / DROP / ALTER
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON pawnest.* TO 'pawnest_admin'@'localhost';

-- Adopter: read what they need, write only their own kinds of data, no access to admin procedures
GRANT SELECT ON pawnest.pets TO 'pawnest_adopter'@'localhost';
GRANT SELECT ON pawnest.shelters TO 'pawnest_adopter'@'localhost';
GRANT SELECT ON pawnest.users TO 'pawnest_adopter'@'localhost';
GRANT SELECT ON pawnest.medical_records TO 'pawnest_adopter'@'localhost';
GRANT SELECT ON pawnest.donations TO 'pawnest_adopter'@'localhost';
GRANT SELECT, INSERT ON pawnest.applications TO 'pawnest_adopter'@'localhost';
GRANT SELECT, INSERT, DELETE ON pawnest.visits TO 'pawnest_adopter'@'localhost';
GRANT SELECT, INSERT, DELETE ON pawnest.favorites TO 'pawnest_adopter'@'localhost';
GRANT SELECT, INSERT, DELETE ON pawnest.waitlist TO 'pawnest_adopter'@'localhost';
GRANT SELECT, INSERT, UPDATE ON pawnest.adopter_preferences TO 'pawnest_adopter'@'localhost';
GRANT SELECT, UPDATE ON pawnest.followups TO 'pawnest_adopter'@'localhost';
GRANT SELECT, INSERT, UPDATE ON pawnest.notifications TO 'pawnest_adopter'@'localhost';
GRANT INSERT ON pawnest.audit_log TO 'pawnest_adopter'@'localhost';
GRANT EXECUTE ON PROCEDURE pawnest.sp_match_pets TO 'pawnest_adopter'@'localhost';
FLUSH PRIVILEGES;

-- Vet: can read most data, add medical records and update only three health columns on pets
CREATE USER IF NOT EXISTS 'pawnest_vet'@'localhost' IDENTIFIED BY 'ChangeVetPass1!';
GRANT SELECT ON pawnest.pets TO 'pawnest_vet'@'localhost';
GRANT SELECT ON pawnest.shelters TO 'pawnest_vet'@'localhost';
GRANT SELECT ON pawnest.users TO 'pawnest_vet'@'localhost';
GRANT SELECT ON pawnest.applications TO 'pawnest_vet'@'localhost';
GRANT SELECT ON pawnest.visits TO 'pawnest_vet'@'localhost';
GRANT SELECT ON pawnest.followups TO 'pawnest_vet'@'localhost';
GRANT SELECT, INSERT ON pawnest.medical_records TO 'pawnest_vet'@'localhost';
GRANT UPDATE (vaccinated, behavior_checked, under_treatment) ON pawnest.pets TO 'pawnest_vet'@'localhost';
GRANT SELECT, UPDATE ON pawnest.notifications TO 'pawnest_vet'@'localhost';
GRANT INSERT ON pawnest.audit_log TO 'pawnest_vet'@'localhost';
FLUSH PRIVILEGES;

-- Part 7: the page reads per-species capacity
GRANT SELECT ON pawnest.shelter_capacity TO 'pawnest_adopter'@'localhost';
GRANT SELECT ON pawnest.shelter_capacity TO 'pawnest_vet'@'localhost';
FLUSH PRIVILEGES;
