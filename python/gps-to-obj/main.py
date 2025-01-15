import typer
from typing_extensions import Annotated
from os import path
import glob

from gps_to_obj import GPSTrackToOBJ, GPSTrackConfig
from gps_track import GPSTrack


def main(
    gps_file_path: str,
    out_dir: str = path.join(".", "output"),
    config: Annotated[
        GPSTrackConfig,
        typer.Option(
            help="Configuration parameters for GPX to OBJ conversion (as JSON)",
            parser=GPSTrackConfig.parse_gps_track_config,
        ),
    ] = None,
) -> None:
    """
    Convert a GPS data file (GPX or FIT) to a 3D OBJ mesh file.

    Args:
        gps_file_path: Path to input GPS file or directory containing GPS files
        out_dir: Directory to write output files
        config: Optional configuration parameters
    """

    glob_patterns = (
        [gps_file_path]
        if path.isfile(gps_file_path)
        else [path.join(gps_file_path, "**", f"*.{ext}") for ext in ["gpx", "fit"]]
    )

    converter = GPSTrackToOBJ(config)
    for p in glob_patterns:
        for file_name_match in glob.glob(p, recursive=True):
            print(f"Processing {file_name_match}")
            gps_track = GPSTrack.from_file(file_name_match)
            if len(gps_track) == 0:
                print(f"Skipping {file_name_match} because it has no valid points")
                continue
            converter.run(
                gps_track,
                path.join(out_dir, path.basename(file_name_match) + ".obj"),
            )


if __name__ == "__main__":
    typer.run(main)
