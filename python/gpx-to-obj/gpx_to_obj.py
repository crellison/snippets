from gpxpy.gpx import GPX, GPXTrackPoint
from itertools import pairwise
from pyproj import Geod
import gpxpy
import math

from dataclasses import dataclass
from typing import Sequence, Tuple, List
import json

geod = Geod(ellps="WGS84")


def move_point(point: tuple[float, float], angle: float, distance: float):
    x, y = point
    dx = math.sin(angle) * distance
    dy = math.cos(angle) * distance
    return (x + dx, y + dy)


@dataclass
class GPXConfig:
    """Configuration parameters for GPX to OBJ conversion.

    Object files have no intrinsic units.
    All configuration parameters are assumed to be in meters relative to the provided GPX file.
    """

    elevation_multiplier: float = 1.0
    smoothing_interval: float = 10.0
    base_height: float = 1.0
    path_width: float = 5.0


def parse_gpx_config(config: str) -> GPXConfig:
    """Parse a configuration string (JSON) into a GPXConfig object."""
    return GPXConfig(**json.loads(config))


def get_angle_and_distance(
    from_point: GPXTrackPoint, to_point: GPXTrackPoint
) -> Tuple[float, float]:
    """
    Calculate angle and distance between two GPX points.

    Returns:
        Tuple of (angle_in_radians, distance_in_meters)
    """
    bearing, _, distance = geod.inv(
        from_point.longitude, from_point.latitude, to_point.longitude, to_point.latitude
    )
    return math.radians(-90 - bearing), distance


class GPXtoOBJ:
    """Converts GPX tracks to 3D OBJ files by extruding the path into a 3D mesh."""

    def __init__(self, config: GPXConfig = None):
        self.config = config or GPXConfig()

    def run(self, gpx_file_path: str, obj_file_path: str) -> None:
        """
        Convert a GPX file to an OBJ file.

        Args:
            gpx_file_path: Path to input GPX file
            obj_file_path: Path to output OBJ file

        Raises:
            ValueError: If GPX file format is invalid
        """
        with open(gpx_file_path, "r") as gpx_file:
            gpx_obj = gpxpy.parse(gpx_file)
            self._convert_gpx_to_obj(gpx_obj, obj_file_path)

    def _get_track_points(self, gpx_obj: GPX) -> Sequence[GPXTrackPoint]:
        """Extract and filter track points from GPX object."""
        if len(gpx_obj.tracks) != 1:
            raise ValueError("Expected exactly one track in GPX file")

        track = gpx_obj.tracks[0]
        if len(track.segments) != 1:
            raise ValueError("Expected exactly one segment in track")

        segment = track.segments[0]
        if len(segment.points) < 2:
            raise ValueError("Expected at least two points in segment")

        points = [segment.points[0]]

        for i in range(1, len(segment.points)):
            _, distance = get_angle_and_distance(points[-1], segment.points[i])
            if distance > self.config.smoothing_interval:
                points.append(segment.points[i])

        return points

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
    ) -> List[Tuple[int, int, int, int]]:
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
        polygons = (
            [(1, 2, 3, 4)]  # first quadrilateral to close the opening
            + list(  # top, bottom, left, and right walls
                (i + (j + 1) % 4, i + j, i + 4 + j, i + 4 + (j + 1) % 4)
                for i in range(0, vertex_count - 8, 4)
                for j in range(1, 5)
            )
            + [
                (vertex_count - 3, vertex_count - 2, vertex_count - 1, vertex_count)
            ]  # last quadrilateral to close the opening
        )
        return polygons

    def _convert_gpx_to_obj(self, gpx_obj: GPX, obj_file_path: str) -> None:
        """Convert GPX data to OBJ format and write to file.

        The OBJ file written has the start of the GPX track at the (0,0,0) position
        """
        points = self._get_track_points(gpx_obj)
        min_elevation = min(point.elevation for point in points)
        current_location = (0, 0)

        vertices = []  # of (x, y, z)
        for from_point, to_point in pairwise(points):
            angle, distance = get_angle_and_distance(from_point, to_point)
            elevation = (
                self.config.base_height
                + (from_point.elevation - min_elevation)
                * self.config.elevation_multiplier
            )
            vertices.extend(
                self._get_vertices_for_point(current_location, angle, elevation)
            )
            current_location = move_point(current_location, angle, distance)

        polygons = self._get_polygons_for_vertices(len(vertices))

        with open(obj_file_path, "w") as obj_file:
            obj_file.write("o obj_0\n")
            for vertex in vertices:
                obj_file.write(f"v {vertex[0]} {vertex[1]} {vertex[2]}\n")
            obj_file.write("\n")
            for polygon in polygons:
                obj_file.write(
                    f"f {polygon[0]} {polygon[1]} {polygon[2]} {polygon[3]}\n"
                )
