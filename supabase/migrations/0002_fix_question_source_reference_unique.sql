drop index if exists questions_source_reference_uidx;

create unique index questions_source_reference_uidx
on questions(source_reference);
