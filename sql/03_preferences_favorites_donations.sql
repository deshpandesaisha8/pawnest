-- Part 3: adopter preferences, saved animals and donations. Run once in Workbench (as root) after part2.sql.
USE pawnest;

CREATE TABLE adopter_preferences (
  user_id INT PRIMARY KEY,
  species ENUM('Any','Dog','Cat') NOT NULL DEFAULT 'Any',
  size ENUM('Any','Small','Medium','Large') NOT NULL DEFAULT 'Any',
  energy ENUM('Any','Low','Medium','High') NOT NULL DEFAULT 'Any',
  home_type ENUM('House','Apartment') NOT NULL DEFAULT 'House',
  experience ENUM('First-time','Some','Experienced') NOT NULL DEFAULT 'Some',
  has_yard BOOLEAN NOT NULL DEFAULT FALSE,
  has_kids BOOLEAN NOT NULL DEFAULT FALSE,
  open_to_special BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE favorites (
  user_id INT NOT NULL,
  pet_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, pet_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (pet_id) REFERENCES pets(pet_id) ON DELETE CASCADE
);

CREATE TABLE donations (
  donation_id INT AUTO_INCREMENT PRIMARY KEY,
  amount INT NOT NULL,
  note VARCHAR(40) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO donations (amount, note) VALUES (18500, 'demo seed');
