

CREATE OR REPLACE VIEW StopsView AS
SELECT
  row_id,
  stop_id,
  stop_name,
  stop_lat,
  stop_lon,
  location_type_name,
  parent_station,
  wheelchair_status,
  status
FROM (
  SELECT
    edt.row_id,
    edt.stop_id,
    edt.stop_name,
    edt.stop_lat,
    edt.stop_lon,
    edt.location_type_name,
    edt.parent_station,
    edt.wheelchair_status,
    edt.status
  FROM EditStopTable edt
  WHERE edt.status IN ('new', 'edit', 'new edit')
  UNION ALL
  SELECT
    st.row_id,
    st.stop_id,
    st.stop_name,
    st.stop_lat,
    st.stop_lon,
    st.location_type_name,
    st.parent_station,
    st.wheelchair_status,
    '' AS status
  FROM stops st
  WHERE NOT EXISTS (
    SELECT 1
    FROM EditStopTable edt
    WHERE edt.row_id = st.row_id
      AND edt.status = 'deleted'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM EditStopTable edt
    WHERE edt.row_id = st.row_id
      AND edt.status = 'edit'
  )
) combined;
