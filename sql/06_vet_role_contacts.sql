-- Part 6: vet role, email and phone on accounts. Run once in Workbench (as root) after part5.sql.
USE pawnest;
ALTER TABLE users MODIFY role ENUM('admin','adopter','vet') NOT NULL,
                  ADD COLUMN email VARCHAR(80) NULL,
                  ADD COLUMN phone CHAR(10) NULL;
