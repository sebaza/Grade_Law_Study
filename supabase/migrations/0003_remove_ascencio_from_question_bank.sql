-- Felipe Ascencio is no longer part of the active teaching scope.
-- Remove his raw questionnaire candidates and residual professor rows so he
-- does not appear in admin/practice segmentation or future clean databases.

delete from raw_questions
where professor_name ilike '%ascencio%';

delete from professors
where name ilike '%ascencio%';
