-- Pawnest schema (MySQL 8). Run this whole script in Workbench as root.
CREATE DATABASE IF NOT EXISTS pawnest CHARACTER SET utf8mb4;
USE pawnest;

CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(60) NOT NULL,
  username VARCHAR(20) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','adopter') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shelters (
  shelter_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  address VARCHAR(120),
  cap_dogs INT NOT NULL,
  cap_cats INT NOT NULL
);

CREATE TABLE pets (
  pet_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(30) NOT NULL,
  species ENUM('Dog','Cat') NOT NULL,
  breed VARCHAR(30) NOT NULL,
  size ENUM('Small','Medium','Large') NOT NULL,
  energy ENUM('Low','Medium','High') NOT NULL,
  good_with_kids BOOLEAN NOT NULL DEFAULT TRUE,
  good_with_pets BOOLEAN NOT NULL DEFAULT TRUE,
  shelter_id INT NOT NULL,
  intake_date DATE NOT NULL,
  status ENUM('Available','Quarantine','Adopted') NOT NULL DEFAULT 'Available',
  vaccinated BOOLEAN NOT NULL DEFAULT FALSE,
  behavior_checked BOOLEAN NOT NULL DEFAULT FALSE,
  under_treatment BOOLEAN NOT NULL DEFAULT FALSE,
  photo_url VARCHAR(255) NULL,
  FOREIGN KEY (shelter_id) REFERENCES shelters(shelter_id)
);

CREATE TABLE applications (
  application_id INT AUTO_INCREMENT PRIMARY KEY,
  pet_id INT NOT NULL,
  user_id INT NOT NULL,
  status ENUM('Submitted','Approved','Rejected') NOT NULL DEFAULT 'Submitted',
  stage TINYINT NOT NULL DEFAULT 0,
  match_score TINYINT NOT NULL DEFAULT 60,
  details JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pet_id) REFERENCES pets(pet_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE audit_log (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(200) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

DELIMITER $$

-- Block adding an animal when its shelter is already full for that species
CREATE TRIGGER trg_pets_capacity BEFORE INSERT ON pets FOR EACH ROW
BEGIN
  DECLARE cur INT;
  DECLARE cap INT;
  SELECT COUNT(*) INTO cur FROM pets
    WHERE shelter_id = NEW.shelter_id AND species = NEW.species AND status <> 'Adopted';
  SELECT IF(NEW.species = 'Dog', cap_dogs, cap_cats) INTO cap FROM shelters WHERE shelter_id = NEW.shelter_id;
  IF cur >= cap THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shelter is full for this species';
  END IF;
END$$

-- Write every application status change to the audit log
CREATE TRIGGER trg_app_audit AFTER UPDATE ON applications FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO audit_log (user_id, action)
    VALUES (NEW.user_id, CONCAT('Application #', NEW.application_id, ' changed from ', OLD.status, ' to ', NEW.status));
  END IF;
END$$

-- Approve one application, auto-reject the rest for that pet, mark the pet adopted (all or nothing)
CREATE PROCEDURE sp_approve_application(IN p_app INT)
BEGIN
  DECLARE v_pet INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  START TRANSACTION;
  SELECT pet_id INTO v_pet FROM applications WHERE application_id = p_app AND status = 'Submitted' FOR UPDATE;
  UPDATE applications SET status = 'Approved', stage = 4 WHERE application_id = p_app;
  UPDATE applications SET status = 'Rejected' WHERE pet_id = v_pet AND application_id <> p_app AND status = 'Submitted';
  UPDATE pets SET status = 'Adopted' WHERE pet_id = v_pet;
  COMMIT;
END$$

DELIMITER ;

CREATE VIEW v_capacity AS
  SELECT s.shelter_id, s.name AS shelter, 'Dog' AS species, s.cap_dogs AS capacity,
         (SELECT COUNT(*) FROM pets p WHERE p.shelter_id = s.shelter_id AND p.species = 'Dog' AND p.status <> 'Adopted') AS current_count
  FROM shelters s
  UNION ALL
  SELECT s.shelter_id, s.name, 'Cat', s.cap_cats,
         (SELECT COUNT(*) FROM pets p WHERE p.shelter_id = s.shelter_id AND p.species = 'Cat' AND p.status <> 'Adopted')
  FROM shelters s;

-- Seed data
INSERT INTO shelters (shelter_id, name, address, cap_dogs, cap_cats) VALUES
  (1, 'Happy Paws', 'Baner Road, Pune', 8, 4),
  (2, 'Safe Tails', 'Kothrud, Pune', 3, 4);

INSERT INTO pets (pet_id, name, species, breed, size, energy, good_with_kids, good_with_pets, shelter_id, intake_date, status, vaccinated, behavior_checked, under_treatment) VALUES
(1,'Bruno','Dog','Labrador','Large','Medium',1,1,1,CURDATE() - INTERVAL 40 DAY,'Available',1,1,0),
(2,'Coco','Dog','Beagle','Medium','High',1,1,1,CURDATE() - INTERVAL 25 DAY,'Available',1,1,0),
(3,'Max','Dog','Labrador','Large','High',1,0,1,CURDATE() - INTERVAL 160 DAY,'Available',1,1,0),
(4,'Rocky','Dog','Pug','Small','Low',1,1,1,CURDATE() - INTERVAL 120 DAY,'Available',1,1,0),
(5,'Simba','Dog','Indie','Medium','Medium',1,1,1,CURDATE() - INTERVAL 15 DAY,'Available',1,1,0),
(6,'Zoe','Dog','Spitz','Small','High',0,1,1,CURDATE() - INTERVAL 5 DAY,'Available',0,1,0),
(7,'Tiger','Dog','German Shepherd','Large','High',0,0,1,CURDATE() - INTERVAL 3 DAY,'Quarantine',0,0,0),
(8,'Misty','Cat','Persian','Small','Low',1,1,1,CURDATE() - INTERVAL 95 DAY,'Available',1,1,0),
(9,'Luna','Cat','Indie','Small','Medium',1,1,1,CURDATE() - INTERVAL 10 DAY,'Available',1,0,0),
(10,'Daisy','Dog','Golden Retriever','Large','Medium',1,1,2,CURDATE() - INTERVAL 50 DAY,'Available',1,1,0),
(11,'Buddy','Dog','Boxer','Large','High',1,0,2,CURDATE() - INTERVAL 45 DAY,'Available',1,1,1),
(12,'Sheru','Dog','Indie','Medium','Low',1,1,2,CURDATE() - INTERVAL 200 DAY,'Available',1,1,0),
(13,'Kitty','Cat','Indie','Small','High',1,1,2,CURDATE() - INTERVAL 18 DAY,'Available',1,1,0),
(14,'Whiskers','Cat','Siamese','Small','Low',0,0,2,CURDATE() - INTERVAL 70 DAY,'Available',1,1,0);
