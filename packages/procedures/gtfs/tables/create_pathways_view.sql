

CREATE OR REPLACE VIEW PathwaysView AS
SELECT
  row_id,
  pathway_id,
  from_stop_id,
  to_stop_id,
  pathway_mode,
  is_bidirectional,
  length,
  traversal_time,
  stair_count,
  max_slope,
  min_width,
  signposted_as,
  reversed_signposted_as,
  pathway_mode_name,
  direction_type,
  status
FROM (
  -- Edited or new pathways from EditPathwayTable
  SELECT
    edt.row_id,
    edt.pathway_id,
    edt.from_stop_id,
    edt.to_stop_id,
    edt.pathway_mode,
    edt.is_bidirectional,
    edt.length,
    edt.traversal_time,
    edt.stair_count,
    edt.max_slope,
    edt.min_width,
    edt.signposted_as,
    edt.reversed_signposted_as,
    pathway_mode_to_name(edt.pathway_mode) AS pathway_mode_name,
    bidirectional_to_direction(edt.is_bidirectional) AS direction_type,
    edt.status
  FROM EditPathwayTable edt
  WHERE edt.status IN ('new', 'edit', 'new edit')

  UNION ALL

  -- Original pathways from pathways table
  SELECT
    pt.row_id,
    pt.pathway_id,
    pt.from_stop_id,
    pt.to_stop_id,
    pt.pathway_mode,
    pt.is_bidirectional,
    pt.length,
    pt.traversal_time,
    pt.stair_count,
    pt.max_slope,
    pt.min_width,
    pt.signposted_as,
    pt.reversed_signposted_as,
    pt.pathway_mode_name,
    pt.direction_type,
    '' AS status
  FROM pathways pt
  WHERE NOT EXISTS (
    SELECT 1
    FROM EditPathwayTable edt
    WHERE edt.row_id = pt.row_id
      AND edt.status = 'deleted'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM EditPathwayTable edt
    WHERE edt.row_id = pt.row_id
      AND edt.status = 'edit'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM EditPathwayTable edt
    WHERE edt.pathway_id = pt.pathway_id
      AND edt.status = 'new edit'
  )
) combined;
