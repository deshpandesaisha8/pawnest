-- Part 5: waitlist (with trigger), medical history, follow-ups, match procedure, shelter map coordinates.
-- Run once in Workbench (as root) after part4.sql.
USE pawnest;

ALTER TABLE shelters ADD COLUMN lat DECIMAL(9,6) NULL, ADD COLUMN lng DECIMAL(9,6) NULL;
UPDATE shelters SET lat = 18.559000, lng = 73.786800 WHERE shelter_id = 1;
UPDATE shelters SET lat = 18.507400, lng = 73.807700 WHERE shelter_id = 2;
UPDATE shelters SET lat = 18.508900, lng = 73.926000 WHERE shelter_id = 3;
UPDATE shelters SET lat = 18.597500, lng = 73.789800 WHERE shelter_id = 4;

CREATE TABLE waitlist (
  user_id INT NOT NULL,
  pet_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, pet_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (pet_id) REFERENCES pets(pet_id) ON DELETE CASCADE
);

CREATE TABLE medical_records (
  record_id INT AUTO_INCREMENT PRIMARY KEY,
  pet_id INT NOT NULL,
  record_type ENUM('Vaccination','Checkup','Treatment','Surgery') NOT NULL,
  notes VARCHAR(200) NOT NULL,
  next_due DATE NULL,
  recorded_by INT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pet_id) REFERENCES pets(pet_id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(user_id) ON DELETE SET NULL
);

CREATE TABLE followups (
  followup_id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  days_after TINYINT UNSIGNED NOT NULL,
  due_date DATE NOT NULL,
  status ENUM('Pending','Done') NOT NULL DEFAULT 'Pending',
  rating TINYINT NULL,
  notes VARCHAR(200) NULL,
  done_at TIMESTAMP NULL,
  UNIQUE KEY uq_followup (application_id, days_after),
  FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE CASCADE
);

DELIMITER $$

-- When an animal leaves quarantine, notify the first person on its waitlist
CREATE TRIGGER trg_pet_available AFTER UPDATE ON pets FOR EACH ROW
BEGIN
  IF NEW.status = 'Available' AND OLD.status <> 'Available' THEN
    INSERT INTO notifications (user_id, message)
    SELECT user_id, CONCAT(NEW.name, ' is now available! You were first on the waitlist.')
    FROM waitlist WHERE pet_id = NEW.pet_id ORDER BY joined_at, user_id LIMIT 1;
  END IF;
END$$

-- Approval now also schedules the 7, 30 and 90 day follow-ups
DROP PROCEDURE IF EXISTS sp_approve_application$$
CREATE PROCEDURE sp_approve_application(IN p_app INT)
BEGIN
  DECLARE v_pet INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  START TRANSACTION;
  SELECT pet_id INTO v_pet FROM applications WHERE application_id = p_app AND status = 'Submitted' FOR UPDATE;
  UPDATE applications SET status = 'Approved', stage = 4 WHERE application_id = p_app;
  UPDATE applications SET status = 'Rejected' WHERE pet_id = v_pet AND application_id <> p_app AND status = 'Submitted';
  UPDATE pets SET status = 'Adopted' WHERE pet_id = v_pet;
  INSERT INTO followups (application_id, days_after, due_date)
    SELECT p_app, d.n, CURDATE() + INTERVAL d.n DAY FROM (SELECT 7 AS n UNION SELECT 30 UNION SELECT 90) d
    WHERE v_pet IS NOT NULL;
  COMMIT;
END$$

-- Compatibility ranking done by the database (same scoring as the page's match view)
CREATE PROCEDURE sp_match_pets(IN p_user INT)
BEGIN
  SELECT p.pet_id AS id, p.name, p.breed, p.species,
         ( (a.size = 'Any' OR a.size = p.size) * 25
         + (a.energy = 'Any' OR a.energy = p.energy) * 25
         + (1 - (a.home_type = 'Apartment' AND p.size = 'Large')) * 20
         + (1 - (a.experience = 'First-time' AND p.energy = 'High')) * 15
         + (a.has_yard OR p.energy <> 'High') * 15 ) AS score
  FROM adopter_preferences a JOIN pets p
  WHERE a.user_id = p_user AND p.status = 'Available'
    AND p.vaccinated AND p.behavior_checked AND NOT p.under_treatment
    AND (a.species = 'Any' OR a.species = p.species)
    AND (NOT a.has_kids OR p.good_with_kids) AND (NOT a.open_to_special OR p.good_with_pets)
  ORDER BY score DESC, p.name;
END$$

DELIMITER ;
