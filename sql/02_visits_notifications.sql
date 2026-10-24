-- Part 2 additions. Run once in Workbench (as root) after schema.sql.
USE pawnest;

ALTER TABLE pets ADD COLUMN featured BOOLEAN NOT NULL DEFAULT FALSE,
                 ADD COLUMN fee_discount BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE visits (
  visit_id INT AUTO_INCREMENT PRIMARY KEY,
  pet_id INT NOT NULL,
  user_id INT NOT NULL,
  visit_date DATE NOT NULL,
  slot CHAR(5) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_visit_slot (pet_id, visit_date, slot),   -- the database itself prevents double booking
  FOREIGN KEY (pet_id) REFERENCES pets(pet_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE notifications (
  note_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  for_admin BOOLEAN NOT NULL DEFAULT FALSE,
  message VARCHAR(200) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- The audit trigger now logs as "System" so the activity log reads clearly
DROP TRIGGER IF EXISTS trg_app_audit;
DELIMITER $$
CREATE TRIGGER trg_app_audit AFTER UPDATE ON applications FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO audit_log (user_id, action)
    VALUES (NULL, CONCAT('Application #', NEW.application_id, ' changed from ', OLD.status, ' to ', NEW.status));
  END IF;
END$$
DELIMITER ;
