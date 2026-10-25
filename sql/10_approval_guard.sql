-- 10: concurrency fix for sp_approve_application. Run once in Workbench (as root) after 08.
-- Before: if two admins approved competing applications at the same moment, the slower one could still approve
-- an application that had just been rejected. Now the procedure refuses to touch an application that is not open.
USE pawnest;
DELIMITER $$
DROP PROCEDURE IF EXISTS sp_approve_application$$
CREATE PROCEDURE sp_approve_application(IN p_app INT)
BEGIN
  DECLARE v_pet INT DEFAULT NULL;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  START TRANSACTION;
  -- FOR UPDATE locks this row, so a second admin waits here until the first transaction finishes
  SELECT pet_id INTO v_pet FROM applications WHERE application_id = p_app AND status = 'Submitted' FOR UPDATE;
  IF v_pet IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This application is already closed';
  END IF;
  UPDATE applications SET status = 'Approved', stage = 4 WHERE application_id = p_app;
  UPDATE applications SET status = 'Rejected' WHERE pet_id = v_pet AND application_id <> p_app AND status = 'Submitted';
  UPDATE pets SET status = 'Adopted' WHERE pet_id = v_pet;
  INSERT INTO followups (application_id, days_after, due_date)
    SELECT p_app, d.n, CURDATE() + INTERVAL d.n DAY FROM (SELECT 7 AS n UNION SELECT 30 UNION SELECT 90) d;
  COMMIT;
END$$
DELIMITER ;
