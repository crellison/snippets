import gpxpy
import fitparse
from dataclasses import dataclass
import math
from typing import Tuple
from pyproj import Geod

geod = Geod(ellps="WGS84")


@dataclass
class GPSPoint:
    latitude: float  # in degrees
    longitude: float  # in degrees
    elevation: float  # in meters

    def is_valid(self) -> bool:
        return (
            self.latitude is not None
            and self.longitude is not None
            and self.elevation is not None
        )

    def angle_and_distance_to(self, other: "GPSPoint") -> Tuple[float, float]:
        """
        Calculate angle and distance between two GPX points.

        Returns:
            Tuple of (angle_in_radians, distance_in_meters)
        """
        bearing, _, distance = geod.inv(
            self.longitude, self.latitude, other.longitude, other.latitude
        )
        return math.radians(-90 - bearing), distance


@dataclass
class GPSTrackSegment:
    points: list[GPSPoint]

    def __len__(self) -> int:
        return len(self.points)

    def min_elevation(self) -> float:
        return min(point.elevation for point in self.points)

    def filter_by_smoothing_interval(
        self, smoothing_interval: float
    ) -> "GPSTrackSegment":
        points = [self.points[0]]
        for i in range(1, len(self.points)):
            _, distance = points[-1].angle_and_distance_to(self.points[i])
            if distance > smoothing_interval:
                points.append(self.points[i])
        return GPSTrackSegment(points=points)


@dataclass
class GPSTrack:
    # a GPS track is a list of segments. This allows for composite paths for a single track
    segments: list[GPSTrackSegment]

    def min_elevation(self) -> float:
        return min(segment.min_elevation() for segment in self.segments)

    def __len__(self) -> int:
        return sum(len(segment) for segment in self.segments)

    @classmethod
    def from_file(cls, file_path: str) -> "GPSTrack":
        if file_path.endswith(".gpx"):
            return cls.from_gpx(file_path)
        elif file_path.endswith(".fit"):
            return cls.from_fit(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_path}")

    @classmethod
    def from_gpx(cls, file_path: str) -> "GPSTrack":
        segments = []
        with open(file_path, "r") as gpx_file:
            gpx_obj = gpxpy.parse(gpx_file)
            for track in gpx_obj.tracks:
                for segment in track.segments:
                    segment = GPSTrackSegment(
                        points=[
                            GPSPoint(
                                latitude=point.latitude,
                                longitude=point.longitude,
                                elevation=point.elevation,
                            )
                            for point in segment.points
                        ]
                    )
                    segments.append(segment)
            return GPSTrack(segments=segments)

    @classmethod
    def from_fit(cls, file_path: str) -> "GPSTrack":
        segment = GPSTrackSegment(points=[])
        fit_file = fitparse.FitFile(file_path)
        for record in fit_file.get_messages("record"):
            # convert from fit's 32-bit integer representation (semicircles) to degrees
            lat = record.get_value("position_lat")
            long = record.get_value("position_long")
            elev = record.get("enhanced_altitude", as_dict=True)
            if lat is None or long is None or elev is None or elev["units"] != "m":
                # skip points without all required fields
                continue
            point = GPSPoint(
                latitude=lat * (180 / 2**31),
                longitude=long * (180 / 2**31),
                elevation=elev["value"],
            )
            segment.points.append(point)
        return GPSTrack(segments=[segment])
