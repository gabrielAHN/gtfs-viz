

-- Note: This procedure only imports the raw data. Reformatting with computed

CREATE OR REPLACE TABLE stops AS
SELECT * FROM read_csv(
  'stops.txt',
  delim = ',',
  header = true,
  auto_detect = true,
  ignore_errors = true,
  max_line_size = 2097152
);

CREATE OR REPLACE TABLE pathways AS
SELECT * FROM read_csv(
  'pathways.txt',
  delim = ',',
  header = true,
  auto_detect = true,
  ignore_errors = true,
  max_line_size = 2097152
);
