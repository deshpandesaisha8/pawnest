-- 08: final schema clean-up: normalisation, CHECK constraints, indexes, views, a function and one more trigger.
-- Run once in Workbench (as root) after 07.
USE pawnest;

-- 1) Normalisation: capacity per species lives in shelter_capacity, so the repeating columns are redundant
ALTER TABLE shelters DROP COLUMN cap_dogs, DROP COLUMN cap_cats;

-- 2) Constraints (data rules enforced by MySQL itself)
ALTER TABLE followups ADD CONSTRAINT chk_followup_rating CHECK (rating IS NULL OR rating BETWEEN 1 AND 5);
ALTER TABLE donations ADD CONSTRAINT chk_donation_amount CHECK (amount > 0);
ALTER TABLE shelter_capacity ADD CONSTRAINT chk_capacity CHECK (capacity >= 0);
ALTER TABLE applications ADD CONSTRAINT chk_match_score CHECK (match_score BETWEEN 0 AND 100),
                         ADD CONSTRAINT chk_stage CHECK (stage BETWEEN 0 AND 4);

-- 3) Indexes for the queries the site runs most
CREATE INDEX idx_pets_species_status ON pets (species, status);
CREATE INDEX idx_pets_status_intake ON pets (status, intake_date);        -- long-stay search
CREATE INDEX idx_apps_pet_status ON applications (pet_id, status);
CREATE INDEX idx_notes_user_read ON notifications (user_id, is_read);
CREATE INDEX idx_followups_due ON followups (status, due_date);
CREATE INDEX idx_audit_created ON audit_log (created_at);

-- 4) Views
CREATE OR REPLACE VIEW v_long_stay AS
  SELECT p.pet_id, p.name, p.species, p.breed, s.name AS shelter, DATEDIFF(CURDATE(), p.intake_date) AS days_in_shelter
  FROM pets p JOIN shelters s ON s.shelter_id = p.shelter_id
  WHERE p.status = 'Available' AND DATEDIFF(CURDATE(), p.intake_date) > 90;

CREATE OR REPLACE VIEW v_pet_readiness AS
  SELECT pet_id, name, species, status,
         CASE WHEN status = 'Quarantine' THEN 'Quarantine'
              WHEN under_treatment THEN 'Under treatment'
              WHEN NOT vaccinated THEN 'Needs vaccination'
              WHEN NOT behavior_checked THEN 'Needs behavior check'
              ELSE 'Ready' END AS readiness,
         ROUND(100 * (vaccinated + behavior_checked + (1 - under_treatment)) / 3) AS readiness_pct
  FROM pets;

CREATE OR REPLACE VIEW v_shelter_stats AS
  SELECT s.shelter_id, s.name, COUNT(p.pet_id) AS total, SUM(p.status = 'Adopted') AS adopted,
         ROUND(100 * SUM(p.status = 'Adopted') / COUNT(p.pet_id), 1) AS rate
  FROM shelters s JOIN pets p ON p.shelter_id = s.shelter_id
  GROUP BY s.shelter_id, s.name;

DELIMITER $$

-- 5) Function: how long an animal has been waiting
CREATE FUNCTION fn_days_in_shelter(p_pet INT) RETURNS INT READS SQL DATA
BEGIN
  DECLARE d INT;
  SELECT DATEDIFF(CURDATE(), intake_date) INTO d FROM pets WHERE pet_id = p_pet;
  RETURN d;
END$$

-- 6) Trigger: the database itself refuses an application for an animal that is not available
CREATE TRIGGER trg_app_check BEFORE INSERT ON applications FOR EACH ROW
BEGIN
  DECLARE v_status VARCHAR(20);
  SELECT status INTO v_status FROM pets WHERE pet_id = NEW.pet_id;
  IF v_status IS NULL OR v_status <> 'Available' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This animal is not available for adoption';
  END IF;
END$$

DELIMITER ;
