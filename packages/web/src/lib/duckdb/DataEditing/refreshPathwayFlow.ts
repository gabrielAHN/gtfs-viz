import type { QueryClient } from '@tanstack/react-query';

import {
  createEditPathwayTable,
  createStationsTable,
  createStopsTable,
  recreatePathwaysView,
  recreateStopsView,
} from '@/lib/extensions';

export const refreshPathwayFlow = async ({
  conn,
  queryClient,
  refreshStops = false,
}: {
  conn: any;
  queryClient: QueryClient;
  refreshStops?: boolean;
}) => {
  if (conn) {
    if (refreshStops) {
      await recreateStopsView(conn);
      await createStationsTable(conn);
      await createStopsTable(conn);
    }

    await createEditPathwayTable(conn);
    await recreatePathwaysView(conn);
  }

  if (refreshStops) {
    await queryClient.invalidateQueries({
      queryKey: ['EditStopTable'],
      refetchType: 'all',
    });
    await queryClient.invalidateQueries({
      queryKey: ['fetchStationInfoData'],
      refetchType: 'all',
    });
    await queryClient.invalidateQueries({
      queryKey: ['fetchStationsData'],
      refetchType: 'all',
    });
    await queryClient.invalidateQueries({
      queryKey: ['fetchStopsData'],
      refetchType: 'all',
    });
  }

  await queryClient.invalidateQueries({
    queryKey: ['EditPathwayTable'],
    refetchType: 'all',
  });
  await queryClient.invalidateQueries({
    queryKey: ['fetchRouteData'],
    refetchType: 'all',
  });
  await queryClient.invalidateQueries({
    queryKey: ['stationPathwaysComplete'],
    refetchType: 'all',
  });
  await queryClient.refetchQueries({
    queryKey: ['stationPathwaysComplete'],
    type: 'all',
  });
};
