-- Makes generated/normalized questions idempotent by source reference.
create unique index if not exists questions_source_reference_uidx
  on questions(source_reference)
  where source_reference is not null;
