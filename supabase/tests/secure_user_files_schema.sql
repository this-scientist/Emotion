DO $$
DECLARE
  file_content_type text;
  blocks_type text;
  mappings_type text;
  key_table_exists boolean;
BEGIN
  SELECT data_type INTO file_content_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'user_files'
    AND column_name = 'file_content';

  SELECT data_type INTO blocks_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'user_files'
    AND column_name = 'blocks_data';

  SELECT data_type INTO mappings_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'user_files'
    AND column_name = 'mappings_data';

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_encryption_keys'
  ) INTO key_table_exists;

  IF file_content_type <> 'jsonb' THEN
    RAISE EXCEPTION 'expected user_files.file_content to be jsonb, got %', file_content_type;
  END IF;

  IF blocks_type <> 'jsonb' THEN
    RAISE EXCEPTION 'expected user_files.blocks_data to be jsonb, got %', blocks_type;
  END IF;

  IF mappings_type <> 'jsonb' THEN
    RAISE EXCEPTION 'expected user_files.mappings_data to be jsonb, got %', mappings_type;
  END IF;

  IF NOT key_table_exists THEN
    RAISE EXCEPTION 'expected public.user_encryption_keys to exist';
  END IF;
END $$;
