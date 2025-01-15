from itertools import pairwise
from pyproj import Geod
import math
from dataclasses import dataclass
from typing import Tuple, List
import json

from write_obj_file import ObjFile
from gps_track import GPSTrack, GPSTrackSegment, GPSPoint

geod = Geod(ellps="WGS84")


def move_point(point: tuple[float, float], angle: float, distance: float):
    x, y = point
    dx = math.sin(angle) * distance
    dy = math.cos(angle) * distance
    return (x + dx, y + dy)


@dataclass
class GPSTrackConfig:
    """Configuration parameters for GPX to OBJ conversion.

    Object files have no intrinsic units.
    All configuration parameters are assumed to be in meters relative to the provided GPX file.
    """

    elevation_multiplier: float = 1.0
    smoothing_interval: float = 10.0
    base_height: float = 1.0
    path_width: float = 5.0

    @classmethod
    def parse_gps_track_config(cls, config: str) -> "GPSTrackConfig":
        """Parse a configuration string (JSON) into a GPSTrackConfig object."""
        return cls(**json.loads(config))


class GPSTrackToOBJ:
    """Converts GPS tracks to 3D OBJ files by extruding the path into a 3D mesh."""

    def __init__(self, config: GPSTrackConfig = None):
        self.config = config or GPSTrackConfig()

    def run(self, gps_track: GPSTrack, obj_file_path: str) -> None:
        """
        Convert a GPS track to an OBJ file.

        Args:
            gps_track: GPS track to convert
            obj_file_path: Path to output OBJ file

        Raises:
            ValueError: If GPX file format is invalid
        """
        global_origin = gps_track.segments[0].points[0]
        segment_offset = 0
        min_elevation = gps_track.min_elevation()
        obj_file = ObjFile([], [])
        for segment in gps_track.segments:
            filtered_segment = segment.filter_by_smoothing_interval(
                self.config.smoothing_interval
            )
            vertices_for_segment = self._get_vertices_for_segment(
                filtered_segment, global_origin, min_elevation
            )
            obj_file.add_vertices(vertices_for_segment)
            polygons_for_segment = self._get_polygons_for_vertices(
                len(vertices_for_segment), segment_offset
            )
            obj_file.add_polygons(polygons_for_segment)
            segment_offset += len(vertices_for_segment)

        obj_file.write_to_file(obj_file_path)

    def _get_vertices_for_segment(
        self, segment: GPSTrackSegment, global_origin: GPSPoint, min_elevation: float
    ) -> List[Tuple[float, float, float]]:
        vertices = []
        for from_point, to_point in pairwise(segment.points):
            angle, _ = from_point.angle_and_distance_to(to_point)
            elevation = (
                self.config.base_height
                + (from_point.elevation - min_elevation)
                * self.config.elevation_multiplier
            )
            angle_to_origin, distance_to_origin = global_origin.angle_and_distance_to(
                from_point
            )
            location = move_point((0, 0), angle_to_origin, distance_to_origin)
            vertices.extend(self._get_vertices_for_point(location, angle, elevation))
        return vertices

    def _get_vertices_for_point(
        self, location: Tuple[float, float], angle: float, elevation: float
    ) -> List[Tuple[float, float, float]]:
        """
        Generate vertices for a single point in the track.

        Creates a rectangular cross-section perpendicular to the track direction.
        """
        x, y = location
        half_width = self.config.path_width / 2
        dx = math.cos(angle) * half_width
        dy = math.sin(angle) * half_width * -1

        return [
            (x + dx, y + dy, 0),
            (x + dx, y + dy, elevation),
            (x - dx, y - dy, elevation),
            (x - dx, y - dy, 0),
        ]

    def _get_polygons_for_vertices(
        self,
        vertex_count: int,
        segment_offset: int,
    ) -> List[List[int]]:
        """
        Generate polygon indices for the extrusion of the path.

        Since each point generates 4 vertices, connecting two points requires 4 shapes.
        This forms the sequential extrusion of the path, which ends up looking like a
        series of cardboard boxes of different sizes and tapers all taped to each other.

        Args:
            vertex_count: Total number of vertices in the mesh

        Returns:
            List of 4-tuples containing vertex indices (1-based for OBJ format)
        """
        polygons = [
            [i + segment_offset for i in vertex_list]
            for vertex_list in (
                [[1, 2, 3, 4]]  # first quadrilateral to close the opening
                + list(  # top, bottom, left, and right walls
                    [
                        i + (j + 1) % 4,
                        i + j,
                        i + 4 + j,
                        i + 4 + (j + 1) % 4,
                    ]
                    for i in range(0, vertex_count - 8, 4)
                    for j in range(1, 5)
                )
                + [
                    [vertex_count - 3, vertex_count - 2, vertex_count - 1, vertex_count]
                ]  # last quadrilateral to close the opening
            )
        ]
        return polygons
