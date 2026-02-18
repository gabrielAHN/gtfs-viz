import {
    insertTableRow, editTableRow, editNewTableRow,
    deleteEditRow, truncateTable
} from "@/lib/duckdb/DataEditing/insertData";
import { logger } from "@/lib/logger";

export const mutationEditStationFn = async ({conn, formData, SelectStation}) => {
    if ( SelectStation.status === '') {
        editTableRow({
            conn,
            table: "EditStopTable",
            column: 'row_id',
            formData: {
                row_id: SelectStation.row_id,
                stop_id: formData.stopId,
                stop_name: formData.name,
                wheelchair_status: formData.wheelchair || null,
                stop_lat: parseFloat(formData.lat),
                stop_lon: parseFloat(formData.lon),
                location_type_name: formData.location_type_name,
                parent_station: formData.parent_station || null,
                status: 'edit',
              }
        })
    }
    else if (
        SelectStation.status === 'new' ||
        SelectStation.status === 'new edit'
    ) {
        editNewTableRow({
            conn,
            table: "EditStopTable",
            column: 'row_id',
            old_stop: SelectStation.row_id,
            formData: {
                row_id: SelectStation.row_id,
                stop_id: formData.stopId,
                stop_name: formData.name,
                wheelchair_status: formData.wheelchair || null,
                stop_lat: parseFloat(formData.lat),
                stop_lon: parseFloat(formData.lon),
                location_type_name: formData.location_type_name,
                parent_station: formData.parent_station || null,
                status: 'new edit',
              }
        })
    }
    else if (SelectStation.status === 'edit') {
        editNewTableRow({
            conn,
            table: "EditStopTable",
            column: 'stop_id',
            old_stop: SelectStation.stop_id,
            formData: {
                row_id: SelectStation.row_id,
                stop_id: formData.stopId,
                stop_name: formData.name,
                wheelchair_status: formData.wheelchair || null,
                stop_lat: parseFloat(formData.lat),
                stop_lon: parseFloat(formData.lon),
                location_type_name: formData.location_type_name,
                parent_station: formData.parent_station || null,
                status: 'edit',
              }
        })
    }
};

export const mutationAddStationFn = async ({conn, formData}) => {
        insertTableRow({
            conn,
            table: "EditStopTable",
            formData: {
                row_id: `edit_${formData.stopId}`,
                stop_id: formData.stopId,
                stop_name: formData.name,
                wheelchair_status: formData.wheelchair || null,
                stop_lat: parseFloat(formData.lat),
                stop_lon: parseFloat(formData.lon),
                location_type_name: formData.location_type_name,
                parent_station: formData.parent_station || null,
                status: 'new'
            }
        });
    };

export const mutationExportFn = async ({conn, mutateType, SelectStation, TableName}) => {
    if (mutateType === 'row') {
        deleteEditRow({
            conn,
            table: TableName,
            formData: {
                stop_id: SelectStation.stop_id
            }
        })
    }
    if (mutateType === 'table') {
        truncateTable({
            conn,
            table: TableName
        })
    } 
}

export const mutationUpgradeToStationFn = async ({conn, SelectStation}) => {

    if (SelectStation?.location_type_name !== 'Stop') {
        throw new Error(`Only stops with type 'Stop' can be upgraded to stations. Current type: ${SelectStation?.location_type_name}`);
    }

    if (!SelectStation?.stop_lat || !SelectStation?.stop_lon) {
        throw new Error('Stop must have valid coordinates (latitude and longitude) to be upgraded');
    }

    if (SelectStation?.status === 'new edit' || SelectStation?.status === 'new') {
        editNewTableRow({
            conn,
            table: "EditStopTable",
            column: 'row_id',
            old_stop: SelectStation.row_id,
            formData: {
                row_id: SelectStation.row_id,
                stop_id: SelectStation.stop_id,
                stop_name: SelectStation.stop_name,
                wheelchair_status: SelectStation.wheelchair_status,
                stop_lat: SelectStation.stop_lat,
                stop_lon: SelectStation.stop_lon,
                location_type_name: 'Station',
                parent_station: null, 
                status: SelectStation.status,
            }
        })
    }
    else if (SelectStation?.status === 'edit') {
        try {
            
            const originalQuery = `
                SELECT * FROM StopsView
                WHERE stop_id = '${SelectStation.stop_id}' AND status = ''
            `;
            const originalResult = await conn.query(originalQuery).then(result =>
                result.toArray().map((row: any) => row.toJSON())
            );

            if (originalResult.length > 0) {
                const original = originalResult[0];

                const normalizeParent = (val: any) => {
                    if (val === null || val === '' || val === undefined) return null;
                    return val;
                };

                const matchesOriginal =
                    original.stop_name === SelectStation.stop_name &&
                    original.wheelchair_status === SelectStation.wheelchair_status &&
                    parseFloat(original.stop_lat) === parseFloat(SelectStation.stop_lat) &&
                    parseFloat(original.stop_lon) === parseFloat(SelectStation.stop_lon) &&
                    original.location_type_name === 'Station' &&
                    normalizeParent(original.parent_station) === null;

                if (matchesOriginal) {
                    
                    deleteEditRow({
                        conn,
                        table: "EditStopTable",
                        formData: {
                            stop_id: SelectStation.stop_id
                        }
                    });
                    return;
                }
            }
        } catch (error) {
            
            logger.warn('Could not check original state, proceeding with edit:', error);
        }

        editNewTableRow({
            conn,
            table: "EditStopTable",
            old_stop: SelectStation.row_id,
            column: 'row_id',
            formData: {
                row_id: SelectStation.row_id,
                stop_id: SelectStation.stop_id,
                stop_name: SelectStation.stop_name,
                wheelchair_status: SelectStation.wheelchair_status,
                stop_lat: SelectStation.stop_lat,
                stop_lon: SelectStation.stop_lon,
                location_type_name: 'Station',
                parent_station: null,
                status: 'edit',
            }
        })
    }
    else if (SelectStation.status === '') {
        editTableRow({
            conn,
            table: "EditStopTable",
            column: 'row_id',
            formData: {
                row_id: SelectStation.row_id,
                stop_id: SelectStation.stop_id,
                stop_name: SelectStation.stop_name,
                wheelchair_status: SelectStation.wheelchair_status || null,
                stop_lat: SelectStation.stop_lat,
                stop_lon: SelectStation.stop_lon,
                location_type_name: 'Station',
                parent_station: null,
                status: 'edit',
            }
        })
    }
};

export const mutationDowngradeToStopFn = async ({conn, SelectStation}) => {

    if (SelectStation?.location_type_name !== 'Station') {
        throw new Error(`Only stations with type 'Station' can be downgraded to stops. Current type: ${SelectStation?.location_type_name}`);
    }

    if (!SelectStation?.stop_lat || !SelectStation?.stop_lon) {
        throw new Error('Station must have valid coordinates (latitude and longitude) to be downgraded');
    }

    const childStopsQuery = `
        SELECT * FROM StopsView
        WHERE parent_station = '${SelectStation.stop_id}'
    `;
    const childStops = await conn.query(childStopsQuery).then(result =>
        result.toArray().map((row: any) => row.toJSON())
    );

    for (const child of childStops) {

        if (!child.stop_lat || !child.stop_lon) {
            logger.warn(`Skipping child stop ${child.stop_id} - missing coordinates`);
            continue;
        }

        if (child.status === 'new edit' || child.status === 'new') {
            editNewTableRow({
                conn,
                table: "EditStopTable",
                column: 'row_id',
                old_stop: child.row_id,
                formData: {
                    row_id: child.row_id,
                    stop_id: child.stop_id,
                    stop_name: child.stop_name,
                    wheelchair_status: child.wheelchair_status,
                    stop_lat: child.stop_lat,
                    stop_lon: child.stop_lon,
                    location_type_name: child.location_type_name,
                    parent_station: null, 
                    status: child.status,
                }
            })
        }
        else if (child.status === 'edit') {
            try {
                
                const originalChildQuery = `
                    SELECT * FROM StopsView
                    WHERE stop_id = '${child.stop_id}' AND status = ''
                `;
                const originalChildResult = await conn.query(originalChildQuery).then(result =>
                    result.toArray().map((row: any) => row.toJSON())
                );

                if (originalChildResult.length > 0) {
                    const originalChild = originalChildResult[0];
                    const normalizeParent = (val: any) => {
                        if (val === null || val === '' || val === undefined) return null;
                        return val;
                    };

                    const matchesOriginal =
                        originalChild.stop_name === child.stop_name &&
                        originalChild.wheelchair_status === child.wheelchair_status &&
                        parseFloat(originalChild.stop_lat) === parseFloat(child.stop_lat) &&
                        parseFloat(originalChild.stop_lon) === parseFloat(child.stop_lon) &&
                        originalChild.location_type_name === child.location_type_name &&
                        normalizeParent(originalChild.parent_station) === null;

                    if (matchesOriginal) {
                        
                        deleteEditRow({
                            conn,
                            table: "EditStopTable",
                            formData: {
                                stop_id: child.stop_id
                            }
                        });
                        continue; 
                    }
                }
            } catch (error) {
                
                logger.warn('Could not check child original state, proceeding with edit:', error);
            }

            editNewTableRow({
                conn,
                table: "EditStopTable",
                old_stop: child.row_id,
                column: 'row_id',
                formData: {
                    row_id: child.row_id,
                    stop_id: child.stop_id,
                    stop_name: child.stop_name,
                    wheelchair_status: child.wheelchair_status,
                    stop_lat: child.stop_lat,
                    stop_lon: child.stop_lon,
                    location_type_name: child.location_type_name,
                    parent_station: null,
                    status: 'edit',
                }
            })
        }
        else if (child.status === '') {
            editTableRow({
                conn,
                table: "EditStopTable",
                column: 'row_id',
                formData: {
                    row_id: child.row_id,
                    stop_id: child.stop_id,
                    stop_name: child.stop_name,
                    wheelchair_status: child.wheelchair_status || null,
                    stop_lat: child.stop_lat,
                    stop_lon: child.stop_lon,
                    location_type_name: child.location_type_name,
                    parent_station: null,
                    status: 'edit',
                }
            })
        }
    }

    if (SelectStation?.status === 'new edit' || SelectStation?.status === 'new') {
        editNewTableRow({
            conn,
            table: "EditStopTable",
            column: 'row_id',
            old_stop: SelectStation.row_id,
            formData: {
                row_id: SelectStation.row_id,
                stop_id: SelectStation.stop_id,
                stop_name: SelectStation.stop_name,
                wheelchair_status: SelectStation.wheelchair_status,
                stop_lat: SelectStation.stop_lat,
                stop_lon: SelectStation.stop_lon,
                location_type_name: 'Stop',
                parent_station: null,
                status: SelectStation.status,
            }
        })
    }
    else if (SelectStation?.status === 'edit') {
        try {
            
            const originalQuery = `
                SELECT * FROM StopsView
                WHERE stop_id = '${SelectStation.stop_id}' AND status = ''
            `;
            const originalResult = await conn.query(originalQuery).then(result =>
                result.toArray().map((row: any) => row.toJSON())
            );

            if (originalResult.length > 0) {
                const original = originalResult[0];

                const normalizeParent = (val: any) => {
                    if (val === null || val === '' || val === undefined) return null;
                    return val;
                };

                const matchesOriginal =
                    original.stop_name === SelectStation.stop_name &&
                    original.wheelchair_status === SelectStation.wheelchair_status &&
                    parseFloat(original.stop_lat) === parseFloat(SelectStation.stop_lat) &&
                    parseFloat(original.stop_lon) === parseFloat(SelectStation.stop_lon) &&
                    (original.location_type_name === 'Stop' || original.location_type_name === 'Platform' ||
                     original.location_type_name === 'Entrance/Exit' || original.location_type_name === 'Generic Node' ||
                     original.location_type_name === 'Boarding Area') &&
                    normalizeParent(original.parent_station) === null;

                if (matchesOriginal) {
                    
                    deleteEditRow({
                        conn,
                        table: "EditStopTable",
                        formData: {
                            stop_id: SelectStation.stop_id
                        }
                    });
                    return;
                }
            }
        } catch (error) {
            
            logger.warn('Could not check original state for downgrade, proceeding with edit:', error);
        }

        editNewTableRow({
            conn,
            table: "EditStopTable",
            old_stop: SelectStation.row_id,
            column: 'row_id',
            formData: {
                row_id: SelectStation.row_id,
                stop_id: SelectStation.stop_id,
                stop_name: SelectStation.stop_name,
                wheelchair_status: SelectStation.wheelchair_status,
                stop_lat: SelectStation.stop_lat,
                stop_lon: SelectStation.stop_lon,
                location_type_name: 'Stop',
                parent_station: null,
                status: 'edit',
            }
        })
    }
    else if (SelectStation.status === '') {
        editTableRow({
            conn,
            table: "EditStopTable",
            column: 'row_id',
            formData: {
                row_id: SelectStation.row_id,
                stop_id: SelectStation.stop_id,
                stop_name: SelectStation.stop_name,
                wheelchair_status: SelectStation.wheelchair_status || null,
                stop_lat: SelectStation.stop_lat,
                stop_lon: SelectStation.stop_lon,
                location_type_name: 'Stop',
                parent_station: null,
                status: 'edit',
            }
        })
    }
};

export const mutationDeleteStationFn = async ({conn, SelectStation}) => {

    if (!SelectStation?.stop_lat || !SelectStation?.stop_lon) {
        throw new Error('Stop/Station must have valid coordinates to be deleted');
    }

    const platformsQuery = `
        SELECT * FROM StopsView
        WHERE parent_station = '${SelectStation.stop_id}'
    `;
    const platforms = await conn.query(platformsQuery).then(result =>
        result.toArray().map((row: any) => row.toJSON())
    );

    if (SelectStation?.status === 'new edit') {
        
        deleteEditRow({
            conn,
            table: "EditStopTable",
            formData: {
                stop_id: SelectStation.stop_id
            }
        })
    }
    else if (SelectStation?.status === 'new') {
        
        deleteEditRow({
            conn,
            table: "EditStopTable",
            formData: {
                stop_id: SelectStation.stop_id
            }
        })
    }
    else if (SelectStation?.status === 'edit') {
        
        deleteEditRow({
            conn,
            table: "EditStopTable",
            formData: {
                stop_id: SelectStation.stop_id
            }
        })

        const originalQuery = `
            SELECT * FROM stops
            WHERE stop_id = '${SelectStation.stop_id}'
        `;
        const originalResult = await conn.query(originalQuery).then(result =>
            result.toArray().map((row: any) => row.toJSON())
        );

        if (originalResult.length > 0) {
            
            const original = originalResult[0];
            insertTableRow({
                conn,
                table: "EditStopTable",
                formData: {
                    row_id: SelectStation.row_id,
                    stop_id: original.stop_id,
                    stop_name: original.stop_name,
                    wheelchair_status: original.wheelchair_boarding || null,
                    stop_lat: original.stop_lat,
                    stop_lon: original.stop_lon,
                    location_type_name: original.location_type,
                    parent_station: original.parent_station || null,
                    status: 'deleted',
                }
            })
        }
    }
    else if (SelectStation.status === '') {
        
        insertTableRow({
            conn,
            table: "EditStopTable",
            formData: {
                row_id: SelectStation.row_id,
                stop_id: SelectStation.stop_id,
                stop_name: SelectStation.stop_name,
                wheelchair_status: SelectStation.wheelchair_status || null,
                stop_lat: SelectStation.stop_lat,
                stop_lon: SelectStation.stop_lon,
                location_type_name: SelectStation.location_type_name,
                parent_station: SelectStation.parent_station || null,
                status: 'deleted',
            }
        })
    }

    for (const platform of platforms) {

        if (!platform.stop_lat || !platform.stop_lon) {
            logger.warn(`Skipping platform ${platform.stop_id} - missing coordinates`);
            continue;
        }

        if (platform.status === 'new edit' || platform.status === 'new') {
            
            deleteEditRow({
                conn,
                table: "EditStopTable",
                formData: {
                    stop_id: platform.stop_id
                }
            })
        }
        else if (platform.status === 'edit') {
            
            deleteEditRow({
                conn,
                table: "EditStopTable",
                formData: {
                    stop_id: platform.stop_id
                }
            })

            const originalPlatformQuery = `
                SELECT * FROM stops
                WHERE stop_id = '${platform.stop_id}'
            `;
            const originalPlatformResult = await conn.query(originalPlatformQuery).then(result =>
                result.toArray().map((row: any) => row.toJSON())
            );

            if (originalPlatformResult.length > 0) {
                
                const original = originalPlatformResult[0];
                insertTableRow({
                    conn,
                    table: "EditStopTable",
                    formData: {
                        row_id: platform.row_id,
                        stop_id: original.stop_id,
                        stop_name: original.stop_name,
                        wheelchair_status: original.wheelchair_boarding || null,
                        stop_lat: original.stop_lat,
                        stop_lon: original.stop_lon,
                        location_type_name: original.location_type,
                        parent_station: original.parent_station || null,
                        status: 'deleted',
                    }
                })
            }
        }
        else if (platform.status === '') {
            
            insertTableRow({
                conn,
                table: "EditStopTable",
                formData: {
                    row_id: platform.row_id,
                    stop_id: platform.stop_id,
                    stop_name: platform.stop_name,
                    wheelchair_status: platform.wheelchair_status || null,
                    stop_lat: platform.stop_lat,
                    stop_lon: platform.stop_lon,
                    location_type_name: platform.location_type_name,
                    parent_station: platform.parent_station || null,
                    status: 'deleted',
                }
            })
        }
    }
};
